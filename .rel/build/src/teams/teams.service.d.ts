import { Repository } from 'typeorm';
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
export declare class TeamsService {
    private readonly teamRepo;
    private readonly memberRepo;
    constructor(teamRepo: Repository<Team>, memberRepo: Repository<TeamMember>);
    listTeams(viewAll: boolean, userId?: string): Promise<TeamSummary[]>;
    getTeam(id: string): Promise<Team>;
    createTeam(dto: CreateTeamDto): Promise<Team>;
    updateTeam(id: string, dto: UpdateTeamDto): Promise<Team>;
    getMemberUserIds(teamId: string): Promise<string[]>;
    setMembers(teamId: string, dto: SetTeamMembersDto): Promise<string[]>;
    getUserTeamIds(userId: string): Promise<string[]>;
    assertUserCanAccessTeam(userId: string, teamId: string, manageAll: boolean): Promise<void>;
    assertUserCanAccessTeams(userId: string, teamIds: string[], manageAll: boolean): Promise<void>;
    resolveAccessibleTeamIds(userId: string, manageAll: boolean, requested?: string[]): Promise<string[] | null>;
    findTeamsByIds(ids: string[]): Promise<Map<string, Team>>;
    assertListingsTeamScope(listings: Array<{
        id: string;
        teamId: string | null;
    }>, userId: string, manageAll: boolean, activeTeamFilter?: string[]): Promise<void>;
}
