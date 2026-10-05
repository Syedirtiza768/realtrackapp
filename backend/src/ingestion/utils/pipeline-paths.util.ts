import * as fs from 'node:fs';
import * as path from 'node:path';

const PIPELINE_SCRIPT_RELATIVE_PATH = path.join(
  'scripts',
  'ebay-enrichment-pipeline.mjs',
);

/**
 * Resolve the repository root used by pipeline uploads, output, and scripts.
 *
 * Docker runs the backend with `/app` as its working directory, while local
 * development commonly runs it from `backend/`. Prefer the configured root,
 * but only when it contains the pipeline script; this keeps an unset or stale
 * PIPELINE_PROJECT_ROOT from resolving to `/scripts` in the container.
 */
export function resolvePipelineProjectRoot(): string {
  const configuredRoot = process.env.PIPELINE_PROJECT_ROOT?.trim();
  const cwd = process.cwd();
  const candidates = [configuredRoot, cwd, path.resolve(cwd, '..')]
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => path.resolve(candidate));

  const uniqueCandidates = [...new Set(candidates)];
  const rootWithPipelineScript = uniqueCandidates.find((root) =>
    fs.existsSync(path.join(root, PIPELINE_SCRIPT_RELATIVE_PATH)),
  );

  return rootWithPipelineScript ?? uniqueCandidates[0] ?? cwd;
}
