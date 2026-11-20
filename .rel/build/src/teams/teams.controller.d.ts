import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { SetTeamMembersDto } from './dto/set-team-members.dto.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';
export declare class TeamsController {
    private readonly teamsService;
    private readonly rbac;
    constructor(teamsService: TeamsService, rbac: RbacService);
    list(user: User): Promise<{
        teams: import("./teams.service.js").TeamSummary[];
    }>;
    getMembers(id: string): Promise<{
        userIds: string[];
    }>;
    create(dto: CreateTeamDto): Promise<{
        team: import("./entities/team.entity.js").Team;
    }>;
    update(id: string, dto: UpdateTeamDto): Promise<{
        team: import("./entities/team.entity.js").Team;
    }>;
    setMembers(id: string, dto: SetTeamMembersDto): Promise<{
        userIds: string[];
    }>;
}
