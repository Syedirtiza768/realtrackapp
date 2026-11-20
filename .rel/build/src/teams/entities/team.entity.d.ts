import { TeamMember } from './team-member.entity.js';
export declare class Team {
    id: string;
    name: string;
    color: string;
    active: boolean;
    members: TeamMember[];
    createdAt: Date;
    updatedAt: Date;
}
