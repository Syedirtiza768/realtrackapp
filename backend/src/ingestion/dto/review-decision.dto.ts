import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewDecisionDto {
  @IsString()
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  /**
   * Optional field corrections the reviewer makes before approval.
   * Keys map to listing fields (e.g. title, brand, mpn).
   */
  @IsOptional()
  @IsObject()
  corrections?: Record<string, unknown>;
}
