const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateUserStatus() {
  try {
    console.log('🔄 更新用户状态为approved...');
    
    // 更新所有pending状态的用户为approved
    const result = await prisma.user.updateMany({
      where: {
        status: 'pending'
      },
      data: {
        status: 'approved'
      }
    });
    
    console.log(`✅ 成功更新 ${result.count} 个用户状态为approved`);
    
    // 显示所有用户信息
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        profile: {
          select: {
            fullName: true
          }
        }
      }
    });
    
    console.log('\n📋 当前用户列表:');
    users.forEach(user => {
      console.log(`- ${user.email} (${user.role}) - ${user.status} - ${user.profile?.fullName}`);
    });
    
  } catch (error) {
    console.error('❌ 更新用户状态失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserStatus(); 