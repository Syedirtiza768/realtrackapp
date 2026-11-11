import { MigrationInterface, QueryRunner } from 'typeorm';

export class MotoarkOrderLifecycle1791500000000 implements MigrationInterface {
  name = 'MotoarkOrderLifecycle1791500000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE primemotive_sale_receipts (
      organization_id uuid NOT NULL, event_id varchar(160) NOT NULL, listing_id uuid NOT NULL,
      payload_hash varchar(64) NOT NULL, received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (organization_id, event_id))`);
    await q.query(`CREATE TABLE motoark_order_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      store_id uuid NOT NULL REFERENCES stores(id), actor_user_id uuid NOT NULL REFERENCES users(id),
      event_id varchar(160) NOT NULL, external_order_id varchar(100) NOT NULL,
      payload_hash varchar(64) NOT NULL, payload jsonb NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'received' CHECK (status IN ('received','pending','applied','rejected')),
      attempts int NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
      last_error text, result jsonb, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), applied_at timestamptz,
      UNIQUE (organization_id, event_id))`);
    await q.query(
      `CREATE INDEX idx_motoark_events_due ON motoark_order_events(next_attempt_at) WHERE status IN ('received','pending')`,
    );
    await q.query(`CREATE TABLE motoark_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
      store_id uuid NOT NULL REFERENCES stores(id), external_order_id varchar(100) NOT NULL,
      order_id uuid NOT NULL UNIQUE REFERENCES orders(id), version int NOT NULL DEFAULT 0,
      currency varchar(3) NOT NULL, total_amount numeric(10,2) NOT NULL, refunded_amount numeric(10,2) NOT NULL DEFAULT 0,
      UNIQUE (organization_id, external_order_id))`);
    await q.query(`CREATE TABLE motoark_order_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), motoark_order_id uuid NOT NULL REFERENCES motoark_orders(id),
      external_line_id varchar(100) NOT NULL, listing_id uuid NOT NULL, inventory_item_id uuid NOT NULL REFERENCES inventory_items(id),
      order_item_id uuid NOT NULL UNIQUE REFERENCES order_items(id), quantity int NOT NULL CHECK (quantity > 0),
      shipped int NOT NULL DEFAULT 0, cancelled int NOT NULL DEFAULT 0,
      CHECK (shipped >= 0 AND cancelled >= 0 AND shipped + cancelled <= quantity),
      UNIQUE (motoark_order_id, external_line_id))`);
    await q.query(`CREATE TABLE motoark_returns (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_line_id uuid NOT NULL REFERENCES motoark_order_lines(id),
      external_return_id varchar(100) NOT NULL, requested int NOT NULL CHECK(requested > 0),
      received int NOT NULL DEFAULT 0, restocked int NOT NULL DEFAULT 0, disposed int NOT NULL DEFAULT 0,
      warehouse_id uuid REFERENCES warehouses(id), location_id uuid REFERENCES warehouse_locations(id),
      unit_ids uuid[] NOT NULL DEFAULT '{}',
      CHECK(received >= 0 AND received <= requested AND restocked >= 0 AND disposed >= 0 AND restocked + disposed <= received),
      UNIQUE (order_line_id, external_return_id))`);
    await q.query(`CREATE TABLE motoark_refunds (
      motoark_order_id uuid NOT NULL REFERENCES motoark_orders(id), refund_id varchar(100) NOT NULL,
      amount numeric(10,2) NOT NULL CHECK(amount > 0), PRIMARY KEY(motoark_order_id, refund_id))`);
    await q.query(`INSERT INTO permissions (key,label,module,description) VALUES
      ('motoark.orders.notify','Report MotoArk order events','motoark','Submit signed order lifecycle facts for the authorized Primemotive store'),
      ('motoark.orders.view','Read MotoArk event and quantity results','motoark','Read organization-scoped lifecycle and stock results'),
      ('motoark.returns.receive','Confirm MotoArk physical returns','motoark','Confirm physical receipt into non-sellable stock'),
      ('motoark.returns.restock','Inspect and dispose MotoArk returns','motoark','Authorize inspected return restocking or disposal')
      ON CONFLICT(key) DO NOTHING`);
    // Physical return authority is deliberately not granted to the external reader role.
    await q.query(`INSERT INTO role_permissions ("roleId","permissionId")
      SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
      WHERE (r.slug = 'api_published_listings_reader' AND p.key IN ('motoark.orders.notify','motoark.orders.view'))
         OR (r.slug IN ('super_admin','admin') AND p.key LIKE 'motoark.%')
      ON CONFLICT DO NOTHING`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM role_permissions WHERE "permissionId" IN (SELECT id FROM permissions WHERE key IN ('motoark.orders.notify','motoark.orders.view','motoark.returns.receive','motoark.returns.restock'))`,
    );
    await q.query(
      `DELETE FROM permissions WHERE key IN ('motoark.orders.notify','motoark.orders.view','motoark.returns.receive','motoark.returns.restock')`,
    );
    await q.query(
      'DROP TABLE motoark_refunds, motoark_returns, motoark_order_lines, motoark_orders, motoark_order_events, primemotive_sale_receipts',
    );
  }
}
