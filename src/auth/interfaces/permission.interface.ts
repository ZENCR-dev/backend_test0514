import { UserRole } from "@prisma/client";

/**
 * 权限操作枚举
 */
export enum Action {
  CREATE = "create",
  READ = "read",
  UPDATE = "update",
  DELETE = "delete",
  MANAGE = "manage", // 管理所有权限
}

/**
 * 资源类型枚举
 */
export enum Resource {
  USER = "user",
  USER_PROFILE = "user_profile",
  PRESCRIPTION = "prescription",
  MEDICINE = "medicine",
  CLINIC = "clinic",
  PATIENT = "patient",
  ALL = "all", // 所有资源
}

/**
 * 权限定义接口
 */
export interface Permission {
  action: Action;
  resource: Resource;
  conditions?: PermissionCondition[];
}

/**
 * 权限条件类型
 */
export enum PermissionConditionType {
  OWNER = "owner", // 资源所有者
  CLINIC_MEMBER = "clinic_member", // 同诊所成员
  ADMIN_OR_OWNER = "admin_or_owner", // 管理员或所有者
  ROLE_HIERARCHY = "role_hierarchy", // 角色层级
}

/**
 * 权限条件接口
 */
export interface PermissionCondition {
  type: PermissionConditionType;
  field?: string; // 用于比较的字段名
  value?: any; // 期望的值
}

/**
 * 权限检查请求接口
 */
export interface PermissionCheckRequest {
  user: {
    id: string;
    role: UserRole;
    clinicId?: string;
    [key: string]: any;
  };
  resource: Resource;
  action: Action;
  resourceId?: string;
  resourceData?: any; // 资源实际数据，用于条件检查
}

/**
 * 权限检查结果接口
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  conditions?: PermissionCondition[];
}

/**
 * 资源权限映射接口
 */
export interface ResourcePermissionMap {
  [key: string]: Permission[];
}

/**
 * 角色权限映射接口
 */
export interface RolePermissionMap {
  [key: string]: Permission[];
}

/**
 * 权限元数据接口
 */
export interface PermissionMetadata {
  permissions?: Permission[];
  conditions?: PermissionCondition[];
  requireOwnership?: boolean;
  requireClinicMembership?: boolean;
  allowAdminOverride?: boolean;
  customValidator?: string; // 自定义验证器名称
}
