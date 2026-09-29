import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { User } from '../auth/entities/user.entity.js';
import { UserOrganizationService } from '../auth/user-organization.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  escapeSvgText,
  fashionDiagramSvg,
  fashionMeasurementTemplate,
  parseFashionMeasurement,
} from './fashion-measurements.js';
import type {
  FashionImageBannerDto,
  FashionSizeChartDto,
} from './fashion.dto.js';
import {
  fashionSkuStem,
  isOrganizationFashionKey,
  keyFromServeUrl,
} from './fashion-storage-keys.util.js';

const CHART_WIDTH = 1200;
const FONT = 'DejaVu Sans, Arial, Helvetica, sans-serif';

const BANNER_THEMES = {
  dark: { background: '#111827', opacity: 0.92, color: '#ffffff' },
  brand: { background: '#db2777', opacity: 0.95, color: '#ffffff' },
  light: { background: '#ffffff', opacity: 0.9, color: '#111827' },
} as const;

/**
 * Generated Fashion listing images: the branded measurement chart and text banners
 * over existing photos. Output is stored as WebP next to other Fashion intake photos.
 * Text rendering needs a system font (the backend Docker image installs fonts-dejavu-core).
 */
@Injectable()
export class FashionIntakeImagesService {
  constructor(
    private readonly userOrgs: UserOrganizationService,
    private readonly storage: StorageService,
  ) {}

  async sizeChart(
    user: User,
    dto: FashionSizeChartDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const svg = buildSizeChartSvg(dto);
    const buffer = await sharp(Buffer.from(svg))
      .webp({ quality: 92 })
      .toBuffer();
    const s3Key = this.storage.buildDurableKey(
      `fashion/size-charts/${org.organizationId}/${fashionSkuStem(dto.sku) || 'size-chart'}-${Date.now()}-${shortId()}.webp`,
    );
    await this.storage.putObject(s3Key, buffer, 'image/webp');
    void this.storage.queueVariantGeneration(s3Key);
    return { url: this.storage.getCdnUrl(s3Key), s3Key };
  }

  async banner(
    user: User,
    dto: FashionImageBannerDto,
    organizationId?: string,
  ) {
    const org = await this.userOrgs.resolveOrganizationId(
      user.id,
      organizationId,
    );
    const key =
      this.storage.keyFromUrl(dto.imageUrl) || keyFromServeUrl(dto.imageUrl);
    // Only images this workspace stored may be re-rendered. Never fetch arbitrary URLs.
    if (!key || !isOrganizationFashionKey(key, org.organizationId))
      throw new ForbiddenException(
        'Banners can only be added to photos uploaded to this Fashion workspace.',
      );
    const source = await this.storage.getObjectBuffer(key);
    const image = sharp(source);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    if (!width || !height)
      throw new BadRequestException('The photo could not be read.');

    const bannerHeight = Math.max(48, Math.round(height * 0.11));
    const fontSize = Math.round(bannerHeight * 0.44);
    const theme = BANNER_THEMES[dto.theme];
    const text = escapeSvgText(dto.text.trim().slice(0, 60));
    const overlay =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${bannerHeight}">` +
      `<rect width="100%" height="100%" fill="${theme.background}" fill-opacity="${theme.opacity}"/>` +
      `<text x="50%" y="50%" font-family="${FONT}" font-size="${fontSize}" font-weight="700" fill="${theme.color}" text-anchor="middle" dominant-baseline="central">${text}</text>` +
      `</svg>`;
    const buffer = await image
      .composite([
        {
          input: Buffer.from(overlay),
          top: dto.position === 'top' ? 0 : height - bannerHeight,
          left: 0,
        },
      ])
      .webp({ quality: 88 })
      .toBuffer();
    const base = (key.split('/').pop() ?? 'photo').replace(/\.[a-z0-9]+$/i, '');
    const s3Key = this.storage.buildDurableKey(
      `fashion/intake/${org.organizationId}/${base.slice(0, 80)}-banner-${shortId()}.webp`,
    );
    await this.storage.putObject(s3Key, buffer, 'image/webp');
    void this.storage.queueVariantGeneration(s3Key);
    return { url: this.storage.getCdnUrl(s3Key), s3Key };
  }
}

function shortId() {
  return randomUUID().split('-')[0];
}

