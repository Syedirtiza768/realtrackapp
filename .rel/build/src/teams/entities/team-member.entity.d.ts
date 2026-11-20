import { User } from '../../auth/entities/user.entity.js';
import { Team } from './team.entity.js';
export declare class TeamMember {
    id: string;
    teamId: string;
    team: Team;
    userId: string;
    user: User;
    createdAt: Date;
}
