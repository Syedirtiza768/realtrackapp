import { MigrationInterface, QueryRunner } from 'typeorm';

export class AiRunLogsAndRoutingPolicy1775700000000 implements MigrationInterface {
  name = 'AiRunLogsAndRoutingPolicy1775700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_run_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sku" varchar(100),
        "part_number" varchar(80),
        "part_type" varchar(80),
        "price" numeric(10,2),
        "donor_vehicle" jsonb,
        "marketplace" varchar(10),
        "batch_id" uuid,
        "enhancement_id" uuid,
        "lane" varchar(20) NOT NULL,
        "model" varchar(80) NOT NULL,
        "attempt" smallint NOT NULL DEFAULT 1,
        "prompt_version" varchar(40) NOT NULL,
        "routing_policy_version" int,
        "input_tokens" int,
        "output_tokens" int,
        "cost_usd" numeric(10,6),
        "latency_ms" int,
        "validation_score" smallint,
        "hard_fails" jsonb NOT NULL DEFAULT '[]',
        "soft_fails" jsonb NOT NULL DEFAULT '[]',
        "escalated" boolean NOT NULL DEFAULT false,
        "passed_gate" boolean NOT NULL DEFAULT false,
        "fitment_row_count" int,
        "human_approved" boolean,
        "human_rejected" boolean,
        "rejection_reason" text,
        "published" boolean,
        "publish_error" text,
        "ebay_category_id" varchar(20),
        "field_edits" jsonb,
        "guard_fixes" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ai_run_logs" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_run_logs_part_type" ON "ai_run_logs" ("part_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_run_logs_model" ON "ai_run_logs" ("model")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_run_logs_created" ON "ai_run_logs" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_run_logs_sku" ON "ai_run_logs" ("sku")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_routing_policy_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "version" int NOT NULL,
        "policy" jsonb NOT NULL,
        "generated_at" timestamptz NOT NULL DEFAULT now(),
        "source" varchar(40) NOT NULL DEFAULT 'optimizer',
        CONSTRAINT "PK_ai_routing_policy_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ai_routing_policy_history_version" ON "ai_routing_policy_history" ("version")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_routing_policy_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ai_run_logs"`);
  }
}
