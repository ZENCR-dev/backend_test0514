const { PrismaClient } = require('@prisma/client');

async function checkUserStatus() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 检查现有用户状态和认证信息...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        password: true,
        createdAt: true,
        profile: {
          select: {
            fullName: true,
            phone: true
          }
        }
      }
    });
    
    console.log(`📊 找到 ${users.length} 个用户:`);
    console.log('=' .repeat(60));
    
    users.forEach((user, index) => {
      const userName = user.profile?.fullName || '未命名';
      console.log(`${index + 1}. ${userName} (${user.email})`);
      console.log(`   👤 角色: ${user.role}`);
      console.log(`   📋 状态: ${user.status} ${user.status === 'approved' ? '✅' : '❌'}`);
      console.log(`   🔐 密码: ${user.password ? user.password.substring(0, 20) + '...' : '未设置'}`);
      console.log(`   📅 创建: ${user.createdAt.toLocaleDateString()}`);
      console.log('-'.repeat(50));
    });
    
    // 检查问题并提供解决方案
    const approvedUsers = users.filter(u => u.status === 'approved');
    const unapprovedUsers = users.filter(u => u.status !== 'approved');
    
    console.log('\n📈 状态分析:');
    console.log(`✅ 已批准用户: ${approvedUsers.length}`);
    console.log(`❌ 未批准用户: ${unapprovedUsers.length}`);
    
    if (unapprovedUsers.length > 0) {
      console.log('\n⚠️  发现问题: 存在未批准用户');
      console.log('💡 建议: 更新用户状态为 approved');
    }
    
    if (users.some(u => u.password === 'password_not_set_for_existing_user')) {
      console.log('\n⚠️  发现问题: 存在默认密码用户');
      console.log('💡 建议: 重置用户密码');
    }
    
    console.log('\n🎯 建议的修复方案:');
    console.log('1. 将所有用户状态更新为 approved');
    console.log('2. 为测试用户设置已知密码');
    console.log('3. 创建专用的联调测试账户');
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserStatus(); 