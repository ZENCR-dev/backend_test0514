import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PrescriptionPurchaseOrderService } from '../../src/pharmacy/services/prescription-purchase-order.service';
import { InvoiceWithdrawalService } from '../../src/pharmacy/services/invoice-withdrawal.service';
import { InvoicePdfService } from '../../src/pharmacy/services/invoice-pdf.service';
import { InvoiceEmailService } from '../../src/pharmacy/services/invoice-email.service';
import { ConfigService } from '@nestjs/config';

describe('PO/Invoice End-to-End Flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let prescriptionPOService: PrescriptionPurchaseOrderService;
  let invoiceService: InvoiceWithdrawalService;
  let pdfService: InvoicePdfService;
  let emailService: InvoiceEmailService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        PrescriptionPurchaseOrderService,
        InvoiceWithdrawalService,
        InvoicePdfService,
        InvoiceEmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                EMAIL_SERVICE: 'gmail',
                EMAIL_USER: 'test@example.com',
                EMAIL_PASSWORD: 'test_password',
                ADMIN_EMAIL: 'admin@example.com',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    prescriptionPOService = moduleFixture.get<PrescriptionPurchaseOrderService>(PrescriptionPurchaseOrderService);
    invoiceService = moduleFixture.get<InvoiceWithdrawalService>(InvoiceWithdrawalService);
    pdfService = moduleFixture.get<InvoicePdfService>(InvoicePdfService);
    emailService = moduleFixture.get<InvoiceEmailService>(InvoiceEmailService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete PO to Invoice Flow', () => {
    let testPharmacyId: string;
    let testPrescriptionId: string;
    let testPurchaseOrderId: string;
    let testInvoiceNumber: string;

    beforeEach(async () => {
      // Setup test data
      await setupTestData();
    });

    afterEach(async () => {
      // Cleanup test data
      await cleanupTestData();
    });

    it('should create a complete PO to Invoice flow', async () => {
      // Step 1: Create prescription-based purchase order
      const prescriptionItems = [
        {
          medicineId: 'med_001',
          medicineName: 'Test Medicine A',
          quantity: 100,
          weight: 50.5,
          unitPrice: 12.50,
          totalPrice: 1437.50, // includes GST
          gstAmount: 0,
          netAmount: 0,
          dosageInstructions: 'Take 2 tablets daily',
          additionalNotes: 'With food',
        },
        {
          medicineId: 'med_002',
          medicineName: 'Test Medicine B',
          quantity: 75,
          weight: 30.0,
          unitPrice: 8.75,
          totalPrice: 756.25, // includes GST
          gstAmount: 0,
          netAmount: 0,
          dosageInstructions: 'Take 1 tablet before bed',
        },
      ];

      const poResult = await prescriptionPOService.generateFromPrescription({
        pharmacyId: testPharmacyId,
        prescriptionId: testPrescriptionId,
        fulfillmentProofId: 'proof_001',
        prescriptionItems,
        metadata: {
          testRun: true,
          createdBy: 'e2e_test',
        },
      });

      expect(poResult.success).toBe(true);
      expect(poResult.data).toBeDefined();
      expect(poResult.data.prescriptionId).toBe(testPrescriptionId);
      expect(poResult.data.gstAmount).toBeGreaterThan(0);
      expect(poResult.data.netAmount).toBeGreaterThan(0);
      
      testPurchaseOrderId = poResult.data.id;

      // Step 2: Approve the purchase order (simulate admin approval)
      await prisma.purchaseOrder.update({
        where: { id: testPurchaseOrderId },
        data: { 
          status: 'approved',
          reviewedBy: 'admin_test',
          reviewedAt: new Date(),
        },
      });

      // Step 3: Create invoice from approved purchase order
      const invoiceResult = await invoiceService.createInvoiceFromPurchaseOrders({
        pharmacyId: testPharmacyId,
        purchaseOrderIds: [testPurchaseOrderId],
        bankDetails: {
          bankName: 'Test Bank',
          accountNumber: '123456789',
          accountName: 'Test Pharmacy Ltd',
          swiftCode: 'TESTNZ2A',
        },
        notes: 'Test invoice for e2e flow',
        paymentTerms: 'Net 30 days',
      });

      expect(invoiceResult.success).toBe(true);
      expect(invoiceResult.data).toBeDefined();
      expect(invoiceResult.data.invoiceData).toBeDefined();
      expect(invoiceResult.data.invoiceData.compliance.gstCompliant).toBe(true);
      
      testInvoiceNumber = invoiceResult.data.invoiceNumber;

      // Step 4: Generate PDF for the invoice
      const pdfResult = await pdfService.generateInvoicePdf(invoiceResult.data.invoiceData);

      expect(pdfResult.success).toBe(true);
      expect(pdfResult.pdfBuffer).toBeDefined();
      expect(pdfResult.size).toBeGreaterThan(0);
      expect(pdfResult.filename).toContain('invoice');
      expect(pdfResult.metadata.compliance).toBe('NZ_IRD_INVOICE_REQUIREMENTS');

      // Step 5: Verify GST calculations
      const invoiceData = invoiceResult.data.invoiceData;
      const totalNet = invoiceData.lineItems.reduce((sum, item) => sum + item.netAmount, 0);
      const totalGST = invoiceData.lineItems.reduce((sum, item) => sum + item.gstAmount, 0);
      const totalGross = totalNet + totalGST;

      expect(Math.abs(totalGross - invoiceData.summary.totalAmount)).toBeLessThan(0.01);
      expect(Math.abs(totalGST - invoiceData.summary.gstAmount)).toBeLessThan(0.01);
      expect(Math.abs(totalNet - invoiceData.summary.subtotal)).toBeLessThan(0.01);

      // Step 6: Test email service capabilities (without sending actual email)
      const emailServiceInfo = emailService.getEmailServiceInfo();
      expect(emailServiceInfo.supportedFeatures).toContain('PDF Attachments');
      expect(emailServiceInfo.supportedFeatures).toContain('HTML Templates');

      console.log('✅ Complete PO to Invoice flow test passed');
      console.log(`   - PO ID: ${testPurchaseOrderId}`);
      console.log(`   - Invoice Number: ${testInvoiceNumber}`);
      console.log(`   - PDF Size: ${pdfResult.size} bytes`);
      console.log(`   - Total Amount: $${invoiceData.summary.totalAmount.toFixed(2)} NZD`);
    }, 30000); // 30 second timeout for this complex test

    it('should validate GST calculations comply with NZ requirements', async () => {
      const testItems = [
        {
          medicineId: 'med_gst_test',
          medicineName: 'GST Test Medicine',
          quantity: 100,
          weight: 25.0,
          unitPrice: 10.00,
          totalPrice: 1150.00, // $1000 + 15% GST
          gstAmount: 0,
          netAmount: 0,
          dosageInstructions: 'Test dosage',
        },
      ];

      const poResult = await prescriptionPOService.generateFromPrescription({
        pharmacyId: testPharmacyId,
        prescriptionId: testPrescriptionId,
        fulfillmentProofId: 'proof_gst_test',
        prescriptionItems: testItems,
      });

      expect(poResult.success).toBe(true);
      
      // Verify GST calculation
      const gstSummary = prescriptionPOService.getGSTSummary(poResult.data.items);
      expect(gstSummary.gstRate).toBe(0.15);
      expect(gstSummary.gstRatePercentage).toBe('15.0%');
      expect(gstSummary.compliance).toBe('NZ_IRD_GST_ACT');
      
      // Net should be approximately $1000, GST should be $150
      expect(Math.abs(gstSummary.netAmount - 1000)).toBeLessThan(0.01);
      expect(Math.abs(gstSummary.gstAmount - 150)).toBeLessThan(0.01);
      expect(Math.abs(gstSummary.grossAmount - 1150)).toBeLessThan(0.01);

      console.log('✅ GST calculation validation passed');
      console.log(`   - Net: $${gstSummary.netAmount}`);
      console.log(`   - GST: $${gstSummary.gstAmount}`);
      console.log(`   - Gross: $${gstSummary.grossAmount}`);
    });

    it('should handle multiple PO consolidation into single invoice', async () => {
      // Create two separate purchase orders
      const po1Items = [{
        medicineId: 'med_multi_1',
        medicineName: 'Multi Test Medicine 1',
        quantity: 50,
        weight: 25.0,
        unitPrice: 15.00,
        totalPrice: 862.50,
        gstAmount: 0,
        netAmount: 0,
        dosageInstructions: 'Test dosage 1',
      }];

      const po2Items = [{
        medicineId: 'med_multi_2',
        medicineName: 'Multi Test Medicine 2',
        quantity: 30,
        weight: 15.0,
        unitPrice: 20.00,
        totalPrice: 690.00,
        gstAmount: 0,
        netAmount: 0,
        dosageInstructions: 'Test dosage 2',
      }];

      const po1Result = await prescriptionPOService.generateFromPrescription({
        pharmacyId: testPharmacyId,
        prescriptionId: testPrescriptionId,
        fulfillmentProofId: 'proof_multi_1',
        prescriptionItems: po1Items,
      });

      const po2Result = await prescriptionPOService.generateFromPrescription({
        pharmacyId: testPharmacyId,
        prescriptionId: testPrescriptionId,
        fulfillmentProofId: 'proof_multi_2',
        prescriptionItems: po2Items,
      });

      // Approve both POs
      await prisma.purchaseOrder.updateMany({
        where: { id: { in: [po1Result.data.id, po2Result.data.id] } },
        data: { status: 'approved', reviewedAt: new Date() },
      });

      // Create consolidated invoice
      const invoiceResult = await invoiceService.createInvoiceFromPurchaseOrders({
        pharmacyId: testPharmacyId,
        purchaseOrderIds: [po1Result.data.id, po2Result.data.id],
        bankDetails: {
          bankName: 'Test Bank',
          accountNumber: '987654321',
          accountName: 'Test Pharmacy Ltd',
        },
        notes: 'Consolidated invoice test',
      });

      expect(invoiceResult.success).toBe(true);
      expect(invoiceResult.data.invoiceData.lineItems).toHaveLength(2);
      
      const totalFromPOs = Number(po1Result.data.totalAmount) + Number(po2Result.data.totalAmount);
      expect(Math.abs(invoiceResult.data.totalAmount - totalFromPOs)).toBeLessThan(0.01);

      console.log('✅ Multi-PO consolidation test passed');
      console.log(`   - PO1 Amount: $${po1Result.data.totalAmount}`);
      console.log(`   - PO2 Amount: $${po2Result.data.totalAmount}`);
      console.log(`   - Invoice Total: $${invoiceResult.data.totalAmount}`);
    });

    async function setupTestData() {
      // Create test pharmacy
      const pharmacy = await prisma.pharmacy.create({
        data: {
          name: 'Test Pharmacy E2E',
          address: {
            street: '123 Test Street',
            city: 'Auckland',
            postalCode: '1010',
            country: 'New Zealand',
          },
          contact: {
            phone: '+64 9 123 4567',
            email: 'test@pharmacy.co.nz',
          },
          operatorId: 'user_test_operator',
          metadata: {
            gstNumber: 'GST123456789',
            nzbn: '9429000000000',
          },
        },
      });
      testPharmacyId = pharmacy.id;

      // Create test user for prescription
      const user = await prisma.user.create({
        data: {
          email: 'test.practitioner@example.com',
          role: 'practitioner',
          status: 'approved',
        },
      });

      // Create test prescription
      const prescription = await prisma.prescription.create({
        data: {
          prescriptionId: `PRX-E2E-${Date.now()}`,
          doctorId: user.id,
          status: 'PAID',
          totalAmount: 2000.00,
          amounts: 2,
        },
      });
      testPrescriptionId = prescription.id;

      // Create test medicines
      await prisma.medicine.createMany({
        data: [
          {
            name: 'Test Medicine A',
            sku: 'MED-001-E2E',
            unit: 'tablets',
            basePrice: 12.50,
            category: 'test',
          },
          {
            name: 'Test Medicine B',
            sku: 'MED-002-E2E',
            unit: 'tablets',
            basePrice: 8.75,
            category: 'test',
          },
        ],
        skipDuplicates: true,
      });

      // Create fulfillment proof
      await prisma.fulfillmentProof.create({
        data: {
          id: 'proof_001',
          orderId: 'order_test_001',
          pharmacyId: testPharmacyId,
          proofFiles: ['test_proof.jpg'],
          reviewStatus: 'approved',
        },
      });
    }

    async function cleanupTestData() {
      if (testInvoiceNumber) {
        await prisma.withdrawalRequest.deleteMany({
          where: { invoiceNumber: testInvoiceNumber },
        });
      }

      if (testPurchaseOrderId) {
        await prisma.purchaseOrder.deleteMany({
          where: { id: testPurchaseOrderId },
        });
      }

      await prisma.purchaseOrder.deleteMany({
        where: { pharmacyId: testPharmacyId },
      });

      await prisma.fulfillmentProof.deleteMany({
        where: { pharmacyId: testPharmacyId },
      });

      if (testPrescriptionId) {
        await prisma.prescription.deleteMany({
          where: { id: testPrescriptionId },
        });
      }

      if (testPharmacyId) {
        await prisma.pharmacy.deleteMany({
          where: { id: testPharmacyId },
        });
      }

      await prisma.medicine.deleteMany({
        where: { sku: { startsWith: 'MED-' } },
      });

      await prisma.user.deleteMany({
        where: { email: { contains: 'test.practitioner' } },
      });
    }
  });

  describe('Service Integration Tests', () => {
    it('should validate all services are properly configured', () => {
      expect(prescriptionPOService).toBeDefined();
      expect(invoiceService).toBeDefined();
      expect(pdfService).toBeDefined();
      expect(emailService).toBeDefined();
    });

    it('should validate PDF service capabilities', () => {
      const capabilities = pdfService.getCapabilities();
      expect(capabilities.compliance).toBe('NZ_IRD_GST_ACT');
      expect(capabilities.features).toContain('New Zealand Tax Invoice Compliance');
      expect(capabilities.features).toContain('GST Calculations');
    });

    it('should validate email service configuration', () => {
      const emailInfo = emailService.getEmailServiceInfo();
      expect(emailInfo.supportedFeatures).toContain('PDF Attachments');
      expect(emailInfo.supportedFeatures).toContain('Multiple Recipients');
      expect(emailInfo.supportedFeatures).toContain('Status Updates');
    });
  });
});