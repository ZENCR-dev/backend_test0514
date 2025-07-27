#!/usr/bin/env node

/**
 * 🚨 紧急API调用真实性验证工具
 * 用于验证前端是否真正调用后端API而非使用Mock数据
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

console.log('🚨 API调用真实性验证工具启动...');
console.log('监听端口：3000 (代理模式)');
console.log('时间：', new Date().toLocaleString('zh-CN', { timeZone: 'Pacific/Auckland' }));

let apiCallCount = 0;
let lastCallTime = null;
const callLog = [];

// 创建HTTP代理服务器监听3001端口，转发到3000
const proxyServer = http.createServer((req, res) => {
  const now = new Date();
  const nzTime = now.toLocaleString('zh-CN', { timeZone: 'Pacific/Auckland' });
  
  // 记录API调用
  if (req.url.includes('/api/v1/medicines')) {
    apiCallCount++;
    lastCallTime = nzTime;
    
    const callRecord = {
      time: nzTime,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'] || 'Unknown',
      origin: req.headers['origin'] || 'Unknown',
      referer: req.headers['referer'] || 'Unknown'
    };
    
    callLog.push(callRecord);
    
    console.log(`\n🎯 API调用检测到！`);
    console.log(`📅 时间: ${nzTime}`);
    console.log(`🔗 接口: ${req.method} ${req.url}`);
    console.log(`🌐 来源: ${req.headers['origin'] || 'Unknown'}`);
    console.log(`📄 引用: ${req.headers['referer'] || 'Unknown'}`);
    console.log(`🔧 客户端: ${req.headers['user-agent'] || 'Unknown'}`);
    console.log(`📊 累计调用次数: ${apiCallCount}`);
    
    // 实时保存调用记录
    const logData = {
      timestamp: now.toISOString(),
      totalCalls: apiCallCount,
      latestCall: callRecord,
      allCalls: callLog
    };
    
    fs.writeFileSync('api-call-verification.json', JSON.stringify(logData, null, 2));
  }
  
  // 转发请求到真实的API服务器
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    console.error('代理请求错误:', err);
    res.writeHead(500);
    res.end('Proxy Error');
  });
  
  req.pipe(proxyReq);
});

// 定时报告
setInterval(() => {
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Pacific/Auckland' });
  console.log(`\n📊 状态报告 [${now}]:`);
  console.log(`✅ API调用总数: ${apiCallCount}`);
  console.log(`⏰ 最后调用时间: ${lastCallTime || '无调用'}`);
  
  if (apiCallCount === 0) {
    console.log('⚠️  警告：未检测到任何前端API调用！');
    console.log('🔍 可能原因：前端使用Mock数据或未连接后端');
  }
}, 30000); // 每30秒报告一次

// 生成最终报告函数
function generateFinalReport() {
  const reportTime = new Date().toLocaleString('zh-CN', { timeZone: 'Pacific/Auckland' });
  const report = {
    verificationTime: reportTime,
    totalApiCalls: apiCallCount,
    lastCallTime: lastCallTime,
    conclusion: apiCallCount > 0 ? '✅ 检测到真实API调用' : '❌ 未检测到真实API调用 - 可能使用Mock数据',
    risk: apiCallCount === 0 ? 'HIGH - 联调质量风险' : 'LOW - 真实联调确认',
    allCalls: callLog,
    recommendations: apiCallCount === 0 ? [
      '立即确认前端是否连接正确的API地址',
      '检查前端是否误用Mock数据',
      '验证网络连接和端口配置',
      '重新执行真实API联调测试'
    ] : [
      '继续执行联调测试',
      '监控API调用质量',
      '记录性能指标'
    ]
  };
  
  fs.writeFileSync('api-verification-final-report.json', JSON.stringify(report, null, 2));
  
  console.log('\n🏁 最终验证报告:');
  console.log(`📊 API调用总数: ${apiCallCount}`);
  console.log(`🎯 结论: ${report.conclusion}`);
  console.log(`⚠️  风险级别: ${report.risk}`);
  console.log('📄 详细报告已保存到: api-verification-final-report.json');
  
  return report;
}

// 启动监听
proxyServer.listen(3001, () => {
  console.log('\n🔥 API验证代理服务器启动成功！');
  console.log('📍 前端请将API地址临时改为: http://localhost:3001');
  console.log('🔄 将自动转发请求到: http://localhost:3000');
  console.log('⏰ 开始监控API调用...\n');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n\n🛑 接收到关闭信号，生成最终报告...');
  const finalReport = generateFinalReport();
  console.log('\n✅ 验证完成，程序退出。');
  process.exit(0);
});

// 导出报告生成函数供外部调用
module.exports = { generateFinalReport }; 