import { applyDecorators, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "./roles.decorator";
import { UserRole } from "@prisma/client";

/**
 * 基础认证装饰器
 * 仅要求用户已登录
 */
export function Auth() {
  return applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiBearerAuth("jwt"),
    ApiUnauthorizedResponse({
      description: "Unauthorized - Invalid or missing JWT token",
      schema: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: 401 },
          message: { type: "string", example: "Unauthorized" },
          error: { type: "string", example: "Unauthorized" },
        },
      },
    }),
  );
}

/**
 * 基于角色的认证装饰器
 * 要求用户已登录且具有指定角色
 */
export function AuthRoles(...roles: UserRole[]) {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(...roles),
    ApiBearerAuth("jwt"),
    ApiUnauthorizedResponse({
      description: "Unauthorized - Invalid or missing JWT token",
      schema: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: 401 },
          message: { type: "string", example: "Unauthorized" },
          error: { type: "string", example: "Unauthorized" },
        },
      },
    }),
    ApiForbiddenResponse({
      description: "Forbidden - Insufficient role privileges",
      schema: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: 403 },
          message: { type: "string", example: "Forbidden resource" },
          error: { type: "string", example: "Forbidden" },
        },
      },
    }),
  );
}

/**
 * 管理员专用装饰器
 */
export function AuthAdmin() {
  return AuthRoles(UserRole.admin);
}

/**
 * 医生专用装饰器
 */
export function AuthDoctor() {
  return AuthRoles(UserRole.practitioner);
}

/**
 * 药房操作员专用装饰器
 */
export function AuthPharmacy() {
  return AuthRoles(UserRole.pharmacy_operator);
}

/**
 * 医生或管理员装饰器
 */
export function AuthDoctorOrAdmin() {
  return AuthRoles(UserRole.practitioner, UserRole.admin);
}

/**
 * 药房或管理员装饰器
 */
export function AuthPharmacyOrAdmin() {
  return AuthRoles(UserRole.pharmacy_operator, UserRole.admin);
}
