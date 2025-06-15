import { OrderStatus } from '@prisma/client';

// 订单实体接口
export interface IOrder {
  id: string;
  platformOrderId: string;
  practitionerId: string;
  patientId?: string;
  clinicId: string;
  patientInfo: any;
  status: OrderStatus;
  totalAmount: number;
  paymentStatus?: string;
  paymentMethod?: string;
  assignedPharmacyId?: string;
  dispensedAt?: Date;
  completedAt?: Date;
  qrCodeData?: string;
  pdfUrl?: string;
  notes?: string;
  version: number;
  idempotencyKey?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 分页查询结果接口
export interface IPaginatedOrders {
  data: IOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 订单创建请求接口
export interface ICreateOrderRequest {
  practitionerId: string;
  patientId?: string;
  clinicId: string;
  patientInfo: any;
  totalAmount: number;
  items: IOrderItemRequest[];
  notes?: string;
  idempotencyKey?: string;
}

// 订单项目请求接口
export interface IOrderItemRequest {
  medicineId: string;
  quantity: number;
  unitPrice: number;
  dosageInstructions?: string;
  notes?: string;
}

// 订单查询条件接口
export interface IOrderQueryCriteria {
  practitionerId?: string;
  clinicId?: string;
  status?: OrderStatus;
  patientId?: string;
  assignedPharmacyId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 订单状态更新请求接口
export interface IUpdateOrderStatusRequest {
  status: OrderStatus;
  notes?: string;
  version: number; // 乐观锁版本控制
}

// Task 5A: 订单实体管理服务核心接口
// 职责：纯订单实体CRUD，无支付逻辑
export interface IOrderManagement {
  /**
   * 创建订单 - 仅创建订单实体，不处理支付
   * @param orderData 订单创建数据
   * @returns 创建的订单实体
   */
  createOrder(orderData: ICreateOrderRequest): Promise<IOrder>;

  /**
   * 更新订单状态 - 管理订单基础状态（DRAFT, CANCELLED等非支付状态）
   * @param orderId 订单ID
   * @param updateData 状态更新数据
   * @returns 更新后的订单实体
   */
  updateOrderStatus(orderId: string, updateData: IUpdateOrderStatusRequest): Promise<IOrder>;

  /**
   * 根据ID获取订单
   * @param orderId 订单ID
   * @returns 订单实体
   */
  getOrderById(orderId: string): Promise<IOrder>;

  /**
   * 根据平台订单号获取订单
   * @param platformOrderId 平台订单号
   * @returns 订单实体
   */
  getOrderByPlatformId(platformOrderId: string): Promise<IOrder>;

  /**
   * 查询订单列表 - 支持分页、过滤、排序
   * @param criteria 查询条件
   * @returns 分页订单列表
   */
  queryOrders(criteria: IOrderQueryCriteria): Promise<IPaginatedOrders>;

  /**
   * 删除订单 - 软删除，将状态设置为CANCELLED
   * @param orderId 订单ID
   * @param version 版本号（乐观锁）
   * @returns 删除结果
   */
  cancelOrder(orderId: string, version: number): Promise<IOrder>;

  /**
   * 验证订单数据完整性
   * @param orderData 订单数据
   * @returns 验证结果
   */
  validateOrderData(orderData: ICreateOrderRequest): Promise<boolean>;

  /**
   * 检查订单状态转换是否合法
   * @param currentStatus 当前状态
   * @param targetStatus 目标状态
   * @returns 是否允许转换
   */
  isStatusTransitionAllowed(currentStatus: OrderStatus, targetStatus: OrderStatus): boolean;
} 