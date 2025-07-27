const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function fixUserPasswords() {
  console.log('🔧 修复用户密码...\n');
  
  try {
    // 定义用户密码
    const userCredentials = [
      {
        email: 'admin@zencr.org',
        password: 'admin123'
      },
      {
        email: 'doctor@test.com',
        password: 'doctor123'
      },
      {
        email: 'pharmacy@test.com',
        password: 'pharmacy123'
      }
    ];

    for (const credential of userCredentials) {
      console.log(`更新用户密码: ${credential.email}`);
      
      // 生成密码哈希
      const hashedPassword = await bcrypt.hash(credential.password, 10);
      
      // 更新数据库
      await prisma.user.update({
        where: { email: credential.email },
        data: { password: hashedPassword }
      });
      
      console.log(`✅ ${credential.email} 密码更新成功`);
    }

    // 验证更新结果
    console.log('\n🔍 验证用户信息...');
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

    users.forEach(user => {
      console.log(`👤 ${user.email} (${user.role}) - 状态: ${user.status} - 姓名: ${user.profile?.fullName}`);
    });

    console.log('\n✅ 用户密码修复完成！');
    console.log('\n🔑 测试凭证:');
    userCredentials.forEach(cred => {
      console.log(`  ${cred.email} : ${cred.password}`);
    });
    
  } catch (error) {
    console.error('❌ 密码修复失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行修复
if (require.main === module) {
  fixUserPasswords()
    .then(() => {
      console.log('\n🎉 密码修复成功完成！');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 密码修复失败:', error);
      process.exit(1);
    });
}

module.exports = { fixUserPasswords };