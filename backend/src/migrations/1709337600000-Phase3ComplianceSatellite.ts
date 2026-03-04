import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3.3 — Extract compliance columns from listing_records
 * into a separate satellite table `listing_compliance`.
 *
 * Strategy: Create the satellite table and populate it from existing data.
 * The original columns remain in listing_records (no data loss) during
 * the transition period. A future migration will drop them.
 */
export class Phase3ComplianceSatellite1709337600000 implements MigrationInterface {
  name = 'Phase3ComplianceSatellite1709337600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Create compliance satellite table ───
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS listing_compliance (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        listing_id UUID NOT NULL UNIQUE,
        -- Product compliance
        product_compliance_policy_id TEXT,
        regional_product_compliance_policies TEXT,
        -- Product safety
        product_safety_pictograms TEXT,
        product_safety_statements TEXT,
        product_safety_component TEXT,
        regulatory_document_ids TEXT,
        -- Manufacturer info
        manufacturer_name TEXT,
        manufacturer_address_line1 TEXT,
        manufacturer_address_line2 TEXT,
        manufacturer_city TEXT,
        manufacturer_country TEXT,
        manufacturer_postal_code TEXT,
        manufacturer_state_or_province TEXT,
        manufacturer_phone TEXT,
        manufacturer_email TEXT,
        manufacturer_contact_url TEXT,
        -- Responsible person
        responsible_person1 TEXT,
        responsible_person1_type TEXT,
        responsible_person1_address_line1 TEXT,
        responsible_person1_address_line2 TEXT,
        responsible_person1_city TEXT,
        responsible_person1_country TEXT,
        responsible_person1_postal_code TEXT,
        responsible_person1_state_or_province TEXT,
        responsible_person1_phone TEXT,
        responsible_person1_email TEXT,
        responsible_person1_contact_url TEXT,
        -- Timestamps
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_compliance_listing
          FOREIGN KEY (listing_id) REFERENCES listing_records(id)
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_compliance_listing ON listing_compliance(listing_id)
    `);

    // ─── Backfill: Copy data from listing_records where compliance data exists ───
    await queryRunner.query(`
      INSERT INTO listing_compliance (
        listing_id,
        product_compliance_policy_id,
        regional_product_compliance_policies,
        product_safety_pictograms,
        product_safety_statements,
        product_safety_component,
        regulatory_document_ids,
        manufacturer_name,
        manufacturer_address_line1,
        manufacturer_address_line2,
        manufacturer_city,
        manufacturer_country,
        manufacturer_postal_code,
        manufacturer_state_or_province,
        manufacturer_phone,
        manufacturer_email,
        manufacturer_contact_url,
        responsible_person1,
        responsible_person1_type,
        responsible_person1_address_line1,
        responsible_person1_address_line2,
        responsible_person1_city,
        responsible_person1_country,
        responsible_person1_postal_code,
        responsible_person1_state_or_province,
        responsible_person1_phone,
        responsible_person1_email,
        responsible_person1_contact_url
      )
      SELECT
        id,
        "productCompliancePolicyId",
        "regionalProductCompliancePolicies",
        "productSafetyPictograms",
        "productSafetyStatements",
        "productSafetyComponent",
        "regulatoryDocumentIds",
        "manufacturerName",
        "manufacturerAddressLine1",
        "manufacturerAddressLine2",
        "manufacturerCity",
        "manufacturerCountry",
        "manufacturerPostalCode",
        "manufacturerStateOrProvince",
        "manufacturerPhone",
        "manufacturerEmail",
        "manufacturerContactUrl",
        "responsiblePerson1",
        "responsiblePerson1Type",
        "responsiblePerson1AddressLine1",
        "responsiblePerson1AddressLine2",
        "responsiblePerson1City",
        "responsiblePerson1Country",
        "responsiblePerson1PostalCode",
        "responsiblePerson1StateOrProvince",
        "responsiblePerson1Phone",
        "responsiblePerson1Email",
        "responsiblePerson1ContactUrl"
      FROM listing_records
      WHERE "manufacturerName" IS NOT NULL
         OR "responsiblePerson1" IS NOT NULL
         OR "productCompliancePolicyId" IS NOT NULL
         OR "productSafetyPictograms" IS NOT NULL
      ON CONFLICT (listing_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_compliance_listing`);
    await queryRunner.query(`DROP TABLE IF EXISTS listing_compliance`);
  }
}
