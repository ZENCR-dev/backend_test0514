import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { OrderController } from "../order.controller";
import { OrderService } from "../../services/order.service";
import { CreateOrderDto } from "../../dto/create-order.dto";
import { UpdateOrderDto } from "../../dto/update-order.dto";
import { QueryOrderDto } from "../../dto/query-order.dto";
import {
  OrderResponseDto,
  ApiResponseWrapper,
  PaginatedOrderResponseDto,
} from "../../dto/order-response.dto";
import { OrderStatus } from "@prisma/client";
import {
  IOrder,
  IOrderItem,
  IPaginatedOrders,
} from "../../interfaces/order-management.interface";
import { PermissionService } from "../../../auth/services/permission.service";

/**
 * OrderController 单元测试 - 修复版
 */
describe("OrderController", () => {
  let controller: OrderController;
  let mockOrderService: jest.Mocked<OrderService>;

  const createMockUser = (role: string, id: string = "user-123") => ({
    id,
    role,
    email: `${role}@test.com`,
  });

  const createMockRequest = (user: any, body: any = {}) => ({
    user,
    body,
  });

  const createMockOrderItem = (
    overrides: Partial<IOrderItem> = {},
  ): IOrderItem => ({
    id: "item-123",
    medicineId: "med-123",
    medicineSnapshot: { name: "Test Medicine" },
    quantity: 2,
    unitPrice: 50,
    totalPrice: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockOrder = (overrides: Partial<IOrder> = {}): IOrder => ({
    id: "order-123",
    platformOrderId: "ORD20250619001",
    practitionerId: "doctor-123",
    patientId: "patient-123",
    patientInfo: { name: "Test Patient", age: 30 },
    status: OrderStatus.DRAFT,
    totalAmount: 100,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [createMockOrderItem()],
    ...overrides,
  });

  const createMockPaginatedResult = (
    orders: IOrder[] = [createMockOrder()],
  ): IPaginatedOrders => ({
    data: orders,
    total: orders.length,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  beforeEach(async () => {
    const mockOrderServiceProvider = {
      provide: OrderService,
      useValue: {
        queryOrders: jest.fn(),
        getOrderById: jest.fn(),
        createOrder: jest.fn(),
        updateOrder: jest.fn(),
        updateOrderStatus: jest.fn(),
        cancelOrder: jest.fn(),
      },
    };

    const mockPermissionServiceProvider = {
      provide: PermissionService,
      useValue: {
        validateUserPermissions: jest.fn().mockResolvedValue(true),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [mockOrderServiceProvider, mockPermissionServiceProvider],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    mockOrderService = module.get<OrderService>(
      OrderService,
    ) as jest.Mocked<OrderService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findAll (GET /orders)", () => {
    it("should return paginated orders for a doctor", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user);
      const query: QueryOrderDto = { page: 1, limit: 10 };
      const paginatedResult = createMockPaginatedResult();
      mockOrderService.queryOrders.mockResolvedValue(paginatedResult);

      const result = await controller.findAll(req, query);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(paginatedResult);
      expect(mockOrderService.queryOrders).toHaveBeenCalledWith({
        ...query,
        practitionerId: user.id,
      });
    });

    it("should allow admin to query orders without practitionerId restriction", async () => {
      const user = createMockUser("admin");
      const req = createMockRequest(user);
      const query: QueryOrderDto = {
        page: 1,
        limit: 10,
        practitionerId: "any-doctor",
      };
      const paginatedResult = createMockPaginatedResult();
      mockOrderService.queryOrders.mockResolvedValue(paginatedResult);

      await controller.findAll(req, query);

      expect(mockOrderService.queryOrders).toHaveBeenCalledWith(query);
    });
  });

  describe("findOne (GET /orders/:id)", () => {
    it("should return an order if user is authorized", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user);
      const order = createMockOrder({ practitionerId: "doctor-123" });
      mockOrderService.getOrderById.mockResolvedValue(order);

      const result = await controller.findOne("order-123", req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(order);
    });

    it("should throw ForbiddenException for unauthorized access", async () => {
      const user = createMockUser("practitioner", "another-doctor");
      const req = createMockRequest(user);
      const order = createMockOrder({ practitionerId: "doctor-123" });
      mockOrderService.getOrderById.mockResolvedValue(order);

      await expect(controller.findOne("order-123", req)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("should throw NotFoundException if order does not exist", async () => {
      const user = createMockUser("practitioner");
      const req = createMockRequest(user);
      mockOrderService.getOrderById.mockRejectedValue(new NotFoundException());

      await expect(controller.findOne("not-found-id", req)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("create (POST /orders)", () => {
    it("should create an order successfully", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user);
      const createDto: CreateOrderDto = {
        practitionerId: "doctor-123",
        patientId: "patient-123",
        patientInfo: { name: "New Patient" },
        items: [{ medicineId: "med-123", quantity: 1, unitPrice: 10 }],
        totalAmount: 10,
        notes: "test note",
        idempotencyKey: "idem-key-1",
      };
      const createdOrder = createMockOrder();
      mockOrderService.createOrder.mockResolvedValue(createdOrder);

      const result = await controller.create(createDto, req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(createdOrder);
      expect(mockOrderService.createOrder).toHaveBeenCalledWith({
        ...createDto,
        practitionerId: user.id,
      });
    });
  });

  describe("update (PATCH /orders/:id)", () => {
    it("should update an order successfully", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user);
      const updateDto: UpdateOrderDto = { notes: "updated note", version: 1 };
      const existingOrder = createMockOrder({
        practitionerId: "doctor-123",
        version: 1,
      });
      const updatedOrder = { ...existingOrder, ...updateDto, version: 2 };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.updateOrder.mockResolvedValue(updatedOrder);

      const result = await controller.update("order-123", updateDto, req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedOrder);
      expect(mockOrderService.updateOrder).toHaveBeenCalledWith(
        "order-123",
        updateDto,
      );
    });

    it("should throw ConflictException on version mismatch", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user);
      const updateDto: UpdateOrderDto = { notes: "updated note", version: 1 };
      const existingOrder = createMockOrder({
        practitionerId: "doctor-123",
        version: 2,
      });

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);

      await expect(
        controller.update("order-123", updateDto, req),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("remove (DELETE /orders/:id)", () => {
    it("should cancel an order successfully", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user, { version: 1 }); // 模拟body中的version
      const existingOrder = createMockOrder({
        practitionerId: "doctor-123",
        status: OrderStatus.DRAFT,
      });
      const cancelledOrder = {
        ...existingOrder,
        status: OrderStatus.CANCELLED,
      };

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);
      mockOrderService.cancelOrder.mockResolvedValue(cancelledOrder);

      const result = await controller.remove("order-123", req);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cancelledOrder);
      expect(mockOrderService.cancelOrder).toHaveBeenCalledWith("order-123", 1);
    });

    it("should throw BadRequestException if order is not in cancellable state", async () => {
      const user = createMockUser("practitioner", "doctor-123");
      const req = createMockRequest(user, { version: 1 });
      const existingOrder = createMockOrder({
        practitionerId: "doctor-123",
        status: OrderStatus.PAID,
      });

      mockOrderService.getOrderById.mockResolvedValue(existingOrder);

      await expect(controller.remove("order-123", req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
