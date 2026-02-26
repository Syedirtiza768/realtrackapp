import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async validateAndSign(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; user: Partial<User> } | null> {
    const user = await this.userRepo.findOne({
      where: { email: email.toLowerCase(), active: true },
      select: ['id', 'email', 'passwordHash', 'name', 'role'],
    });
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    // Update last login
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async register(
    email: string,
    password: string,
    name?: string,
  ): Promise<{ accessToken: string; user: Partial<User> }> {
    const normalizedEmail = email.toLowerCase();

    const existing = await this.userRepo.findOne({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = this.userRepo.create({
      email: normalizedEmail,
      passwordHash,
      name: name ?? null,
      role: 'user',
    });
    const saved = await this.userRepo.save(user);

    const payload = { sub: saved.id, email: saved.email, role: saved.role };
    const accessToken = this.jwt.sign(payload);

    return {
      accessToken,
      user: { id: saved.id, email: saved.email, name: saved.name, role: saved.role },
    };
  }
}
