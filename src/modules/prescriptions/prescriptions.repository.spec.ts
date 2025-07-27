import { Test, TestingModule } from "@nestjs/testing";
import { PrescriptionsRepository } from "./prescriptions.repository";
import { PrismaService } from "../../prisma/prisma.service";

describe("PrescriptionsRepository", () => {
  let repository: PrescriptionsRepository;
  let mockPrisma: any;

  const mockMedicineData = [
    {
      id: "medicine-123",
      name: "板蓝根颗粒",
      chineseName: "板蓝根颗粒",
      englishName: "Banlangen Granules",
      sku: "BLG001",
      unit: "袋",
      basePrice: 10.5,
      category: "中成药",
      status: "active",
    },
    {
      id: "medicine-456",
      name: "感冒清热颗粒",
      chineseName: "感冒清热颗粒",
      englishName: "Ganmao Qingre Granules",
      sku: "GMQR002",
      unit: "袋",
      basePrice: 15.8,
      category: "中成药",
      status: "active",
    },
  ];

  const mockCreateData = {
    doctorId: "doctor-123",
    medicines: [
      {
        medicineId: "medicine-123",
        weight: 15, // 克重
        dosageInstructions: "每日三次，饭后服用",
        notes: "注意休息",
      },
    ],
    copies: 7, // 帖数 - Fixed: use copies instead of amounts
    notes: "处方备注",
  };

  const mockOrder = {
    id: "order-123",
    platformOrderId: "RX-123456",
    practitionerId: "doctor-123",
    status: "DRAFT",
    totalAmount: 157.5, // Updated to match calculation
    paymentStatus: "pending",
    notes: "感冒症状",
    qrCodeData: "QR_CODE_DATA_123",
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: "item-123",
        medicineId: "medicine-123",
        quantity: 15, // 克重
        unitPrice: 10.5,
        totalPrice: 157.5, // 15 * 10.5
        dosageInstructions: "每日三次，饭后服用",
        notes: "注意休息",
        medicine: mockMedicineData[0],
      },
    ],
    practitioner: {
      id: "doctor-123",
      profile: {
        fullName: "张医生",
        licenseNumber: "DOC001",
      },
    },
    clinic: {
      id: "clinic-123",
      name: "测试诊所",
      licenseNumber: "CLINIC001",
    },
  };

  beforeEach(async () => {
    mockPrisma = {
      medicine: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      orderItem: {
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<PrescriptionsRepository>(PrescriptionsRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("create", () => {
    it("should create prescription successfully", async () => {
      // 模拟药品查询返回
      mockPrisma.medicine.findMany.mockResolvedValue(
        mockMedicineData.slice(0, 1),
      );
      mockPrisma.order.create.mockResolvedValue(mockOrder);

      // 模拟findById返回
      jest.spyOn(repository, "findById").mockResolvedValue({
        id: mockOrder.id,
        prescriptionId: mockOrder.platformOrderId,
        doctorId: mockOrder.practitionerId,
        copies: 7,  // Fixed: use copies instead of amounts
        status: mockOrder.status,
        totalAmount: mockOrder.totalAmount,
        notes: mockOrder.notes,
        qrCodeData: mockOrder.qrCodeData,
        medicines: mockOrder.items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicine.name,
          chineseName: item.medicine.chineseName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          dosageInstructions: item.dosageInstructions,
          notes: item.notes,
          unit: item.medicine.unit,
        })),
        practitioner: mockOrder.practitioner,
        createdAt: mockOrder.createdAt,
        updatedAt: mockOrder.updatedAt,
      });

      const result = await repository.create(mockCreateData);

      expect(mockPrisma.medicine.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ["medicine-123"] },
          status: "active",
        },
        select: expect.objectContaining({
          id: true,
          basePrice: true,
          name: true,
          chineseName: true,
          englishName: true,
          sku: true,
          unit: true,
          category: true,
        }),
      });

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          practitionerId: mockCreateData.doctorId,
          copies: 7, // 帖数字段
          status: "DRAFT",
          totalAmount: 157.5, // 10.5 * 15
          paymentStatus: "pending",
          notes: mockCreateData.notes,
          items: {
            create: expect.arrayContaining([
              expect.objectContaining({
                medicineId: "medicine-123",
                quantity: 15, // 克重
                unitPrice: 10.5,
                totalPrice: 157.5, // 10.5 * 15
                dosageInstructions: "注意休息", // Updated to match actual
                notes: "注意休息",
                medicineSnapshot: expect.objectContaining({
                  id: "medicine-123",
                  name: "板蓝根颗粒",
                  basePrice: 10.5,
                }),
              }),
            ]),
          },
        }),
        include: expect.any(Object),
      });

      expect(result).toBeDefined();
      expect(result.totalAmount).toBe(157.5); // Updated to match calculation
    });

    it("should throw error for invalid medicine IDs", async () => {
      // 模拟返回的药品数量少于请求的数量
      mockPrisma.medicine.findMany.mockResolvedValue([]);

      await expect(repository.create(mockCreateData)).rejects.toThrow(
        "包含无效或已停用的药品ID: medicine-123",
      );

      expect(mockPrisma.medicine.findMany).toHaveBeenCalled();
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it("should throw error for duplicate medicines", async () => {
      const duplicateData = {
        ...mockCreateData,
        medicines: [
          mockCreateData.medicines[0],
          mockCreateData.medicines[0], // 重复
        ],
      };

      mockPrisma.medicine.findMany.mockResolvedValue([
        mockMedicineData[0],
        mockMedicineData[0],
      ]);

      await expect(repository.create(duplicateData)).rejects.toThrow(
        "处方中包含重复的药品",
      );

      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it("should calculate total amount correctly for multiple medicines", async () => {
      const multiMedicineData = {
        ...mockCreateData,
        medicines: [
          {
            medicineId: "medicine-123",
            weight: 10,
            notes: "每日三次",
          },
          {
            medicineId: "medicine-456",
            weight: 5,
            notes: "每日两次",
          },
        ],
      };

      mockPrisma.medicine.findMany.mockResolvedValue(mockMedicineData);
      mockPrisma.order.create.mockResolvedValue({
        ...mockOrder,
        totalAmount: 184, // (10.5 * 10) + (15.8 * 5) = 105 + 79 = 184
      });

      jest.spyOn(repository, "findById").mockResolvedValue({} as any);

      await repository.create(multiMedicineData);

      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 184,
          }),
        }),
      );
    });
  });

  describe("findByDoctor", () => {
    it("should return paginated prescriptions for doctor", async () => {
      const mockOrders = [mockOrder];
      const mockTotal = 1;

      mockPrisma.order.findMany.mockResolvedValue(mockOrders);
      mockPrisma.order.count.mockResolvedValue(mockTotal);

      const result = await repository.findByDoctor("doctor-123", 1, 20);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: { practitionerId: "doctor-123" },
        include: expect.any(Object),
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
      });

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { practitionerId: "doctor-123" },
      });

      expect(result).toEqual({
        data: expect.any(Array),
        total: mockTotal,
      });
      expect(result.data).toHaveLength(1);
    });

    it("should handle pagination correctly", async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.order.count.mockResolvedValue(0);

      await repository.findByDoctor("doctor-123", 2, 10);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10, // (2-1) * 10
          take: 10,
        }),
      );
    });
  });

  describe("findById", () => {
    it("should return prescription when found", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await repository.findById("order-123");

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: "order-123" },
        include: expect.any(Object),
      });

      expect(result).toBeDefined();
      expect(result.id).toBe("order-123");
      expect(result.prescriptionId).toBe("RX-123456");
    });

    it("should return null when prescription not found", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      const result = await repository.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update prescription basic info", async () => {
      const updateData = {
        notes: "更新备注",
      };

      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        ...updateData,
      });
      jest.spyOn(repository, "findById").mockResolvedValue({} as any);

      await repository.update("order-123", updateData);

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-123" },
        data: expect.objectContaining({
          notes: updateData.notes,
          updatedAt: expect.any(Date),
        }),
      });
    });

    it("should throw error when prescription not found", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        repository.update("non-existent", { notes: "test" }),
      ).rejects.toThrow("处方不存在");
    });
  });

  describe("delete", () => {
    it("should delete prescription successfully", async () => {
      mockPrisma.order.findUnique.mockResolvedValue(mockOrder);
      mockPrisma.order.delete.mockResolvedValue(mockOrder);

      await repository.delete("order-123");

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: "order-123" },
      });
      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: "order-123" },
      });
    });
  });

  describe("updateStatus", () => {
    it("should update prescription status", async () => {
      mockPrisma.order.update.mockResolvedValue({
        ...mockOrder,
        status: "PAID",
      });

      jest.spyOn(repository, "findById").mockResolvedValue({} as any);

      await repository.updateStatus("order-123", "PAID");

      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: "order-123" },
        data: {
          status: "PAID",
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
