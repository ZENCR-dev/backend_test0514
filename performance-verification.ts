import { Test, TestingModule } from '@nestjs/testing';
import { PrescriptionsService } from './src/modules/prescriptions/prescriptions.service';
import { PrescriptionsNewRepository } from './src/modules/prescriptions/prescriptions-new.repository';
import { QRCodeService } from './src/modules/prescriptions/services/qr-code.service';

// Simple performance verification test
async function runPerformanceTest() {
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

  // Mock data
  const mockPrescription = {
    id: "prescription-123",
    prescriptionId: "RX-2023-001",
    doctorId: "doctor-123",
    medicines: [{ medicineId: "med-123", weight: 15, notes: "每日三次" }],
    copies: 7,
    status: "DRAFT",
    totalAmount: 150.0,
    notes: "测试处方",
    qrCodeData: null,
    practitioner: { id: "doctor-123", name: "Dr. Test" },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Setup mocks
  mockRepository.create.mockResolvedValue(mockPrescription);
  mockRepository.findById.mockResolvedValue(mockPrescription);
  mockRepository.findByDoctor.mockResolvedValue({
    data: [mockPrescription],
    total: 1,
  });

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

  const service = module.get<PrescriptionsService>(PrescriptionsService);

  console.log('🚀 Starting Performance Verification Tests...');

  // Test 1: Single Create Operation
  console.log('\\n📝 Test 1: Single Create Operation');
  const startTime1 = Date.now();
  try {
    await service.create({
      medicines: [{ medicineId: "med-123", weight: 15, notes: "测试药品" }],
      copies: 5,
      notes: "性能测试处方",
    }, "doctor-123");
    const responseTime1 = Date.now() - startTime1;
    console.log(`✅ Create operation: ${responseTime1}ms (Target: <200ms)`);
    console.log(responseTime1 < 200 ? '✅ PASS' : '❌ FAIL - Exceeds 200ms limit');
  } catch (error) {
    console.log(`❌ Create operation failed: ${error.message}`);
  }

  // Test 2: Single FindOne Operation
  console.log('\\n🔍 Test 2: Single FindOne Operation');
  const startTime2 = Date.now();
  try {
    await service.findOne("prescription-123", "doctor-123");
    const responseTime2 = Date.now() - startTime2;
    console.log(`✅ FindOne operation: ${responseTime2}ms (Target: <200ms)`);
    console.log(responseTime2 < 200 ? '✅ PASS' : '❌ FAIL - Exceeds 200ms limit');
  } catch (error) {
    console.log(`❌ FindOne operation failed: ${error.message}`);
  }

  // Test 3: Concurrent Operations (10 requests)
  console.log('\\n⚡ Test 3: Concurrent Operations (10 requests)');
  const startTime3 = Date.now();
  try {
    const concurrentRequests = Array.from({ length: 10 }, (_, i) =>
      service.findOne(`prescription-${i}`, "doctor-123")
    );
    await Promise.all(concurrentRequests);
    const responseTime3 = Date.now() - startTime3;
    console.log(`✅ Concurrent operations (10): ${responseTime3}ms (Target: <200ms)`);
    console.log(responseTime3 < 200 ? '✅ PASS' : '❌ FAIL - Exceeds 200ms limit');
  } catch (error) {
    console.log(`❌ Concurrent operations failed: ${error.message}`);
  }

  // Test 4: Mixed Operations Performance
  console.log('\\n🔄 Test 4: Mixed Operations Performance');
  const startTime4 = Date.now();
  try {
    await Promise.all([
      service.create({
        medicines: [{ medicineId: "med-mixed", weight: 10, notes: "混合测试" }],
        copies: 3,
        notes: "混合操作测试",
      }, "doctor-123"),
      service.findOne("prescription-123", "doctor-123"),
      service.findAll("doctor-123", { page: 1, limit: 20 }),
    ]);
    const responseTime4 = Date.now() - startTime4;
    console.log(`✅ Mixed operations: ${responseTime4}ms (Target: <200ms)`);
    console.log(responseTime4 < 200 ? '✅ PASS' : '❌ FAIL - Exceeds 200ms limit');
  } catch (error) {
    console.log(`❌ Mixed operations failed: ${error.message}`);
  }

  console.log('\\n📊 Performance Verification Complete!');
  console.log('\\n🎯 Summary:');
  console.log('- All operations use mocked dependencies for consistent timing');
  console.log('- Tests verify service layer performance under controlled conditions'); 
  console.log('- Real-world performance may vary based on database and network latency');

  await module.close();
}

// Run the test
runPerformanceTest().catch(console.error);