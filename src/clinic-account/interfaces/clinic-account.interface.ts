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

  // A1前置修复：支付相关方法
  updateBalance(
    clinicId: string,
    amount: number,
    transactionType: string,
    referenceId?: string,
    description?: string,
  ): Promise<IClinicAccount>;

  deductBalance(
    clinicId: string,
    amount: number,
    referenceId?: string,
    description?: string,
  ): Promise<IClinicAccount>;

  refundBalance(
    clinicId: string,
    amount: number,
    referenceId?: string,
    description?: string,
  ): Promise<IClinicAccount>;

  getTransactionHistory(
    accountId: string,
    page?: number,
    limit?: number,
  ): Promise<{
    data: any[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }>;
}

export interface IUserPermission {
  userId: string;
  role: string;
  clinicId?: string;
}
