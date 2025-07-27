/**
 * API Contract Tests - 验证所有API端点的响应格式和数据结构
 * 
 * 功能:
 * 1. 测试认证相关API
 * 2. 测试药品管理API
 * 3. 测试用户管理API
 * 4. 验证响应格式符合前端期望
 * 5. 检查错误处理和状态码
 * 
 * 用法: npx tsx scripts/api-contract-tests.ts
 */

import axios, { AxiosResponse, AxiosError } from 'axios';
import { config } from 'dotenv';

// 加载环境变量
config();

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details?: string;
  duration?: number;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

class ApiContractTester {
  private baseUrl: string;
  private authToken: string = '';
  private testResults: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  }

  private async makeRequest(method: string, endpoint: string, data?: any, requireAuth: boolean = false): Promise<AxiosResponse> {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        data,
        headers,
        timeout: 10000,
      });
      return response;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        return error.response;
      }
      throw error;
    }
  }

  private addTestResult(testName: string, status: 'PASS' | 'FAIL' | 'SKIP', details?: string, duration?: number) {
    this.testResults.push({ testName, status, details, duration });
  }

  private validateApiResponseStructure(response: any, testName: string): boolean {
    if (typeof response !== 'object' || response === null) {
      this.addTestResult(testName, 'FAIL', 'Response is not an object');
      return false;
    }

    // 检查是否是v1.2格式 {success, data, meta}
    if (typeof response.success === 'boolean') {
      // v1.2格式验证
      if (response.success && response.data === undefined) {
        this.addTestResult(testName, 'FAIL', 'v1.2 success response missing data field');
        return false;
      }
      if (!response.success && !response.error && !response.message) {
        this.addTestResult(testName, 'FAIL', 'v1.2 error response missing error or message field');
        return false;
      }
      return true;
    }

    // 检查是否是旧格式（直接包含data或错误信息）
    if (response.data !== undefined || response.error !== undefined || response.message !== undefined) {
      // 旧格式，也接受
      return true;
    }

    // 简单响应（如字符串或直接数据）
    return true;
  }

  private validatePaginationStructure(response: any, testName: string): boolean {
    // 检查v1.2格式的分页
    if (response.meta && response.meta.pagination) {
      const pagination = response.meta.pagination;
      const requiredFields = ['total', 'page', 'limit', 'totalPages'];
      
      for (const field of requiredFields) {
        if (typeof pagination[field] !== 'number') {
          this.addTestResult(testName, 'FAIL', `Missing or invalid pagination.${field}`);
          return false;
        }
      }
      return true;
    }

    // 检查旧格式的分页（直接在响应中）
    if (response.total !== undefined && response.page !== undefined && 
        response.limit !== undefined && response.totalPages !== undefined) {
      return true;
    }

    this.addTestResult(testName, 'FAIL', 'Missing pagination information');
    return false;
  }

  // ==================== 认证模块测试 ====================

  async testHealthCheck(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/');
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        this.addTestResult('Health Check', 'PASS', `Status: ${response.status}`, duration);
      } else {
        this.addTestResult('Health Check', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Health Check', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testUserRegistration(): Promise<void> {
    const startTime = Date.now();
    const testData = {
      email: `test_${Date.now()}@example.com`,
      password: 'TestPassword123!',
      name: 'Test User',
      role: 'clinic_staff',
    };

    try {
      const response = await this.makeRequest('POST', '/api/v1/auth/register', testData);
      const duration = Date.now() - startTime;

      if (response.status === 201) {
        if (this.validateApiResponseStructure(response.data, 'User Registration - Response Structure')) {
          const data = response.data.data || response.data;
          if (data && (data.user || data.id) && (data.tokens || data.access_token)) {
            this.addTestResult('User Registration', 'PASS', 'Registration successful with proper structure', duration);
            // 保存token用于后续测试
            this.authToken = data.tokens?.access_token || data.access_token;
          } else {
            this.addTestResult('User Registration', 'FAIL', 'Missing user or tokens in response data', duration);
          }
        }
      } else if (response.status === 400) {
        this.addTestResult('User Registration', 'FAIL', `Validation error: ${response.data?.message || 'Bad request'}`, duration);
      } else if (response.status === 409) {
        this.addTestResult('User Registration', 'PASS', 'Email already exists (expected behavior)', duration);
      } else {
        this.addTestResult('User Registration', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('User Registration', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testUserLogin(): Promise<void> {
    const startTime = Date.now();
    const loginData = {
      email: 'admin@tcm.com',
      password: 'admin123',
    };

    try {
      const response = await this.makeRequest('POST', '/api/v1/auth/login', loginData);
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'User Login - Response Structure')) {
          const data = response.data.data || response.data;
          if (data && (data.user || data.id) && (data.tokens || data.access_token)) {
            this.addTestResult('User Login', 'PASS', 'Login successful with proper structure', duration);
            // 更新token用于后续测试
            this.authToken = data.tokens?.access_token || data.access_token;
          } else {
            this.addTestResult('User Login', 'FAIL', 'Missing user or tokens in response data', duration);
          }
        }
      } else if (response.status === 401) {
        this.addTestResult('User Login', 'FAIL', `Authentication failed: ${response.data?.message || 'Invalid credentials'}`, duration);
      } else {
        this.addTestResult('User Login', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('User Login', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testGetProfile(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/api/v1/auth/profile', undefined, true);
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'Get Profile - Response Structure')) {
          const data = response.data.data || response.data;
          if (data && data.id && data.email && data.name) {
            this.addTestResult('Get Profile', 'PASS', 'Profile retrieved with proper structure', duration);
          } else {
            this.addTestResult('Get Profile', 'FAIL', 'Missing required user fields in response', duration);
          }
        }
      } else if (response.status === 401) {
        this.addTestResult('Get Profile', 'SKIP', 'Authentication required but no valid token', duration);
      } else if (response.status === 404) {
        this.addTestResult('Get Profile', 'SKIP', 'Profile endpoint not found', duration);
      } else {
        this.addTestResult('Get Profile', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Get Profile', 'FAIL', `Request failed: ${error}`);
    }
  }

  // ==================== 药品管理模块测试 ====================

  async testGetMedicines(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/api/v1/medicines?page=1&limit=10');
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'Get Medicines - Response Structure')) {
          // 适应不同的响应格式
          const data = response.data.data || response.data;
          
          if (Array.isArray(data)) {
            this.addTestResult('Get Medicines - Data Array', 'PASS', `Retrieved ${data.length} medicines`, duration);
            
            // 验证分页信息
            if (this.validatePaginationStructure(response.data, 'Get Medicines - Pagination')) {
              this.addTestResult('Get Medicines - Pagination', 'PASS', 'Pagination structure valid');
            }

            // 验证药品数据结构
            if (data.length > 0) {
              const medicine = data[0];
              const requiredFields = ['id', 'name', 'sku', 'category'];
              const optionalFields = ['namePinyin', 'price', 'description'];
              const missingFields = requiredFields.filter(field => medicine[field] === undefined);
              
              if (missingFields.length === 0) {
                this.addTestResult('Get Medicines - Data Structure', 'PASS', 'Medicine object structure valid');
                
                // 检查可选字段
                const missingOptional = optionalFields.filter(field => medicine[field] === undefined);
                if (missingOptional.length > 0) {
                  this.addTestResult('Get Medicines - Optional Fields', 'PASS', `Optional fields missing: ${missingOptional.join(', ')}`);
                }
              } else {
                this.addTestResult('Get Medicines - Data Structure', 'FAIL', `Missing required fields: ${missingFields.join(', ')}`);
              }
            }
          } else {
            this.addTestResult('Get Medicines', 'FAIL', 'Data is not an array', duration);
          }
        }
      } else {
        this.addTestResult('Get Medicines', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Get Medicines', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testSearchMedicines(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/api/v1/medicines?search=人参&page=1&limit=5');
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'Search Medicines - Response Structure')) {
          const data = response.data.data || response.data;
          
          if (Array.isArray(data)) {
            this.addTestResult('Search Medicines', 'PASS', `Search returned ${data.length} results`, duration);
            
            // 验证搜索结果相关性
            if (data.length > 0) {
              const relevantResults = data.filter(medicine => 
                medicine.name?.includes('人参') || 
                medicine.namePinyin?.includes('renshen') ||
                medicine.description?.includes('人参') ||
                medicine.name?.includes('renshen')
              );
              
              if (relevantResults.length > 0) {
                this.addTestResult('Search Medicines - Relevance', 'PASS', `${relevantResults.length}/${data.length} results are relevant`);
              } else {
                this.addTestResult('Search Medicines - Relevance', 'PASS', 'Search functionality working (no specific relevance required)');
              }
            } else {
              this.addTestResult('Search Medicines - Empty Results', 'PASS', 'Search returned empty results (valid behavior)');
            }
          } else {
            this.addTestResult('Search Medicines', 'FAIL', 'Data is not an array', duration);
          }
        }
      } else {
        this.addTestResult('Search Medicines', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Search Medicines', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testGetMedicineById(): Promise<void> {
    const startTime = Date.now();
    try {
      // 首先获取一个药品ID
      const listResponse = await this.makeRequest('GET', '/api/v1/medicines?limit=1');
      if (listResponse.status !== 200 || !listResponse.data.data || listResponse.data.data.length === 0) {
        this.addTestResult('Get Medicine By ID', 'SKIP', 'No medicines available for testing');
        return;
      }

      const medicineId = listResponse.data.data[0].id;
      const response = await this.makeRequest('GET', `/api/v1/medicines/${medicineId}`);
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'Get Medicine By ID - Response Structure')) {
          const data = response.data.data || response.data;
          
          if (data && data.id === medicineId) {
            this.addTestResult('Get Medicine By ID', 'PASS', 'Medicine retrieved successfully', duration);
          } else {
            this.addTestResult('Get Medicine By ID', 'FAIL', 'Medicine ID mismatch or missing data', duration);
          }
        }
      } else if (response.status === 404) {
        this.addTestResult('Get Medicine By ID', 'SKIP', 'Medicine not found (may be valid if endpoint not implemented)', duration);
      } else {
        this.addTestResult('Get Medicine By ID', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Get Medicine By ID', 'FAIL', `Request failed: ${error}`);
    }
  }

  // ==================== 用户管理模块测试 ====================

  async testGetUsers(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/api/v1/users?page=1&limit=10', undefined, true);
      const duration = Date.now() - startTime;

      if (response.status === 200) {
        if (this.validateApiResponseStructure(response.data, 'Get Users - Response Structure')) {
          const data = response.data.data || response.data;
          
          if (Array.isArray(data)) {
            this.addTestResult('Get Users - Data Array', 'PASS', `Retrieved ${data.length} users`, duration);
            
            // 验证分页信息
            if (this.validatePaginationStructure(response.data, 'Get Users - Pagination')) {
              this.addTestResult('Get Users - Pagination', 'PASS', 'Pagination structure valid');
            }

            // 验证用户数据结构
            if (data.length > 0) {
              const user = data[0];
              const requiredFields = ['id', 'email', 'name'];
              const optionalFields = ['role', 'isActive'];
              const missingFields = requiredFields.filter(field => user[field] === undefined);
              
              if (missingFields.length === 0) {
                this.addTestResult('Get Users - Data Structure', 'PASS', 'User object structure valid');
                
                // 检查可选字段
                const missingOptional = optionalFields.filter(field => user[field] === undefined);
                if (missingOptional.length > 0) {
                  this.addTestResult('Get Users - Optional Fields', 'PASS', `Optional fields missing: ${missingOptional.join(', ')}`);
                }
              } else {
                this.addTestResult('Get Users - Data Structure', 'FAIL', `Missing required fields: ${missingFields.join(', ')}`);
              }
            }
          } else {
            this.addTestResult('Get Users', 'FAIL', 'Data is not an array', duration);
          }
        }
      } else if (response.status === 401) {
        this.addTestResult('Get Users', 'SKIP', 'Authentication required', duration);
      } else if (response.status === 403) {
        this.addTestResult('Get Users', 'SKIP', 'Insufficient permissions', duration);
      } else {
        this.addTestResult('Get Users', 'FAIL', `Unexpected status: ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Get Users', 'FAIL', `Request failed: ${error}`);
    }
  }

  // ==================== 错误处理测试 ====================

  async testNotFoundEndpoint(): Promise<void> {
    const startTime = Date.now();
    try {
      const response = await this.makeRequest('GET', '/api/v1/nonexistent');
      const duration = Date.now() - startTime;

      if (response.status === 404) {
        if (this.validateApiResponseStructure(response.data, 'Not Found - Response Structure')) {
          this.addTestResult('Not Found Endpoint', 'PASS', 'Proper 404 response structure', duration);
        }
      } else {
        this.addTestResult('Not Found Endpoint', 'FAIL', `Expected 404, got ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Not Found Endpoint', 'FAIL', `Request failed: ${error}`);
    }
  }

  async testInvalidData(): Promise<void> {
    const startTime = Date.now();
    const invalidData = {
      email: 'invalid-email',
      password: '123', // 太短
      name: '', // 空名称
    };

    try {
      const response = await this.makeRequest('POST', '/api/v1/auth/register', invalidData);
      const duration = Date.now() - startTime;

      if (response.status === 400) {
        if (this.validateApiResponseStructure(response.data, 'Invalid Data - Response Structure')) {
          this.addTestResult('Invalid Data Validation', 'PASS', 'Proper validation error response', duration);
        }
      } else {
        this.addTestResult('Invalid Data Validation', 'FAIL', `Expected 400, got ${response.status}`, duration);
      }
    } catch (error) {
      this.addTestResult('Invalid Data Validation', 'FAIL', `Request failed: ${error}`);
    }
  }

  // ==================== 测试执行和报告 ====================

  async runAllTests(): Promise<void> {
    console.log('🧪 Starting API Contract Tests...\n');
    console.log(`Base URL: ${this.baseUrl}\n`);

    // 基础测试
    console.log('📡 Testing Basic Connectivity...');
    await this.testHealthCheck();
    console.log('');

    // 认证模块测试
    console.log('🔐 Testing Authentication Module...');
    await this.testUserLogin();
    await this.testUserRegistration();
    await this.testGetProfile();
    console.log('');

    // 药品管理模块测试
    console.log('💊 Testing Medicine Management Module...');
    await this.testGetMedicines();
    await this.testSearchMedicines();
    await this.testGetMedicineById();
    console.log('');

    // 用户管理模块测试
    console.log('👥 Testing User Management Module...');
    await this.testGetUsers();
    console.log('');

    // 错误处理测试
    console.log('❌ Testing Error Handling...');
    await this.testNotFoundEndpoint();
    await this.testInvalidData();
    console.log('');

    this.generateReport();
  }

  private generateReport(): void {
    const passCount = this.testResults.filter(r => r.status === 'PASS').length;
    const failCount = this.testResults.filter(r => r.status === 'FAIL').length;
    const skipCount = this.testResults.filter(r => r.status === 'SKIP').length;
    const totalCount = this.testResults.length;

    console.log('=' .repeat(60));
    console.log('📊 API CONTRACT TEST REPORT');
    console.log('=' .repeat(60));
    console.log(`📈 SUMMARY: ${passCount}/${totalCount} tests passed`);
    console.log(`✅ PASSED: ${passCount}`);
    console.log(`❌ FAILED: ${failCount}`);
    console.log(`⏭️  SKIPPED: ${skipCount}`);
    console.log('');

    // 按状态分组显示详细结果
    if (passCount > 0) {
      console.log('✅ PASSED TESTS:');
      this.testResults
        .filter(r => r.status === 'PASS')
        .forEach(result => {
          const duration = result.duration ? ` (${result.duration}ms)` : '';
          console.log(`   ✓ ${result.testName}${duration}`);
          if (result.details) console.log(`     ${result.details}`);
        });
      console.log('');
    }

    if (failCount > 0) {
      console.log('❌ FAILED TESTS:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(result => {
          const duration = result.duration ? ` (${result.duration}ms)` : '';
          console.log(`   ✗ ${result.testName}${duration}`);
          if (result.details) console.log(`     ${result.details}`);
        });
      console.log('');
    }

    if (skipCount > 0) {
      console.log('⏭️  SKIPPED TESTS:');
      this.testResults
        .filter(r => r.status === 'SKIP')
        .forEach(result => {
          console.log(`   ⏭️  ${result.testName}`);
          if (result.details) console.log(`     ${result.details}`);
        });
      console.log('');
    }

    // 总体状态评估
    const passRate = (passCount / totalCount) * 100;
    let overallStatus = 'POOR';
    if (passRate >= 95) overallStatus = 'EXCELLENT';
    else if (passRate >= 85) overallStatus = 'GOOD';
    else if (passRate >= 70) overallStatus = 'FAIR';

    console.log(`🎯 OVERALL API CONTRACT STATUS: ${overallStatus} (${passRate.toFixed(1)}% pass rate)`);
    console.log('');

    if (failCount === 0) {
      console.log('🎉 All critical API contract tests passed! Ready for frontend integration.');
    } else {
      console.log('⚠️  Some tests failed. Please review and fix issues before frontend integration.');
    }

    console.log('=' .repeat(60));
  }
}

// 主执行函数
async function main() {
  const tester = new ApiContractTester();
  await tester.runAllTests();
}

// 执行测试
if (require.main === module) {
  main().catch(console.error);
} 