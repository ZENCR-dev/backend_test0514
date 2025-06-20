/**
 * Day 3-C: 系统验证脚本
 * 验证所有API端点的v1.2格式一致性
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL';
  issues: string[];
  responseTime: number;
  data?: any;
}

class SystemVerifier {
  private baseUrl = 'http://localhost:3001/api/v1';
  private testResults: TestResult[] = [];
  private authToken: string | null = null;

  async runVerification(): Promise<void> {
    console.log('🔍 开始系统验证...\n');
    
    // 1. 认证流程验证
    await this.verifyAuthFlow();
    
    // 2. 药品API验证
    await this.verifyMedicinesAPI();
    
    // 3. 生成验证报告
    this.generateReport();
  }

  private async verifyAuthFlow(): Promise<void> {
    console.log('📋 验证认证流程...');
    
    // 登录验证
    const loginResult = await this.testEndpoint('POST', '/auth/login', {
      email: 'admin@example.com',
      password: 'admin123'
    });
    
    if (loginResult.status === 'PASS' && loginResult.data?.data?.accessToken) {
      this.authToken = loginResult.data.data.accessToken;
      console.log('✅ 登录成功，获取到访问令牌');
      
      // 获取用户信息
      await this.testEndpoint('GET', '/auth/me', null, true);
    }
  }

  private async verifyMedicinesAPI(): Promise<void> {
    console.log('📋 验证药品API...');
    
    // 药品列表（分页测试）
    await this.testEndpoint('GET', '/medicines?page=1&limit=5');
    await this.testEndpoint('GET', '/medicines?page=2&limit=10');
    
    // 搜索测试
    await this.testEndpoint('GET', '/medicines?search=当归&page=1&limit=5');
  }

  private async testEndpoint(
    method: string, 
    path: string, 
    body?: any, 
    requireAuth: boolean = false
  ): Promise<TestResult> {
    const startTime = Date.now();
    const endpoint = `${method} ${path}`;
    const issues: string[] = [];
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (requireAuth && this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }
      
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      
      const responseTime = Date.now() - startTime;
      const data = await response.json();
      
      // 验证响应时间
      if (responseTime > 500) {
        issues.push(`响应时间过长: ${responseTime}ms > 500ms`);
      }
      
      // 验证v1.2格式
      this.validateV12Format(data, issues);
      
      const result: TestResult = {
        endpoint,
        method,
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        issues,
        responseTime,
        data
      };
      
      this.testResults.push(result);
      
      if (result.status === 'PASS') {
        console.log(`✅ ${endpoint} - ${responseTime}ms`);
      } else {
        console.log(`❌ ${endpoint} - ${issues.join(', ')}`);
      }
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result: TestResult = {
        endpoint,
        method,
        status: 'FAIL',
        issues: [`请求失败: ${error.message}`],
        responseTime
      };
      
      this.testResults.push(result);
      console.log(`❌ ${endpoint} - ${error.message}`);
      return result;
    }
  }

  private validateV12Format(data: any, issues: string[]): void {
    // 验证基本结构
    if (typeof data !== 'object' || data === null) {
      issues.push('响应不是有效的JSON对象');
      return;
    }
    
    // 验证success字段
    if (typeof data.success !== 'boolean') {
      issues.push('缺少或无效的success字段');
    }
    
    // 验证meta字段
    if (!data.meta || typeof data.meta !== 'object') {
      issues.push('缺少或无效的meta字段');
    } else {
      // 验证timestamp
      if (!data.meta.timestamp || typeof data.meta.timestamp !== 'string') {
        issues.push('meta.timestamp缺失或无效');
      }
      
      // 验证分页信息（如果存在）
      if (data.meta.pagination) {
        const pagination = data.meta.pagination;
        const requiredFields = ['total', 'page', 'limit', 'totalPages'];
        
        for (const field of requiredFields) {
          if (typeof pagination[field] !== 'number') {
            issues.push(`meta.pagination.${field}缺失或无效`);
          }
        }
      }
    }
    
    // 验证data字段（成功响应）
    if (data.success && data.data === undefined) {
      issues.push('成功响应缺少data字段');
    }
    
    // 验证error字段（错误响应）
    if (!data.success && !data.error) {
      issues.push('错误响应缺少error字段');
    }
  }

  private generateReport(): void {
    console.log('\n📊 系统验证报告');
    console.log('='.repeat(50));
    
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(r => r.status === 'PASS').length;
    const failedTests = totalTests - passedTests;
    
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${passedTests} ✅`);
    console.log(`失败: ${failedTests} ❌`);
    console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    // 性能统计
    const responseTimes = this.testResults.map(r => r.responseTime);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    
    console.log(`\n⏱️ 性能统计:`);
    console.log(`平均响应时间: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`最大响应时间: ${maxResponseTime}ms`);
    
    // 失败详情
    if (failedTests > 0) {
      console.log(`\n❌ 失败详情:`);
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          console.log(`  ${result.endpoint}:`);
          result.issues.forEach(issue => {
            console.log(`    - ${issue}`);
          });
        });
    }
    
    console.log('\n' + '='.repeat(50));
  }
}

// 执行验证
async function main() {
  const verifier = new SystemVerifier();
  await verifier.runVerification();
}

if (require.main === module) {
  main().catch(console.error);
} 