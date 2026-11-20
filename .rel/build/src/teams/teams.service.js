"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const team_entity_js_1 = require("./entities/team.entity.js");
const team_member_entity_js_1 = require("./entities/team-member.entity.js");
let TeamsService = class TeamsService {
    teamRepo;
    memberRepo;
    constructor(teamRepo, memberRepo) {
        this.teamRepo = teamRepo;
        this.memberRepo = memberRepo;
    }
    async listTeams(viewAll, userId) {
        let teams;
        if (!viewAll && userId) {
            const memberships = await this.memberRepo.find({
                where: { userId },
                relations: ['team'],
            });
            teams = memberships
                .map((m) => m.team)
                .filter((t) => t?.active)
                .sort((a, b) => a.name.localeCompare(b.name));
        }
        else {
            teams = await this.teamRepo.find({
                where: { active: true },
                order: { name: 'ASC' },
            });
        }
        if (teams.length === 0)
            return [];
        const countRows = await this.memberRepo
            .createQueryBuilder('m')
            .select('m.team_id', 'teamId')
            .addSelect('COUNT(*)', 'cnt')
            .where('m.team_id IN (:...ids)', { ids: teams.map((t) => t.id) })
            .groupBy('m.team_id')
            .getRawMany();
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
    async getTeam(id) {
        const team = await this.teamRepo.findOne({ where: { id } });
        if (!team)
            throw new common_1.NotFoundException(`Team ${id} not found`);
        return team;
    }
    async createTeam(dto) {
        const existing = await this.teamRepo.findOne({ where: { name: dto.name } });
        if (existing) {
            throw new common_1.ConflictException(`Team "${dto.name}" already exists`);
        }
        return this.teamRepo.save(this.teamRepo.create({
            name: dto.name.trim(),
            color: dto.color ?? '#3B82F6',
        }));
    }
    async updateTeam(id, dto) {
        const team = await this.getTeam(id);
        if (dto.name && dto.name.trim() !== team.name) {
            const clash = await this.teamRepo.findOne({
                where: { name: dto.name.trim() },
            });
            if (clash && clash.id !== id) {
                throw new common_1.ConflictException(`Team "${dto.name}" already exists`);
            }
            team.name = dto.name.trim();
        }
        if (dto.color !== undefined)
            team.color = dto.color;
        if (dto.active !== undefined)
            team.active = dto.active;
        return this.teamRepo.save(team);
    }
    async getMemberUserIds(teamId) {
        await this.getTeam(teamId);
        const members = await this.memberRepo.find({
            where: { teamId },
            select: ['userId'],
        });
        return members.map((m) => m.userId);
    }
    async setMembers(teamId, dto) {
        await this.getTeam(teamId);
        await this.memberRepo.delete({ teamId });
        if (dto.userIds.length) {
            await this.memberRepo.save(dto.userIds.map((userId) => this.memberRepo.create({ teamId, userId })));
        }
        return dto.userIds;
    }
    async getUserTeamIds(userId) {
        const rows = await this.memberRepo.find({
            where: { userId },
            select: ['teamId'],
        });
        return rows.map((r) => r.teamId);
    }
    async assertUserCanAccessTeam(userId, teamId, manageAll) {
        if (manageAll)
            return;
        const member = await this.memberRepo.findOne({ where: { userId, teamId } });
        if (!member) {
            throw new common_1.ForbiddenException('You are not a member of this team');
        }
    }
    async assertUserCanAccessTeams(userId, teamIds, manageAll) {
        if (manageAll || teamIds.length === 0)
            return;
        const allowed = await this.getUserTeamIds(userId);
        const allowedSet = new Set(allowed);
        for (const id of teamIds) {
            if (!allowedSet.has(id)) {
                throw new common_1.ForbiddenException('You do not have access to one or more selected teams');
            }
        }
    }
    async resolveAccessibleTeamIds(userId, manageAll, requested) {
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
    async findTeamsByIds(ids) {
        if (!ids.length)
            return new Map();
        const teams = await this.teamRepo.find({ where: { id: (0, typeorm_2.In)(ids) } });
        return new Map(teams.map((t) => [t.id, t]));
    }
    async assertListingsTeamScope(listings, userId, manageAll, activeTeamFilter) {
        if (listings.length === 0)
            return;
        if (activeTeamFilter?.length) {
            const allowed = new Set(activeTeamFilter);
            for (const row of listings) {
                if (row.teamId && !allowed.has(row.teamId)) {
                    throw new common_1.ForbiddenException('One or more listings are outside the active team filter');
                }
            }
        }
        if (manageAll)
            return;
        const userTeams = new Set(await this.getUserTeamIds(userId));
        for (const row of listings) {
            if (row.teamId && !userTeams.has(row.teamId)) {
                throw new common_1.ForbiddenException('You do not have access to one or more selected listings');
            }
        }
    }
};
exports.TeamsService = TeamsService;
exports.TeamsService = TeamsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(team_entity_js_1.Team)),
    __param(1, (0, typeorm_1.InjectRepository)(team_member_entity_js_1.TeamMember)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], TeamsService);
//# sourceMappingURL=teams.service.js.map