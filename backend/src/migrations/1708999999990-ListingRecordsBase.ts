import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Legacy catalog import table — must exist before Phase1 / InitialSchema migrations.
 * Previously created only via SQL dump or manual setup; empty Docker volumes failed.
 */
export class ListingRecordsBase1708999999990 implements MigrationInterface {
  name = 'ListingRecordsBase1708999999990';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'listing_records'
      ) AS "exists"
    `);
    if (exists[0]?.exists) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "listing_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "sourceFileName" text NOT NULL,
        "sourceFilePath" text NOT NULL,
        "sheetName" text NOT NULL DEFAULT 'Listings',
        "sourceRowNumber" integer NOT NULL,
        "importedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "action" text,
        "customLabelSku" text,
        "categoryId" text,
        "categoryName" text,
        "title" text,
        "relationship" text,
        "relationshipDetails" text,
        "scheduleTime" text,
        "pUpc" text,
        "pEpid" text,
        "startPrice" text,
        "quantity" text,
        "itemPhotoUrl" text,
        "conditionId" text,
        "description" text,
        "format" text,
        "duration" text,
        "buyItNowPrice" text,
        "bestOfferEnabled" text,
        "bestOfferAutoAcceptPrice" text,
        "minimumBestOfferPrice" text,
        "immediatePayRequired" text,
        "location" text,
        "shippingService1Option" text,
        "shippingService1Cost" text,
        "shippingService1Priority" text,
        "shippingService2Option" text,
        "shippingService2Cost" text,
        "shippingService2Priority" text,
        "maxDispatchTime" text,
        "returnsAcceptedOption" text,
        "returnsWithinOption" text,
        "refundOption" text,
        "returnShippingCostPaidBy" text,
        "shippingProfileName" text,
        "returnProfileName" text,
        "paymentProfileName" text,
        "productCompliancePolicyId" text,
        "regionalProductCompliancePolicies" text,
        "cBrand" text,
        "cType" text,
        "cItemHeight" text,
        "cItemLength" text,
        "cItemWidth" text,
        "cItemDiameter" text,
        "cFeatures" text,
        "cManufacturerPartNumber" text,
        "cOeOemPartNumber" text,
        "cOperatingMode" text,
        "cFuelType" text,
        "cDriveType" text,
        "productSafetyPictograms" text,
        "productSafetyStatements" text,
        "productSafetyComponent" text,
        "regulatoryDocumentIds" text,
        "manufacturerName" text,
        "manufacturerAddressLine1" text,
        "manufacturerAddressLine2" text,
        "manufacturerCity" text,
        "manufacturerCountry" text,
        "manufacturerPostalCode" text,
        "manufacturerStateOrProvince" text,
        "manufacturerPhone" text,
        "manufacturerEmail" text,
        "manufacturerContactUrl" text,
        "responsiblePerson1" text,
        "responsiblePerson1Type" text,
        "responsiblePerson1AddressLine1" text,
        "responsiblePerson1AddressLine2" text,
        "responsiblePerson1City" text,
        "responsiblePerson1Country" text,
        "responsiblePerson1PostalCode" text,
        "responsiblePerson1StateOrProvince" text,
        "responsiblePerson1Phone" text,
        "responsiblePerson1Email" text,
        "responsiblePerson1ContactUrl" text,
        CONSTRAINT "PK_listing_records" PRIMARY KEY ("id"),
        CONSTRAINT "uq_listing_source_row" UNIQUE ("sourceFileName", "sheetName", "sourceRowNumber")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_sku" ON "listing_records" ("customLabelSku")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_category_id" ON "listing_records" ("categoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_title" ON "listing_records" ("title")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_brand" ON "listing_records" ("cBrand")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_condition" ON "listing_records" ("conditionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_c_type" ON "listing_records" ("cType")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_listing_source_file" ON "listing_records" ("sourceFileName")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "listing_records"`);
  }
}
