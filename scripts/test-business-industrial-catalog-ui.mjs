/**
 * Mocked B&I catalog UI regression.
 *
 * Runtime:
 *   CATALOG_PLAYWRIGHT_PATH  Playwright module (default: .codex-fashion-test-runtime/node_modules/playwright/index.mjs)
 *   CATALOG_CHROME_PATH      Chrome executable (default: C:/Program Files/Google/Chrome/Application/chrome.exe)
 *   CATALOG_UI_URL           Frontend origin (default: http://127.0.0.1:3923)
 *
 * This script intercepts /api/** and does not prove live backend integration.
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const runtime = process.env.CATALOG_PLAYWRIGHT_PATH || path.resolve('.codex-fashion-test-runtime/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CATALOG_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const base = process.env.CATALOG_UI_URL || 'http://127.0.0.1:3923';
const permissions = [
  'access',
  'dashboard.view',
  'listings.view',
  'listings.create',
  'listings.update',
  'catalog.export',
  'catalog.assign_team',
  'catalog.manage_policies',
  'catalog.delete',
  'publish',
].map((permission) => 'business_industrial.' + permission);
const item = {
  id: '11111111-1111-4111-8111-111111111111',
  vertical: 'business_industrial',
  sku: 'BI-TEST-001',
  title: 'Siemens industrial power supply',
  description: 'Test catalog record',
  brand: 'Siemens',
  mpn: 'PS24-075D',
  conditionId: null,
  conditionLabel: null,
  price: 125,
  quantity: 3,
  imageUrls: ['https://example.test/equipment-1.webp', 'https://example.test/equipment-2.webp', 'https://example.test/equipment-3.webp'],
  categoryId: '181939',
  categoryName: 'Industrial Power Supplies',
  partType: null,
  location: null,
  format: null,
  shippingProfile: null,
  paymentProfile: null,
  returnProfile: null,
  sourceFile: null,
  sourceRow: null,
  importId: null,
  pipelineJobId: null,
  teamId: null,
  teamName: null,
  teamColor: null,
  verticalAttributes: {
    categoryFamily: 'industrial_automation',
    manufacturer: 'Siemens',
    model: 'PS24-075D',
    mpn: 'PS24-075D',
    inventoryMode: 'single',
    shippingMode: 'parcel',
  },
  verticalValidationStatus: 'approved',
  manualReview: false,
  readinessScore: 82,
  seoScore: 76,
  reviewStatus: 'approved',
  publicationStatus: 'unpublished',
  publications: [],
  createdAt: '2026-09-13T00:00:00.000Z',
  updatedAt: '2026-09-13T00:00:00.000Z',
};

const errors = [];
let searchRequests = 0;
let summaryRequests = 0;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => localStorage.setItem('mk_auth_token', 'mock-test-token'));
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  const requestPath = url.pathname;
  let data;
  if (requestPath === '/api/auth/me') {
    data = {
      user: { id: 'test-admin', email: 'admin@example.test', name: 'B&I Admin', role: 'user', roleSlug: 'business_industrial_admin', roleName: 'B&I Admin', active: true, permissions },
      organizations: [],
    };
  } else if (requestPath === '/api/client-settings/branding') data = {};
  else if (requestPath === '/api/rbac/roles/sidebar-config/me') data = { visibleModules: [] };
  else if (requestPath === '/api/business-industrial/workspace') data = { metrics: { listingCount: 1 }, stores: [] };
  else if (requestPath === '/api/business-industrial/catalog/search/facets') {
    data = {
      vertical: 'business_industrial',
      totalFiltered: 1,
      queryTimeMs: 7,
      brands: [{ value: 'Siemens', label: 'Siemens', count: 1 }],
      categories: [{ value: '181939', label: 'Industrial Power Supplies', count: 1 }],
      conditions: [],
      types: [],
      sourceFiles: [],
      formats: [],
      locations: [],
      mpns: [{ value: 'PS24-075D', label: 'PS24-075D', count: 1 }],
      teams: [],
      marketplaces: [],
      shippingProfiles: [],
      stockLevels: [{ value: 'in_stock', label: 'In Stock', count: 1 }],
      catalogStatuses: [{ value: 'ready_to_publish', label: 'Ready To Publish', count: 1 }],
      validationStatuses: [{ value: 'approved', label: 'Approved', count: 1 }],
      attributeFacets: {
        categoryFamily: [{ value: 'industrial_automation', count: 1 }],
        manufacturer: [{ value: 'Siemens', count: 1 }],
        model: [{ value: 'PS24-075D', count: 1 }],
        mpn: [{ value: 'PS24-075D', count: 1 }],
        inventoryMode: [{ value: 'single', count: 1 }],
        shippingMode: [{ value: 'parcel', count: 1 }],
      },
      priceRange: { min: 125, max: 125 },
    };
  } else if (requestPath === '/api/business-industrial/catalog/search') {
    searchRequests += 1;
    data = { vertical: 'business_industrial', total: 1, limit: 25, offset: 0, nextCursor: null, queryTimeMs: 5, items: [item] };
  } else if (requestPath === '/api/business-industrial/catalog/summary') {
    summaryRequests += 1;
    data = { vertical: 'business_industrial', organizationId: 'org-test', total: 1, withImages: 1, missingImages: 0, published: 0 };
  } else if (requestPath === '/api/business-industrial/catalog/products/' + item.id) data = item;
  else if (requestPath === '/api/business-industrial/ebay/accounts') data = [{ id: 'acct-bi-test', storeId: 'store-bi-test', storeName: 'B&I Test Store', accountDisplayName: 'B&I Test Account', status: 'active', connectionStatus: 'active', marketplaceId: 'EBAY_US', locationKey: 'warehouse-bi', marketplaces: [{ marketplaceId: 'EBAY_US', defaultFulfillmentPolicyId: 'fulfillment-bi', defaultPaymentPolicyId: 'payment-bi', defaultReturnPolicyId: 'return-bi', defaultInventoryLocationKey: 'warehouse-bi' }] }];
  else if (requestPath === '/api/business-industrial/ebay/accounts/acct-bi-test/policies') data = { policies: [{ id: 'policy-fulfillment', marketplaceId: 'EBAY_US', policyType: 'fulfillment', ebayPolicyId: 'fulfillment-bi', name: 'B&I Shipping' }, { id: 'policy-payment', marketplaceId: 'EBAY_US', policyType: 'payment', ebayPolicyId: 'payment-bi', name: 'B&I Payment' }, { id: 'policy-return', marketplaceId: 'EBAY_US', policyType: 'return', ebayPolicyId: 'return-bi', name: 'B&I Returns' }] };
  else if (requestPath === '/api/business-industrial/ebay/listings/validate' && route.request().method() === 'POST') data = { results: [{ blockingErrors: [], warnings: [], status: 'valid' }] };
  else if (requestPath === '/api/business-industrial/ebay/listings/publish' && route.request().method() === 'POST') data = { jobId: 'job-bi-test', status: 'queued' };
  else if (requestPath === '/api/business-industrial/ebay/listing-jobs/job-bi-test') data = { id: 'job-bi-test', jobId: 'job-bi-test', status: 'completed', targets: [{ id: 'target-bi-test', status: 'published' }] };
  else return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected fixture request ' + requestPath }) });
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
});

try {
  await page.goto(base + '/business-industrial/catalog');
  await page.getByRole('heading', { name: 'Catalog', exact: true }).waitFor();
  await page.getByRole('table').getByRole('button', { name: 'Siemens industrial power supply', exact: true }).waitFor();
  assert.equal(await page.getByText('Industrial automation & controls', { exact: true }).count() > 0, true);
  assert.equal(await page.getByText('Manufacturer', { exact: true }).count() > 0, true);
  assert.equal(await page.getByText('Inventory mode', { exact: true }).count() > 0, true);
  assert.equal(await page.getByText('Shipping mode', { exact: true }).count() > 0, true);
  assert.equal(await page.getByText('Make', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Fitment', { exact: true }).count(), 0);
  assert.equal(await page.getByText('PS24-075D', { exact: true }).count() > 0, true);
  assert.equal(await page.getByRole('button', { name: 'Add Equipment' }).count() > 0, true);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByRole('dialog', { name: 'Filters' }).waitFor();
  await page.getByRole('button', { name: 'Close filters' }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  const beforeRefresh = summaryRequests;
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.waitForTimeout(300);
  assert.equal(summaryRequests > beforeRefresh, true);
  assert.equal(searchRequests >= 2, true);
  await page.getByRole('button', { name: /Quick view/ }).first().click();
  await page.getByText('Images (3/24)', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: /Select image/ }).count(), 3);
  await page.getByRole('button', { name: 'Open image 1 of 3' }).click();
  await page.getByText('1 / 3', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next image' }).click();
  await page.getByText('2 / 3', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Validate & publish' }).click();
  await page.getByRole('heading', { name: 'Validate and publish listing' }).waitFor();
  await page.getByText('Connected store policies & location', { exact: true }).waitFor();
  await page.getByText('warehouse-bi', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Validate listing' }).click();
  await page.getByText('Validation passed; this listing is ready to queue.', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Publish to .* store/ }).click();
  await page.getByText('Publish job submitted. Progress will update here.', { exact: true }).waitFor();
  await page.getByText('Published', { exact: true }).waitFor();
  await page.getByText('Closing this panel does not cancel the job.', { exact: false }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS B&I catalog parity, vertical filters, populated row data, refresh, and publish job phases');
} finally {
  await context.close();
  await browser.close();
}
