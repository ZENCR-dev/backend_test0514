import {
  Injectable,
  UnauthorizedException,
  Inject,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UserService } from "../user/user.service";
import {
  JwtPayload,
  AuthConfig,
  LoginResult,
  RegisterResult,
  PasswordValidationResult,
} from "./interfaces/auth.interface";
import { UserStatus } from "@prisma/client";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRegisterDto } from "./dto/auth-register.dto";
import { FullUserInfo } from "../user/interfaces/user.interface";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    @Inject("AUTH_CONFIG") private authConfig: AuthConfig,
  ) {}

  /**
   * 用户注册
   */
  async register(registerDto: AuthRegisterDto): Promise<RegisterResult> {
    try {
      const newUser = await this.userService.createUser({
        email: registerDto.email,
        password: registerDto.password,
        role: registerDto.role,
        profile: {
          fullName: registerDto.fullName,
          phone: registerDto.phone,
          address: registerDto.address,
        },
      });

      return {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
      };
    } catch (error) {
      this.logger.error(
        `Registration failed for ${registerDto.email}`,
        error.stack,
      );
      // 将底层的验证错误或数据库错误转换为统一的注册失败响应
      return {
        success: false,
        message:
          error.message || "Registration failed due to an internal error.",
      };
    }
  }

  /**
   * 用户登录
   */
  async login(loginDto: AuthLoginDto): Promise<LoginResult> {
    const validationResult = await this.validateUserPassword(loginDto);

    if (!validationResult.isValid || !validationResult.user) {
      return {
        success: false,
        message: "Invalid credentials",
      };
    }

    const { user } = validationResult;

    if (user.status !== UserStatus.approved) {
      return {
        success: false,
        message: `User account is not active. Current status: ${user.status}`,
      };
    }

    const fullUserInfo = await this.userService.findById(user.id);
    if (!fullUserInfo) {
      // This case should be rare if validateUserPassword works correctly
      throw new InternalServerErrorException(
        "Failed to retrieve user details after validation.",
      );
    }

    const payload: JwtPayload = {
      sub: fullUserInfo.id,
      email: fullUserInfo.email,
      role: fullUserInfo.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      success: true,
      accessToken,
      user: {
        id: fullUserInfo.id,
        email: fullUserInfo.email,
        role: fullUserInfo.role,
        profile: fullUserInfo.profile
          ? {
              fullName: fullUserInfo.profile.fullName,
              phone: fullUserInfo.profile.phone,
            }
          : undefined,
      },
    };
  }

  /**
   * 验证用户密码
   */
  async validateUserPassword(
    loginDto: AuthLoginDto,
  ): Promise<PasswordValidationResult> {
    const user = await this.userService.findByEmail(loginDto.email, {
      includeProfile: false,
      includePassword: true, // This now correctly returns the user with password
    });

    if (!user) {
      return { isValid: false };
    }

    // Since findByEmail with includePassword returns the full user model, we can safely cast to any
    // to access the password field for comparison.
    const isPasswordMatching = await bcrypt.compare(
      loginDto.password,
      (user as any).password,
    );

    if (!isPasswordMatching) {
      return { isValid: false };
    }

    return {
      isValid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }

  /**
   * 根据用户ID获取用户信息
   */
  async getUserById(id: string): Promise<FullUserInfo | null> {
    return this.userService.findById(id);
  }

  /**
   * 生成JWT
   */
  generateJwt(user: FullUserInfo): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  /**
   * 验证JWT负载
   */
  async verifyPayload(payload: JwtPayload): Promise<FullUserInfo | null> {
    const user = await this.userService.findById(payload.sub);
    if (!user || user.status !== UserStatus.approved) {
      return null;
    }
    return user;
  }
}
