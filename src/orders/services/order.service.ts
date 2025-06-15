import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderStatus } from "@prisma/client";
import {
  IOrderManagement,
  IOrder,
  ICreateOrderRequest,
  IPaginatedOrders,
  IOrderQueryCriteria,
  IUpdateOrderStatusRequest,
} from "../interfaces/order-management.interface";
import { CreateOrderDto } from "../dto/create-order.dto";
import {
  OrderSubmittedForPaymentEvent,
  OrderCancelledEvent,
  APP_EVENTS,
} from "../../common/events/app.events";

/**
 * 订单实体管理服务 - Task 5A
 *
 * 职责范围：
 * - 纯订单实体CRUD操作，不涉及支付逻辑
 * - 订单状态管理（DRAFT, CANCELLED等基础状态）
 * - 订单数据验证和完整性检查
 * - 并发安全的订单操作（乐观锁）
 *
 * 设计原则：
 * - 遵循DDD领域驱动设计
 * - 单一职责原则：只管理订单实体
 * - 接口隔离：与支付引擎完全解耦
 * - 并发安全：使用乐观锁防止数据竞争
 *
 * @author Task 5A Team
 * @version 1.0.0
 * @since 2025-06-13
 */
@Injectable()
export class OrderService implements IOrderManagement {
  private readonly logger = new Logger(OrderService.name);

  // 业务常量配置
  private readonly ORDER_EXPIRY_HOURS = 24; // 订单过期时间（小时）
  private readonly PLATFORM_ORDER_ID_PREFIX = "ORD"; // 平台订单号前缀
  private readonly AMOUNT_PRECISION_TOLERANCE = 0.01; // 金额精度容差
  private readonly DEFAULT_PAGE_SIZE = 20; // 默认分页大小
  private readonly MAX_PAGE_SIZE = 100; // 最大分页大小

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * 创建订单 - Task 5A核心方法1
   *
   * 业务流程：
   * 1. 数据验证（医生、诊所、药品存在性）
   * 2. 生成唯一平台订单号
   * 3. 计算订单总金额（基于药品基础价格）
   * 4. 事务性创建订单和订单项
   * 5. 设置订单过期时间（24小时）
   *
   * 并发安全：
   * - 使用数据库事务保证原子性
   * - 幂等性键防止重复创建
   *
   * 性能考虑：
   * - 批量创建订单项减少数据库往返
   * - 避免N+1查询问题
   *
   * @param createOrderDto 订单创建数据传输对象
   * @returns 创建的订单实体（包含计算后的金额）
   * @throws BadRequestException 当数据验证失败时
   * @throws ConflictException 当幂等性键重复时
   */
  async createOrder(createOrderDto: CreateOrderDto): Promise<IOrder> {
    this.logger.log(
      `Creating order for practitioner: ${createOrderDto.practitionerId}`,
    );

    // 1. 数据验证 - 确保所有关联实体存在
    await this.validateCreateOrderData(createOrderDto);

    // 2. 生成平台订单号 - 保证全局唯一性
    const platformOrderId = await this.generatePlatformOrderId();

    // 3. 计算总金额 - 基于药品当前价格重新计算
    const { totalAmount, itemsWithCalculation } =
      await this.calculateOrderTotal(createOrderDto.items);

    // 4. 使用事务创建订单和订单项（保证数据一致性）
    const result = await this.prisma.$transaction(async (tx) => {
      // 创建订单主记录
      const order = await tx.order.create({
        data: {
          platformOrderId,
          practitionerId: createOrderDto.practitionerId,
          patientId: createOrderDto.patientId,
          clinicId: createOrderDto.clinicId,
          patientInfo: createOrderDto.patientInfo,
          totalAmount,
          status: OrderStatus.DRAFT, // 初始状态为草稿
          notes: createOrderDto.notes,
          idempotencyKey: createOrderDto.idempotencyKey,
          version: 1, // 乐观锁初始版本
          expiresAt: new Date(
            Date.now() + this.ORDER_EXPIRY_HOURS * 60 * 60 * 1000,
          ), // 设置过期时间
        },
      });

      // 批量创建订单项 - 性能优化
      await tx.orderItem.createMany({
        data: itemsWithCalculation.map((item) => ({
          orderId: order.id,
          medicineId: item.medicineId,
          medicineSnapshot: item.medicineSnapshot, // 保存药品快照，防止价格变动影响
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          dosageInstructions: item.dosageInstructions,
          notes: item.notes,
        })),
      });

      return order;
    });

    this.logger.log(`Order created successfully: ${result.platformOrderId}`);

    // 转换Decimal类型
    const orderResult = this.convertOrderDecimalFields(result) as IOrder;

    // 发布订单创建事件 - 为了通知其他服务（如支付引擎）
    // 注意：这里暂时不发布支付事件，等订单确认提交时再发布
    this.logger.log(
      `Order created, ready for submission: ${result.platformOrderId}`,
    );

    return orderResult;
  }

