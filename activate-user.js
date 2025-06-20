const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function activateUser() {
  try {
    const user = await prisma.user.update({
      where: { email: 'integration.test@tcm.nz' },
      data: { status: 'approved' }
    });
    console.log('用户激活成功:', user.email, user.status);
  } catch (error) {
    console.error('激活失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

activateUser(); 