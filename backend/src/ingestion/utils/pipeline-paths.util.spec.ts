import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolvePipelineProjectRoot } from './pipeline-paths.util.js';

describe('resolvePipelineProjectRoot', () => {
  const originalRoot = process.env.PIPELINE_PROJECT_ROOT;
  const currentCheckoutRoot = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
  ].find((candidate) =>
    fs.existsSync(
      path.join(candidate, 'scripts', 'ebay-enrichment-pipeline.mjs'),
    ),
  )!;

  afterEach(() => {
    if (originalRoot === undefined) {
      delete process.env.PIPELINE_PROJECT_ROOT;
    } else {
      process.env.PIPELINE_PROJECT_ROOT = originalRoot;
    }
  });

  it('uses the configured root when it contains the pipeline script', () => {
    process.env.PIPELINE_PROJECT_ROOT = currentCheckoutRoot;

    expect(resolvePipelineProjectRoot()).toBe(currentCheckoutRoot);
  });

  it('falls back to the current working directory when configured root is stale', () => {
    process.env.PIPELINE_PROJECT_ROOT = path.parse(process.cwd()).root;

    expect(resolvePipelineProjectRoot()).toBe(currentCheckoutRoot);
  });
});
