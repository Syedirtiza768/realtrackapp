import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Mirrors PartsBazar360's OptionsQueryDto (apps/api/src/modules/search/internal/options/options-query.dto.ts). */
export const OPTIONS_DROPPABLE = ['number', 'make', 'model', 'year', 'side', 'position'] as const;
const ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function toList(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const list = (Array.isArray(value) ? value : String(value).split(','))
    .map((item) => String(item).trim())
    .filter(Boolean);
  return list.length ? [...new Set(list)].slice(0, 10) : undefined;
}

function toBool(value: unknown): boolean | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).toLowerCase();
  if (text === 'true' || text === '1') return true;
  if (text === 'false' || text === '0') return false;
  return undefined;
}

export class PartsSearchOptionsDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(ID_RE)
  vehicleConfigId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(ID_RE)
  makeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(ID_RE)
  modelId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60)
  make?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  model?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1950) @Max(2049)
  year?: number;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsNumber() @Min(0.5) @Max(10)
  engineLitres?: number;

  @ApiPropertyOptional({ enum: OPTIONS_DROPPABLE, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(OPTIONS_DROPPABLE as unknown as string[], { each: true })
  @Transform(({ value }) => toList(value))
  drop?: string[];

  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => toBool(value)) @IsBoolean()
  includeUnavailable?: boolean;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  page?: number;

  @ApiPropertyOptional({ enum: [24, 48, 72] }) @IsOptional() @Type(() => Number) @IsInt() @IsIn([24, 48, 72])
  pageSize?: number;
}

export class PartsSearchSelectDto {
  @IsString() @MaxLength(200) query!: string;
  @IsString() @Matches(ID_RE) partId!: string;
  @IsOptional() @IsString() @MaxLength(64) requestRef?: string;
  /** What the user did: open / copy / external. */
  @IsOptional() @IsIn(['open', 'copy', 'external', 'quote']) action?: string;
}

export class PartsSearchRequestDto {
  @IsString() @MaxLength(200) query!: string;

  @IsOptional() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(60, { each: true })
  numbers?: string[];

  @IsOptional() @IsObject()
  vehicle?: Record<string, unknown>;

  @IsOptional() @IsString() @Matches(ID_RE)
  partId?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class PartsSearchRequestStatusDto {
  @IsIn(['open', 'done', 'dismissed']) status!: 'open' | 'done' | 'dismissed';
}

export class PartsSearchDemandQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90)
  days?: number;
}

export function toOptionsParams(dto: PartsSearchOptionsDto): Array<[string, string]> {
  const params: Array<[string, string]> = [];
  const scalar: Array<keyof PartsSearchOptionsDto> = [
    'q',
    'vehicleConfigId',
    'makeId',
    'modelId',
    'make',
    'model',
    'year',
    'engineLitres',
    'page',
    'pageSize',
  ];
  for (const key of scalar) {
    const value = dto[key];
    if (value !== undefined && value !== null && value !== '') params.push([key, String(value)]);
  }
  if (dto.drop?.length) params.push(['drop', dto.drop.join(',')]);
  // Always fetch unavailable parts: Omni Core warehouse stock can make a part
  // sellable that PartsBazar360 shows as not available. Hiding happens after
  // the merge (PartsSearchOptionsService.applyVisibility).
  params.push(['includeUnavailable', 'true']);
  return params;
}