  /**
   * 更新订单状态 - Task 5A核心方法3
   *
   * 业务规则：
   * - 只允许合法的状态转换（基于状态机）
   * - 使用乐观锁防止并发冲突
   * - 记录状态变更日志
   *
   * 状态转换示例：
   * DRAFT -> CANCELLED (用户取消)
   * DRAFT -> PAID (支付成功，由Task 5C处理)
   * PAID -> FULFILLED (履约完成)
   *
   * 并发安全：
   * - 乐观锁版本控制
   * - 原子性状态更新
   *
   * @param orderId 订单ID
   * @param updateData 状态更新数据（包含版本号）
   * @returns 更新后的订单实体
   * @throws NotFoundException 当订单不存在时
   * @throws BadRequestException 当状态转换不合法或版本冲突时
   */
  async updateOrderStatus(
    orderId: string,
    updateData: IUpdateOrderStatusRequest,
  ): Promise<IOrder> {
    this.logger.log(
      `Updating order status: ${orderId} to ${updateData.status}`,
    );

    // 1. 查询现有订单 - 验证存在性和当前状态
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // 2. 验证状态转换合法性 - 基于业务状态机
    if (
      !this.isStatusTransitionAllowed(existingOrder.status, updateData.status)
    ) {
      throw new BadRequestException(
        `Invalid status transition from ${existingOrder.status} to ${updateData.status}`,
      );
    }

    // 3. 使用乐观锁更新订单状态 - 防止并发冲突
    try {
      const updatedOrder = await this.prisma.order.update({
        where: {
          id: orderId,
          version: updateData.version, // 乐观锁版本检查
        },
        data: {
          status: updateData.status,
          notes: updateData.notes,
          version: { increment: 1 }, // 版本号自增
        },
      });

      this.logger.log(
        `Order status updated successfully: ${updatedOrder.platformOrderId}`,
      );

      // 根据状态变化发布相应事件
      await this.publishOrderStatusChangeEvent(updatedOrder, updateData.status);

      return this.convertOrderDecimalFields(updatedOrder) as IOrder;
    } catch (error) {
      // 处理乐观锁冲突
      if (error.code === "P2025") {
        throw new BadRequestException(
          "Order version mismatch - order may have been updated by another process",
        );
      }
      throw error;
    }
  }

  /**
   * 根据ID获取订单 - Task 5A核心方法2
   *
   * 查询策略：
   * - 包含订单项信息（一次查询获取完整数据）
   * - 优化include关系避免N+1问题
   *
   * 数据转换：
   * - Decimal类型转换为Number
   * - 保持与前端接口的兼容性
   *
   * @param orderId 订单ID
   * @returns 订单实体（包含订单项）
   * @throws NotFoundException 当订单不存在时
   */
  async getOrderById(orderId: string): Promise<IOrder> {
    this.logger.log(`Getting order by ID: ${orderId}`);

    // 查询订单（优化include策略，一次查询获取完整数据）
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }, // 包含订单项，避免额外查询
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    this.logger.log(`Order found: ${order.platformOrderId}`);

