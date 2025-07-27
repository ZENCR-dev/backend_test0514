import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../../app.module";
import { PrismaService } from "../../prisma/prisma.service";
import { UserRole, UserStatus } from "@prisma/client";
import { JwtService } from "@nestjs/jwt";
import { Decimal } from "@prisma/client/runtime/library";

describe("Prescription Payment Integration Tests", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let accessToken: string;
  let practitionerId: string;
  let prescriptionId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // 清理数据库 - 按外键依赖顺序删除
    await prisma.accountTransaction.deleteMany();
    await prisma.prescriptionMedicine.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.practitionerAccount.deleteMany();
    // 先删除pharmacy表（引用user的operatorId）
    await prisma.pharmacy.deleteMany();
    await prisma.user.deleteMany();

    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: "test-practitioner@example.com",
        password: "hashedPassword",
        role: UserRole.practitioner,
        status: UserStatus.approved,
        profile: {
          create: {
            fullName: "Test Practitioner",
            licenseNumber: "LIC123456",
          },
        },
      },
    });

    practitionerId = testUser.id;

    // 创建医师账户
    await prisma.practitionerAccount.create({
      data: {
        practitionerId,
        balance: new Decimal(200.0),
        creditLimit: new Decimal(100.0),
        usedCredit: new Decimal(0),
        availableCredit: new Decimal(100.0),
        status: "active",
        version: 1,
      },
    });

    // 创建测试处方（使用新的Prescription模型）
    const prescription = await prisma.prescription.create({
      data: {
        prescriptionId: "RX-2025-001",
        doctorId: practitionerId,
        copies: 7,  // Fixed: use copies instead of amounts
        totalAmount: new Decimal(50.0),
        status: "DRAFT",
        notes: "Test prescription for integration testing",
        version: 1,
      },
    });

    prescriptionId = prescription.id;

    // 生成JWT Token
    accessToken = jwtService.sign(
      { sub: practitionerId, email: testUser.email },
      { secret: process.env.JWT_SECRET || "test-secret" },
    );
  });

  describe("POST /api/v1/prescriptions/:id/pay-with-balance", () => {
    it("should successfully pay with balance when sufficient funds available", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("PAID");
      expect(response.body.data.paymentMethod).toBe("balance");
      expect(response.body.data.transactionId).toBeDefined();
      expect(response.body.data.remainingBalance).toBe(150.0); // 200 - 50

      // 验证处方状态已更新
      const updatedPrescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
      });
      expect(updatedPrescription?.status).toBe("PAID");

      // 验证账户余额已扣除
      const updatedAccount = await prisma.practitionerAccount.findUnique({
        where: { practitionerId },
      });
      expect(updatedAccount?.balance.toNumber()).toBe(150.0);

      // 验证创建了交易记录
      const transaction = await prisma.accountTransaction.findFirst({
        where: {
          referenceId: prescriptionId,
          transactionType: "DEBIT",
        },
      });
      expect(transaction).toBeDefined();
      expect(transaction?.amount.toNumber()).toBe(50.0);
    });

    it("should fail when insufficient balance", async () => {
      // 先扣除大部分余额
      await prisma.practitionerAccount.update({
        where: { practitionerId },
        data: { balance: new Decimal(30.0) },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("余额不足");

      // 验证处方状态未更新
      const prescription = await prisma.prescription.findUnique({
        where: { id: prescriptionId },
      });
      expect(prescription?.status).toBe("DRAFT");
    });

    it("should fail when prescription already paid", async () => {
      // 先更新处方状态为已支付
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: { status: "PAID" },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("处方状态不允许支付");
    });

    it("should fail when prescription not found", async () => {
      const nonExistentId = "non-existent-prescription-id";

      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${nonExistentId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it("should fail when prescription belongs to different practitioner", async () => {
      // 创建另一个用户和处方
      const anotherUser = await prisma.user.create({
        data: {
          email: "another-practitioner@example.com",
          password: "hashedPassword",
          role: UserRole.practitioner,
          status: UserStatus.approved,
          profile: {
            create: {
              fullName: "Another Practitioner",
              licenseNumber: "LIC789012",
            },
          },
        },
      });

      const anotherPrescription = await prisma.prescription.create({
        data: {
          prescriptionId: "RX-2025-002",
          doctorId: anotherUser.id,
          copies: 5,
          totalAmount: new Decimal(30.0),
          status: "DRAFT",
          notes: "Another prescription",
          version: 1,
        },
      });

      const response = await request(app.getHttpServer())
        .post(
          `/api/v1/prescriptions/${anotherPrescription.id}/pay-with-balance`,
        )
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("无权限操作此处方");
    });
  });

  describe("POST /api/v1/prescriptions/:id/pay-with-stripe", () => {
    it("should successfully create Stripe payment intent", async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-stripe`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prescriptionId).toBe(prescriptionId);
      expect(response.body.data.paymentIntentId).toBeDefined();
      expect(response.body.data.clientSecret).toBeDefined();
      expect(response.body.data.amount).toBe(50.0);
      expect(response.body.data.currency).toBe("NZD");
      expect(response.body.data.status).toBeDefined();
    });

    it("should fail when prescription already paid", async () => {
      // 先更新处方状态为已支付
      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: { status: "PAID" },
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-stripe`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("处方状态不允许支付");
    });

    it("should fail when prescription not found", async () => {
      const nonExistentId = "non-existent-prescription-id";

      const response = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${nonExistentId}/pay-with-stripe`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/prescriptions/:id/payment-status", () => {
    it("should return prescription payment status", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${prescriptionId}/payment-status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.prescriptionId).toBe(prescriptionId);
      expect(response.body.data.status).toBe("DRAFT");
      expect(response.body.data.totalAmount).toBe(50.0);
      expect(response.body.data.currency).toBe("NZD");
      expect(response.body.data.createdAt).toBeDefined();
      expect(response.body.data.updatedAt).toBeDefined();
    });

    it("should return updated status after payment", async () => {
      // 先支付处方
      await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${prescriptionId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      // 检查状态
      const response = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${prescriptionId}/payment-status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("PAID");
    });

    it("should fail when prescription not found", async () => {
      const nonExistentId = "non-existent-prescription-id";

      const response = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${nonExistentId}/payment-status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe("Payment flow integration", () => {
    it("should complete full payment flow with balance", async () => {
      // 1. 创建处方
      const createResponse = await request(app.getHttpServer())
        .post("/api/v1/prescriptions")
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
          medicines: [
            {
              medicineId: "med_integration",
              quantity: 15,
              dosageInstructions: "每日一次",
            },
          ],
          notes: "Integration test prescription",
        })
        .expect(201);

      const newPrescriptionId = createResponse.body.data.id;

      // 2. 检查支付状态
      const statusResponse = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${newPrescriptionId}/payment-status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(statusResponse.body.data.status).toBe("DRAFT");

      // 3. 开具处方
      const issueResponse = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${newPrescriptionId}/issue`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(issueResponse.body.success).toBe(true);
      expect(issueResponse.body.data.qrCodeString).toBeDefined();

      // 4. 余额支付
      const paymentResponse = await request(app.getHttpServer())
        .post(`/api/v1/prescriptions/${newPrescriptionId}/pay-with-balance`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data.status).toBe("PAID");

      // 5. 再次检查支付状态
      const finalStatusResponse = await request(app.getHttpServer())
        .get(`/api/v1/prescriptions/${newPrescriptionId}/payment-status`)
        .set("Authorization", `Bearer ${accessToken}`)
        .expect(200);

      expect(finalStatusResponse.body.data.status).toBe("PAID");

      // 6. 验证账户余额变化
      const finalAccount = await prisma.practitionerAccount.findUnique({
        where: { practitionerId },
      });
      expect(finalAccount?.balance.toNumber()).toBeLessThan(200.0); // 余额应该减少
    });
  });
});
