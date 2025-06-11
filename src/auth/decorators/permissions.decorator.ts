import { SetMetadata } from "@nestjs/common";
import {
  Action,
  Resource,
  Permission,
  PermissionCondition,
  PermissionConditionType,
  PermissionMetadata,
} from "../interfaces/permission.interface";

// 权限元数据键
export const PERMISSION_METADATA_KEY = "permissions";
export const PERMISSION_CONDITIONS_KEY = "permission_conditions";
export const REQUIRE_OWNERSHIP_KEY = "require_ownership";
export const REQUIRE_CLINIC_MEMBERSHIP_KEY = "require_clinic_membership";
export const ALLOW_ADMIN_OVERRIDE_KEY = "allow_admin_override";

/**
 * 要求特定权限装饰器
 * @param permissions 权限列表
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_METADATA_KEY, permissions);

/**
 * 要求特定操作权限装饰器
 * @param action 操作类型
 * @param resource 资源类型
 * @param conditions 权限条件
 */
export const RequirePermission = (
  action: Action,
  resource: Resource,
  conditions?: PermissionCondition[],
) => {
  const permission: Permission = { action, resource, conditions };
  return SetMetadata(PERMISSION_METADATA_KEY, [permission]);
};

/**
 * 要求资源所有权装饰器
 * 只有资源所有者才能访问
 */
export const OwnerOnly = (resource: Resource, action: Action = Action.READ) => {
  const condition: PermissionCondition = {
    type: PermissionConditionType.OWNER,
  };
  return SetMetadata(PERMISSION_METADATA_KEY, [
    { action, resource, conditions: [condition] },
  ]);
};

/**
 * 要求诊所成员装饰器
 * 只有同一诊所的成员才能访问
 */
export const ClinicMember = (
  resource: Resource,
  action: Action = Action.READ,
) => {
  const condition: PermissionCondition = {
    type: PermissionConditionType.CLINIC_MEMBER,
  };
  return SetMetadata(PERMISSION_METADATA_KEY, [
    { action, resource, conditions: [condition] },
  ]);
};

/**
 * 管理员或所有者装饰器
 * 管理员或资源所有者才能访问
 */
export const AdminOrOwner = (
  resource: Resource,
  action: Action = Action.READ,
) => {
  const condition: PermissionCondition = {
    type: PermissionConditionType.ADMIN_OR_OWNER,
  };
  return SetMetadata(PERMISSION_METADATA_KEY, [
    { action, resource, conditions: [condition] },
  ]);
};

/**
 * 角色层级装饰器
 * 要求特定层级的角色才能访问
 */
export const RequireRoleLevel = (
  level: number,
  resource: Resource,
  action: Action = Action.READ,
) => {
  const condition: PermissionCondition = {
    type: PermissionConditionType.ROLE_HIERARCHY,
    value: level,
  };
  return SetMetadata(PERMISSION_METADATA_KEY, [
    { action, resource, conditions: [condition] },
  ]);
};

/**
 * 设置权限条件装饰器
 * @param conditions 权限条件列表
 */
export const SetPermissionConditions = (...conditions: PermissionCondition[]) =>
  SetMetadata(PERMISSION_CONDITIONS_KEY, conditions);

/**
 * 要求所有权装饰器
 * 简化版本，只标记需要所有权检查
 */
export const RequireOwnership = () => SetMetadata(REQUIRE_OWNERSHIP_KEY, true);

/**
 * 要求诊所成员装饰器
 * 简化版本，只标记需要诊所成员检查
 */
export const RequireClinicMembership = () =>
  SetMetadata(REQUIRE_CLINIC_MEMBERSHIP_KEY, true);

/**
 * 允许管理员覆盖装饰器
 * 标记管理员可以绕过权限检查
 */
export const AllowAdminOverride = () =>
  SetMetadata(ALLOW_ADMIN_OVERRIDE_KEY, true);

/**
 * 组合权限装饰器
 * 允许设置多种权限条件
 */
export const PermissionConfig = (metadata: PermissionMetadata) => {
  return (
    target: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor,
  ) => {
    if (metadata.permissions) {
      SetMetadata(PERMISSION_METADATA_KEY, metadata.permissions)(
        target,
        propertyKey,
        descriptor,
      );
    }
    if (metadata.conditions) {
      SetMetadata(PERMISSION_CONDITIONS_KEY, metadata.conditions)(
        target,
        propertyKey,
        descriptor,
      );
    }
    if (metadata.requireOwnership) {
      SetMetadata(REQUIRE_OWNERSHIP_KEY, true)(target, propertyKey, descriptor);
    }
    if (metadata.requireClinicMembership) {
      SetMetadata(REQUIRE_CLINIC_MEMBERSHIP_KEY, true)(
        target,
        propertyKey,
        descriptor,
      );
    }
    if (metadata.allowAdminOverride) {
      SetMetadata(ALLOW_ADMIN_OVERRIDE_KEY, true)(
        target,
        propertyKey,
        descriptor,
      );
    }
  };
};

// 便捷的组合装饰器

/**
 * 读取用户装饰器
 * 用户只能读取自己的信息或管理员可以读取所有用户信息
 */
export const ReadUser = () => AdminOrOwner(Resource.USER, Action.READ);

/**
 * 更新用户装饰器
 * 用户只能更新自己的信息或管理员可以更新任何用户信息
 */
export const UpdateUser = () => AdminOrOwner(Resource.USER, Action.UPDATE);

/**
 * 读取用户资料装饰器
 */
export const ReadUserProfile = () =>
  AdminOrOwner(Resource.USER_PROFILE, Action.READ);

/**
 * 更新用户资料装饰器
 */
export const UpdateUserProfile = () =>
  AdminOrOwner(Resource.USER_PROFILE, Action.UPDATE);

/**
 * 读取患者信息装饰器
 * 同诊所医生可以读取患者信息，患者只能读取自己的信息
 */
export const ReadPatient = () => {
  return SetMetadata(PERMISSION_METADATA_KEY, [
    {
      action: Action.READ,
      resource: Resource.PATIENT,
      conditions: [{ type: PermissionConditionType.CLINIC_MEMBER }],
    },
    {
      action: Action.READ,
      resource: Resource.PATIENT,
      conditions: [{ type: PermissionConditionType.OWNER }],
    },
  ]);
};

/**
 * 管理处方装饰器
 * 医生可以管理处方，药剂师可以读取和更新处方状态，患者只能读取自己的处方
 */
export const ManagePrescription = () => {
  return SetMetadata(PERMISSION_METADATA_KEY, [
    { action: Action.MANAGE, resource: Resource.PRESCRIPTION }, // 医生
    { action: Action.READ, resource: Resource.PRESCRIPTION }, // 药剂师
    { action: Action.UPDATE, resource: Resource.PRESCRIPTION }, // 药剂师
    {
      action: Action.READ,
      resource: Resource.PRESCRIPTION,
      conditions: [{ type: PermissionConditionType.OWNER }],
    }, // 患者
  ]);
};
