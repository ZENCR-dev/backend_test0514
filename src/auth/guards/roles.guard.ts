import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { ROLES_KEY } from "../decorators/roles.decorator";
import {
  PERMISSION_METADATA_KEY,
  PERMISSION_CONDITIONS_KEY,
  REQUIRE_OWNERSHIP_KEY,
  REQUIRE_CLINIC_MEMBERSHIP_KEY,
  ALLOW_ADMIN_OVERRIDE_KEY,
} from "../decorators/permissions.decorator";
import { PermissionService } from "../services/permission.service";
import {
  Permission,
  PermissionCondition,
  PermissionConditionType,
  Action,
  Resource,
} from "../interfaces/permission.interface";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      this.logger.debug(
        `[DEBUG] canActivate called with user: ${JSON.stringify(user)}`,
      );

      // 检查用户是否已认证
      if (!user || !user.role) {
        this.logger.warn("No authenticated user found in request");
        return false;
      }

      this.logger.debug(
        `[DEBUG] User authenticated: ${user.id} with role: ${user.role}`,
      );

      // 检查管理员覆盖权限
      const adminOverride = this.checkAdminOverride(context, user);
      this.logger.debug(
        `[DEBUG] Admin override check result: ${adminOverride}`,
      );
      if (adminOverride) {
        return true;
      }

      // 检查新的权限系统
      const hasPermissionAccess = await this.checkPermissions(
        context,
        user,
        request,
      );
      this.logger.debug(
        `[DEBUG] Permission check result: ${hasPermissionAccess}`,
      );
      if (hasPermissionAccess !== null) {
        return hasPermissionAccess;
      }

      // 回退到传统的角色检查（向后兼容性）
      const roleCheckResult = this.checkRoles(context, user);
      this.logger.debug(`[DEBUG] Role check result: ${roleCheckResult}`);
      return roleCheckResult;
    } catch (error) {
      this.logger.error(
        `Permission check failed: ${error.message}`,
        error.stack,
      );
      throw new ForbiddenException("Permission check failed");
    }
  }

  /**
   * 检查管理员覆盖权限
   */
  private checkAdminOverride(context: ExecutionContext, user: any): boolean {
    const allowAdminOverride = this.reflector.getAllAndOverride<boolean>(
      ALLOW_ADMIN_OVERRIDE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (allowAdminOverride && user.role === UserRole.admin) {
      this.logger.debug(`Admin override granted for user ${user.id}`);
      return true;
    }

    return false;
  }

  /**
   * 检查新的权限系统
   */
  private async checkPermissions(
    context: ExecutionContext,
    user: any,
    request: any,
  ): Promise<boolean | null> {
    // 获取权限元数据
    const permissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSION_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    this.logger.debug(
      `[DEBUG] Retrieved permissions metadata: ${JSON.stringify(permissions)}`,
    );

    const additionalConditions = this.reflector.getAllAndOverride<
      PermissionCondition[]
    >(PERMISSION_CONDITIONS_KEY, [context.getHandler(), context.getClass()]);

    const requireOwnership = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireClinicMembership = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CLINIC_MEMBERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 如果没有设置任何权限要求，返回null让其他检查继续
    if (
      !permissions &&
      !additionalConditions &&
      !requireOwnership &&
      !requireClinicMembership
    ) {
      this.logger.debug(
        `[DEBUG] No permission requirements found, returning null`,
      );
      return null;
    }

    // 提取资源ID和数据
    const { resourceId, resourceData } = this.extractResourceInfo(request);
    this.logger.debug(
      `[DEBUG] Extracted resource info - ID: ${resourceId}, Data: ${JSON.stringify(resourceData)}`,
    );

    // 构建权限检查列表
    const permissionsToCheck: Permission[] = [];

    // 添加显式权限
    if (permissions) {
      permissionsToCheck.push(...permissions);
    }

    // 添加基于简化装饰器的权限
    if (requireOwnership) {
      permissionsToCheck.push({
        action: Action.READ,
        resource: Resource.ALL,
        conditions: [{ type: PermissionConditionType.OWNER }],
      });
    }

    if (requireClinicMembership) {
      permissionsToCheck.push({
        action: Action.READ,
        resource: Resource.ALL,
        conditions: [{ type: PermissionConditionType.CLINIC_MEMBER }],
      });
    }

    // 如果没有具体权限要求，但有额外条件，创建一个默认权限
    if (permissionsToCheck.length === 0 && additionalConditions) {
      permissionsToCheck.push({
        action: Action.READ,
        resource: Resource.ALL,
        conditions: additionalConditions,
      });
    }

    this.logger.debug(
      `[DEBUG] Final permissions to check: ${JSON.stringify(permissionsToCheck)}`,
    );

    // 检查每个权限
    for (const permission of permissionsToCheck) {
      this.logger.debug(
        `[DEBUG] Checking permission: ${JSON.stringify(permission)}`,
      );

      const result = await this.permissionService.checkPermission({
        user,
        action: permission.action,
        resource: permission.resource,
        resourceId,
        resourceData,
      });

      this.logger.debug(
        `[DEBUG] Permission service result: ${JSON.stringify(result)}`,
      );

      if (result.allowed) {
        this.logger.debug(
          `Permission granted for user ${user.id}: ${permission.action} on ${permission.resource}`,
        );
        return true;
      } else {
        this.logger.debug(
          `Permission denied for user ${user.id}: ${permission.action} on ${permission.resource} - ${result.reason}`,
        );
      }
    }

    // 如果所有权限检查都失败
    if (permissionsToCheck.length > 0) {
      this.logger.warn(`All permission checks failed for user ${user.id}`);
      return false;
    }

    return null;
  }

  /**
   * 传统的角色检查（向后兼容性）
   */
  private checkRoles(context: ExecutionContext, user: any): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true; // 如果没有指定角色，则允许访问
    }

    // 检查用户的角色是否在允许的角色列表中
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (hasRole) {
      this.logger.debug(
        `Role-based access granted for user ${user.id} with role ${user.role}`,
      );
    } else {
      this.logger.warn(
        `Role-based access denied for user ${user.id} with role ${user.role}. Required: ${requiredRoles.join(", ")}`,
      );
    }

    return hasRole;
  }

  /**
   * 从请求中提取资源信息
   */
  private extractResourceInfo(request: any): {
    resourceId?: string;
    resourceData?: any;
  } {
    let resourceId: string | undefined;
    let resourceData: any;

    // 从路径参数中提取资源ID
    const params = request.params || {};

    // 常见的资源ID参数名
    const idParams = [
      "id",
      "userId",
      "patientId",
      "prescriptionId",
      "clinicId",
    ];
    for (const param of idParams) {
      if (params[param]) {
        resourceId = params[param];
        break;
      }
    }

    // 从请求体中提取资源数据
    if (request.body && typeof request.body === "object") {
      resourceData = request.body;
    }

    // 从查询参数中提取资源信息
    if (request.query && typeof request.query === "object") {
      if (!resourceId && request.query.id) {
        resourceId = request.query.id as string;
      }
      if (!resourceData) {
        resourceData = request.query;
      }
    }

    return { resourceId, resourceData };
  }

  /**
   * 获取权限检查的错误消息
   */
  private getPermissionErrorMessage(
    permission: Permission,
    reason?: string,
  ): string {
    const baseMessage = `Insufficient permissions: ${permission.action} on ${permission.resource}`;
    return reason ? `${baseMessage}. Reason: ${reason}` : baseMessage;
  }
}
