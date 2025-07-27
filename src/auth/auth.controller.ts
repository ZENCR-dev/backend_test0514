import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
  Res,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRegisterDto } from "./dto/auth-register.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { Roles } from "./decorators/roles.decorator";
import { UserRole } from "@prisma/client";
import { Auth } from "./decorators/auth.decorator";
import {
  LoginResponseV12Dto,
  RefreshResponseV12Dto,
} from "./dto/auth-response-v12.dto";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User successfully registered." })
  @ApiResponse({ status: 409, description: "Email already exists." })
  async register(@Body() authRegisterDto: AuthRegisterDto) {
    return this.authService.register(authRegisterDto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log in a user" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in.",
    type: LoginResponseV12Dto,
  })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  async login(@Body() authLoginDto: AuthLoginDto, @Res() res: any) {
    const result = await this.authService.login(authLoginDto);

    if (!result.success) {
      // 返回标准格式的401错误响应
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: result.message || "Invalid credentials",
          details: null,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // 转换为 v1.2 响应格式
    const response = this.authService.transformToLoginResponseV12(result);
    return res.status(200).json(response);
  }

  @Get("me")
  @Auth()
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Return current user profile." })
  getProfile(@Request() req) {
    // req.user is populated by JwtAuthGuard after successful token validation
    return this.authService.getUserById(req.user.id);
  }

  @Get("admin-data")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin) // 只有管理员可以访问
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get admin-only data" })
  @ApiResponse({ status: 200, description: "Admin data retrieved." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 403, description: "Forbidden: Insufficient role." })
  getAdminData(@Request() req) {
    return {
      message: `Welcome, Admin ${req.user.email}! This is sensitive admin data.`,
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully.",
    type: RefreshResponseV12Dto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or expired refresh token.",
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - missing refresh token.",
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    const result = await this.authService.refreshAccessToken(refreshTokenDto);

    if (!result.success) {
      throw new UnauthorizedException(
        result.message || "Invalid or expired refresh token",
      );
    }

    // 转换为 v1.2 响应格式
    return this.authService.transformToRefreshResponseV12(result);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Log out user and clear refresh token" })
  @ApiResponse({ status: 200, description: "User successfully logged out." })
  @ApiResponse({ status: 401, description: "Invalid refresh token." })
  @ApiResponse({
    status: 400,
    description: "Bad request - missing refresh token.",
  })
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    // 验证 refreshToken 并获取用户信息
    const user = await this.authService.validateRefreshToken(
      refreshTokenDto.refreshToken,
    );

    if (!user) {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    // 清除用户的 refreshToken
    await this.authService.clearRefreshToken(user.id);

    return {
      success: true,
      message: "Logged out successfully",
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
