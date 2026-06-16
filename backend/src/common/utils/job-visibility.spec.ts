import { Brackets, SelectQueryBuilder } from 'typeorm';
import {
  applyCreatedByVisibility,
  assertCanAccessJob,
  canViewJob,
  withCreatedByBackfill,
} from './job-visibility.js';

function mockQueryBuilder(): SelectQueryBuilder<object> & {
  andWhere: jest.Mock;
} {
  const qb = {
    andWhere: jest.fn().mockReturnThis(),
  };
  return qb as unknown as SelectQueryBuilder<object> & { andWhere: jest.Mock };
}

describe('job-visibility', () => {
  describe('canViewJob', () => {
    it('allows admins to view any job', () => {
      expect(canViewJob('other-user', 'viewer-1', true)).toBe(true);
      expect(canViewJob(null, 'viewer-1', true)).toBe(true);
    });

    it('allows viewer to see own jobs', () => {
      expect(canViewJob('viewer-1', 'viewer-1', false)).toBe(true);
    });

    it('allows viewer to see legacy unassigned jobs', () => {
      expect(canViewJob(null, 'viewer-1', false)).toBe(true);
    });

    it('denies viewer access to another users job', () => {
      expect(canViewJob('other-user', 'viewer-1', false)).toBe(false);
    });
  });

  describe('applyCreatedByVisibility', () => {
    it('does not filter when viewAll is true', () => {
      const qb = mockQueryBuilder();
      const result = applyCreatedByVisibility(qb, 'j', 'user-1', true);
      expect(qb.andWhere).not.toHaveBeenCalled();
      expect(result).toBe(qb);
    });

    it('filters to own jobs and legacy null createdBy when viewAll is false', () => {
      const qb = mockQueryBuilder();
      applyCreatedByVisibility(qb, 'j', 'user-1', false);
      expect(qb.andWhere).toHaveBeenCalledTimes(1);
      const [brackets] = qb.andWhere.mock.calls[0];
      expect(brackets).toBeInstanceOf(Brackets);
    });
  });

  describe('assertCanAccessJob', () => {
    it('throws when viewer cannot access job', () => {
      expect(() => assertCanAccessJob('other', 'viewer-1', false)).toThrow(
        'You do not have access to this job',
      );
    });

    it('allows admin without throw', () => {
      expect(() => assertCanAccessJob('other', 'admin-1', true)).not.toThrow();
    });
  });

  describe('withCreatedByBackfill', () => {
    it('keeps existing creator', () => {
      expect(withCreatedByBackfill('user-a', 'user-b')).toBe('user-a');
    });

    it('assigns actor when missing', () => {
      expect(withCreatedByBackfill(null, 'user-b')).toBe('user-b');
    });
  });
});
