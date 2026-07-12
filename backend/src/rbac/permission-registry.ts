/**
 * Central permission registry — single source of truth for RBAC keys.
 * Run RbacSeedService.syncFromRegistry() to upsert into the database.
 */

export type PermissionDefinition = {
  key: string;
  label: string;
  module: string;
  description?: string;
  defaultRoles?: string[];
};

export const ROLE_SLUGS = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
  CATALOG_MANAGER: 'catalog_manager',
  LISTING_MANAGER: 'listing_manager',
  OPS_USER: 'ops_user',
  LISTING_USER: 'listing_user',
  SUPERVISOR: 'supervisor',
} as const;

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS];

/** Maps legacy users.role column values to RBAC role slugs. */
export const LEGACY_USER_ROLE_TO_SLUG: Record<string, RoleSlug> = {
  admin: ROLE_SLUGS.ADMIN,
  manager: ROLE_SLUGS.MANAGER,
  user: ROLE_SLUGS.STAFF,
  viewer: ROLE_SLUGS.VIEWER,
  super_admin: ROLE_SLUGS.SUPER_ADMIN,
};

const ALL_OPERATIONAL: RoleSlug[] = [
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.MANAGER,
  ROLE_SLUGS.STAFF,
  ROLE_SLUGS.CATALOG_MANAGER,
  ROLE_SLUGS.LISTING_MANAGER,
  ROLE_SLUGS.OPS_USER,
];

const ADMIN_UP: RoleSlug[] = [
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.MANAGER,
];

const MANAGER_UP: RoleSlug[] = [
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.MANAGER,
];

const READ_WRITE: RoleSlug[] = [
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
  ROLE_SLUGS.MANAGER,
  ROLE_SLUGS.STAFF,
  ROLE_SLUGS.CATALOG_MANAGER,
  ROLE_SLUGS.LISTING_MANAGER,
  ROLE_SLUGS.OPS_USER,
];

const READ_ONLY: RoleSlug[] = [
  ...READ_WRITE,
  ROLE_SLUGS.VIEWER,
  ROLE_SLUGS.LISTING_USER,
  ROLE_SLUGS.SUPERVISOR,
];

const SUPER_ADMIN_ONLY: RoleSlug[] = [ROLE_SLUGS.SUPER_ADMIN];

/** Admin + super_admin only. Super admin can reassign via Roles UI later. */
const SUPER_AND_ADMIN: RoleSlug[] = [
  ROLE_SLUGS.SUPER_ADMIN,
  ROLE_SLUGS.ADMIN,
];

