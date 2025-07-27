/**
 * API 契约测试全局设置
 */

// 配置测试超时
jest.setTimeout(20000);

// 全局测试前设置
beforeAll(async () => {
  console.log('🚀 开始执行 API 契约测试');
  console.log(`📡 API 基础地址: ${process.env.API_BASE_URL || 'https://staging-api.tcm.onrender.com'}`);
  console.log(`⏰ 测试开始时间: ${new Date().toISOString()}`);
});

// 全局测试后清理
afterAll(async () => {
  console.log('✅ API 契约测试执行完成');
  console.log(`⏰ 测试结束时间: ${new Date().toISOString()}`);
});

// 错误处理增强
process.on('unhandledRejection', (reason, promise) => {
  console.error('契约测试中发现未处理的 Promise 拒绝:', reason);
}); 