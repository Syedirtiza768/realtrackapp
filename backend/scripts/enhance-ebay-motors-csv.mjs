import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import {
  DEFAULT_MODEL,
  applyApprovedChanges,
  buildModelPayload,
  buildPrompts,
  createChangeEntry,
  defaultOutputPaths,
  extractApprovedFields,
  getItemRows,
  inspectStructure,
  parseArgs,
  parseCsvDocument,
  parseModelResponse,
  renderChangesCsv,
  serializeCsvDocument,
  sleep,
  summarizeExamples,
  validateProposal,
  verifyStructure,
} from './lib/ebay-csv-enhancer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultInput = path.join(repoRoot, 'inventory-export-selected-25-2026-03-16 (1).csv');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sourcePath = path.resolve(options.input || defaultInput);
  const outputPaths = defaultOutputPaths(sourcePath);
  const outputPath = path.resolve(options.output || outputPaths.output);
  const reportPath = path.resolve(options.report || outputPaths.report);
  const changesPath = path.resolve(options.changes || outputPaths.changes);
  const apiKey = process.env.OPENAI_API_KEY || '';

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source CSV not found: ${sourcePath}`);
  }

  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const document = parseCsvDocument(sourceText);
  const inspection = inspectStructure(document);
  const itemRows = getItemRows(document, inspection).slice(0, options.maxItems);
  const baseURL = process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
  const client = apiKey
    ? new OpenAI({
        apiKey,
        baseURL,
        maxRetries: 0,
        timeout: 60_000,
        defaultHeaders: {
          'HTTP-Referer': 'https://realtrackapp.com',
          'X-Title': 'RealTrackApp',
        },
      })
    : null;

  if (!client && !options.dryRun && !options.allowMissingKey) {
    throw new Error('OPENAI_API_KEY is not set. Use --dry-run or set the key to run enhancements.');
  }

  const report = {
    model: options.model || process.env.OPENAI_CHAT_MODEL || DEFAULT_MODEL,
    source: sourcePath,
    output: outputPath,
    report: reportPath,
    changes: changesPath,
    dryRun: options.dryRun,
    startedAt: new Date().toISOString(),
    structureBefore: {
      totalRows: inspection.totalRows,
      totalColumns: inspection.totalColumns,
      metadataRows: inspection.metadataRows,
      headerRowNumber: inspection.headerRowNumber,
      dataStartRowNumber: inspection.dataStartRowNumber,
      itemRowCount: inspection.itemRowCount,
      compatibilityRowCount: inspection.compatibilityRowCount,
      newlineStyle: document.newlineStyle,
      hasUtf8Bom: document.hasBom,
    },
    processing: {
      requestedItemCount: itemRows.length,
      batchSize: options.batchSize,
      sampleSize: options.sampleSize,
      changedCount: 0,
      skippedCount: 0,
      failureCount: 0,
    },
    samples: [],
    warnings: [],
    failures: [],
    structureAfter: null,
    integrity: null,
    finishedAt: null,
  };

  const changeEntries = [];
  let samplePrinted = false;

  for (let start = 0; start < itemRows.length; start += options.batchSize) {
    const batch = itemRows.slice(start, start + options.batchSize);

    for (const row of batch) {
      const fields = extractApprovedFields(row, inspection.headerMap);
      const payload = buildModelPayload(fields);

      const outcome = await processRow({
        client,
        model: options.model || DEFAULT_MODEL,
        fields,
        payload,
        dryRun: options.dryRun,
        allowMissingKey: options.allowMissingKey,
      });

      if (outcome.status === 'changed') {
        applyApprovedChanges(row, inspection.headerMap, {
          changedFields: outcome.changedFields,
          sanitizedTitle: outcome.newTitle,
          sanitizedDescription: outcome.newDescription,
        });
        report.processing.changedCount += 1;
      } else if (outcome.status === 'failed') {
        report.processing.failureCount += 1;
        report.failures.push({
          csvRowNumber: row.csvRowNumber,
          customLabel: fields.customLabel,
          reason: outcome.skipReason,
        });
      } else {
        report.processing.skippedCount += 1;
      }

      const changeEntry = createChangeEntry(row, fields, outcome);
      changeEntries.push(changeEntry);

      if (outcome.warnings?.length) {
        report.warnings.push({
          csvRowNumber: row.csvRowNumber,
          customLabel: fields.customLabel,
          warnings: outcome.warnings,
        });
      }
    }

    if (!samplePrinted && changeEntries.length >= Math.min(options.sampleSize, itemRows.length)) {
      const samples = summarizeExamples(changeEntries, options.sampleSize);
      report.samples = samples;
      printSamples(samples);
      samplePrinted = true;
    }

    if (options.delayMs > 0 && start + options.batchSize < itemRows.length) {
      await sleep(options.delayMs);
    }
  }

  const outputText = serializeCsvDocument(document);
  const integrity = verifyStructure(parseCsvDocument(sourceText), outputText, inspection);
  report.integrity = {
    ok: integrity.ok,
    issues: integrity.issues,
  };
  report.structureAfter = {
    totalRows: integrity.outputInspection.totalRows,
    totalColumns: integrity.outputInspection.totalColumns,
    metadataRows: integrity.outputInspection.metadataRows,
    headerRowNumber: integrity.outputInspection.headerRowNumber,
    dataStartRowNumber: integrity.outputInspection.dataStartRowNumber,
    itemRowCount: integrity.outputInspection.itemRowCount,
    compatibilityRowCount: integrity.outputInspection.compatibilityRowCount,
  };

  if (!integrity.ok) {
    throw new Error(`Integrity validation failed: ${integrity.issues.join(' | ')}`);
  }

  fs.writeFileSync(reportPath, `${JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(changesPath, `${renderChangesCsv(changeEntries)}\r\n`, 'utf8');

  if (!options.dryRun) {
    fs.writeFileSync(outputPath, outputText, 'utf8');
  }

  const finalReport = {
    ...report,
    finishedAt: new Date().toISOString(),
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(finalReport, null, 2)}\n`, 'utf8');

  printSummary({
    sourcePath,
    outputPath,
    reportPath,
    changesPath,
    dryRun: options.dryRun,
    report: finalReport,
  });
}

async function processRow({ client, model, fields, payload, dryRun, allowMissingKey }) {
  if (!client) {
    return {
      status: dryRun || allowMissingKey ? 'skipped' : 'failed',
      changedFields: [],
      newTitle: fields.title,
      newDescription: payload.description,
      warnings: [],
      skipReason: 'missing_openai_api_key',
    };
  }

  const prompts = buildPrompts(payload);

  try {
    const response = await callWithRetry(() =>
      client.chat.completions.create({
        model,
        temperature: 0.1,
        max_completion_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompts.systemPrompt },
          { role: 'user', content: prompts.userPrompt },
        ],
      }),
    );

    const parsed = parseModelResponse(response.choices[0]?.message?.content ?? '{}');
    const validation = validateProposal(fields, parsed);
    if (!validation.accepted) {
      return {
        status: 'skipped',
        changedFields: [],
        newTitle: fields.title,
        newDescription: payload.description,
        warnings: validation.warnings,
        skipReason: validation.errors.join(' | '),
      };
    }

    if (dryRun) {
      return {
        status: validation.changedFields.length > 0 ? 'changed' : 'skipped',
        changedFields: validation.changedFields,
        newTitle: validation.sanitizedTitle,
        newDescription: validation.sanitizedDescription,
        warnings: validation.warnings,
        skipReason: validation.changedFields.length > 0 ? '' : 'no_material_change',
      };
    }

    return {
      status: validation.changedFields.length > 0 ? 'changed' : 'skipped',
      changedFields: validation.changedFields,
      newTitle: validation.sanitizedTitle,
      newDescription: validation.sanitizedDescription,
      warnings: validation.warnings,
      skipReason: validation.changedFields.length > 0 ? '' : 'no_material_change',
    };
  } catch (error) {
    return {
      status: 'failed',
      changedFields: [],
      newTitle: fields.title,
      newDescription: payload.description,
      warnings: [],
      skipReason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

async function callWithRetry(fn, attempt = 0) {
  const maxRetries = 3;

  try {
    return await fn();
  } catch (error) {
    const status = error?.status ?? error?.response?.status;
    const shouldRetry = status === 429 || (status >= 500 && status < 600);
    if (!shouldRetry || attempt >= maxRetries) {
      throw error;
    }

    const delayMs = Math.pow(4, attempt) * 1000;
    await sleep(delayMs);
    return callWithRetry(fn, attempt + 1);
  }
}

function printSamples(samples) {
  console.log('Sample row results:');
  for (const sample of samples) {
    console.log(`- Row ${sample.csv_row_number} (${sample.custom_label || 'no label'}) [${sample.status}]`);
    console.log(`  Old Title: ${sample.old_title}`);
    console.log(`  New Title: ${sample.new_title}`);
    console.log(`  Old Description: ${sample.old_description_preview}`);
    console.log(`  New Description: ${sample.new_description_preview}`);
    if (sample.skip_reason) {
      console.log(`  Skip Reason: ${sample.skip_reason}`);
    }
  }
}

function printSummary({ sourcePath, outputPath, reportPath, changesPath, dryRun, report }) {
  console.log('Enhancement summary:');
  console.log(`- Source: ${sourcePath}`);
  console.log(`- Mode: ${dryRun ? 'dry-run' : 'write'}`);
  console.log(`- Items requested: ${report.processing.requestedItemCount}`);
  console.log(`- Changed: ${report.processing.changedCount}`);
  console.log(`- Skipped: ${report.processing.skippedCount}`);
  console.log(`- Failed: ${report.processing.failureCount}`);
  console.log(`- Integrity check: ${report.integrity.ok ? 'passed' : 'failed'}`);
  console.log(`- Report: ${reportPath}`);
  console.log(`- Changes: ${changesPath}`);
  if (!dryRun) {
    console.log(`- Output: ${outputPath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});