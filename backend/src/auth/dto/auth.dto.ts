import {
  IsByteLength,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;

  /** Optional product vertical requested by a dedicated workspace login. */
  @IsOptional()
  @IsIn(['automotive', 'fashion', 'business_industrial'])
  vertical?: 'automotive' | 'fashion' | 'business_industrial';
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @IsByteLength(0, 72)
  newPassword: string;
}
