import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { PipelineJob, PipelineJobStatus } from '../entities/pipeline-job.entity.js';
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

export interface PipelineJobData {
  jobId: string;
  filePath: string;
  originalFilename: string;
}

/**
 * BullMQ processor for the enrichment pipeline queue.
 *
 * Spawns `scripts/ebay-enrichment-pipeline.mjs` as a child process,
 * monitors its stdout for progress, and updates the PipelineJob entity
 * through the lifecycle stages.
 */
@Processor('pipeline', { concurrency: 1 })
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(
    @InjectRepository(PipelineJob)
    private readonly jobRepo: Repository<PipelineJob>,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { jobId, filePath } = job.data;
    this.logger.log(`Starting pipeline job=${jobId}`);

    await this.updateStatus(jobId, 'uploading');

    // Resolve paths
    const projectRoot = path.resolve(process.cwd(), '..');
    const scriptPath = path.resolve(projectRoot, 'scripts', 'ebay-enrichment-pipeline.mjs');
    const outputDir = path.resolve(projectRoot, 'output', `pipeline-${jobId.slice(0, 8)}`);

    if (!fs.existsSync(scriptPath)) {
      await this.fail(jobId, `Pipeline script not found: ${scriptPath}`);
      throw new Error(`Pipeline script not found: ${scriptPath}`);
    }

    // Create output directory for this job
    fs.mkdirSync(outputDir, { recursive: true });

    try {
      await this.updateStatus(jobId, 'vin_decode');

      // Spawn the pipeline script with environment overrides
      const exitCode = await this.runPipeline(jobId, scriptPath, filePath, outputDir, projectRoot);

      if (exitCode !== 0) {
        await this.fail(jobId, `Pipeline exited with code ${exitCode}`);
        throw new Error(`Pipeline exited with code ${exitCode}`);
      }

      // Scan output directory for generated files
      await this.collectOutputs(jobId, outputDir);

      await this.updateStatus(jobId, 'completed');
      this.logger.log(`Pipeline job=${jobId} completed successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Pipeline job=${jobId} failed: ${message}`);
      await this.fail(jobId, message);
      throw err;
    }
  }

  private runPipeline(
    jobId: string,
    scriptPath: string,
    inputPath: string,
    outputDir: string,
    cwd: string,
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [scriptPath], {
        cwd,
        env: {
          ...process.env,
          PIPELINE_INPUT_FILE: inputPath,
          PIPELINE_OUTPUT_DIR: outputDir,
          PIPELINE_JOB_ID: jobId,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        // Parse progress from stdout markers
        this.parseProgress(jobId, text).catch(() => {});
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
        // Keep last 4KB of stderr
        if (stderr.length > 4096) {
          stderr = stderr.slice(-4096);
        }
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code !== 0 && stderr) {
          this.logger.error(`Pipeline stderr: ${stderr.slice(-500)}`);
        }
        resolve(code ?? 1);
      });
    });
  }

  /**
   * Parse stdout for STEP markers and update job status/stage accordingly.
   */
  private async parseProgress(jobId: string, text: string): Promise<void> {
    const stageMap: Record<string, PipelineJobStatus> = {
      'VIN Decod': 'vin_decode',
      'Category Mapping': 'category_mapping',
      'Enrichment': 'enrichment',
      'Enriching': 'enrichment',
      'OpenAI': 'enrichment',
      'Compliance': 'validation',
      'Validat': 'validation',
      'Generating Output': 'output_generation',
      'Pipeline Report': 'output_generation',
    };

    for (const [marker, status] of Object.entries(stageMap)) {
      if (text.includes(marker)) {
        await this.updateStatus(jobId, status);
        break;
      }
    }

    // Parse numeric progress from lines like "Processed 50/200 parts"
    const progressMatch = text.match(/(\d+)\s*\/\s*(\d+)\s*parts/i);
    if (progressMatch) {
      const processed = parseInt(progressMatch[1], 10);
      const total = parseInt(progressMatch[2], 10);
      await this.jobRepo.update(jobId, {
        processedParts: processed,
        totalParts: total,
      });
    }

    // Parse VIN decode stats
    const vinMatch = text.match(/VIN decode.*?(\d+)\s*success.*?(\d+)\s*fail/i);
    if (vinMatch) {
      await this.jobRepo.update(jobId, {
        vinDecodeSuccess: parseInt(vinMatch[1], 10),
        vinDecodeFailed: parseInt(vinMatch[2], 10),
      });
    }
  }

  /**
   * Scan the output directory and record file paths in the job record.
   */
  private async collectOutputs(jobId: string, outputDir: string): Promise<void> {
    const files = fs.existsSync(outputDir) ? fs.readdirSync(outputDir) : [];
    const update: Partial<PipelineJob> = {};

    for (const file of files) {
      const fullPath = path.join(outputDir, file);
      const lower = file.toLowerCase();

      if (lower.includes('us-motors') || lower.includes('us_motors')) {
        update.outputUsPath = fullPath;
      } else if (lower.startsWith('au-') || lower.startsWith('au_')) {
        update.outputAuPath = fullPath;
      } else if (lower.startsWith('de-') || lower.startsWith('de_')) {
        update.outputDePath = fullPath;
      } else if (lower.includes('report') && lower.endsWith('.json')) {
        update.reportPath = fullPath;

        // Parse report for final stats
        try {
          const report = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          const summary = report.summary ?? report;
          if (summary.totalProcessed) update.processedParts = summary.totalProcessed;
          if (summary.totalInput) update.totalParts = summary.totalInput;
          if (summary.vinDecodeSuccess) update.vinDecodeSuccess = summary.vinDecodeSuccess;
          if (summary.vinDecodeFail) update.vinDecodeFailed = summary.vinDecodeFail;
          if (summary.categoryMappingApi) update.categoryApiCount = summary.categoryMappingApi;
          if (summary.categoryMappingFallback) update.categoryFallbackCount = summary.categoryMappingFallback;
          if (summary.openaiTokensUsed) update.openaiTokensUsed = summary.openaiTokensUsed;
        } catch {
          // Non-critical
        }
      }
    }

    // Also check parent output dir as fallback (pipeline may write there)
    if (!update.outputUsPath) {
      const parentOutput = path.resolve(outputDir, '..');
      const parentFiles = fs.readdirSync(parentOutput);
      for (const file of parentFiles) {
        const fullPath = path.join(parentOutput, file);
        const lower = file.toLowerCase();
        if (lower.includes('us-motors') && !update.outputUsPath) update.outputUsPath = fullPath;
        if (lower.startsWith('au-') && !update.outputAuPath) update.outputAuPath = fullPath;
        if (lower.startsWith('de-') && !update.outputDePath) update.outputDePath = fullPath;
        if (lower.includes('report') && lower.endsWith('.json') && !update.reportPath) update.reportPath = fullPath;
      }
    }

    if (Object.keys(update).length > 0) {
      await this.jobRepo.update(jobId, update as any);
    }
  }

  private async updateStatus(jobId: string, status: PipelineJobStatus): Promise<void> {
    await this.jobRepo.update(jobId, { status });
  }

  private async fail(jobId: string, error: string): Promise<void> {
    await this.jobRepo.update(jobId, {
      status: 'failed' as PipelineJobStatus,
      lastError: error.substring(0, 2000),
    });
  }
}
