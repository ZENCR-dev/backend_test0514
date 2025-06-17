import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { RequirePermissions } from "../../auth/decorators/permissions.decorator";
import { Action, Resource } from "../../auth/interfaces/permission.interface";
import { OrderService } from "../services/order.service";
import { CreateOrderDto } from "../dto/create-order.dto";
import { UpdateOrderDto } from "../dto/update-order.dto";
import { QueryOrderDto } from "../dto/query-order.dto";
import {
  OrderResponseDto,
  ApiResponseWrapper,
  PaginatedOrderResponseDto,
} from "../dto/order-response.dto";
import {
  IOrder,
  IPaginatedOrders,
  IOrderQueryCriteria,
} from "../interfaces/order-management.interface";
import { OrderStatus } from "@prisma/client";

/**
 * 订单控制器 - Task 5A API层实现
 *
 * 实现功能：
 * - GET /orders - 分页查询订单列表
 * - GET /orders/:id - 获取单个订单详情
 * - POST /orders - 创建新订单
 * - PATCH /orders/:id - 更新订单信息
 * - DELETE /orders/:id - 取消订单
 *
 * 权限矩阵：
 * - 医生：只能操作自己的订单
 * - 药房：只能查看指派给自己的订单
 * - 管理员：拥有所有权限
 *
 * @author Task 5A Team
 * @version 1.0.0
 * @since 2025-06-17
 */
