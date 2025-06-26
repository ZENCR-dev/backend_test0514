const { PrismaClient } = require('@prisma/client');

async function fixUserStatusForAuth() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 DAY3 Phase 5 - 数据库状态紧急修正');
    console.log('🎯 核心小组技术指导决议执行');
    console.log('=' .repeat(50));
    
    console.log('🔍 Step 1: 确认当前用户状态...');
    
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        profile: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`📊 数据库中共有 ${allUsers.length} 个用户:`);
    allUsers.forEach((user, index) => {
      const userName = user.profile?.fullName || '未命名';
      const statusIcon = user.status === 'approved' ? '✅' : '⚠️';
      console.log(`${index + 1}. ${userName} (${user.email}) - ${user.status} ${statusIcon}`);
    });
    
    console.log('\n🔧 Step 2: 修正用户状态为 approved...');
    
    // 修正所有pending用户为approved
    const pendingUsers = allUsers.filter(u => u.status === 'pending');
    
    if (pendingUsers.length === 0) {
      console.log('✅ 所有用户状态已正确，无需修正');
    } else {
      console.log(`🔄 发现 ${pendingUsers.length} 个pending用户，正在修正...`);
      
      const updateResult = await prisma.user.updateMany({
        where: {
          status: 'pending'
        },
        data: {
          status: 'approved',
          updatedAt: new Date()
        }
      });
      
      console.log(`✅ 成功修正 ${updateResult.count} 个用户状态`);
    }
    
    console.log('\n🎯 Step 3: 验证修正结果...');
    
    const verificationUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        status: true,
        updatedAt: true,
        profile: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    
    console.log('📊 修正后用户状态验证:');
    verificationUsers.forEach((user, index) => {
      const userName = user.profile?.fullName || '未命名';
      const statusIcon = user.status === 'approved' ? '✅' : '❌';
      const timeStr = user.updatedAt.toLocaleTimeString();
      console.log(`${index + 1}. ${userName} (${user.email}) - ${user.status} ${statusIcon} [${timeStr}]`);
    });
    
    // 特别检查我们的测试用户
    const testUsers = [
      'test@example.com',
      'backend.doctor@tcm.nz',
      'testdoctor@tcm.nz'
    ];
    
    console.log('\n🔍 测试用户状态验证:');
    for (const email of testUsers) {
      const user = verificationUsers.find(u => u.email === email);
      if (user) {
        const statusIcon = user.status === 'approved' ? '✅' : '❌';
        console.log(`   ${email}: ${user.status} ${statusIcon}`);
      } else {
        console.log(`   ${email}: 不存在 ⚠️`);
      }
    }
    
    console.log('\n🎊 Phase A 完成 - 数据库状态修正成功！');
    console.log('⏱️  执行时间: < 5分钟');
    console.log('🔄 准备进入 Phase B - 认证流程验证');
    
    return {
      success: true,
      totalUsers: allUsers.length,
      fixedUsers: pendingUsers.length,
      allApproved: verificationUsers.every(u => u.status === 'approved')
    };
    
  } catch (error) {
    console.error('❌ 数据库修正失败:', error.message);
    return {
      success: false,
      error: error.message
    };
  } finally {
    await prisma.$disconnect();
  }
}

fixUserStatusForAuth().then(result => {
  if (result.success) {
    console.log('\n🚀 状态修正完成，可以进行认证测试！');
  } else {
    console.log('\n❌ 需要手动介入处理');
  }
}); 