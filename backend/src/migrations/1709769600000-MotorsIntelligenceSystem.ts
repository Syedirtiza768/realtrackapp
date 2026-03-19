import { MigrationInterface, QueryRunner } from 'typeorm';

export class MotorsIntelligenceSystem1709769600000 implements MigrationInterface {
  name = 'MotorsIntelligenceSystem1709769600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── motors_products ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "motors_product_status_enum" AS ENUM (
        'pending','extracting','identifying','resolving_fitment',
        'generating_listing','validating','review_required',
        'approved','publishing','published','failed','rejected'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "motors_source_type_enum" AS ENUM (
        'image_upload','mpn_input','oem_input','csv_import',
        'excel_import','supplier_feed','marketplace_reference','catalog_product'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "motors_products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organizationId" uuid,
        "listingId" uuid,
        "catalogProductId" uuid,
        "status" "motors_product_status_enum" NOT NULL DEFAULT 'pending',
        "sourceType" "motors_source_type_enum" NOT NULL,
        "sourcePayload" jsonb,
        "sourceFileName" text,
        "sourceFilePath" text,
        "sourceRowNumber" integer,
        "brand" text,
        "brandNormalized" text,
        "mpn" text,
        "mpnNormalized" text,
        "oemPartNumber" text,
        "upc" text,
        "epid" text,
        "productType" text,
        "productFamily" text,
        "placement" text,
        "material" text,
        "finish" text,
        "condition" text,
        "features" text[],
        "includes" text[],
        "dimensions" jsonb,
        "quantityPerPack" text,
        "sideOrientation" text,
        "frontRear" text,
        "ebayCategoryId" text,
        "ebayCategoryName" text,
        "compatibilityRequired" boolean NOT NULL DEFAULT false,
        "identityConfidence" numeric(5,4),
        "fitmentConfidence" numeric(5,4),
        "complianceConfidence" numeric(5,4),
        "contentQualityScore" numeric(5,4),
        "generatedTitle" text,
        "generatedItemSpecifics" jsonb,
        "generatedBulletFeatures" text[],
        "generatedHtmlDescription" text,
        "generatedKeywordRationale" text,
        "generatedSearchTags" text[],
        "fitmentRows" jsonb,
        "compatibleVehicleSummary" text,
        "imageUrls" text[],
        "imageAssetIds" uuid[],
        "price" numeric(10,2),
        "quantity" integer,
        "ebayListingId" text,
        "publishError" text,
        "publishedAt" TIMESTAMP,
        "createdBy" text,
        "approvedBy" text,
        "approvedAt" TIMESTAMP,
        "version" integer NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP,
        CONSTRAINT "PK_motors_products" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_status" ON "motors_products" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_brand_mpn" ON "motors_products" ("brand", "mpn")`);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_source_type" ON "motors_products" ("sourceType")`);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_org" ON "motors_products" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_listing" ON "motors_products" ("listingId")`);
    await queryRunner.query(`CREATE INDEX "idx_motors_product_catalog" ON "motors_products" ("catalogProductId")`);

    // ─── product_candidates ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "candidate_status_enum" AS ENUM ('pending','selected','rejected','merged')
    `);
    await queryRunner.query(`
      CREATE TABLE "product_candidates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid NOT NULL,
        "status" "candidate_status_enum" NOT NULL DEFAULT 'pending',
        "rank" integer NOT NULL DEFAULT 0,
        "brand" text,
        "mpn" text,
        "mpnNormalized" text,
        "oemPartNumber" text,
        "productType" text,
        "productFamily" text,
        "placement" text,
        "condition" text,
        "source" text NOT NULL,
        "sourceReference" text,
        "exactMpnScore" numeric(5,4) NOT NULL DEFAULT 0,
        "brandMatchScore" numeric(5,4) NOT NULL DEFAULT 0,
        "ocrMpnScore" numeric(5,4) NOT NULL DEFAULT 0,
        "visualFamilyScore" numeric(5,4) NOT NULL DEFAULT 0,
        "dimensionMatchScore" numeric(5,4) NOT NULL DEFAULT 0,
        "supplierDescSimilarityScore" numeric(5,4) NOT NULL DEFAULT 0,
        "fitmentConsistencyScore" numeric(5,4) NOT NULL DEFAULT 0,
        "compositeScore" numeric(5,4) NOT NULL DEFAULT 0,
        "candidateData" jsonb,
        "scoringBreakdown" jsonb,
        "rejectionReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_candidates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_product_candidates_motors" FOREIGN KEY ("motorsProductId") REFERENCES "motors_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_product_candidate_motors" ON "product_candidates" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_product_candidate_status" ON "product_candidates" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_product_candidate_mpn" ON "product_candidates" ("mpnNormalized")`);

    // ─── extracted_attributes ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "extraction_source_enum" AS ENUM (
        'ocr','vision_ai','regex','supplier_data','catalog_lookup','manual'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "extracted_attributes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid NOT NULL,
        "extractionSource" "extraction_source_enum" NOT NULL,
        "imageAssetId" text,
        "rawOcrText" text,
        "rawModelOutput" jsonb,
        "extractedBrand" text,
        "extractedMpn" text,
        "extractedOemNumber" text,
        "extractedProductType" text,
        "extractedProductFamily" text,
        "extractedPlacement" text,
        "extractedMaterial" text,
        "extractedFinish" text,
        "extractedCondition" text,
        "extractedQuantity" text,
        "extractedSideOrientation" text,
        "extractedFrontRear" text,
        "extractedDimensions" jsonb,
        "extractedFeatures" text[],
        "extractedFitmentRaw" jsonb,
        "visibleTextLines" text[],
        "packagingIdentifiers" text[],
        "confidenceScores" jsonb,
        "normalizedOutput" jsonb,
        "approvedOutput" jsonb,
        "aiProvider" text,
        "aiModel" text,
        "tokensUsed" integer,
        "latencyMs" integer,
        "costUsd" numeric(10,6),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_extracted_attributes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_extracted_attributes_motors" FOREIGN KEY ("motorsProductId") REFERENCES "motors_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_extracted_attr_motors" ON "extracted_attributes" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_extracted_attr_source" ON "extracted_attributes" ("extractionSource")`);

    // ─── ebay_category_mappings ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ebay_category_mappings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ebayCategoryId" text NOT NULL,
        "ebayCategoryName" text NOT NULL,
        "parentCategoryId" text,
        "parentCategoryName" text,
        "productType" text,
        "isMotorsCategory" boolean NOT NULL DEFAULT false,
        "supportsCompatibility" boolean NOT NULL DEFAULT false,
        "compatibilityProperties" text[],
        "listingPolicies" jsonb,
        "maxFitmentRows" integer,
        "keywords" text[],
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncedAt" TIMESTAMP,
        CONSTRAINT "PK_ebay_category_mappings" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ebay_cat_map_id" UNIQUE ("ebayCategoryId")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ebay_cat_map_category_id" ON "ebay_category_mappings" ("ebayCategoryId")`);
    await queryRunner.query(`CREATE INDEX "idx_ebay_cat_map_product_type" ON "ebay_category_mappings" ("productType")`);

    // ─── ebay_aspect_requirements ──────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "aspect_requirement_level_enum" AS ENUM ('required','recommended','optional')
    `);
    await queryRunner.query(`
      CREATE TABLE "ebay_aspect_requirements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ebayCategoryId" text NOT NULL,
        "aspectName" text NOT NULL,
        "requirementLevel" "aspect_requirement_level_enum" NOT NULL,
        "dataType" text,
        "allowedValues" text[],
        "maxLength" integer,
        "isMultiValue" boolean NOT NULL DEFAULT false,
        "description" text,
        "defaultValue" text,
        "validationRules" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "lastSyncedAt" TIMESTAMP,
        CONSTRAINT "PK_ebay_aspect_requirements" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ebay_aspect_category" ON "ebay_aspect_requirements" ("ebayCategoryId")`);
    await queryRunner.query(`CREATE INDEX "idx_ebay_aspect_name" ON "ebay_aspect_requirements" ("aspectName")`);

    // ─── validation_results ────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "validation_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "publishable" boolean NOT NULL DEFAULT false,
        "errors" jsonb NOT NULL DEFAULT '[]',
        "warnings" jsonb NOT NULL DEFAULT '[]',
        "infos" jsonb NOT NULL DEFAULT '[]',
        "duplicateDetected" boolean NOT NULL DEFAULT false,
        "duplicateOfListingId" uuid,
        "duplicateMatchType" text,
        "overallComplianceScore" numeric(5,4),
        "aspectCoverage" jsonb,
        "fullPayload" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_validation_results" PRIMARY KEY ("id"),
        CONSTRAINT "FK_validation_results_motors" FOREIGN KEY ("motorsProductId") REFERENCES "motors_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_validation_motors_product" ON "validation_results" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_validation_publishable" ON "validation_results" ("publishable")`);

    // ─── review_tasks ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "review_task_status_enum" AS ENUM (
        'open','in_progress','approved','rejected','deferred','auto_resolved'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "review_task_priority_enum" AS ENUM ('low','medium','high','critical')
    `);
    await queryRunner.query(`
      CREATE TYPE "review_task_reason_enum" AS ENUM (
        'multiple_identities','ocr_conflict','missing_fitment','low_confidence',
        'image_only','supplier_conflict','brand_ambiguity','quantity_ambiguity',
        'side_orientation_conflict','front_rear_conflict','compliance_failure',
        'missing_required_aspects','title_quality','fitment_unverified','duplicate_detected'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "review_tasks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid NOT NULL,
        "organizationId" uuid,
        "status" "review_task_status_enum" NOT NULL DEFAULT 'open',
        "priority" "review_task_priority_enum" NOT NULL DEFAULT 'medium',
        "reason" "review_task_reason_enum" NOT NULL,
        "reasonDetail" text,
        "productSnapshot" jsonb,
        "candidatesSnapshot" jsonb,
        "extractionSnapshot" jsonb,
        "fitmentSnapshot" jsonb,
        "validationSnapshot" jsonb,
        "complianceSnapshot" jsonb,
        "assignedTo" uuid,
        "assignedAt" TIMESTAMP,
        "resolution" text,
        "resolutionData" jsonb,
        "resolvedBy" uuid,
        "resolvedAt" TIMESTAMP,
        "dueAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_tasks" PRIMARY KEY ("id"),
        CONSTRAINT "FK_review_tasks_motors" FOREIGN KEY ("motorsProductId") REFERENCES "motors_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_review_task_status" ON "review_tasks" ("status")`);
    await queryRunner.query(`CREATE INDEX "idx_review_task_priority" ON "review_tasks" ("priority")`);
    await queryRunner.query(`CREATE INDEX "idx_review_task_motors_product" ON "review_tasks" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_review_task_assigned" ON "review_tasks" ("assignedTo")`);
    await queryRunner.query(`CREATE INDEX "idx_review_task_org" ON "review_tasks" ("organizationId")`);

    // ─── correction_rules ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "correction_type_enum" AS ENUM (
        'char_substitution','hyphen_normalization','supersession','brand_alias',
        'brand_format','pair_single','side_orientation','front_rear',
        'product_type_alias','fitment_normalization','title_pattern'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "correction_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "correctionType" "correction_type_enum" NOT NULL,
        "brand" text,
        "productType" text,
        "inputPattern" text NOT NULL,
        "correctedValue" text NOT NULL,
        "isRegex" boolean NOT NULL DEFAULT false,
        "description" text,
        "source" text,
        "sourceReviewTaskId" uuid,
        "applicationCount" integer NOT NULL DEFAULT 0,
        "active" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_correction_rules" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_correction_type" ON "correction_rules" ("correctionType")`);
    await queryRunner.query(`CREATE INDEX "idx_correction_brand" ON "correction_rules" ("brand")`);
    await queryRunner.query(`CREATE INDEX "idx_correction_active" ON "correction_rules" ("active")`);

    // ─── listing_generations ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "listing_generation_status_enum" AS ENUM (
        'pending','generating','generated','approved','rejected','failed'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "listing_generations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "status" "listing_generation_status_enum" NOT NULL DEFAULT 'pending',
        "inputContract" jsonb NOT NULL,
        "generatedTitle" text,
        "generatedItemSpecifics" jsonb,
        "generatedBulletFeatures" text[],
        "generatedHtmlDescription" text,
        "keywordRationale" text,
        "searchTags" text[],
        "templateId" text,
        "templateName" text,
        "aiProvider" text,
        "aiModel" text,
        "aiRawResponse" jsonb,
        "tokensUsed" integer,
        "latencyMs" integer,
        "costUsd" numeric(10,6),
        "titleQualityScore" numeric(5,4),
        "descriptionQualityScore" numeric(5,4),
        "overallQualityScore" numeric(5,4),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_listing_generations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_listing_generations_motors" FOREIGN KEY ("motorsProductId") REFERENCES "motors_products"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_listing_gen_motors" ON "listing_generations" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_listing_gen_status" ON "listing_generations" ("status")`);

    // ─── motors_feedback_logs ──────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE "feedback_type_enum" AS ENUM (
        'reviewer_correction','title_edit','fitment_edit','specifics_edit',
        'ebay_api_error','policy_rejection','return_inad','ctr_data',
        'sell_through','brand_correction','mpn_correction','category_correction'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "motors_feedback_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "motorsProductId" uuid,
        "reviewTaskId" uuid,
        "feedbackType" "feedback_type_enum" NOT NULL,
        "field" text,
        "originalValue" text,
        "correctedValue" text,
        "context" jsonb,
        "appliedToRules" boolean NOT NULL DEFAULT false,
        "generatedCorrectionRuleId" uuid,
        "createdBy" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_motors_feedback_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_feedback_motors_product" ON "motors_feedback_logs" ("motorsProductId")`);
    await queryRunner.query(`CREATE INDEX "idx_feedback_type" ON "motors_feedback_logs" ("feedbackType")`);
    await queryRunner.query(`CREATE INDEX "idx_feedback_created" ON "motors_feedback_logs" ("createdAt")`);

    // ─── Seed initial eBay Motors category mappings ────────────────
    await queryRunner.query(`
      INSERT INTO "ebay_category_mappings" ("ebayCategoryId", "ebayCategoryName", "isMotorsCategory", "supportsCompatibility", "productType", "keywords", "maxFitmentRows")
      VALUES
        ('33563', 'Brake Calipers', true, true, 'Brake Caliper', '{"brake caliper","caliper","disc brake caliper"}', 3000),
        ('33564', 'Brake Pads & Shoes', true, true, 'Brake Pad', '{"brake pad","brake shoe","disc pad"}', 3000),
        ('177707', 'Control Arms & Parts', true, true, 'Control Arm', '{"control arm","suspension arm","lower control arm","upper control arm"}', 3000),
        ('33603', 'Alternators & Generators', true, true, 'Alternator', '{"alternator","generator","charging"}', 3000),
        ('33710', 'Headlights', true, true, 'Headlight', '{"headlight","headlamp","head light"}', 3000),
        ('36612', 'Mirrors', true, true, 'Mirror', '{"mirror","side mirror","rear view","door mirror"}', 3000),
        ('33573', 'Wheel Hubs & Bearings', true, true, 'Wheel Hub', '{"wheel hub","hub bearing","hub assembly"}', 3000),
        ('36700', 'Radiators', true, true, 'Radiator', '{"radiator","cooling","coolant"}', 3000),
        ('33555', 'Sensors', true, true, 'Sensor', '{"sensor","oxygen sensor","speed sensor","abs sensor"}', 3000),
        ('33596', 'Ignition Coils', true, true, 'Ignition Coil', '{"ignition coil","coil pack","ignition"}', 3000),
        ('33571', 'Shock Absorbers', true, true, 'Shock Absorber', '{"shock","strut","shock absorber","dampener"}', 3000),
        ('33577', 'Starters', true, true, 'Starter', '{"starter","starter motor","starting"}', 3000),
        ('33612', 'Water Pumps', true, true, 'Water Pump', '{"water pump","coolant pump"}', 3000),
        ('43961', 'Catalytic Converters', true, true, 'Catalytic Converter', '{"catalytic converter","cat converter","emissions"}', 3000),
        ('174044', 'Turbochargers & Parts', true, true, 'Turbocharger', '{"turbo","turbocharger","turbo charger"}', 3000)
      ON CONFLICT ("ebayCategoryId") DO NOTHING
    `);

    // ─── Seed initial correction rules ─────────────────────────────
    await queryRunner.query(`
      INSERT INTO "correction_rules" ("correctionType", "inputPattern", "correctedValue", "isRegex", "description", "source")
      VALUES
        ('char_substitution', 'O', '0', false, 'Common OCR confusion: letter O read as zero', 'system'),
        ('char_substitution', 'I', '1', false, 'Common OCR confusion: letter I read as 1', 'system'),
        ('hyphen_normalization', '–', '-', false, 'En dash to standard hyphen', 'system'),
        ('hyphen_normalization', '—', '-', false, 'Em dash to standard hyphen', 'system'),
        ('brand_alias', 'RAYBESTOS', 'Raybestos', false, 'Normalize uppercase brand', 'system'),
        ('brand_alias', 'DORMAN', 'Dorman', false, 'Normalize uppercase brand', 'system'),
        ('brand_alias', 'MOOG', 'Moog', false, 'Normalize uppercase brand', 'system'),
        ('brand_alias', 'AC DELCO', 'ACDelco', false, 'Normalize ACDelco brand name', 'system'),
        ('brand_alias', 'ACDELCO', 'ACDelco', false, 'Normalize ACDelco brand name', 'system'),
        ('product_type_alias', 'Disc Brake Pad', 'Brake Pad', false, 'Normalize product type', 'system'),
        ('product_type_alias', 'Disc Brake Caliper', 'Brake Caliper', false, 'Normalize product type', 'system'),
        ('product_type_alias', 'Hub Assembly', 'Wheel Hub', false, 'Normalize product type', 'system'),
        ('product_type_alias', 'Hub Bearing', 'Wheel Hub', false, 'Normalize product type', 'system')
    `);

    // ─── Seed feature flags for Motors Intelligence ────────────────
    await queryRunner.query(`
      INSERT INTO "feature_flags" ("key", "enabled", "description")
      VALUES
        ('motors_intelligence', false, 'Enable Motors Intelligence System pipeline'),
        ('motors_auto_publish', false, 'Auto-publish when all confidence thresholds met'),
        ('motors_vision_extraction', true, 'Enable AI vision extraction for Motors products'),
        ('motors_fitment_resolution', true, 'Enable automated fitment resolution'),
        ('motors_listing_generation', true, 'Enable AI listing generation'),
        ('motors_compliance_engine', true, 'Enable compliance validation before publish')
      ON CONFLICT ("key") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove feature flags
    await queryRunner.query(`DELETE FROM "feature_flags" WHERE "key" LIKE 'motors_%'`);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "motors_feedback_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "listing_generations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "correction_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "review_tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "validation_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_aspect_requirements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ebay_category_mappings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "extracted_attributes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_candidates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "motors_products"`);

    // Drop enum types
    await queryRunner.query(`DROP TYPE IF EXISTS "feedback_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "listing_generation_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "correction_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "review_task_reason_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "review_task_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "review_task_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "aspect_requirement_level_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "extraction_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "candidate_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "motors_source_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "motors_product_status_enum"`);
  }
}
