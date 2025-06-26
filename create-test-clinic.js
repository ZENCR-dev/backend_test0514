const { PrismaClient } = require('@prisma/client');

async function createTestClinic() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏥 创建测试clinic...');
    
    const clinic = await prisma.clinic.create({
      data: {
        name: "测试中医诊所",
        ownerId: "cmc5wsbka0000ugzoi7hpadi8", // 使用现有的医生用户作为owner
        address: {
          street: "123 Queen Street",
          city: "Auckland",
          region: "Auckland",
          postalCode: "1010",
          country: "New Zealand"
        },
        contact: {
          phone: "+64-9-123-4567",
          email: "clinic@example.com",
          website: "https://clinic.example.com"
        },
        licenseNumber: "TCM-NZ-001",
        metadata: {
          specialties: ["Traditional Chinese Medicine", "Acupuncture", "Herbal Medicine"],
          languages: ["English", "Chinese"],
          serviceHours: {
            monday: { open: "09:00", close: "17:00" },
            tuesday: { open: "09:00", close: "17:00" },
            wednesday: { open: "09:00", close: "17:00" },
            thursday: { open: "09:00", close: "17:00" },
            friday: { open: "09:00", close: "17:00" },
            saturday: { open: "09:00", close: "14:00" },
            sunday: { closed: true }
          }
        }
      }
    });
    
    console.log('✅ 测试clinic创建成功!');
    console.log('Clinic ID:', clinic.id);
    console.log('Clinic Name:', clinic.name);
    
    return clinic;
    
  } catch (error) {
    console.log('❌ 创建失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestClinic(); 