@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  private readonly logger = new Logger(OrderController.name);
  constructor(private readonly orderService: OrderService) {}

  /**
   * 获取订单列表
   * 支持分页、筛选和排序
   *
   * 权限控制：
   * - 医生：只能查看自己创建的订单
   * - 药房：只能查看分配给自己的订单
   * - 管理员：可查看所有订单
   */
  @Get()
  @RequirePermissions({ action: Action.READ, resource: Resource.PRESCRIPTION })
  @ApiOperation({
    summary: "分页查询订单列表",
    description:
      "根据查询条件分页获取订单列表，支持按状态、诊所等条件过滤。医生只能查看自己的订单，管理员可以查看所有订单。",
  })
  @ApiResponse({
    status: 200,
    description: "查询成功",
    type: ApiResponseWrapper,
  })
  @ApiResponse({ status: 401, description: "未授权访问" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 400, description: "查询参数错误" })
  async findAll(
    @Req() req: any,
    @Query() query: QueryOrderDto,
  ): Promise<ApiResponseWrapper<PaginatedOrderResponseDto>> {
    try {
      const { startDate, endDate, ...restQuery } = query;
      const criteria: IOrderQueryCriteria = { ...restQuery };

      if (req.user.role !== "admin") {
        criteria.practitionerId = req.user.id;
      }

      if (startDate) {
        criteria.startDate = new Date(startDate);
      }
      if (endDate) {
        criteria.endDate = new Date(endDate);
      }

      const paginatedOrders = await this.orderService.queryOrders(criteria);
      return {
        success: true,
        data: paginatedOrders as unknown as PaginatedOrderResponseDto, // Cast to match type
        message: "Orders retrieved successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to get orders for user ${req.user.id}:`, error);
      throw new BadRequestException("Failed to retrieve orders.");
    }
  }

  /**
   * 获取单个订单详情
   *
   * 权限控制：
   * - Doctor: 只能查看自己的订单
   * - Admin: 可以查看所有订单
   * - Pharmacy: 可以查看指派给自己的订单
   */
  @Get(":id")
  @RequirePermissions({ action: Action.READ, resource: Resource.PRESCRIPTION })
  @ApiOperation({
    summary: "获取单个订单详情",
    description: "根据订单ID获取订单详细信息，包含订单项和患者信息",
  })
  @ApiParam({ name: "id", description: "订单ID", type: "string" })
  @ApiResponse({
    status: 200,
    description: "获取成功",
    type: ApiResponseWrapper,
  })
  @ApiResponse({ status: 404, description: "订单不存在" })
  @ApiResponse({ status: 403, description: "无权访问该订单" })
  async findOne(
    @Param("id") id: string,
    @Req() req: any,
  ): Promise<ApiResponseWrapper<OrderResponseDto>> {
    const order = await this.orderService.getOrderById(id);
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }
    this.checkOrderAccess(order, req.user);
    return {
      success: true,
      data: order as unknown as OrderResponseDto, // Cast to match type
      message: "Order retrieved successfully",
    };
  }

  /**
   * 创建新订单
   *
   * 权限控制：
   * - Doctor: 只能为自己创建订单
   * - Admin: 可以为任何医生创建订单
   */
  @Post()
  @RequirePermissions({
    action: Action.CREATE,
    resource: Resource.PRESCRIPTION,
  })
  @ApiOperation({
    summary: "创建新订单",
    description: "创建新的处方订单，包含患者信息和药品列表",
  })
  @ApiBody({
    type: CreateOrderDto,
    description: "订单创建数据",
  })
  @ApiResponse({
    status: 201,
    description: "创建成功",
    type: ApiResponseWrapper,
  })
  @ApiResponse({ status: 400, description: "请求数据无效" })
  @ApiResponse({ status: 403, description: "权限不足" })
  @ApiResponse({ status: 409, description: "幂等性冲突" })
  async create(
    @Body() createDto: CreateOrderDto,
    @Req() req: any,
  ): Promise<ApiResponseWrapper<OrderResponseDto>> {
    try {
      if (req.user.role !== "admin") {
        createDto.practitionerId = req.user.id;
        createDto.clinicId = req.user.clinicId;
      }
      const newOrder = await this.orderService.createOrder(createDto);
      return {
        success: true,
        data: newOrder as unknown as OrderResponseDto, // Cast to match type
        message: "Order created successfully",
      };
    } catch (error) {
      this.logger.error("Failed to create order:", error);
      throw new BadRequestException("Failed to create order.");
    }
  }

  /**
   * 更新订单信息
   *
   * 权限控制：
   * - Doctor: 只能更新自己的订单
   * - Admin: 可以更新所有订单
   * - Pharmacy: 可以更新履约状态
   */
  @Patch(":id")
  @RequirePermissions({
    action: Action.UPDATE,
    resource: Resource.PRESCRIPTION,
  })
  @ApiOperation({
    summary: "更新订单信息",
    description: "更新订单状态、备注等信息，使用乐观锁防止并发冲突",
  })
  @ApiParam({ name: "id", description: "订单ID", type: "string" })
  @ApiBody({
    type: UpdateOrderDto,
    description: "订单更新数据",
  })
  @ApiResponse({
    status: 200,
    description: "更新成功",
    type: ApiResponseWrapper,
  })
  @ApiResponse({ status: 400, description: "请求数据无效或版本冲突" })
  @ApiResponse({ status: 404, description: "订单不存在" })
  @ApiResponse({ status: 403, description: "无权更新该订单" })
  async update(
    @Param("id") id: string,
    @Body() updateDto: UpdateOrderDto,
    @Req() req: any,
  ): Promise<ApiResponseWrapper<OrderResponseDto>> {
    const existingOrder = await this.orderService.getOrderById(id);
    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }
    this.checkOrderAccess(existingOrder, req.user);

    if (existingOrder.version !== updateDto.version) {
      throw new ConflictException(
        "Version mismatch. Please refresh and try again.",
      );
    }

    try {
      const updatedOrder = await this.orderService.updateOrder(id, updateDto);
      return {
        success: true,
        data: updatedOrder as unknown as OrderResponseDto, // Cast to match type
        message: "Order updated successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to update order ${id}:`, error);
      throw new InternalServerErrorException("Failed to update order.");
    }
  }

  /**
   * 取消订单
   *
   * 权限控制：
   * - Doctor: 只能取消自己的订单
   * - Admin: 可以取消所有订单
   */
  @Delete(":id")
  @RequirePermissions({
    action: Action.DELETE,
    resource: Resource.PRESCRIPTION,
  })
  @ApiOperation({
    summary: "取消订单",
    description: "取消指定订单，只能取消未支付状态的订单",
  })
  @ApiParam({ name: "id", description: "订单ID" })
  @ApiBody({
    description: "版本号，用于乐观锁控制",
    schema: {
      type: "object",
      properties: { version: { type: "number", example: 1 } },
    },
  })
  @ApiResponse({
    status: 200,
    description: "订单取消成功",
    type: ApiResponseWrapper,
  })
  @ApiResponse({ status: 400, description: "订单状态不合法，无法取消" })
  @ApiResponse({ status: 403, description: "无权操作" })
  @ApiResponse({ status: 404, description: "订单未找到" })
  @ApiResponse({ status: 409, description: "版本冲突" })
  async remove(
    @Param("id") id: string,
    @Req() req: any,
  ): Promise<ApiResponseWrapper<OrderResponseDto>> {
    const { version } = req.body;
    if (typeof version !== "number") {
      throw new BadRequestException("Version is required in the request body.");
    }

    // 权限检查
    const existingOrder = await this.orderService.getOrderById(id);
    if (!existingOrder) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }
    this.checkOrderAccess(existingOrder, req.user);

    // 状态检查
    if (existingOrder.status !== OrderStatus.DRAFT) {
      throw new BadRequestException("Only DRAFT orders can be cancelled.");
    }

    try {
      const cancelledOrder = await this.orderService.cancelOrder(id, version);
      return {
        success: true,
        data: cancelledOrder as unknown as OrderResponseDto, // Cast to match type
        message: "Order cancelled successfully",
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw new ConflictException(error.message);
      }
      this.logger.error(`Failed to cancel order ${id}:`, error);
      throw new InternalServerErrorException("Failed to cancel order.");
    }
  }

  /**
   * 检查用户是否有权访问订单
   * @param order 订单对象
   * @param user 用户对象
   */
  private checkOrderAccess(order: IOrder, user: any): void {
    const isAdmin = user.role === "admin";
    const isOwner = user.id === order.practitionerId;
    const isAssignedPharmacy = user.id === order.assignedPharmacyId;

    if (isAdmin || isOwner || isAssignedPharmacy) {
      return;
    }

    throw new ForbiddenException(
      "You do not have permission to access this order.",
    );
  }
}
