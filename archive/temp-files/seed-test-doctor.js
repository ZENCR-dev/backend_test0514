const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

async function seedTestDoctor() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🏥 创建测试医生用户...');
    
    // 检查是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email: 'testdoctor@tcm.nz' }
    });
    
    if (existingUser) {
      console.log('⚠️  用户已存在，删除现有用户...');
      await prisma.user.delete({
        where: { email: 'testdoctor@tcm.nz' }
      });
    }
    
    // 创建新的测试医生
    const hashedPassword = await bcrypt.hash('Doctor123!', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'testdoctor@tcm.nz',
        password: hashedPassword,
        role: 'practitioner',
        status: 'active',
        profile: {
          create: {
            fullName: 'Dr. 测试医师',
            phone: '+64-21-123-4567',
            licenseNumber: 'TCM-NZ-001',
            address: {
              street: '123 Queen Street',
              city: 'Auckland',
              country: 'New Zealand',
              postcode: '1010'
            },
            preferences: {
              language: 'zh-CN',
              notifications: true
            },
            metadata: {
              specialization: '中医内科',
              experience: '10年',
              created_by: 'integration_test'
            }
          }
        }
      },
      include: {
        profile: true
      }
    });
    
    console.log('✅ 测试医生用户创建成功！');
    console.log(`📋 用户信息:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   姓名: ${user.profile?.fullName}`);
    console.log(`   角色: ${user.role}`);
    console.log(`   状态: ${user.status}`);
    console.log('🔑 登录凭据:');
    console.log(`   邮箱: testdoctor@tcm.nz`);
    console.log(`   密码: Doctor123!`);
    
    return user;
    
  } catch (error) {
    console.error('❌ 创建用户失败:', error.message);
    
    // 如果是 bcrypt 问题，尝试简单密码
    try {
      console.log('🔄 尝试使用简单密码创建...');
      
      const user = await prisma.user.create({
        data: {
          email: 'testdoctor@tcm.nz',
          password: 'password123', // 简单密码，可能系统会自动加密
          role: 'practitioner',
          status: 'active',
          profile: {
            create: {
              fullName: 'Dr. 测试医师',
              phone: '+64-21-123-4567'
            }
          }
        },
        include: {
          profile: true
        }
      });
      
      console.log('✅ 使用简单密码创建成功！');
      console.log('🔑 登录凭据: testdoctor@tcm.nz / password123');
      return user;
      
    } catch (secondError) {
      console.error('❌ 第二次尝试也失败:', secondError.message);
      throw secondError;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// 测试创建的用户登录
async function testLogin() {
  console.log('\n🔐 测试新创建用户的登录...');
  
  const http = require('http');
  
  const loginData = {
    email: 'testdoctor@tcm.nz',
    password: 'Doctor123!'
  };

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(loginData);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 登录状态: ${res.statusCode}`);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const loginResult = JSON.parse(data);
            const token = loginResult.accessToken || loginResult.access_token;
            
            if (token) {
              console.log('🎉 登录测试成功！');
              console.log('🔑 Token已获取，可以进行API测试');
              resolve(token);
            } else {
              console.log('⚠️  登录成功但未获取Token');
              console.log('📄 响应:', data);
              resolve(null);
            }
          } catch (e) {
            console.log('⚠️  解析响应失败:', data);
            resolve(null);
          }
        } else {
          console.log('❌ 登录失败:', data);
          // 尝试简单密码
          console.log('🔄 尝试简单密码...');
          testSimplePasswordLogin().then(resolve).catch(reject);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ 登录请求失败:', error.message);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// 尝试简单密码登录
async function testSimplePasswordLogin() {
  const http = require('http');
  
  const loginData = {
    email: 'testdoctor@tcm.nz',
    password: 'password123'
  };

  return new Promise((resolve) => {
    const postData = JSON.stringify(loginData);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`📊 简单密码登录状态: ${res.statusCode}`);
        
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const loginResult = JSON.parse(data);
            const token = loginResult.accessToken || loginResult.access_token;
            
            if (token) {
              console.log('🎉 简单密码登录成功！');
              resolve(token);
            } else {
              console.log('❌ 简单密码无效');
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        } else {
          console.log('❌ 简单密码登录失败');
          resolve(null);
        }
      });
    });

    req.on('error', () => {
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

// 主执行函数
async function main() {
  console.log('🚀 Phase 5 集成验证 - 数据库用户创建');
  console.log('=' .repeat(50));
  
  try {
    // 1. 创建测试用户
    await seedTestDoctor();
    
    // 2. 测试登录
    const token = await testLogin();
    
    if (token) {
      console.log('\n✅ 用户创建和登录测试完成！');
      console.log('🎯 现在可以运行最终集成测试');
      
      // 保存Token
      require('fs').writeFileSync('integration-test-token.txt', token);
      console.log('💾 Token已保存到 integration-test-token.txt');
    } else {
      console.log('\n❌ 用户创建或登录验证失败');
    }
    
  } catch (error) {
    console.error('💥 执行失败:', error.message);
  }
}

main(); 