export function buildSizeChartSvg(dto: FashionSizeChartDto): string {
  const template = fashionMeasurementTemplate(dto.template);
  if (!template)
    throw new BadRequestException('Choose a valid measurement chart.');
  const allowed = new Set(template.points.map((point) => point.key));
  const unknown = Object.keys(dto.values ?? {}).filter(
    (key) => !allowed.has(key),
  );
  if (unknown.length)
    throw new BadRequestException(
      `These values do not belong to the ${template.label} chart: ${unknown.join(', ')}`,
    );
  const rows: Array<{ letter: string; label: string; value: string }> = [];
  const invalid: string[] = [];
  for (const point of template.points) {
    const raw = dto.values?.[point.key];
    if (raw == null || String(raw).trim() === '') continue;
    const parsed = parseFashionMeasurement(String(raw));
    if (parsed === null) invalid.push(point.label);
    else
      rows.push({
        letter: point.letter,
        label: point.label,
        value: String(parsed),
      });
  }
  if (invalid.length)
    throw new BadRequestException(
      `Enter positive numbers for: ${invalid.join(', ')}.`,
    );
  if (!rows.length)
    throw new BadRequestException(
      'Enter at least one measurement before creating the chart.',
    );

  const brand = escapeSvgText(
    (dto.brandName?.trim() || 'Size guide').toUpperCase().slice(0, 40),
  );
  const subtitle = escapeSvgText(
    `SIZE GUIDE — ${template.chartTitle.toUpperCase()}`,
  );
  const unitLabel = dto.unit === 'in' ? 'inch' : 'cm';
  const diagram = fashionDiagramSvg(template).replace(
    /^<svg [^>]*>/,
    '<svg x="190" y="230" width="820" height="656" viewBox="0 0 400 320">',
  );
  const tableTop = 920;
  const headerHeight = 76;
  const rowHeight = 68;
  const tableLeft = 120;
  const tableWidth = CHART_WIDTH - tableLeft * 2;
  const splitX = tableLeft + Math.round(tableWidth * 0.62);
  const height = tableTop + headerHeight + rows.length * rowHeight + 150;
  const rowSvg = rows
    .map((row, index) => {
      const y = tableTop + headerHeight + index * rowHeight;
      return (
        `<rect x="${tableLeft}" y="${y}" width="${tableWidth}" height="${rowHeight}" fill="${index % 2 ? '#f9fafb' : '#ffffff'}" stroke="#e5e7eb"/>` +
        `<line x1="${splitX}" y1="${y}" x2="${splitX}" y2="${y + rowHeight}" stroke="#e5e7eb"/>` +
        `<text x="${tableLeft + 28}" y="${y + rowHeight / 2}" font-family="${FONT}" font-size="30" fill="#111827" dominant-baseline="central"><tspan font-weight="700" fill="#c2410c">${row.letter}</tspan>  ${escapeSvgText(row.label)}</text>` +
        `<text x="${splitX + 28}" y="${y + rowHeight / 2}" font-family="${FONT}" font-size="30" font-weight="700" fill="#111827" dominant-baseline="central">${escapeSvgText(row.value)}</text>`
      );
    })
    .join('');
  const sku = dto.sku?.trim()
    ? `<text x="${CHART_WIDTH - tableLeft}" y="${height - 60}" font-family="${FONT}" font-size="22" fill="#6b7280" text-anchor="end">${escapeSvgText(dto.sku.trim().slice(0, 60))}</text>`
    : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${height}" viewBox="0 0 ${CHART_WIDTH} ${height}">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>` +
    `<text x="${CHART_WIDTH / 2}" y="112" font-family="${FONT}" font-size="64" font-weight="700" fill="#111827" text-anchor="middle">${brand}</text>` +
    `<text x="${CHART_WIDTH / 2}" y="170" font-family="${FONT}" font-size="28" letter-spacing="6" fill="#4b5563" text-anchor="middle">${subtitle}</text>` +
    `<line x1="${tableLeft}" y1="204" x2="${CHART_WIDTH - tableLeft}" y2="204" stroke="#d1d5db" stroke-width="2"/>` +
    diagram +
    `<rect x="${tableLeft}" y="${tableTop}" width="${tableWidth}" height="${headerHeight}" fill="#f3f4f6" stroke="#e5e7eb"/>` +
    `<text x="${tableLeft + 28}" y="${tableTop + headerHeight / 2}" font-family="${FONT}" font-size="30" font-weight="700" fill="#374151" dominant-baseline="central">Measurement</text>` +
    `<text x="${splitX + 28}" y="${tableTop + headerHeight / 2}" font-family="${FONT}" font-size="30" font-weight="700" fill="#374151" dominant-baseline="central">Value (${unitLabel})</text>` +
    rowSvg +
    `<text x="${tableLeft}" y="${height - 60}" font-family="${FONT}" font-size="22" fill="#6b7280">Measured flat by hand. Allow ±1 cm / ±0.5 in.</text>` +
    sku +
    `</svg>`
  );
}
