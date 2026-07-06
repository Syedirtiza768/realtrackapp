import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ROLE_SLUGS } from '../permission-registry.js';

const ROLE_SLUG_VALUES = Object.values(ROLE_SLUGS);

export class CreateRbacUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsIn(ROLE_SLUG_VALUES)
  roleSlug: string;
}

export class AssignRoleDto {
  @IsString()
  @IsIn(ROLE_SLUG_VALUES)
  roleSlug: string;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'slug must be lowercase alphanumeric with underscores',
  })
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class SetRolePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys: string[];
}

export class SetSidebarConfigDto {
  @IsArray()
  configs: Array<{ roleSlug: string; moduleKey: string; visible: boolean }>;
}
