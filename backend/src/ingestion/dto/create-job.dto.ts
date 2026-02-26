import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateJobDto {
  @IsString()
  @IsIn(['single', 'bulk', 'bundle'])
  mode!: 'single' | 'bulk' | 'bundle';

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  assetIds!: string[];

  @IsOptional()
  @IsString()
  @IsIn(['upload', 'camera', 'url', 'api'])
  source?: 'upload' | 'camera' | 'url' | 'api';

  @IsOptional()
  @IsString()
  @IsIn(['openai', 'google'])
  preferredProvider?: 'openai' | 'google';
}