function p(
  key: string,
  label: string,
  module: string,
  defaultRoles: RoleSlug[],
  description?: string,
): PermissionDefinition {
  return { key, label, module, defaultRoles, description };
}

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  // ── Auth / session ──
  p('auth.session', 'View own session', 'auth', READ_ONLY),

  // ── Users & RBAC admin ──
  p('users.view', 'View users', 'users', MANAGER_UP),
  p('users.create', 'Create users', 'users', ADMIN_UP),
  p('users.update', 'Update users', 'users', ADMIN_UP),
  p('users.deactivate', 'Deactivate users', 'users', ADMIN_UP),
  p('users.reset_password', 'Reset user passwords', 'users', ADMIN_UP),
  p('roles.view', 'View roles', 'roles', MANAGER_UP),
  p('roles.manage', 'Manage roles', 'roles', [ROLE_SLUGS.SUPER_ADMIN]),
  p('roles.assign_permissions', 'Assign role permissions', 'roles', [
    ROLE_SLUGS.SUPER_ADMIN,
  ]),
  p('roles.assign', 'Assign roles to users', 'roles', ADMIN_UP),
  p('roles.create', 'Create custom roles', 'roles', SUPER_ADMIN_ONLY),
  p('roles.update', 'Update role details', 'roles', SUPER_ADMIN_ONLY),
  p('roles.delete', 'Delete custom roles', 'roles', SUPER_ADMIN_ONLY),

  // ── Teams ──
  p('teams.view', 'View teams', 'teams', READ_ONLY),
  p('teams.manage', 'Manage teams and member assignments', 'teams', ADMIN_UP),

  // ── Client settings / white-label ──
  p(
    'client_settings.view',
    'View client settings',
    'client_settings',
    SUPER_ADMIN_ONLY,
  ),
  p(
    'client_settings.manage',
    'Manage client settings',
    'client_settings',
    SUPER_ADMIN_ONLY,
  ),
  p(
    'client_settings.branding',
    'Update branding assets',
    'client_settings',
    SUPER_ADMIN_ONLY,
  ),
  p(
    'client_settings.theme',
    'Update theme settings',
    'client_settings',
    SUPER_ADMIN_ONLY,
  ),
  p(
    'client_settings.whitelabel',
    'Update white-label options',
    'client_settings',
    SUPER_ADMIN_ONLY,
  ),

  // ── Dashboard ──
  p('dashboard.view', 'View dashboard', 'dashboard', READ_ONLY),

  // ── Listings ──
  p('listings.view', 'View listings', 'listings', READ_ONLY),
  p('listings.create', 'Create listings', 'listings', [
    ...READ_WRITE,
    ROLE_SLUGS.LISTING_USER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p('listings.update', 'Update listings', 'listings', [
    ...READ_WRITE,
    ROLE_SLUGS.LISTING_USER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p(
    'listings.delete',
    'Soft-delete listings (catalog / listings UI)',
    'listings',
    SUPER_AND_ADMIN,
    'Responsible soft-delete; restore via listings.update. Defaults to admin/super_admin; reassignable.',
  ),
  p('listings.publish', 'Publish listings to channels', 'listings', [
    ROLE_SLUGS.SUPER_ADMIN,
    ROLE_SLUGS.ADMIN,
    ROLE_SLUGS.MANAGER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p('listings.approve', 'Approve listings for publication', 'listings', [
    ROLE_SLUGS.SUPER_ADMIN,
    ROLE_SLUGS.ADMIN,
    ROLE_SLUGS.MANAGER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p('listings.revise', 'Revise published listings', 'listings', [
    ROLE_SLUGS.SUPER_ADMIN,
    ROLE_SLUGS.ADMIN,
    ROLE_SLUGS.MANAGER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p('listings.price_override', 'Change price on live listings', 'listings', [
    ROLE_SLUGS.SUPER_ADMIN,
    ROLE_SLUGS.ADMIN,
    ROLE_SLUGS.MANAGER,
  ]),
  p('listings.import', 'Import listings', 'listings', [
    ...MANAGER_UP,
    ROLE_SLUGS.LISTING_USER,
    ROLE_SLUGS.SUPERVISOR,
  ]),
  p('listings.export', 'Export listings', 'listings', READ_ONLY),
  p('listings.generate', 'AI-generate listings', 'listings', [
    ...READ_WRITE,
    ROLE_SLUGS.LISTING_USER,
    ROLE_SLUGS.SUPERVISOR,
  ]),

  // ── AI routing ──
  p('ai.routing.view', 'View AI routing stats and policy', 'ai', READ_ONLY),
  p('ai.routing.manage', 'Run AI routing optimizer', 'ai', ADMIN_UP),

  // ── Ingestion & pipeline ──
  p('ingestion.view', 'View ingestion jobs', 'ingestion', READ_ONLY),
  p('ingestion.create', 'Create ingestion jobs', 'ingestion', READ_WRITE),
  p('ingestion.manage', 'Manage ingestion jobs', 'ingestion', MANAGER_UP),
  p('pipeline.view', 'View pipeline jobs', 'pipeline', READ_ONLY),
  p('pipeline.run', 'Run pipeline jobs', 'pipeline', READ_WRITE),
  p('pipeline.manage', 'Manage pipeline jobs', 'pipeline', MANAGER_UP),
  p(
    'pipeline.review',
    'Approve/reject pipeline review',
    'pipeline',
    MANAGER_UP,
  ),
  p('pipeline.export', 'Download pipeline outputs', 'pipeline', READ_ONLY),

  // ── Catalog ──
  p('catalog.view', 'View catalog products', 'catalog', READ_ONLY),
  p('catalog.update', 'Update catalog products', 'catalog', READ_WRITE),
  p('catalog.import', 'Import catalog CSV', 'catalog', MANAGER_UP),
  p('catalog.clear', 'Clear catalog data', 'catalog', ADMIN_UP),
  p('catalog.export', 'Export catalog', 'catalog', READ_ONLY),
  p('catalog.compliance', 'Run compliance audits', 'catalog', MANAGER_UP),

  // ── Inventory ──
  p('inventory.view', 'View inventory', 'inventory', READ_ONLY),
  p(
    'inventory.enrich',
    'Fetch details and run enrichment on inventory parts',
    'inventory',
    [
      ROLE_SLUGS.SUPER_ADMIN,
      ROLE_SLUGS.ADMIN,
      ROLE_SLUGS.MANAGER,
      ROLE_SLUGS.LISTING_MANAGER,
      ROLE_SLUGS.OPS_USER,
    ],
  ),
  p(
    'inventory.delete',
    'Soft-delete inventory listings',
    'inventory',
    SUPER_AND_ADMIN,
    'Responsible soft-delete from inventory workbench. Defaults to admin/super_admin; reassignable.',
  ),
  p('inventory.adjust', 'Adjust inventory', 'inventory', MANAGER_UP),
  p('inventory.allocate', 'Allocate inventory', 'inventory', MANAGER_UP),
  p('inventory.reconcile', 'Reconcile inventory', 'inventory', ADMIN_UP),

  // ── Orders ──
  p('orders.view', 'View orders', 'orders', READ_ONLY),
  p('orders.update', 'Update order status', 'orders', READ_WRITE),
  p('orders.ship', 'Ship orders', 'orders', READ_WRITE),
  p('orders.refund', 'Refund orders', 'orders', ADMIN_UP),
  p('orders.import', 'Import orders', 'orders', MANAGER_UP),

  // ── Channels & stores ──
  p('channels.view', 'View channel connections', 'channels', READ_ONLY),
  p('channels.connect', 'Connect channels', 'channels', MANAGER_UP),
  p('channels.publish', 'Publish to channels', 'channels', READ_WRITE),
  p('channels.sync', 'Sync channel listings', 'channels', READ_WRITE),
  p('channels.manage', 'Manage channel connections', 'channels', MANAGER_UP),
  p('stores.view', 'View stores', 'stores', READ_ONLY),
  p('stores.manage', 'Manage stores', 'stores', MANAGER_UP),
  p('stores.assign', 'Assign users to stores', 'stores', MANAGER_UP),
  p(
    'stores.access_all_manage',
    'Toggle store access_all for users',
    'stores',
    ADMIN_UP,
  ),

  // ── eBay integrations ──
  p('ebay.view', 'View eBay accounts', 'ebay', READ_ONLY),
  p('ebay.connect', 'Connect eBay accounts', 'ebay', MANAGER_UP),
  p('ebay.sync', 'Sync eBay data', 'ebay', READ_WRITE),
  p('ebay.publish', 'Publish via eBay', 'ebay', READ_WRITE),
  p('ebay.manage', 'Manage eBay accounts', 'ebay', MANAGER_UP),
  p('ebay.audit', 'View eBay API audit logs', 'ebay', MANAGER_UP),

  // ── Published listings (live eBay mirror) ──
  p(
    'published_listings.view',
    'View published eBay listings',
    'published_listings',
    READ_ONLY,
  ),
  p(
    'published_listings.sync',
    'Sync published listings from eBay',
    'published_listings',
    READ_WRITE,
  ),
  p(
    'published_listings.manage',
    'Revise/end published listings',
    'published_listings',
    READ_WRITE,
  ),
  p(
    'published_listings.bulk',
    'Bulk actions on published listings',
    'published_listings',
    MANAGER_UP,
  ),

  // ── Settings (tenant operational) ──
  p('settings.view', 'View settings', 'settings', READ_ONLY),
  p('settings.manage', 'Manage settings', 'settings', ADMIN_UP),

  // ── Automation & templates ──
  p('automation.view', 'View automation rules', 'automation', READ_ONLY),
  p('automation.manage', 'Manage automation rules', 'automation', MANAGER_UP),
  p('templates.view', 'View templates', 'templates', READ_ONLY),
  p('templates.manage', 'Manage templates', 'templates', MANAGER_UP),

  // ── Notifications & audit ──
  p('notifications.view', 'View notifications', 'notifications', READ_ONLY),
  p(
    'notifications.manage',
    'Manage notifications',
    'notifications',
    READ_WRITE,
  ),
  p('audit.view', 'View audit trail', 'audit', MANAGER_UP),

  // ── Motors intelligence ──
  p('motors.view', 'View motors intelligence', 'motors', READ_ONLY),
  p('motors.manage', 'Manage motors products', 'motors', READ_WRITE),
  p('motors.review', 'Review motors queue', 'motors', MANAGER_UP),

  // ── Fitment ──
  p('fitment.view', 'View fitment', 'fitment', READ_ONLY),
  p('fitment.manage', 'Manage fitment', 'fitment', READ_WRITE),

  // ── Storage ──
  p('storage.view', 'View storage assets', 'storage', READ_ONLY),
  p('storage.upload', 'Upload storage assets', 'storage', READ_WRITE),
  p('storage.manage', 'Manage storage assets', 'storage', MANAGER_UP),

  // ── Pricing ──
  p('pricing.view', 'View pricing intelligence', 'pricing', READ_ONLY),
  p('pricing.manage', 'Manage pricing rules', 'pricing', MANAGER_UP),

  // ── Feature flags ──
  p('feature_flags.view', 'View feature flags', 'feature_flags', ADMIN_UP),
  p('feature_flags.manage', 'Manage feature flags', 'feature_flags', [
    ROLE_SLUGS.SUPER_ADMIN,
  ]),
];

export const ROLE_DEFINITIONS: {
  slug: RoleSlug;
  name: string;
  description: string;
  isSystem: boolean;
}[] = [
  {
    slug: ROLE_SLUGS.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Full system access including client settings and white-label',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.ADMIN,
    name: 'Admin',
    description: 'Broad operational access without client branding controls',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.MANAGER,
    name: 'Manager',
    description: 'Operational management across listings, orders, and channels',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.STAFF,
    name: 'Staff',
    description: 'Day-to-day listing and catalog operations',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.VIEWER,
    name: 'Viewer',
    description: 'Read-only access',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.CATALOG_MANAGER,
    name: 'Catalog Manager',
    description: 'Catalog import and product management',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.LISTING_MANAGER,
    name: 'Listing Manager',
    description: 'Listing creation, publishing, and channel sync',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.OPS_USER,
    name: 'Operations User',
    description: 'Orders, inventory, and fulfillment operations',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.LISTING_USER,
    name: 'Listing User',
    description:
      'Upload sheets, verify data, and edit draft listings. Cannot publish, revise, or delete.',
    isSystem: true,
  },
  {
    slug: ROLE_SLUGS.SUPERVISOR,
    name: 'Supervisor',
    description:
      'Approve and publish listings, revise live listings. Cannot delete or change price on live listings without manager approval.',
    isSystem: true,
  },
];

export function permissionsForRole(slug: RoleSlug): string[] {
  return PERMISSION_REGISTRY.filter((perm) =>
    perm.defaultRoles?.includes(slug),
  ).map((perm) => perm.key);
}

/** Map of sidebar module keys → the permission that gates them. Mirrors NAV_ITEMS in Shell.tsx. */
export const SIDEBAR_MODULE_PERMISSIONS: Record<string, string> = {
  '': 'dashboard.view',
  ingestion: 'ingestion.view',
  motors: 'motors.view',
  'motors/review': 'motors.review',
  'listings/new': 'listings.create',
  fitment: 'fitment.view',
  'fitment/vin': 'fitment.view',
  catalog: 'catalog.view',
  'catalog/import': 'catalog.import',
  'catalog/motors-filters': 'catalog.view',
  inventory: 'inventory.view',
  'published-listings': 'published_listings.view',
  pipeline: 'pipeline.view',
  preview: 'listings.view',
  'bulk-actions': 'listings.update',
  orders: 'orders.view',
  automation: 'automation.view',
  templates: 'templates.view',
  audit: 'audit.view',
  notifications: 'notifications.view',
  settings: 'settings.view',
  'settings/users': 'users.view',
  'settings/teams': 'teams.manage',
  'settings/permissions': 'roles.view',
  'settings/client': 'client_settings.view',
  'settings/integrations/ebay': 'ebay.view',
  'settings/ai-routing': 'ai.routing.view',
};
