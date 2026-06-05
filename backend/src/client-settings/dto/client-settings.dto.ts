import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const emptyStringToNull = ({ value }: { value: unknown }) =>
  value === '' || value === undefined ? null : value;

export class UpdateClientSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  appName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  shortName?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  loginLogoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  themeMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  sidebarTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  navbarTheme?: string;

  @IsOptional()
  @IsString()
  footerText?: string;

  @IsOptional()
  @Transform(emptyStringToNull)
  @IsEmail()
  supportEmail?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;

  @IsOptional()
  @IsBoolean()
  whiteLabelEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  poweredByVisible?: boolean;
}
