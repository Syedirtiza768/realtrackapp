#!/usr/bin/env node
/**
 * Standalone AI routing optimizer CLI — advisor mode (Phase 2).
 *
 * Usage:
 *   node scripts/ai-optimize-routing.mjs
 *   node scripts/ai-optimize-routing.mjs --apply
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf('=');
    if (idx < 0) continue;
    env[t.slice(0, idx).trim()] = t.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = {
  ...loadEnv(path.resolve(ROOT, 'backend/.env')),
  ...loadEnv(path.resolve(ROOT, '.env')),
  ...process.env,
};

const PRIOR_REWARDS = {
  'openai/gpt-4.1-mini': 0.98,
  'google/gemini-2.5-flash': 1.0,
  'deepseek/deepseek-chat-v3-0324': 0.94,
  'openai/gpt-4o-mini': 0.8,
};

function computeReward(row) {
  const normalizedCost = Math.min((row.avgCost || 0) / 0.01, 1);
  return (
    0.4 * (row.humanApprovalRate || PRIOR_REWARDS[row.model] || 0.85) +
    0.3 * (row.firstPassRate || 0) +
    0.2 * (row.publishSuccessRate || 0) +
    0.1 * (1 - normalizedCost) -
    0.5 * (row.escalationRate || 0)
  );
}

async function fetchStatsFromDb() {
  // CLI advisor mode: read latest ai-run-logs sidecar from pipeline output if present
  const sidecar = path.resolve(ROOT, 'output/ai-run-logs.json');
  if (!fs.existsSync(sidecar)) return null;
  const parsed = JSON.parse(fs.readFileSync(sidecar, 'utf8'));
  const logs = Array.isArray(parsed) ? parsed : parsed.logs ?? [];
  const byKey = new Map();
  for (const log of logs) {
    const key = `${log.partType || 'general'}|${log.lane || 'default'}`;
    const cur = byKey.get(key) ?? {
      segmentKey: key,
      model: log.model,
      attempts: 0,
      firstPass: 0,
      escalated: 0,
      approved: 0,
      withOutcome: 0,
      costSum: 0,
    };
    cur.attempts++;
    if (log.passedGate && !log.escalated) cur.firstPass++;
    if (log.escalated) cur.escalated++;
    if (log.humanApproved != null) {
      cur.withOutcome++;
      if (log.humanApproved) cur.approved++;
    }
    cur.costSum += log.costUsd || 0;
    byKey.set(key, cur);
  }
  return [...byKey.values()].map((r) => ({
    segmentKey: r.segmentKey,
    model: r.model,
    attempts: r.attempts,
    firstPassRate: r.attempts ? r.firstPass / r.attempts : 0,
    escalationRate: r.attempts ? r.escalated / r.attempts : 0,
    avgCost: r.attempts ? r.costSum / r.attempts : 0,
    humanApprovalRate: r.withOutcome ? r.approved / r.withOutcome : 0,
    publishSuccessRate: 0,
    reward: 0,
  }));
}

async function main() {
  const apply = process.argv.includes('--apply');
  let stats = await fetchStatsFromDb();

  if (!stats?.length) {
    console.log('No ai_run_logs data — using benchmark priors only');
    stats = Object.entries(PRIOR_REWARDS).map(([model, prior]) => ({
      segmentKey: '*|*',
      model,
      attempts: 0,
      firstPassRate: prior,
      escalationRate: 0,
      avgCost: model.includes('deepseek') ? 0.0012 : 0.0021,
      humanApprovalRate: prior,
      publishSuccessRate: 0,
      reward: prior,
    }));
  } else {
    stats = stats.map((s) => ({ ...s, reward: computeReward(s) }));
  }

  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.resolve(ROOT, 'docs/ai-optimization');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.resolve(outDir, `routing-recommendations-${date}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    minSamples: Number(env.AI_LEARNING_MIN_SAMPLES || 20),
    recommendations: stats.sort((a, b) => b.reward - a.reward),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${reportPath}`);

  if (apply) {
    const policyPath =
      env.AI_ROUTING_POLICY_PATH
        ? path.resolve(ROOT, env.AI_ROUTING_POLICY_PATH)
        : path.resolve(ROOT, 'config/ai-routing-policy.json');
    const current = fs.existsSync(policyPath)
      ? JSON.parse(fs.readFileSync(policyPath, 'utf8'))
      : { version: 0, segments: {}, thresholds: {}, escalationChain: [], blocklist: [] };
    const next = {
      ...current,
      version: (current.version || 0) + 1,
      generatedAt: new Date().toISOString(),
      source: 'cli-optimizer',
      canaryPercent: Number(env.AI_OPTIMIZER_CANARY_PERCENT || 10),
    };
    for (const rec of report.recommendations) {
      if (rec.attempts >= report.minSamples) {
        next.segments[rec.segmentKey] = {
          lane:
            rec.model === 'deepseek/deepseek-chat-v3-0324'
              ? 'bulk'
              : rec.model === 'google/gemini-2.5-flash'
                ? 'flagship'
                : 'default',
          model: rec.model,
        };
      }
    }
    fs.writeFileSync(policyPath, JSON.stringify(next, null, 2));
    const historyPath = path.resolve(ROOT, 'config/ai-routing-policy-history.json');
    const history = fs.existsSync(historyPath)
      ? JSON.parse(fs.readFileSync(historyPath, 'utf8'))
      : [];
    history.push({
      version: next.version,
      policy: next,
      source: next.source,
      generatedAt: next.generatedAt,
    });
    fs.writeFileSync(historyPath, JSON.stringify(history.slice(-50), null, 2));
    console.log(`Applied policy v${next.version} → ${policyPath}`);
    console.log(`Appended history → ${historyPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
