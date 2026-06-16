import { ForbiddenException } from '@nestjs/common';
import { Brackets, type SelectQueryBuilder } from 'typeorm';

/** Admins (users.view) see all jobs; others see own jobs + legacy unassigned rows. */
export function applyCreatedByVisibility<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  viewerId: string,
  viewAll: boolean,
): SelectQueryBuilder<T> {
  if (viewAll) return qb;
  return qb.andWhere(
    new Brackets((w) => {
      w.where(`${alias}.createdBy IS NULL`).orWhere(`${alias}.createdBy = :viewerId`, {
        viewerId,
      });
    }),
  );
}

export function canViewJob(
  createdBy: string | null,
  viewerId: string,
  viewAll: boolean,
): boolean {
  if (viewAll) return true;
  return createdBy === null || createdBy === viewerId;
}

export function assertCanAccessJob(
  createdBy: string | null,
  viewerId: string,
  viewAll: boolean,
): void {
  if (!canViewJob(createdBy, viewerId, viewAll)) {
    throw new ForbiddenException('You do not have access to this job');
  }
}

/** Preserve original creator; assign actor when legacy rows have no owner. */
export function withCreatedByBackfill(
  existing: string | null,
  actorId?: string,
): string | null {
  return existing ?? actorId ?? null;
}