#!/usr/bin/env node
// Pre-commit gate: if a commit touches architecturally relevant source and
// doesn't touch the docs/ vault, ask the local `claude` CLI to judge whether
// it should have. Blocks on "yes" — override with SKIP_DOCS_CHECK=1.
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

// On Windows, Node's execSync shells out via cmd.exe, whose PATH doesn't always
// include per-user install dirs (e.g. ~/.local/bin) that a Git Bash / POSIX
// shell session picks up. Extend PATH so `claude` resolves the same way here.
const home = process.env.USERPROFILE || process.env.HOME || "";
const extraPaths = [`${home}\\.local\\bin`, `${home}/.local/bin`].filter(Boolean);
const CHILD_ENV = {
  ...process.env,
  PATH: [process.env.PATH, ...extraPaths].filter(Boolean).join(process.platform === "win32" ? ";" : ":"),
};

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", env: CHILD_ENV, ...opts });
}

function warnFallback(reason, files) {
  console.warn(`[docs-check] ${reason}`);
  console.warn(
    `[docs-check] This commit touches ${files.length} file(s) under src/, backend/src/, ` +
      `backend/scripts/, scripts/, or shared/ without touching docs/. Check docs/Home.md and ` +
      `update the relevant area note or docs/decisions.md if this is architecturally significant.`,
  );
  console.warn("[docs-check] Override once you've checked: SKIP_DOCS_CHECK=1 git commit ...");
}

if (process.env.SKIP_DOCS_CHECK) {
  console.log("[docs-check] SKIP_DOCS_CHECK set — skipping.");
  process.exit(0);
}

const staged = sh("git diff --cached --name-only").trim().split("\n").filter(Boolean);
if (staged.length === 0) process.exit(0);

const docsTouched = staged.some((f) => f.startsWith("docs/") || f === "CLAUDE.md" || f === "AGENTS.md");
if (docsTouched) process.exit(0);

const RELEVANT = [
  /^src\//,
  /^backend\/src\//,
  /^backend\/scripts\//,
  /^scripts\//,
  /^shared\//,
];
const relevant = staged.filter((f) => RELEVANT.some((re) => re.test(f)));
if (relevant.length === 0) process.exit(0);

let notes = [];
for (const dir of ["docs", "docs/areas"]) {
  try {
    notes.push(...readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => `${dir}/${f}`));
  } catch {
    // dir may not exist in some checkout states; fine to skip
  }
}

let diff;
try {
  diff = sh(`git diff --cached -- ${relevant.map((f) => JSON.stringify(f)).join(" ")}`).slice(0, 12000);
} catch (err) {
  warnFallback(`Could not read staged diff (${err.message.split("\n")[0]}).`, relevant);
  process.exit(1);
}

const prompt =
  `You are a pre-commit check for a full-stack app (React frontend in src/, NestJS backend ` +
  `in backend/). Existing architecture docs (an Obsidian vault):\n${notes.join("\n")}\n\n` +
  `Staged diff (source files only, may be truncated):\n${diff}\n\n` +
  `Does this diff introduce a change significant enough that one of the docs notes above (or ` +
  `docs/decisions.md) should be updated to stay accurate? Ignore purely cosmetic/refactor/` +
  `formatting changes. Reply with EXACTLY one line: "OK" if no doc update is warranted, or ` +
  `"UPDATE_NEEDED: <note path> — <reason in under 15 words>" if one is.`;

let verdict;
try {
  verdict = sh(`claude -p ${JSON.stringify(prompt)}`, { timeout: 45000 }).trim();
} catch (err) {
  warnFallback(
    `Could not run \`claude\` CLI for a smart check (${err.message.split("\n")[0]}).`,
    relevant,
  );
  process.exit(1);
}

if (verdict.toUpperCase().startsWith("UPDATE_NEEDED")) {
  console.error(`[docs-check] ${verdict}`);
  console.error("[docs-check] Update that note (or docs/decisions.md) and re-stage, or override:");
  console.error("[docs-check]   SKIP_DOCS_CHECK=1 git commit ...");
  process.exit(1);
}

console.log(`[docs-check] OK — ${verdict}`);
process.exit(0);
