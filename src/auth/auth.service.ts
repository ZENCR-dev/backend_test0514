import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthLoginDto } from './dto/auth-login.dto';
import { AuthRegisterDto } from './dto/auth-register.dto';
import { User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(authRegisterDto: AuthRegisterDto): Promise<any> {
    const existingUser = await this.userService.findByEmail(authRegisterDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      authRegisterDto.password,
      parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '10'),
    );

    const user = await this.userService.create({
      ...authRegisterDto,
      password: hashedPassword,
    });

    // Remove password hash before returning
    const { password, ...userWithoutPassword } = user as any;
    return userWithoutPassword;
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return null;
    }
    const userWithPassword = user as any; // Type assertion to access password
    const isPasswordMatching = await bcrypt.compare(pass, userWithPassword.password);
    if (!isPasswordMatching) {
      return null;
    }
    // If user status is not approved, they cannot log in
    if (user.status !== 'approved') {
      throw new UnauthorizedException('Your account is not approved yet or has been suspended.');
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = userWithPassword;
    return result;
  }

  async login(authLoginDto: AuthLoginDto) {
    const user = await this.validateUser(authLoginDto.email, authLoginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials or account not approved.');
    }
    const payload = { email: user.email, sub: user.id, role: user.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: user,
    };
  }

  async getProfile(userId: string): Promise<User | null> {
    return this.userService.findById(userId);
  }
} 