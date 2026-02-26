import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

class LoginDto {
  email: string;
  password: string;
}

class RegisterDto {
  email: string;
  password: string;
  name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    const result = await this.auth.validateAndSign(body.email, body.password);
    if (!result) throw new UnauthorizedException('Invalid credentials');
    return result;
  }

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.auth.register(body.email, body.password, body.name);
  }
}
