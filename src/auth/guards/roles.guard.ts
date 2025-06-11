import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // 如果没有指定角色，则允许访问
    }

    const { user } = context.switchToHttp().getRequest();
    // 确保用户对象存在且包含 role 属性
    // 在实际应用中，user 对象会由 JwtStrategy 或其他认证策略填充
    if (!user || !user.role) {
      return false; // 没有用户信息或角色，拒绝访问
    }
    
    // 检查用户的角色是否在允许的角色列表中
    return requiredRoles.some((role) => user.role === role);
  }
} 