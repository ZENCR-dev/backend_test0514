import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrescriptionsService } from "./prescriptions.service";
import { PrescriptionsNewRepository } from "./prescriptions-new.repository";
import { QRCodeService } from "./services/qr-code.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";

describe("PrescriptionsService", () => {
  let service: PrescriptionsService;
  let repository: PrescriptionsNewRepository;
  let qrCodeService: QRCodeService;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByDoctor: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    delete: jest.fn(),
  };

  const mockQRCodeService = {
    updatePrescriptionQRCode: jest.fn(),
    parseQRCodeString: jest.fn(),
    verifyQRCodeData: jest.fn(),
  };

  // 标准的mock处方对象 - 隐私合规版本
  const createMockPrescription = (overrides = {}) => ({
    id: "prescription-123",
    prescriptionId: "RX-2023-001",
    doctorId: "doctor-123",
    medicines: [
      {
        medicineId: "med-123",
        weight: 15, // 克重
        notes: "每日三次，饭后服用",
      },
    ],
    copies: 7, // 帖数
    status: "DRAFT",
    totalAmount: 150.0,
    notes: "注意休息",
    qrCodeData: null,
    practitioner: {
      id: "doctor-123",
      name: "李医生",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        {
          provide: PrescriptionsNewRepository,
          useValue: mockRepository,
        },
        {
          provide: QRCodeService,
          useValue: mockQRCodeService,
        },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    repository = module.get<PrescriptionsNewRepository>(
      PrescriptionsNewRepository,
    );
    qrCodeService = module.get<QRCodeService>(QRCodeService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const mockPrescriptionData: CreatePrescriptionDto = {
      medicines: [
        {
          medicineId: "med-123",
          weight: 15, // 克重
          notes: "每日三次，饭后服用",
        },
      ],
      copies: 7, // 帖数
      notes: "注意休息",
    };

    it("should create a prescription successfully", async () => {
      const mockPrescription = createMockPrescription();
      mockRepository.create.mockResolvedValue(mockPrescription);

      const result = await service.create(mockPrescriptionData, "doctor-123");

      expect(mockRepository.create).toHaveBeenCalledWith({
        doctorId: "doctor-123",
        medicines: mockPrescriptionData.medicines,
        copies: mockPrescriptionData.copies,
        notes: mockPrescriptionData.notes,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPrescription);
    });

    it("should throw error when medicine validation fails", async () => {
      mockRepository.create.mockRejectedValue(new Error("无效的药品ID"));

      await expect(
        service.create(mockPrescriptionData, "doctor-123"),
      ).rejects.toThrow("创建处方失败: 无效的药品ID");
    });

    it("should handle duplicate medicine error", async () => {
      const duplicateData = {
        ...mockPrescriptionData,
        medicines: [
          mockPrescriptionData.medicines[0],
          mockPrescriptionData.medicines[0], // 重复药品
        ],
      };

      mockRepository.create.mockRejectedValue(
        new Error("药品列表中存在重复项"),
      );

      await expect(service.create(duplicateData, "doctor-123")).rejects.toThrow(
        "创建处方失败: 药品列表中存在重复项",
      );
    });
  });

  describe("findOne", () => {
    it("should return prescription for authorized doctor", async () => {
      const mockPrescription = createMockPrescription();
      mockRepository.findById.mockResolvedValue(mockPrescription);

      const result = await service.findOne("prescription-123", "doctor-123");

      expect(mockRepository.findById).toHaveBeenCalledWith("prescription-123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPrescription);
    });

    it("should throw NotFoundException for non-existent prescription", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.findOne("non-existent", "doctor-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException for unauthorized doctor", async () => {
      const otherDoctorPrescription = createMockPrescription({
        doctorId: "other-doctor",
      });
      mockRepository.findById.mockResolvedValue(otherDoctorPrescription);

      await expect(
        service.findOne("prescription-123", "doctor-123"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("findAll", () => {
    it("should return paginated prescriptions for doctor", async () => {
      const mockPrescriptions = [createMockPrescription()];
      const mockPaginatedResult = {
        data: mockPrescriptions,
        total: 1,
      };
      mockRepository.findByDoctor.mockResolvedValue(mockPaginatedResult);

      const result = await service.findAll("doctor-123", {
        page: 1,
        limit: 20,
      });

      expect(mockRepository.findByDoctor).toHaveBeenCalledWith(
        "doctor-123",
        1,
        20,
      );
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPrescriptions);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("should use default pagination when not provided", async () => {
      const mockPaginatedResult = {
        data: [createMockPrescription()],
        total: 1,
      };
      mockRepository.findByDoctor.mockResolvedValue(mockPaginatedResult);

      await service.findAll("doctor-123", {});

      expect(mockRepository.findByDoctor).toHaveBeenCalledWith(
        "doctor-123",
        1,
        20,
      );
    });
  });

  describe("update", () => {
    it("should update prescription successfully", async () => {
      const mockPrescription = createMockPrescription();
      const updatedPrescription = createMockPrescription({
        copies: 10,
        notes: "更新的备注",
      });

      mockRepository.findById.mockResolvedValue(mockPrescription);
      mockRepository.update.mockResolvedValue(updatedPrescription);

      const updateData = {
        copies: 10,
        notes: "更新的备注",
      };

      const result = await service.update(
        "prescription-123",
        updateData,
        "doctor-123",
      );

      expect(mockRepository.update).toHaveBeenCalledWith("prescription-123", {
        copies: updateData.copies,
        notes: updateData.notes,
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedPrescription);
    });

    it("should throw ForbiddenException when updating other doctor's prescription", async () => {
      const otherDoctorPrescription = createMockPrescription({
        doctorId: "other-doctor",
      });
      mockRepository.findById.mockResolvedValue(otherDoctorPrescription);

      await expect(
        service.update("prescription-123", { notes: "更新备注" }, "doctor-123"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("remove", () => {
    it("should delete prescription successfully", async () => {
      const mockPrescription = createMockPrescription();
      mockRepository.findById.mockResolvedValue(mockPrescription);
      mockRepository.delete.mockResolvedValue(undefined);

      const result = await service.remove("prescription-123", "doctor-123");

      expect(mockRepository.delete).toHaveBeenCalledWith("prescription-123");
      expect(result.success).toBe(true);
      expect(result.message).toBe("处方删除成功");
    });

    it("should throw NotFoundException for non-existent prescription", async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        service.remove("non-existent", "doctor-123"),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ForbiddenException when deleting other doctor's prescription", async () => {
      const otherDoctorPrescription = createMockPrescription({
        doctorId: "other-doctor",
      });
      mockRepository.findById.mockResolvedValue(otherDoctorPrescription);

      await expect(
        service.remove("prescription-123", "doctor-123"),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("issuePrescription", () => {
    it("should issue prescription successfully", async () => {
      const mockPrescription = createMockPrescription({ status: "DRAFT" });
      const updatedPrescription = createMockPrescription({ status: "PAID" });
      // const qrCodeData = { qrCodeString: "generated-qr-code" };

      mockRepository.findById.mockResolvedValue(mockPrescription);
      mockQRCodeService.updatePrescriptionQRCode.mockReturnValue({
        ...mockPrescription,
        qrCodeData: "qr-data",
        qrCodeString: "generated-qr-code",
      });
      mockRepository.updateStatus.mockResolvedValue(updatedPrescription);
      mockRepository.update.mockResolvedValue(updatedPrescription);

      const result = await service.issuePrescription(
        "prescription-123",
        "doctor-123",
      );

      expect(mockRepository.updateStatus).toHaveBeenCalledWith(
        "prescription-123",
        "PAID",
      );
      expect(result.success).toBe(true);
    });

    it("should throw error for non-draft prescription", async () => {
      const mockPrescription = createMockPrescription({ status: "PAID" });
      mockRepository.findById.mockResolvedValue(mockPrescription);

      await expect(
        service.issuePrescription("prescription-123", "doctor-123"),
      ).rejects.toThrow("开具处方失败: 只有草稿状态的处方才能开具");
    });
  });

  describe("verifyPrescription", () => {
    it("should verify prescription successfully", async () => {
      const mockPrescription = createMockPrescription();
      const mockQRData = {
        prescriptionId: "prescription-123",
        doctorId: "doctor-123",
        issuedAt: "2023-01-01T00:00:00Z",
        expiresAt: "2023-01-04T00:00:00Z",
        verifyCode: "ABC123",
      };

      mockQRCodeService.parseQRCodeString.mockReturnValue(mockQRData);
      mockQRCodeService.verifyQRCodeData.mockReturnValue({ isValid: true });
      mockRepository.findById.mockResolvedValue(mockPrescription);

      const result = await service.verifyPrescription("valid-qr-code");

      expect(mockQRCodeService.parseQRCodeString).toHaveBeenCalledWith(
        "valid-qr-code",
      );
      expect(result.success).toBe(true);
      expect(result.data.prescription).toEqual(mockPrescription);
      expect(result.data.verificationInfo.verifyCode).toBe("ABC123");
    });

    it("should handle invalid QR code", async () => {
      mockQRCodeService.parseQRCodeString.mockReturnValue(null);

      await expect(
        service.verifyPrescription("invalid-qr-code"),
      ).rejects.toThrow("处方验证失败: 无效的QR码格式");
    });
  });

  // 边界条件测试套件
  describe("边界条件测试", () => {
    describe("create - 边界条件", () => {
      it("should handle null medicines array", async () => {
        const nullMedicinesData = {
          medicines: null,
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(nullMedicinesData as any, "doctor-123"),
        ).rejects.toThrow("创建处方失败: 处方必须包含至少一种药品");
      });

      it("should handle undefined medicines array", async () => {
        const undefinedMedicinesData = {
          medicines: undefined,
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(undefinedMedicinesData as any, "doctor-123"),
        ).rejects.toThrow("创建处方失败: 处方必须包含至少一种药品");
      });

      it("should handle empty medicines array", async () => {
        const emptyMedicinesData = {
          medicines: [],
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(emptyMedicinesData as any, "doctor-123"),
        ).rejects.toThrow("创建处方失败: 处方必须包含至少一种药品");
      });

      it("should handle medicine with null weight", async () => {
        const nullWeightData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: null,
              notes: "用药说明",
            },
          ],
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(nullWeightData as any, "doctor-123"),
        ).rejects.toThrow(
          "创建处方失败: 药品信息不完整：缺少药品ID、克重或用药说明",
        );
      });

      it("should handle medicine with zero weight", async () => {
        const zeroWeightData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: 0,
              notes: "用药说明",
            },
          ],
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(zeroWeightData as any, "doctor-123"),
        ).rejects.toThrow("创建处方失败: 药品克重必须大于0");
      });

      it("should handle medicine with negative weight", async () => {
        const negativeWeightData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: -5,
              notes: "用药说明",
            },
          ],
          copies: 7,
          notes: "测试备注",
        };

        await expect(
          service.create(negativeWeightData as any, "doctor-123"),
        ).rejects.toThrow("创建处方失败: 药品克重必须大于0");
      });

      it("should handle null or undefined copies", async () => {
        const nullCopiesData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: 15,
              notes: "用药说明",
            },
          ],
          copies: null,
          notes: "测试备注",
        };

        // This should be handled by DTO validation, but test service behavior
        await expect(
          service.create(nullCopiesData as any, "doctor-123"),
        ).rejects.toThrow();
      });

      it("should handle empty string notes", async () => {
        const emptyNotesData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: 15,
              notes: "",
            },
          ],
          copies: 7,
          notes: "",
        };

        await expect(
          service.create(emptyNotesData as any, "doctor-123"),
        ).rejects.toThrow(
          "创建处方失败: 药品信息不完整：缺少药品ID、克重或用药说明",
        );
      });

      it("should handle null doctorId", async () => {
        const validData = {
          medicines: [
            {
              medicineId: "med-123",
              weight: 15,
              notes: "用药说明",
            },
          ],
          copies: 7,
          notes: "测试备注",
        };

        await expect(service.create(validData as any, null)).rejects.toThrow();
      });
    });

    describe("findOne - 边界条件", () => {
      it("should handle null prescription id", async () => {
        await expect(service.findOne(null, "doctor-123")).rejects.toThrow();
      });

      it("should handle undefined prescription id", async () => {
        await expect(
          service.findOne(undefined, "doctor-123"),
        ).rejects.toThrow();
      });

      it("should handle empty string prescription id", async () => {
        await expect(service.findOne("", "doctor-123")).rejects.toThrow(
          "获取处方详情失败: 处方ID和医师ID不能为空",
        );
      });

      it("should handle null doctor id", async () => {
        await expect(
          service.findOne("prescription-123", null),
        ).rejects.toThrow();
      });
    });

    describe("update - 边界条件", () => {
      it("should handle empty update data", async () => {
        const mockPrescription = createMockPrescription();
        mockRepository.findById.mockResolvedValue(mockPrescription);
        mockRepository.update.mockResolvedValue(mockPrescription);

        const result = await service.update(
          "prescription-123",
          {},
          "doctor-123",
        );

        expect(result.success).toBe(true);
        expect(mockRepository.update).toHaveBeenCalledWith(
          "prescription-123",
          {},
        );
      });

      it("should handle update with null values", async () => {
        const mockPrescription = createMockPrescription();
        mockRepository.findById.mockResolvedValue(mockPrescription);
        mockRepository.update.mockResolvedValue(mockPrescription);

        const updateData = {
          notes: null,
          copies: null,
        };

        const result = await service.update(
          "prescription-123",
          updateData as any,
          "doctor-123",
        );

        expect(result.success).toBe(true);
        // Should not include null values in update
        expect(mockRepository.update).toHaveBeenCalledWith(
          "prescription-123",
          {},
        );
      });
    });

    describe("verifyPrescription - 边界条件", () => {
      it("should handle null QR code string", async () => {
        await expect(service.verifyPrescription(null)).rejects.toThrow(
          "处方验证失败:",
        );
      });

      it("should handle undefined QR code string", async () => {
        await expect(service.verifyPrescription(undefined)).rejects.toThrow(
          "处方验证失败:",
        );
      });

      it("should handle empty string QR code", async () => {
        await expect(service.verifyPrescription("")).rejects.toThrow(
          "处方验证失败:",
        );
      });

      it("should handle very long QR code string", async () => {
        const longQrCode = "a".repeat(10000);
        mockQRCodeService.parseQRCodeString.mockReturnValue(null);

        await expect(service.verifyPrescription(longQrCode)).rejects.toThrow(
          "处方验证失败: 无效的QR码格式",
        );
      });
    });
  });

});
