import { UserRole, UserStatus } from "@prisma/client";

/**
 * 用户基础信息接口
 */
export interface UserInfo {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 用户档案信息接口
 */
export interface UserProfileInfo {
  id: string;
  userId: string;
  fullName: string;
  phone?: string;
  address?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 完整用户信息接口
 */
export interface FullUserInfo extends UserInfo {
  profile?: UserProfileInfo;
}

/**
 * 用户创建数据接口
 */
export interface CreateUserData {
  email: string;
  password: string;
  role: UserRole;
  profile: {
    fullName: string;
    phone?: string;
    address?: any;
  };
}

/**
 * 用户更新数据接口
 */
export interface UpdateUserData {
  email?: string;
  status?: UserStatus;
  profile?: {
    fullName?: string;
    phone?: string;
    address?: any;
  };
}

/**
 * 用户查询选项接口
 */
export interface UserQueryOptions {
  includeProfile?: boolean;
  includePassword?: boolean;
}

/**
 * 用户列表查询参数接口
 */
export interface UserListQuery {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string; // 搜索邮箱或姓名
  sortBy?: "createdAt" | "updatedAt" | "email" | "fullName";
  sortOrder?: "asc" | "desc";
}

/**
 * 分页结果接口
 */
export interface PaginatedUsers {
  users: FullUserInfo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
