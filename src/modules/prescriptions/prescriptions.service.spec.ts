import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { PrescriptionsService } from "./prescriptions.service";
import { PrescriptionsRepository } from "./prescriptions.repository";
import { QRCodeService } from "./services/qr-code.service";
import { CreatePrescriptionDto } from "./dto/create-prescription.dto";

describe("PrescriptionsService", () => {
  let service: PrescriptionsService;
  let repository: PrescriptionsRepository;
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

  // 标准的mock处方对象
  const createMockPrescription = (overrides = {}) => ({
    id: "prescription-123",
    prescriptionId: "RX-2023-001",
    doctorId: "doctor-123",
    clinicId: "clinic-123",
    patientInfo: {
      name: "张三",
      age: 35,
      gender: "男",
      phone: "13800138000",
    },
    medicines: [
      {
        medicineId: "med-123",
        quantity: 10,
        dosageInstructions: "每日三次，饭后服用",
        notes: "",
      },
    ],
    status: "DRAFT",
    totalAmount: 150.0,
    notes: "注意休息",
    qrCodeData: null,
    practitioner: {
      id: "doctor-123",
      name: "李医生",
    },
    clinic: {
      id: "clinic-123",
      name: "中医诊所",
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
          provide: PrescriptionsRepository,
          useValue: mockRepository,
        },
        {
          provide: QRCodeService,
          useValue: mockQRCodeService,
        },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
    repository = module.get<PrescriptionsRepository>(PrescriptionsRepository);
    qrCodeService = module.get<QRCodeService>(QRCodeService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("create", () => {
    const mockPrescriptionData: CreatePrescriptionDto = {
      patientInfo: {
        name: "张三",
        age: 35,
        gender: "男",
        phone: "13800138000",
      },
      medicines: [
        {
          medicineId: "med-123",
          quantity: 10,
          dosageInstructions: "每日三次，饭后服用",
          notes: "",
        },
      ],
      notes: "注意休息",
    };

    it("should create a prescription successfully", async () => {
      const mockPrescription = createMockPrescription();
      mockRepository.create.mockResolvedValue(mockPrescription);

      const result = await service.create(mockPrescriptionData, "doctor-123");

      expect(mockRepository.create).toHaveBeenCalledWith({
        doctorId: "doctor-123",
        patientInfo: mockPrescriptionData.patientInfo,
        medicines: mockPrescriptionData.medicines,
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
        patientInfo: { name: "李四" },
        notes: "更新的备注",
      });

      mockRepository.findById.mockResolvedValue(mockPrescription);
      mockRepository.update.mockResolvedValue(updatedPrescription);

      const updateData = {
        patientInfo: { name: "李四" },
        notes: "更新的备注",
      };

      const result = await service.update(
        "prescription-123",
        updateData,
        "doctor-123",
      );

      expect(mockRepository.update).toHaveBeenCalledWith("prescription-123", {
        patientInfo: updateData.patientInfo,
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
      const qrCodeData = { qrCodeString: "generated-qr-code" };

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
        patientName: "张三",
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
});
