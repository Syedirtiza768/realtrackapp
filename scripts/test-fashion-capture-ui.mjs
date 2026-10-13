import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const runtime = process.env.FASHION_PLAYWRIGHT_PATH || path.resolve('.codex-fashion-test-runtime/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: true, executablePath: process.env.FASHION_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const base = process.env.FASHION_UI_URL || 'http://127.0.0.1:3935';
const errors = [];
const permissions = ['access', 'dashboard.view', 'listings.view', 'listings.create', 'listings.update', 'settings.manage'].map((permission) => `fashion.${permission}`);
async function setup({ hangSku = false, holdUploads = false, cameraMode = 'normal' } = {}) {
  const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 390, height: 844 } });
  await context.addInitScript((mode) => {
    localStorage.setItem('mk_auth_token', 'mock-camera-test-token');
    window.__cameraMode = mode; window.__streams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.__openRealCamera = original;
    navigator.mediaDevices.getUserMedia = async (...args) => {
      if (window.__cameraMode === 'denied') throw new DOMException('Permission denied', 'NotAllowedError');
      if (window.__cameraMode === 'hang') return new Promise((resolve) => { window.__resolveCamera = resolve; });
      const stream = await original(...args); window.__streams.push(stream); return stream;
    };
  }, cameraMode);
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const state = { skuCalls: 0, uploads: [], saves: [], holdUploads, failUpload: false, failSave: false, hangSku };
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data;
    if (pathname === '/api/auth/me') data = { user: { id: 'camera-test-user', email: 'camera@example.test', name: 'Camera test', role: 'user', roleSlug: 'fashion_admin', active: true, permissions }, organizations: [] };
    else if (pathname === '/api/client-settings/branding') data = {};
    else if (pathname === '/api/rbac/roles/sidebar-config/me') data = { visibleModules: [] };
    else if (pathname === '/api/fashion/measurement-templates' || pathname === '/api/fashion/warehouses' || pathname === '/api/fashion/intake/batches' || pathname === '/api/fashion/ebay/accounts') data = [];
    else if (pathname === '/api/fashion/intake/sku') {
      state.skuCalls++;
      if (state.hangSku) return;
      data = { batch: 'AVP', number: 12969 + state.skuCalls, sku: `AVP-${12969 + state.skuCalls}` };
    } else if (pathname === '/api/fashion/listings/photos') {
      const index = state.uploads.length;
      let release; const gate = new Promise((resolve) => { release = resolve; });
      state.uploads.push({ release });
      if (state.holdUploads) await gate;
      if (state.failUpload) { state.failUpload = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Upload interrupted. Retry this photo.' }) }); }
      data = { uploaded: [{ url: `https://images.example.test/photo-${index}.webp`, s3Key: `photo-${index}.webp`, filename: 'photo.webp' }], errors: [] };
    } else if (pathname === '/api/fashion/intake' && route.request().method() === 'POST') {
      const payload = route.request().postDataJSON(); state.saves.push(payload);
      if (state.failSave) { state.failSave = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Save confirmation was interrupted. Retry safely.' }) }); }
      data = { id: '11111111-1111-4111-8111-111111111111', sku: payload.sku, title: 'Saved garment', verticalAttributes: {}, verticalValidationStatus: 'draft' };
    } else data = {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return { page, context, state };
}
async function shot(page, label) {
  await page.getByRole('button', { name: `Capture ${label}`, exact: true }).click();
  await page.getByRole('button', { name: 'Use photo & continue' }).click();
}
async function waitUntil(fn, message) {
  for (let attempt = 0; attempt < 100; attempt++) { if (fn()) return; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error(message);
}
try {
  const { page, context, state } = await setup({ holdUploads: true });
  await page.goto(`${base}/fashion/capture`);
  await page.getByLabel('Generated SKU').filter({ hasText: 'AVP-' }).waitFor();
  const baseSku = await page.getByLabel('Generated SKU').innerText();
  const initialCalls = state.skuCalls;
  assert.equal(await page.getByLabel('Add measurement chart').isChecked(), false);
  await page.getByRole('button', { name: 'M', exact: true }).click();
  assert.equal(await page.getByLabel('Generated SKU').innerText(), `${baseSku}-M`);
  await page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await page.getByRole('button', { name: 'Capture front', exact: true }).click();
  await page.getByRole('button', { name: 'Retake', exact: true }).click();
  assert.equal(state.uploads.length, 0, 'Retake must not upload discarded frames');
  await shot(page, 'front'); await shot(page, 'back'); await shot(page, 'tag & labels');
  await waitUntil(() => state.uploads.length === 2, 'First two uploads did not start');
  assert.equal(state.uploads.length, 2, 'Upload concurrency must be bounded');
  await page.getByRole('button', { name: 'Close camera' }).click();
  assert.equal(await page.evaluate(() => window.__streams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended'))), true);
  await page.getByRole('button', { name: 'L', exact: true }).click();
  assert.equal(await page.getByLabel('Generated SKU').innerText(), `${baseSku}-L`);
  assert.equal(state.skuCalls, initialCalls, 'Size correction must preserve the number');
  assert.equal(await page.getByRole('button', { name: 'Save & next garment' }).isDisabled(), true);
  state.holdUploads = false; state.uploads.forEach((upload) => upload.release());
  await waitUntil(() => state.uploads.length === 3, 'Third photo did not upload');
  await page.getByRole('button', { name: 'Save & next garment' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Save & next garment' }).click();
  await page.getByText(/saved — identifying in the background/).waitFor();
  assert.equal(state.saves[0].sku, `${baseSku}-L`);
  assert.equal(state.saves[0].frontImageUrl, 'https://images.example.test/photo-0.webp');
  assert.equal(state.saves[0].backImageUrl, 'https://images.example.test/photo-1.webp');
  assert.equal(state.saves[0].tagImageUrls[0], 'https://images.example.test/photo-2.webp');
  assert(state.saves[0].captureId);
  await page.getByLabel('Generated SKU').filter({ hasText: new RegExp(`^AVP-${12969 + state.skuCalls}$`) }).waitFor();
  assert.equal(await page.getByLabel('Other label size').inputValue(), '');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Mobile layout must fit');
  await page.screenshot({ path: process.env.FASHION_CAPTURE_SCREENSHOT || 'fashion-capture-mobile.png', fullPage: true });
  console.log('PASS continuous camera, retake, bounded uploads, size correction, photo roles, next garment, mobile layout');

  await page.getByRole('button', { name: 'S', exact: true }).click();
  state.failUpload = true;
  await page.getByRole('button', { name: 'Open camera', exact: true }).click(); await shot(page, 'front');
  await page.getByRole('button', { name: 'Close camera' }).click();
  await page.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await page.getByRole('img', { name: 'Front photo 1', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open camera', exact: true }).click(); await shot(page, 'back'); await shot(page, 'tag & labels');
  await page.getByRole('button', { name: 'Close camera' }).click();
  state.failSave = true;
  await page.getByRole('button', { name: 'Save & next garment' }).click();
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await page.getByText(/saved — identifying in the background/).waitFor();
  assert.deepEqual(state.saves[1], state.saves[2], 'Save retries must keep the same payload and capture identity');
  console.log('PASS failed upload retains photo, explicit retry, interrupted save preserves exact capture');
  await context.close();

  const denied = await setup({ cameraMode: 'denied' });
  await denied.page.goto(`${base}/fashion/capture`); await denied.page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await denied.page.getByText(/Camera access was denied/).waitFor();
  assert.equal(await denied.page.getByRole('button', { name: 'Retry camera', exact: true }).isEnabled(), true);
  await denied.context.close();
  const stalled = await setup({ cameraMode: 'hang', hangSku: true });
  await stalled.page.clock.install();
  await stalled.page.goto(`${base}/fashion/capture`);
  await stalled.page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await stalled.page.clock.fastForward(16_000);
  await stalled.page.getByText(/Camera access is taking too long/).waitFor();
  assert.equal(await stalled.page.evaluate(async () => {
    const stream = await window.__openRealCamera({ video: true });
    window.__resolveCamera(stream);
    await new Promise((resolve) => queueMicrotask(resolve));
    await new Promise((resolve) => queueMicrotask(resolve));
    return stream.getTracks().every((track) => track.readyState === 'ended');
  }), true, 'Late camera grants must release the stream');
  await stalled.page.getByRole('button', { name: 'Close camera' }).click();
  await stalled.page.clock.fastForward(46_000);
  await stalled.page.getByRole('button', { name: 'Retry automatic SKU', exact: true }).waitFor();
  stalled.state.hangSku = false;
  await stalled.page.getByRole('button', { name: 'Retry automatic SKU', exact: true }).click();
  await stalled.page.getByLabel('Generated SKU').filter({ hasText: 'AVP-' }).waitFor();
  assert.equal(await stalled.page.getByRole('button', { name: 'Open camera', exact: true }).isEnabled(), true);
  await stalled.context.close();
  console.log('PASS permission denial, camera deadline, late-stream cleanup, SKU deadline and retry');
  const uploadTimeout = await setup({ holdUploads: true });
  await uploadTimeout.page.clock.install();
  await uploadTimeout.page.goto(`${base}/fashion/capture`);
  await uploadTimeout.page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await shot(uploadTimeout.page, 'front');
  await uploadTimeout.page.getByRole('button', { name: 'Close camera' }).click();
  await waitUntil(() => uploadTimeout.state.uploads.length === 1, 'Upload never started');
  await uploadTimeout.page.clock.fastForward(46_000);
  await uploadTimeout.page.getByRole('button', { name: 'Retry upload', exact: true }).waitFor();
  assert.equal(await uploadTimeout.page.getByRole('img', { name: 'Front pending upload', exact: true }).isVisible(), true);
  uploadTimeout.state.holdUploads = false;
  await uploadTimeout.page.getByRole('button', { name: 'Retry upload', exact: true }).click();
  await uploadTimeout.page.getByRole('img', { name: 'Front photo 1', exact: true }).waitFor();
  uploadTimeout.state.uploads.forEach((upload) => upload.release());
  await uploadTimeout.context.close();
  console.log('PASS hanging upload times out, retains the local photo and retries successfully');
  const editor = await setup();
  await editor.page.goto(`${base}/fashion/listings/new`);
  await editor.page.getByLabel('SKU *', { exact: true }).filter({ visible: true }).waitFor();
  await editor.page.getByLabel('Label size', { exact: false }).first().fill('M');
  await editor.page.waitForFunction(() => document.querySelector('input[maxlength="160"]')?.value?.endsWith('-M'));
  const editorSku = await editor.page.getByLabel('SKU *', { exact: false }).inputValue();
  const editorCalls = editor.state.skuCalls;
  await editor.page.getByLabel('Label size', { exact: false }).first().fill('L');
  await editor.page.waitForFunction(() => document.querySelector('input[maxlength="160"]')?.value?.endsWith('-L'));
  assert.equal(await editor.page.getByLabel('SKU *', { exact: false }).inputValue(), editorSku.replace(/-M$/, '-L'));
  assert.equal(editor.state.skuCalls, editorCalls);
  await editor.context.close();
  console.log('PASS Add Item shares automatic AVP numbering and size correction');
  assert.deepEqual(errors, [], 'Unexpected browser errors');
} finally { await browser.close(); }