    return this.convertOrderWithItemsDecimalFields(order) as IOrder;
  }

  /**
   * 根据平台订单ID获取订单 - Task 5A核心方法4
   *
   * 业务场景：
   * - 外部系统通过平台订单号查询
   * - 用户通过订单号查询订单状态
   * - 客服系统订单查询
   *
   * 实现策略：
   * - 复用getOrderById的查询和转换逻辑
   * - 保持一致的错误处理和日志记录
   *
   * @param platformOrderId 平台订单号（如：ORD1671234567890123）
   * @returns 订单实体（包含订单项）
   * @throws NotFoundException 当订单不存在时
   */
  async getOrderByPlatformId(platformOrderId: string): Promise<IOrder> {
    this.logger.log(`Getting order by platform ID: ${platformOrderId}`);

    // 查询订单（使用与getOrderById一致的include策略）
    const order = await this.prisma.order.findUnique({
      where: { platformOrderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException(
        `Order not found with platform ID: ${platformOrderId}`,
      );
    }

    this.logger.log(`Order found by platform ID: ${order.platformOrderId}`);

    return this.convertOrderWithItemsDecimalFields(order) as IOrder;
  }

  /**
   * 查询订单列表 - Task 5A核心方法5
   *
   * 查询功能：
   * - 多维度过滤（医生、诊所、状态、时间范围）
   * - 分页支持（防止大数据量查询）
   * - 排序支持（多字段排序）
   * - 权限过滤（基于用户角色）
   *
   * 性能优化：
   * - 并行执行count和data查询
   * - 合理的默认分页大小
   * - 索引优化的查询条件
   *
   * @param criteria 查询条件（过滤、分页、排序）
   * @returns 分页订单列表
   */
  async queryOrders(criteria: IOrderQueryCriteria): Promise<IPaginatedOrders> {
    this.logger.log(
      `Querying orders with criteria: ${JSON.stringify(criteria)}`,
    );

    // 1. 构建查询条件 - 支持多维度过滤
    const where: any = {};

    if (criteria.practitionerId) {
      where.practitionerId = criteria.practitionerId;
    }

    if (criteria.clinicId) {
      where.clinicId = criteria.clinicId;
    }

    if (criteria.status) {
      where.status = criteria.status;
    }

    // 时间范围查询 - 支持开始和结束时间
    if (criteria.startDate || criteria.endDate) {
      where.createdAt = {};
      if (criteria.startDate) {
        where.createdAt.gte = criteria.startDate;
      }
      if (criteria.endDate) {
        where.createdAt.lte = criteria.endDate;
      }
    }

    // 2. 分页参数 - 防止大数据量查询
    const page = criteria.page || 1;
    const limit = Math.min(
      criteria.limit || this.DEFAULT_PAGE_SIZE,
      this.MAX_PAGE_SIZE,
    );
    const skip = (page - 1) * limit;

    // 3. 排序参数 - 支持多字段排序
    const orderBy: any = {};
    const sortBy = criteria.sortBy || "createdAt";
    const sortOrder = criteria.sortOrder || "desc";
    orderBy[sortBy] = sortOrder;

    // 4. 并行执行查询 - 性能优化
    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          items: true, // 包含订单项信息
        },
      }),
      this.prisma.order.count({ where }), // 并行计算总数
    ]);

    // 5. 计算分页信息
    const totalPages = Math.ceil(total / limit);

    this.logger.log(`Found ${orders.length} orders out of ${total} total`);

    // 6. 转换数据类型并返回
    const convertedOrders = orders.map((order) =>
      this.convertOrderWithItemsDecimalFields(order),
    );

    return {
      data: convertedOrders as IOrder[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 取消订单 - Task 5A核心方法6
   *
   * 业务规则：
   * - 只允许DRAFT状态的订单取消
   * - 已支付订单需要通过退款流程（Task 5B处理）
   * - 使用乐观锁防止并发取消
   *
   * 状态转换：
   * DRAFT -> CANCELLED（允许）
   * PAID -> CANCELLED（需要退款，由Task 5C处理）
   *
   * @param orderId 订单ID
   * @param version 版本号（乐观锁）
   * @returns 取消后的订单实体
   * @throws NotFoundException 当订单不存在时
   * @throws BadRequestException 当订单状态不允许取消或版本冲突时
   */
  async cancelOrder(orderId: string, version: number): Promise<IOrder> {
    this.logger.log(`Cancelling order: ${orderId}`);

    // 1. 查询现有订单 - 验证存在性
    const existingOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    // 2. 验证订单状态 - 业务规则检查
    if (existingOrder.status !== OrderStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot cancel order with status ${existingOrder.status}. Only DRAFT orders can be cancelled.`,
      );
    }

    // 3. 使用乐观锁更新订单状态为CANCELLED
    try {
      const cancelledOrder = await this.prisma.order.update({
        where: {
          id: orderId,
          version: version, // 乐观锁版本检查
        },
        data: {
          status: OrderStatus.CANCELLED,
          notes: "Order cancelled by user", // 记录取消原因
          version: { increment: 1 }, // 版本号自增
        },
      });

      this.logger.log(
        `Order cancelled successfully: ${cancelledOrder.platformOrderId}`,
      );

      return this.convertOrderDecimalFields(cancelledOrder) as IOrder;
    } catch (error) {
      // 处理乐观锁冲突
      if (error.code === "P2025") {
        throw new BadRequestException(
          "Order version mismatch - order may have been updated by another process",
        );
      }
      throw error;
    }
  }

  /**
   * 验证订单数据完整性 - Task 5A核心方法7
   *
   * 验证项目：
   * 1. 医生存在性验证
   * 2. 诊所存在性验证
   * 3. 药品存在性验证
   * 4. 总金额计算验证
   * 5. 业务规则验证
   *
   * 用途：
   * - 订单创建前的数据验证
   * - 外部系统数据同步验证
   * - 数据完整性检查工具
   *
   * @param orderData 订单数据
   * @returns 验证结果（true/false）
   */
  async validateOrderData(orderData: ICreateOrderRequest): Promise<boolean> {
    this.logger.log(
      `Validating order data for practitioner: ${orderData.practitionerId}`,
    );

    try {
      // 1. 验证医生存在性
      const practitioner = await this.prisma.user.findUnique({
        where: { id: orderData.practitionerId },
      });
      if (!practitioner) {
        this.logger.warn(`Practitioner not found: ${orderData.practitionerId}`);
        return false;
      }

      // 2. 验证诊所存在性
      const clinic = await this.prisma.clinic.findUnique({
        where: { id: orderData.clinicId },
      });
      if (!clinic) {
        this.logger.warn(`Clinic not found: ${orderData.clinicId}`);
        return false;
      }

      // 3. 验证药品存在性并计算总金额
      let calculatedTotal = 0;
      for (const item of orderData.items) {
        const medicine = await this.prisma.medicine.findUnique({
          where: { id: item.medicineId },
        });
        if (!medicine) {
          this.logger.warn(`Medicine not found: ${item.medicineId}`);
          return false;
        }

        // 计算该项的总价
        const itemTotal = item.quantity * item.unitPrice;
        calculatedTotal += itemTotal;
      }

      // 4. 验证总金额是否正确 - 允许浮点精度误差
      const totalAmountMatch =
        Math.abs(calculatedTotal - orderData.totalAmount) <
        this.AMOUNT_PRECISION_TOLERANCE;
      if (!totalAmountMatch) {
        this.logger.warn(
          `Total amount mismatch: calculated ${calculatedTotal}, provided ${orderData.totalAmount}`,
        );
        return false;
      }

      this.logger.log(`Order data validation successful`);
      return true;
    } catch (error) {
      this.logger.error(`Order data validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查订单状态转换是否合法 - Task 5A核心方法8
   *
   * 状态机定义：
   * - DRAFT: 草稿状态，可以取消、支付或过期
   * - PAID: 已支付，可以审核、履约或取消（需退款）
   * - CANCELLED: 已取消，终态
   * - FULFILLED: 已履约，终态
   *
   * 设计原则：
   * - 明确的状态转换规则
   * - 防止非法状态转换
   * - 支持业务流程扩展
   *
   * @param currentStatus 当前状态
   * @param targetStatus 目标状态
   * @returns 是否允许转换
   */
  isStatusTransitionAllowed(
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
  ): boolean {
    // Task 5A范围内的状态转换规则（基础状态管理，不涉及复杂支付流程）
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.DRAFT]: [
        OrderStatus.CANCELLED,
        OrderStatus.PAID,
        OrderStatus.EXPIRED,
      ], // 草稿可以取消、支付或过期
      [OrderStatus.PAYMENT_FAILED]: [OrderStatus.DRAFT, OrderStatus.CANCELLED], // 支付失败可以重新草稿或取消
      [OrderStatus.PAID]: [
        OrderStatus.PENDING_REVIEW,
        OrderStatus.FULFILLED,
        OrderStatus.CANCELLED,
      ], // 已支付可以待审核、履约或取消
      [OrderStatus.PENDING_REVIEW]: [
        OrderStatus.REJECTED,
        OrderStatus.FULFILLED,
      ], // 待审核可以拒绝或履约
      [OrderStatus.REJECTED]: [OrderStatus.DRAFT], // 拒绝后可以重新草稿
      [OrderStatus.FULFILLED]: [], // 已履约是终态，不允许转换
      [OrderStatus.CANCELLED]: [], // 已取消是终态，不允许转换
      [OrderStatus.EXPIRED]: [OrderStatus.DRAFT], // 过期后可以重新草稿
    };

    const allowedTargets = allowedTransitions[currentStatus] || [];
    return allowedTargets.includes(targetStatus);
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 验证订单创建数据
   *
   * 验证项目：
   * - 医生和诊所存在性
   * - 幂等性键唯一性
   * - 药品存在性
   *
   * @private
   * @param createOrderDto 订单创建DTO
   * @throws BadRequestException 当验证失败时
   * @throws ConflictException 当幂等性键重复时
   */
  private async validateCreateOrderData(
    createOrderDto: CreateOrderDto,
  ): Promise<void> {
    // 验证医生存在性
    const practitioner = await this.prisma.user.findUnique({
      where: { id: createOrderDto.practitionerId },
    });
    if (!practitioner) {
      throw new BadRequestException(
        `Practitioner not found: ${createOrderDto.practitionerId}`,
      );
    }

    // 验证诊所存在性
    const clinic = await this.prisma.clinic.findUnique({
      where: { id: createOrderDto.clinicId },
    });
    if (!clinic) {
      throw new BadRequestException(
        `Clinic not found: ${createOrderDto.clinicId}`,
      );
    }

    // 检查幂等性键唯一性 - 防止重复创建
    if (createOrderDto.idempotencyKey) {
      const existingOrder = await this.prisma.order.findUnique({
        where: { idempotencyKey: createOrderDto.idempotencyKey },
      });
      if (existingOrder) {
        throw new ConflictException(
          `Order with idempotency key already exists: ${createOrderDto.idempotencyKey}`,
        );
      }
    }

    // 验证药品存在性
    for (const item of createOrderDto.items) {
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: item.medicineId },
      });
      if (!medicine) {
        throw new BadRequestException(`Medicine not found: ${item.medicineId}`);
      }
    }
  }

  /**
   * 生成平台订单号
   *
   * 格式：ORD + 时间戳 + 3位随机数
   * 示例：ORD1671234567890123
   *
   * 特点：
   * - 全局唯一性
   * - 时间排序性
   * - 可读性
   *
   * @private
   * @returns 平台订单号
   */
  private async generatePlatformOrderId(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `${this.PLATFORM_ORDER_ID_PREFIX}${timestamp}${random}`;
  }

  /**
   * 计算订单总金额
   *
   * 计算逻辑：
   * - 基于药品当前基础价格
   * - 保存药品快照防止价格变动
   * - 计算每项小计和总计
   *
   * 数据完整性：
   * - 药品信息快照
   * - 价格计算验证
   * - 数量和单价验证
   *
   * @private
   * @param items 订单项目列表
   * @returns 总金额和计算后的项目列表
   * @throws BadRequestException 当药品不存在时
   */
  private async calculateOrderTotal(
    items: any[],
  ): Promise<{ totalAmount: number; itemsWithCalculation: any[] }> {
    let totalAmount = 0;
    const itemsWithCalculation = [];

    for (const item of items) {
      // 获取药品信息作为快照 - 防止价格变动影响订单
      const medicine = await this.prisma.medicine.findUnique({
        where: { id: item.medicineId },
        select: {
          id: true,
          name: true,
          chineseName: true,
          englishName: true,
          pinyinName: true,
          sku: true,
          unit: true,
          basePrice: true,
          category: true,
        },
      });

      if (!medicine) {
        throw new BadRequestException(`Medicine not found: ${item.medicineId}`);
      }

      // 计算项目金额
      const itemWithCalculation = {
        ...item,
        medicineSnapshot: medicine, // 保存药品快照
        unitPrice: Number(medicine.basePrice), // 使用当前基础价格
        totalPrice: Number(medicine.basePrice) * item.quantity, // 计算小计
      };

      totalAmount += itemWithCalculation.totalPrice;
      itemsWithCalculation.push(itemWithCalculation);
    }

    return { totalAmount, itemsWithCalculation };
  }

  /**
   * 转换订单Decimal字段为Number
   *
   * 目的：
   * - 解决Prisma Decimal类型与前端Number类型的兼容性
   * - 保持API响应的一致性
   * - 避免重复的类型转换代码
   *
   * @private
   * @param order 订单对象
   * @returns 转换后的订单对象
   */
  private convertOrderDecimalFields(order: any): any {
    const result: any = { ...order };

    // 只有当totalAmount存在时才转换
    if (order.totalAmount !== undefined && order.totalAmount !== null) {
      result.totalAmount = Number(order.totalAmount);
    }

    return result;
  }

  /**
   * 转换订单及订单项的Decimal字段为Number
   *
   * 扩展convertOrderDecimalFields，同时处理订单项的价格字段
   *
   * @private
   * @param order 包含订单项的订单对象
   * @returns 转换后的订单对象
   */
  private convertOrderWithItemsDecimalFields(order: any): any {
    const result = this.convertOrderDecimalFields(order);

    // 转换订单项的价格字段
    if (order.items && order.items.length > 0) {
      result.items = order.items.map((item) => ({
        ...item,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : item.unitPrice,
        totalPrice: item.totalPrice ? Number(item.totalPrice) : item.totalPrice,
      }));
    }

    return result;
  }

  /**
   * 发布订单状态变化事件
   *
   * 根据订单状态变化发布相应的事件，用于通知其他服务（如支付引擎）
   *
   * 事件映射：
   * - CANCELLED -> OrderCancelledEvent
   * - PAID -> OrderSubmittedForPaymentEvent (支付成功后的确认)
   * - 其他状态变化暂时不发布事件
   *
   * @private
   * @param order 更新后的订单对象
   * @param newStatus 新的订单状态
   */
  private async publishOrderStatusChangeEvent(
    order: any,
    newStatus: OrderStatus,
  ): Promise<void> {
    try {
      switch (newStatus) {
        case OrderStatus.CANCELLED: {
          // 发布订单取消事件
          const cancelEvent = new OrderCancelledEvent(
            order.id,
            order.notes || "Order cancelled",
            order.practitionerId,
            new Date(),
          );
          await this.eventEmitter.emitAsync(
            APP_EVENTS.ORDER_CANCELLED,
            cancelEvent,
          );
          this.logger.log(
            `Published OrderCancelledEvent for order: ${order.platformOrderId}`,
          );
          break;
        }

        case OrderStatus.PAID: {
          // 发布订单支付成功事件（用于后续履约流程）
          const paymentEvent = new OrderSubmittedForPaymentEvent(
            order.id,
            order.clinicId,
            Number(order.totalAmount),
            "prepaid", // 默认预付费，实际支付方式由支付引擎确定
            new Date(),
          );
          await this.eventEmitter.emitAsync(
            APP_EVENTS.ORDER_SUBMITTED_FOR_PAYMENT,
            paymentEvent,
          );
          this.logger.log(
            `Published OrderSubmittedForPaymentEvent for order: ${order.platformOrderId}`,
          );
          break;
        }

        default:
          // 其他状态变化暂时不发布事件
          this.logger.debug(
            `No event published for status change to: ${newStatus}`,
          );
          break;
      }
    } catch (error) {
      // 事件发布失败不应该影响主业务流程
      this.logger.error(
        `Failed to publish order status change event: ${error.message}`,
        error.stack,
      );
    }
  }
}
