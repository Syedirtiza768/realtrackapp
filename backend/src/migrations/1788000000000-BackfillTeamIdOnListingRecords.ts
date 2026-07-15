import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfill `team_id` on `listing_records` from the associated `pipeline_jobs`
 * row. This fixes the issue where batch CSV imports never propagated the team
 * from the pipeline job to the listing record.
 *
 * Only updates rows where:
 *   - pipeline_job_id IS NOT NULL
 *   - team_id IS NULL
 *   - The associated pipeline job has a non-null team_id
 */
export class BackfillTeamIdOnListingRecords1788000000000
  implements MigrationInterface
{
  name = 'BackfillTeamIdOnListingRecords1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE listing_records lr
      SET "team_id" = pj."team_id"
      FROM pipeline_jobs pj
      WHERE lr."pipeline_job_id" = pj.id
        AND lr."team_id" IS NULL
        AND lr."pipeline_job_id" IS NOT NULL
        AND pj."team_id" IS NOT NULL
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op: reverting a backfill is not meaningful since we cannot
    // distinguish backfilled values from user-set values.
  }
}
