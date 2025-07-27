import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Decimal } from "@prisma/client/runtime/library";
import { PrescriptionPaymentService } from "./prescription-payment.service";
import { PrescriptionsService } from "../prescriptions.service";
import { PaymentService } from "../../../payment/services/payment.service";
import { PractitionerAccountService } from "../../../practitioner-account/services/practitioner-account.service";
import { PaymentStatus } from "../../../payment/interfaces/payment-engine.interface";

describe("PrescriptionPaymentService", () => {
  let service: PrescriptionPaymentService;
  let prescriptionsService: jest.Mocked<PrescriptionsService>;
  let paymentService: jest.Mocked<PaymentService>;
  let practitionerAccountService: jest.Mocked<PractitionerAccountService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockPrescription = {
    id: "prescription_123",
    prescriptionId: "prescription_123",
    doctorId: "practitioner_456",
    medicines: [
      {
        medicineId: "medicine_1",
        weight: 15, // 克重
        dosageInstructions: "每日三次",
        notes: "",
      },
    ],
    copies: 7, // 帖数
    totalAmount: 100,
    status: "DRAFT",
    paymentStatus: "PENDING",  // Added missing field
    paymentMethod: null,       // Added missing field
    notes: "Test prescription",
    qrCodeData: "test_qr_code_data",
    expiresAt: new Date(),     // Added missing field
    version: 1,                // Added missing field
    createdAt: new Date(),
    updatedAt: new Date(),
    practitioner: {
      id: "practitioner_456",
      email: "doctor@example.com",
      profile: {
        fullName: "Dr. Test",
        licenseNumber: "LIC123",
      },
    },
  };

  beforeEach(async () => {
    const mockPrescriptionsService = {
      findOne: jest.fn(),
      updateStatus: jest.fn(),
    };

    const mockPaymentService = {
      createPaymentIntent: jest.fn(),
      deductFromPractitionerAccount: jest.fn(),
    };

    const mockPractitionerAccountService = {
      getBalance: jest.fn(),
    };

    const mockEventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionPaymentService,
        {
          provide: PrescriptionsService,
          useValue: mockPrescriptionsService,
        },
        {
          provide: PaymentService,
          useValue: mockPaymentService,
        },
        {
          provide: PractitionerAccountService,
          useValue: mockPractitionerAccountService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<PrescriptionPaymentService>(
      PrescriptionPaymentService,
    );
    prescriptionsService = module.get(PrescriptionsService);
    paymentService = module.get(PaymentService);
    practitionerAccountService = module.get(PractitionerAccountService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe("payWithBalance", () => {
    it("should successfully pay with balance when sufficient funds available", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: mockPrescription,
      });

      practitionerAccountService.getBalance.mockResolvedValue({
        balance: new Decimal(200),
        availableCredit: new Decimal(100),
        creditLimit: new Decimal(500),
        usedCredit: new Decimal(0),
      });

      paymentService.deductFromPractitionerAccount.mockResolvedValue({
        transactionId: "txn_123",
        practitionerId,
        amount: 100,
        remainingBalance: 100,
        orderId: prescriptionId,
        status: "success",
      });

      prescriptionsService.updateStatus.mockResolvedValue({
        success: true,
        data: { ...mockPrescription, status: "PAID" },
        message: "处方状态更新成功",
      });

      // Act
      const result = await service.payWithBalance(
        prescriptionId,
        practitionerId,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("PAID");
      expect(paymentService.deductFromPractitionerAccount).toHaveBeenCalledWith(
        {
          practitionerId,
          amount: new Decimal(100),
          orderId: prescriptionId,
          description: `处方支付: ${prescriptionId}`,
          idempotencyKey: expect.any(String),
        },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "prescription.payment.completed",
        {
          prescriptionId,
          practitionerId,
          status: "paid",
          paymentMethod: "balance",
          amount: 100,
          timestamp: expect.any(String),
        },
      );
    });

    it("should fail when prescription not found", async () => {
      // Arrange
      const prescriptionId = "nonexistent_prescription";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockRejectedValue(
        new NotFoundException("处方不存在"),
      );

      // Act & Assert
      await expect(
        service.payWithBalance(prescriptionId, practitionerId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should fail when prescription not owned by practitioner", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "different_practitioner";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: mockPrescription,
      });

      // Act & Assert
      await expect(
        service.payWithBalance(prescriptionId, practitionerId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail when prescription already paid", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: { ...mockPrescription, status: "PAID" },
      });

      // Act & Assert
      await expect(
        service.payWithBalance(prescriptionId, practitionerId),
      ).rejects.toThrow(BadRequestException);
    });

    it("should fail when insufficient balance", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: mockPrescription,
      });

      practitionerAccountService.getBalance.mockResolvedValue({
        balance: new Decimal(50),
        availableCredit: new Decimal(0),
        creditLimit: new Decimal(100),
        usedCredit: new Decimal(100),
      });

      paymentService.deductFromPractitionerAccount.mockResolvedValue({
        transactionId: "txn_123",
        practitionerId,
        amount: 100,
        remainingBalance: 50,
        orderId: prescriptionId,
        status: "insufficient_funds",
      });

      // Act & Assert
      await expect(
        service.payWithBalance(prescriptionId, practitionerId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("payWithStripe", () => {
    it("should successfully create Stripe payment intent", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: mockPrescription,
      });

      paymentService.createPaymentIntent.mockResolvedValue({
        id: "pi_123",
        clientSecret: "pi_123_secret",
        amount: 10000, // 100 NZD in cents
        currency: "nzd",
        status: PaymentStatus.REQUIRES_PAYMENT_METHOD,
        orderId: prescriptionId,
        createdAt: new Date(),
      });

      // Act
      const result = await service.payWithStripe(
        prescriptionId,
        practitionerId,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.clientSecret).toBe("pi_123_secret");
      expect(paymentService.createPaymentIntent).toHaveBeenCalledWith({
        amount: new Decimal(100),
        practitionerId,
        orderId: prescriptionId,
        currency: "NZD",
        metadata: {
          type: "prescription_payment",
          prescriptionId,
        },
      });
    });

    it("should fail when prescription not found", async () => {
      // Arrange
      const prescriptionId = "nonexistent_prescription";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockRejectedValue(
        new NotFoundException("处方不存在"),
      );

      // Act & Assert
      await expect(
        service.payWithStripe(prescriptionId, practitionerId),
      ).rejects.toThrow(NotFoundException);
    });

    it("should fail when prescription already paid", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: { ...mockPrescription, status: "PAID" },
      });

      // Act & Assert
      await expect(
        service.payWithStripe(prescriptionId, practitionerId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("updatePrescriptionPaymentStatus", () => {
    it("should successfully update prescription status to paid", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const status = "PAID";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: mockPrescription,
      });

      prescriptionsService.updateStatus.mockResolvedValue({
        success: true,
        data: { ...mockPrescription, status: "PAID" },
        message: "处方状态更新成功",
      });

      // Act
      const result = await service.updatePrescriptionPaymentStatus(
        prescriptionId,
        status,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("PAID");
      expect(prescriptionsService.updateStatus).toHaveBeenCalledWith(
        prescriptionId,
        status,
        mockPrescription.doctorId,
      );
    });

    it("should fail when prescription not found", async () => {
      // Arrange
      const prescriptionId = "nonexistent_prescription";
      const status = "PAID";

      prescriptionsService.findOne.mockRejectedValue(
        new NotFoundException("处方不存在"),
      );

      // Act & Assert
      await expect(
        service.updatePrescriptionPaymentStatus(prescriptionId, status),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getPaymentStatus", () => {
    it("should return prescription payment status", async () => {
      // Arrange
      const prescriptionId = "prescription_123";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockResolvedValue({
        success: true,
        data: { ...mockPrescription, status: "PAID" },
      });

      // Act
      const result = await service.getPaymentStatus(
        prescriptionId,
        practitionerId,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.data.status).toBe("PAID");
      expect(result.data.prescriptionId).toBe(prescriptionId);
      expect(result.data.totalAmount).toBe(100);
    });

    it("should fail when prescription not found", async () => {
      // Arrange
      const prescriptionId = "nonexistent_prescription";
      const practitionerId = "practitioner_456";

      prescriptionsService.findOne.mockRejectedValue(
        new NotFoundException("处方不存在"),
      );

      // Act & Assert
      await expect(
        service.getPaymentStatus(prescriptionId, practitionerId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
