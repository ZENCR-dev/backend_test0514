import { Injectable, Logger } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  Action,
  Resource,
  Permission,
  PermissionCondition,
  PermissionConditionType,
  PermissionCheckRequest,
  PermissionCheckResult,
  RolePermissionMap,
} from "../interfaces/permission.interface";

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  /**
   * 角色权限映射配置
   */
  private readonly rolePermissions: RolePermissionMap = {
    [UserRole.admin]: [
      // 管理员拥有所有权限
      { action: Action.MANAGE, resource: Resource.ALL },
    ],
    [UserRole.practitioner]: [
      // 医生权限
      { action: Action.READ, resource: Resource.USER },
      {
        action: Action.UPDATE,
        resource: Resource.USER,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      { action: Action.READ, resource: Resource.USER_PROFILE },
      {
        action: Action.UPDATE,
        resource: Resource.USER_PROFILE,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      { action: Action.MANAGE, resource: Resource.PRESCRIPTION },
      { action: Action.READ, resource: Resource.MEDICINE },
      {
        action: Action.READ,
        resource: Resource.PATIENT,
        conditions: [{ type: PermissionConditionType.CLINIC_MEMBER }],
      },
      { action: Action.CREATE, resource: Resource.PATIENT },
      {
        action: Action.UPDATE,
        resource: Resource.PATIENT,
        conditions: [{ type: PermissionConditionType.CLINIC_MEMBER }],
      },
    ],
    [UserRole.pharmacy_operator]: [
      // 药剂师权限
      { action: Action.READ, resource: Resource.USER },
      {
        action: Action.UPDATE,
        resource: Resource.USER,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      { action: Action.READ, resource: Resource.USER_PROFILE },
      {
        action: Action.UPDATE,
        resource: Resource.USER_PROFILE,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      { action: Action.READ, resource: Resource.PRESCRIPTION },
      { action: Action.UPDATE, resource: Resource.PRESCRIPTION }, // 可以更新处方状态（如：已配药）
      { action: Action.MANAGE, resource: Resource.MEDICINE },
    ],
    [UserRole.patient]: [
      // 患者权限
      {
        action: Action.READ,
        resource: Resource.USER,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      {
        action: Action.UPDATE,
        resource: Resource.USER,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      {
        action: Action.READ,
        resource: Resource.USER_PROFILE,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      {
        action: Action.UPDATE,
        resource: Resource.USER_PROFILE,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
      {
        action: Action.READ,
        resource: Resource.PRESCRIPTION,
        conditions: [{ type: PermissionConditionType.OWNER }],
      },
    ],
  };

  /**
   * 检查用户权限
   */
  async checkPermission(
    request: PermissionCheckRequest,
  ): Promise<PermissionCheckResult> {
    try {
      const { user, resource, action, resourceId, resourceData } = request;

      // 获取用户角色的所有权限
      const userPermissions = this.rolePermissions[user.role] || [];

      // 查找匹配的权限
      const matchingPermissions = this.findMatchingPermissions(
        userPermissions,
        action,
        resource,
      );

      if (matchingPermissions.length === 0) {
        return {
          allowed: false,
          reason: `No permission found for action '${action}' on resource '${resource}'`,
        };
      }

      // 检查每个匹配的权限的条件
      for (const permission of matchingPermissions) {
        const conditionResult = await this.checkConditions(
          permission.conditions || [],
          user,
          resourceId,
          resourceData,
        );

        if (conditionResult.allowed) {
          return conditionResult;
        }
      }

      return {
        allowed: false,
        reason: "Permission conditions not satisfied",
      };
    } catch (error) {
      this.logger.error(
        `Permission check failed: ${error.message}`,
        error.stack,
      );
      return {
        allowed: false,
        reason: "Permission check error",
      };
    }
  }

  /**
   * 查找匹配的权限
   */
  private findMatchingPermissions(
    permissions: Permission[],
    action: Action,
    resource: Resource,
  ): Permission[] {
    return permissions.filter((permission) => {
      // 检查是否有管理所有资源的权限
      if (
        permission.action === Action.MANAGE &&
        permission.resource === Resource.ALL
      ) {
        return true;
      }

      // 检查是否有管理特定资源的权限
      if (
        permission.action === Action.MANAGE &&
        permission.resource === resource
      ) {
        return true;
      }

      // 检查精确匹配的权限
      return permission.action === action && permission.resource === resource;
    });
  }

  /**
   * 检查权限条件
   */
  private async checkConditions(
    conditions: PermissionCondition[],
    user: any,
    resourceId?: string,
    resourceData?: any,
  ): Promise<PermissionCheckResult> {
    // 如果没有条件，直接允许
    if (!conditions || conditions.length === 0) {
      return { allowed: true };
    }

    // 检查每个条件
    for (const condition of conditions) {
      const conditionResult = await this.checkSingleCondition(
        condition,
        user,
        resourceId,
        resourceData,
      );
      if (!conditionResult.allowed) {
        return conditionResult;
      }
    }

    return { allowed: true };
  }

  /**
   * 检查单个条件
   */
  private async checkSingleCondition(
    condition: PermissionCondition,
    user: any,
    resourceId?: string,
    resourceData?: any,
  ): Promise<PermissionCheckResult> {
    switch (condition.type) {
      case PermissionConditionType.OWNER:
        return this.checkOwnershipCondition(user, resourceId, resourceData);

      case PermissionConditionType.CLINIC_MEMBER:
        return this.checkClinicMembershipCondition(user, resourceData);

      case PermissionConditionType.ADMIN_OR_OWNER:
        if (user.role === UserRole.admin) {
          return { allowed: true, reason: "Admin override" };
        }
        return this.checkOwnershipCondition(user, resourceId, resourceData);

      case PermissionConditionType.ROLE_HIERARCHY:
        return this.checkRoleHierarchyCondition(user, condition);

      default:
        return {
          allowed: false,
          reason: `Unknown condition type: ${condition.type}`,
        };
    }
  }

  /**
   * 检查资源所有权条件
   */
  private checkOwnershipCondition(
    user: any,
    resourceId?: string,
    resourceData?: any,
  ): PermissionCheckResult {
    // 如果提供了资源数据，检查其中的所有者字段
    if (resourceData) {
      const ownerId =
        resourceData.userId || resourceData.ownerId || resourceData.id;
      if (ownerId === user.id) {
        return { allowed: true, reason: "Resource owner" };
      }
    }

    // 如果提供了资源ID，检查是否与用户ID匹配
    if (resourceId && resourceId === user.id) {
      return { allowed: true, reason: "Resource owner" };
    }

    return {
      allowed: false,
      reason: "Not resource owner",
    };
  }

  /**
   * 检查诊所成员条件
   */
  private checkClinicMembershipCondition(
    user: any,
    resourceData?: any,
  ): PermissionCheckResult {
    // 如果用户没有诊所ID，拒绝访问
    if (!user.clinicId) {
      return {
        allowed: false,
        reason: "User not associated with any clinic",
      };
    }

    // 如果资源数据包含诊所ID，检查是否匹配
    if (resourceData && resourceData.clinicId) {
      if (resourceData.clinicId === user.clinicId) {
        return { allowed: true, reason: "Same clinic member" };
      } else {
        return {
          allowed: false,
          reason: "Different clinic",
        };
      }
    }

    // 如果没有资源数据，暂时允许（可能需要在具体使用时进一步检查）
    return { allowed: true, reason: "Clinic member" };
  }

  /**
   * 检查角色层级条件
   */
  private checkRoleHierarchyCondition(
    user: any,
    condition: PermissionCondition,
  ): PermissionCheckResult {
    const roleHierarchy = {
      [UserRole.admin]: 3,
      [UserRole.practitioner]: 2,
      [UserRole.pharmacy_operator]: 2,
      [UserRole.patient]: 1,
    };

    const userRoleLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = condition.value || 1;

    if (userRoleLevel >= requiredLevel) {
      return { allowed: true, reason: "Role hierarchy satisfied" };
    }

    return {
      allowed: false,
      reason: `Insufficient role level: ${userRoleLevel} < ${requiredLevel}`,
    };
  }

  /**
   * 检查用户是否有特定权限
   */
  async hasPermission(
    user: any,
    action: Action,
    resource: Resource,
    resourceId?: string,
    resourceData?: any,
  ): Promise<boolean> {
    const request: PermissionCheckRequest = {
      user,
      action,
      resource,
      resourceId,
      resourceData,
    };

    const result = await this.checkPermission(request);
    return result.allowed;
  }

  /**
   * 获取用户角色的所有权限
   */
  getUserPermissions(role: UserRole): Permission[] {
    return this.rolePermissions[role] || [];
  }
}
