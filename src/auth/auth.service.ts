import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { UserService } from "../user/user.service";
import {
  JwtPayload,
  AuthConfig,
  LoginResult,
  RegisterResult,
  PasswordValidationResult,
  RefreshTokenResult,
} from "./interfaces/auth.interface";
import { UserStatus } from "@prisma/client";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRegisterDto } from "./dto/auth-register.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { FullUserInfo } from "../user/interfaces/user.interface";
import {
  transformToLoginResponseV12,
  transformToRefreshResponseV12,
} from "./utils/response-transformer";

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

    // 生成并设置 RefreshToken
    const refreshToken = this.generateRefreshToken();
    await this.setRefreshToken(fullUserInfo.id, refreshToken);

    return {
      success: true,
      accessToken,
      refreshToken,
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

  /**
   * 生成 RefreshToken
   */
  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * 验证 RefreshToken
   */
  async validateRefreshToken(
    refreshToken: string,
  ): Promise<FullUserInfo | null> {
    try {
      const user = await this.userService.findByRefreshToken(refreshToken);

      if (!user) {
        this.logger.warn(
          `Invalid refresh token attempted: ${refreshToken.substring(0, 8)}...`,
        );
        return null;
      }

      // 检查 refreshToken 是否过期
      if (user.refreshTokenExp && user.refreshTokenExp < new Date()) {
        this.logger.warn(`Expired refresh token for user ${user.id}`);
        // 清除过期的 refreshToken
        await this.userService.clearRefreshToken(user.id);
        return null;
      }

      // 检查用户状态
      if (user.status !== UserStatus.approved) {
        this.logger.warn(
          `Refresh token used by inactive user ${user.id}, status: ${user.status}`,
        );
        return null;
      }

      return user;
    } catch (error) {
      this.logger.error(
        `Error validating refresh token: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * 刷新访问令牌（实现Token轮换机制）
   */
  async refreshAccessToken(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<RefreshTokenResult> {
    const user = await this.validateRefreshToken(refreshTokenDto.refreshToken);

    if (!user) {
      return {
        success: false,
        message: "Invalid or expired refresh token",
      };
    }

    // 生成新的 accessToken
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    // 生成新的 refreshToken（Token轮换机制）
    const newRefreshToken = this.generateRefreshToken();

    // 更新数据库中的 refreshToken
    await this.setRefreshToken(user.id, newRefreshToken);

    this.logger.log(
      `Access token and refresh token refreshed for user ${user.id}`,
    );

    return {
      success: true,
      accessToken,
      refreshToken: newRefreshToken, // 返回新的refreshToken
    };
  }

  /**
   * 为用户设置 RefreshToken
   */
  async setRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7天有效期

    await this.userService.updateRefreshToken(
      userId,
      refreshToken,
      expirationDate,
    );
  }

  /**
   * 清除用户的 RefreshToken（用于登出）
   */
  async clearRefreshToken(userId: string): Promise<void> {
    await this.userService.clearRefreshToken(userId);
  }

  /**
   * 转换登录结果为 v1.2 API 响应格式
   */
  transformToLoginResponseV12(loginResult: LoginResult) {
    if (
      !loginResult.success ||
      !loginResult.user ||
      !loginResult.accessToken ||
      !loginResult.refreshToken
    ) {
      throw new InternalServerErrorException(
        "Invalid login result for transformation",
      );
    }

    // 添加对user对象结构的详细检查
    const { user } = loginResult;
    if (!user.id || !user.email || user.role === undefined) {
      this.logger.error(
        `Invalid user object structure in login result: ${JSON.stringify(user)}`,
      );
      throw new InternalServerErrorException(
        "User object is missing required properties (id, email, or role)",
      );
    }

    try {
      return transformToLoginResponseV12(
        user, // 移除临时类型转换，让检查在transformToLoginResponseV12函数中进行
        loginResult.accessToken,
        loginResult.refreshToken,
      );
    } catch (error) {
      this.logger.error(
        `Error transforming login response: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        "Failed to transform login response",
      );
    }
  }

  /**
   * 转换刷新令牌结果为 v1.2 API 响应格式
   */
  transformToRefreshResponseV12(refreshResult: RefreshTokenResult) {
    if (!refreshResult.success || !refreshResult.accessToken) {
      throw new InternalServerErrorException(
        "Invalid refresh result for transformation",
      );
    }

    return transformToRefreshResponseV12(
      refreshResult.accessToken,
      refreshResult.refreshToken,
    );
  }
}
