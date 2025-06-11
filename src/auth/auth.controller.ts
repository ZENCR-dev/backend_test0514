import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  UseGuards,
  Request,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthLoginDto } from "./dto/auth-login.dto";
import { AuthRegisterDto } from "./dto/auth-register.dto";
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
  @ApiResponse({ status: 200, description: "User successfully logged in." })
  @ApiResponse({ status: 401, description: "Invalid credentials." })
  async login(@Body() authLoginDto: AuthLoginDto) {
    return this.authService.login(authLoginDto);
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

  // Refresh token endpoint can be added later if needed
  // @Post('refresh')
  // @HttpCode(HttpStatus.OK)
  // @ApiOperation({ summary: 'Refresh access token' })
  // @ApiResponse({ status: 200, description: 'Token refreshed.' })
  // @ApiResponse({ status: 401, description: 'Invalid refresh token.' })
  // async refresh(@Body() { refreshToken }: { refreshToken: string }) {
  //   // Implement refresh token logic here
  // }
}
