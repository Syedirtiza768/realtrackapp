import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { SetTeamMembersDto } from './dto/set-team-members.dto.js';

export type TeamSummary = {
  id: string;
  name: string;
  color: string;
  active: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(TeamMember)
    private readonly memberRepo: Repository<TeamMember>,
  ) {}

  async listTeams(viewAll: boolean, userId?: string): Promise<TeamSummary[]> {
    let teams: Team[];
    if (!viewAll && userId) {
      const memberships = await this.memberRepo.find({
        where: { userId },
        relations: ['team'],
      });
      teams = memberships
        .map((m) => m.team)
        .filter((t) => t?.active)
        .sort((a, b) => a.name.localeCompare(b.name));
    } else {
      teams = await this.teamRepo.find({
        where: { active: true },
        order: { name: 'ASC' },
      });
    }

    if (teams.length === 0) return [];

    const countRows = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.team_id', 'teamId')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.team_id IN (:...ids)', { ids: teams.map((t) => t.id) })
      .groupBy('m.team_id')
      .getRawMany<{ teamId: string; cnt: string }>();

    const countByTeam = new Map(countRows.map((r) => [r.teamId, Number(r.cnt) || 0]));

    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      active: t.active,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      memberCount: countByTeam.get(t.id) ?? 0,
    }));
  }

  async getTeam(id: string): Promise<Team> {
    const team = await this.teamRepo.findOne({ where: { id } });
    if (!team) throw new NotFoundException(`Team ${id} not found`);
    return team;
  }

  async createTeam(dto: CreateTeamDto): Promise<Team> {
    const existing = await this.teamRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException(`Team "${dto.name}" already exists`);
    }
    return this.teamRepo.save(
      this.teamRepo.create({
        name: dto.name.trim(),
        color: dto.color ?? '#3B82F6',
      }),
    );
  }

  async updateTeam(id: string, dto: UpdateTeamDto): Promise<Team> {
    const team = await this.getTeam(id);
    if (dto.name && dto.name.trim() !== team.name) {
      const clash = await this.teamRepo.findOne({ where: { name: dto.name.trim() } });
      if (clash && clash.id !== id) {
        throw new ConflictException(`Team "${dto.name}" already exists`);
      }
      team.name = dto.name.trim();
    }
    if (dto.color !== undefined) team.color = dto.color;
    if (dto.active !== undefined) team.active = dto.active;
    return this.teamRepo.save(team);
  }

  async getMemberUserIds(teamId: string): Promise<string[]> {
    await this.getTeam(teamId);
    const members = await this.memberRepo.find({ where: { teamId }, select: ['userId'] });
    return members.map((m) => m.userId);
  }

  async setMembers(teamId: string, dto: SetTeamMembersDto): Promise<string[]> {
    await this.getTeam(teamId);
    await this.memberRepo.delete({ teamId });
    if (dto.userIds.length) {
      await this.memberRepo.save(
        dto.userIds.map((userId) => this.memberRepo.create({ teamId, userId })),
      );
    }
    return dto.userIds;
  }

  async getUserTeamIds(userId: string): Promise<string[]> {
    const rows = await this.memberRepo.find({
      where: { userId },
      select: ['teamId'],
    });
    return rows.map((r) => r.teamId);
  }

  async assertUserCanAccessTeam(userId: string, teamId: string, manageAll: boolean): Promise<void> {
    if (manageAll) return;
    const member = await this.memberRepo.findOne({ where: { userId, teamId } });
    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }

  async assertUserCanAccessTeams(
    userId: string,
    teamIds: string[],
    manageAll: boolean,
  ): Promise<void> {
    if (manageAll || teamIds.length === 0) return;
    const allowed = await this.getUserTeamIds(userId);
    const allowedSet = new Set(allowed);
    for (const id of teamIds) {
      if (!allowedSet.has(id)) {
        throw new ForbiddenException('You do not have access to one or more selected teams');
      }
    }
  }

  async resolveAccessibleTeamIds(
    userId: string,
    manageAll: boolean,
    requested?: string[],
  ): Promise<string[] | null> {
    if (manageAll) {
      if (requested?.length) {
        await this.assertUserCanAccessTeams(userId, requested, true);
        return requested;
      }
      return null;
    }
    const userTeams = await this.getUserTeamIds(userId);
    if (requested?.length) {
      await this.assertUserCanAccessTeams(userId, requested, false);
      return requested;
    }
    return userTeams;
  }

  async findTeamsByIds(ids: string[]): Promise<Map<string, Team>> {
    if (!ids.length) return new Map();
    const teams = await this.teamRepo.find({ where: { id: In(ids) } });
    return new Map(teams.map((t) => [t.id, t]));
  }

  /**
   * Ensures listing rows are visible under the user's team memberships and optional active filter.
   */
  async assertListingsTeamScope(
    listings: Array<{ id: string; teamId: string | null }>,
    userId: string,
    manageAll: boolean,
    activeTeamFilter?: string[],
  ): Promise<void> {
    if (listings.length === 0) return;

    if (activeTeamFilter?.length) {
      const allowed = new Set(activeTeamFilter);
      for (const row of listings) {
        if (row.teamId && !allowed.has(row.teamId)) {
          throw new ForbiddenException(
            'One or more listings are outside the active team filter',
          );
        }
      }
    }

    if (manageAll) return;

    const userTeams = new Set(await this.getUserTeamIds(userId));
    for (const row of listings) {
      if (row.teamId && !userTeams.has(row.teamId)) {
        throw new ForbiddenException('You do not have access to one or more selected listings');
      }
    }
  }
}
