import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
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
