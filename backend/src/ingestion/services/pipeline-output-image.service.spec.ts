import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import { PipelineOutputImageService } from './pipeline-output-image.service.js';

describe('PipelineOutputImageService CSV image handling', () => {
  let outputDir: string;
  let storage: { mirrorRemoteImages: jest.Mock };
  let service: PipelineOutputImageService;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-output-image-'));
    storage = {
      mirrorRemoteImages: jest.fn().mockResolvedValue([
        {
          url: 'https://images.example/mirrored.webp',
          s3Key: 'pipeline-images/job/SKU-1/image.webp',
        },
      ]),
    };
    service = new PipelineOutputImageService(
      storage as any,
      { get: (_key: string, fallback: string) => fallback } as any,
    );
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it('mirrors source image URLs in fast-pipeline CSV exports', async () => {
    const csvPath = path.join(outputDir, 'US-Motors-Listings.csv');
    fs.writeFileSync(
      csvPath,
      'Action,CustomLabel,Title,PicURL,AdditionalPicURL\r\n' +
        'Add,SKU-1,Part one,https://origin.example/part.jpg,\r\n',
    );

    await service.mirrorImagesInOutputDir('job-1', outputDir);

    expect(storage.mirrorRemoteImages).toHaveBeenCalledWith(
      ['https://origin.example/part.jpg'],
      'pipeline-images/job-1/SKU-1',
      6,
    );
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(csvPath).Sheets.Sheet1,
      { header: 1, defval: '' },
    ) as string[][];
    const headers = rows[0];
    expect(rows[1][headers.indexOf('PicURL')]).toBe(
      'https://images.example/mirrored.webp',
    );
    expect(rows[1][headers.indexOf('S3 Image Path')]).toBe(
      'pipeline-images/job/SKU-1/image.webp',
    );
  });

  it('writes catalog and Image Drive images into CSV exports by SKU', async () => {
    const csvPath = path.join(outputDir, 'US-Motors-Listings.csv');
    fs.writeFileSync(
      csvPath,
      'Action,CustomLabel,Title,PicURL,AdditionalPicURL\r\n' +
        'Add,SKU-1,Part one,,\r\n' +
        'Add,SKU-2,Part two,,\r\n',
    );

    const result = await service.applyResolvedImagesToOutputDir(
      'job-1',
      outputDir,
      new Map([
        [
          'sku-1',
          [
            'https://images.example/drive-primary.webp',
            'https://images.example/drive-side.webp',
          ],
        ],
      ]),
    );

    expect(result).toEqual({ filesUpdated: 1, rowsUpdated: 1 });
    const rows = XLSX.utils.sheet_to_json(
      XLSX.readFile(csvPath).Sheets.Sheet1,
      { header: 1, defval: '' },
    ) as string[][];
    const headers = rows[0];
    expect(rows[1][headers.indexOf('PicURL')]).toBe(
      'https://images.example/drive-primary.webp',
    );
    expect(rows[1][headers.indexOf('AdditionalPicURL')]).toBe(
      'https://images.example/drive-side.webp',
    );
    expect(rows[2][headers.indexOf('PicURL')]).toBe('');
  });
});