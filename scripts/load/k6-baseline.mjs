/**
 * k6 load baseline for RealTrackApp API.
 *
 * Prerequisites:
 *   - k6 installed: https://grafana.com/docs/k6/latest/set-up/install-k6/
 *   - Backend running (default http://localhost:4191)
 *
 * Usage:
 *   k6 run scripts/load/k6-baseline.mjs
 *   BASE_URL=http://localhost:4191 k6 run scripts/load/k6-baseline.mjs
 *   k6 run --vus 20 --duration 2m scripts/load/k6-baseline.mjs
 *
 * Auth (optional — exercises protected read endpoints):
 *   K6_AUTH_EMAIL=admin@realtrack.local K6_AUTH_PASSWORD=ChangeMe123! k6 run scripts/load/k6-baseline.mjs
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://localhost:4191').replace(/\/$/, '');
const authEmail = __ENV.K6_AUTH_EMAIL || '';
const authPassword = __ENV.K6_AUTH_PASSWORD || '';

const healthDuration = new Trend('health_duration', true);
const listingsDuration = new Trend('listings_duration', true);
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    baseline: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    health_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

export function setup() {
  if (!authEmail || !authPassword) {
    console.warn('K6_AUTH_EMAIL / K6_AUTH_PASSWORD not set — skipping authenticated endpoints');
    return { token: null };
  }

  const res = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email: authEmail, password: authPassword }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (res.status !== 201 && res.status !== 200) {
    console.warn(`Login failed (${res.status}): ${res.body}`);
    return { token: null };
  }

  const body = res.json();
  return { token: body.accessToken || body.token || null };
}

export default function (data) {
  const healthRes = http.get(`${baseUrl}/api/health`);
  healthDuration.add(healthRes.timings.duration);
  check(healthRes, { 'health status 200': (r) => r.status === 200 }) || errorRate.add(1);

  const runtimeRes = http.get(`${baseUrl}/api/health/runtime`);
  check(runtimeRes, { 'runtime status 200': (r) => r.status === 200 }) || errorRate.add(1);

  if (data.token) {
    const headers = { Authorization: `Bearer ${data.token}` };
    const listingsRes = http.get(`${baseUrl}/api/listings?limit=20`, { headers });
    listingsDuration.add(listingsRes.timings.duration);
    check(listingsRes, {
      'listings status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  sleep(0.5 + Math.random() * 0.5);
}

export function handleSummary(data) {
  const p95Health = data.metrics.health_duration?.values?.['p(95)'];
  const p95Listings = data.metrics.listings_duration?.values?.['p(95)'];
  const failed = data.metrics.http_req_failed?.values?.rate;

  console.log('\n── RealTrackApp k6 baseline summary ──');
  console.log(`Base URL: ${baseUrl}`);
  console.log(`HTTP failed rate: ${failed != null ? (failed * 100).toFixed(2) : 'n/a'}%`);
  console.log(`Health p95: ${p95Health != null ? p95Health.toFixed(0) : 'n/a'} ms`);
  if (p95Listings != null) {
    console.log(`Listings p95: ${p95Listings.toFixed(0)} ms`);
  }
  console.log('Save full JSON: k6 run --summary-export=docs/load/baseline-latest.json scripts/load/k6-baseline.mjs\n');

  return {
    stdout: '',
  };
}
