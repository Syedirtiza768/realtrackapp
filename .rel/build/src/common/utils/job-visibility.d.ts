import { type SelectQueryBuilder } from 'typeorm';
export declare function applyCreatedByVisibility<T extends object>(qb: SelectQueryBuilder<T>, alias: string, viewerId: string, viewAll: boolean): SelectQueryBuilder<T>;
export declare function canViewJob(createdBy: string | null, viewerId: string, viewAll: boolean): boolean;
export declare function assertCanAccessJob(createdBy: string | null, viewerId: string, viewAll: boolean): void;
export declare function withCreatedByBackfill(existing: string | null, actorId?: string): string | null;
