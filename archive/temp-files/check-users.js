const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查数据库中的用户...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        profile: {
          select: {
            fullName: true
          }
        }
      }
    });
    
    console.log(`📊 找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      const userName = user.profile?.fullName || '未命名';
      console.log(`${index + 1}. ${userName} (${user.email}) - ${user.role}`);
    });
    
    if (users.length === 0) {
      console.log('⚠️  数据库中没有用户，需要创建测试用户');
    } else {
      console.log('\n💡 建议使用现有用户进行测试，或检查密码要求');
    }
    
  } catch (error) {
    console.error('❌ 查询用户失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 