import { Module } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { UserModule } from "../user/user.module";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PermissionService } from "./services/permission.service";
import { PermissionInterceptor } from "./interceptors/permission.interceptor";

@Module({
  imports: [
    UserModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "7d",
          issuer: "tcm-prescription-platform",
          audience: "tcm-platform-users",
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    PermissionService,
    PermissionInterceptor,
    {
      provide: "AUTH_CONFIG",
      useFactory: (configService: ConfigService) => ({
        jwtSecret: configService.get<string>("JWT_SECRET"),
        jwtExpiresIn: configService.get<string>("JWT_EXPIRES_IN") || "7d",
        bcryptSaltRounds: parseInt(
          configService.get<string>("BCRYPT_SALT_ROUNDS") || "12",
        ),
      }),
      inject: [ConfigService],
    },
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    RolesGuard,
    PermissionService,
    PermissionInterceptor,
  ],
})
export class AuthModule {}
