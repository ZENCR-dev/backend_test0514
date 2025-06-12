import { AccountStatus } from "@prisma/client";

export interface IClinicAccount {
  id: string;
  clinicId: string;
  prepaidBalance: number;
  creditLimit: number;
  status: AccountStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  // 移除deletedAt，使用status状态来标记删除
  // clinicName将通过关联查询获取
}

export interface IClinicAccountService {
  create(data: any): Promise<IClinicAccount>;
  findAll(query: any, userId?: string, userRole?: string): Promise<any>;
  findOne(id: string): Promise<IClinicAccount>;
  update(id: string, data: any): Promise<IClinicAccount>;
  remove(id: string): Promise<{ message: string }>;
  getBalance(id: string): Promise<any>;
}

export interface IUserPermission {
  userId: string;
  role: string;
  clinicId?: string;
}
