import { describe, test, expect } from '@jest/globals';

/**
 * API 契约测试 - 响应格式静态验证
 * 验证 output/api-response-samples.json 中的响应样本是否符合前端期望的 v1.2 格式
 */
describe('API Response Format Contract Tests', () => {
  let responseSamples: any;

  beforeAll(() => {
    // 动态加载 API 响应样本数据
    responseSamples = require('../../output/api-response-samples.json');
  });

  describe('认证模块响应格式验证', () => {
    test('POST /auth/login - 登录成功响应格式', () => {
      const loginResponse = responseSamples.samples.auth_login_success;
      
      // v1.2 格式验证：顶级结构
      expect(loginResponse).toHaveProperty('success', true);
      expect(loginResponse).toHaveProperty('data');
      expect(loginResponse).toHaveProperty('meta');
      
      // 登录响应数据结构验证
      expect(loginResponse.data).toHaveProperty('accessToken');
      expect(loginResponse.data).toHaveProperty('refreshToken');
      expect(loginResponse.data).toHaveProperty('user');
      
      // JWT Token 格式验证
      expect(typeof loginResponse.data.accessToken).toBe('string');
      expect(loginResponse.data.accessToken).toMatch(/^eyJ/); // JWT 前缀
      expect(typeof loginResponse.data.refreshToken).toBe('string');
      expect(loginResponse.data.refreshToken.length).toBeGreaterThan(20);
      
      // 用户信息结构验证
      const user = loginResponse.data.user;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('role');
      
      // 字段类型验证
      expect(typeof user.id).toBe('string');
      expect(typeof user.email).toBe('string');
      expect(typeof user.name).toBe('string');
      expect(['admin', 'doctor', 'pharmacy', 'patient']).toContain(user.role);
      
      // Meta 信息验证
      expect(loginResponse.meta).toHaveProperty('timestamp');
      expect(typeof loginResponse.meta.timestamp).toBe('string');
      expect(new Date(loginResponse.meta.timestamp)).toBeInstanceOf(Date);
    });

    test('POST /auth/login - 登录错误响应格式', () => {
      const errorResponse = responseSamples.samples.auth_login_error;
      
      // 错误响应结构验证（NestJS 标准错误格式）
      expect(errorResponse).toHaveProperty('statusCode');
      expect(errorResponse).toHaveProperty('timestamp');
      expect(errorResponse).toHaveProperty('path');
      expect(errorResponse).toHaveProperty('method');
      expect(errorResponse).toHaveProperty('message');
      expect(errorResponse).toHaveProperty('error');
      
      // 错误响应字段类型验证
      expect(typeof errorResponse.statusCode).toBe('number');
      expect(errorResponse.statusCode).toBe(401);
      expect(typeof errorResponse.message).toBe('string');
      expect(errorResponse.path).toBe('/api/v1/auth/login');
      expect(errorResponse.method).toBe('POST');
    });

    test('POST /auth/refresh - Token刷新响应格式', () => {
      const refreshResponse = responseSamples.samples.auth_refresh_success;
      
      // v1.2 格式验证
      expect(refreshResponse).toHaveProperty('success', true);
      expect(refreshResponse).toHaveProperty('data');
      expect(refreshResponse).toHaveProperty('meta');
      
      // Token 刷新数据结构验证
      expect(refreshResponse.data).toHaveProperty('accessToken');
      expect(refreshResponse.data).toHaveProperty('refreshToken');
      
      // Token 格式验证
      expect(typeof refreshResponse.data.accessToken).toBe('string');
      expect(refreshResponse.data.accessToken).toMatch(/^eyJ/);
      expect(typeof refreshResponse.data.refreshToken).toBe('string');
      
      // Meta 时间戳验证
      expect(refreshResponse.meta).toHaveProperty('timestamp');
      expect(typeof refreshResponse.meta.timestamp).toBe('string');
    });

    test('GET /auth/me - 用户信息响应格式', () => {
      const meResponse = responseSamples.samples.auth_me_success;
      
      // 用户信息基础字段验证
      expect(meResponse).toHaveProperty('id');
      expect(meResponse).toHaveProperty('email');
      expect(meResponse).toHaveProperty('role');
      expect(meResponse).toHaveProperty('status');
      expect(meResponse).toHaveProperty('createdAt');
      expect(meResponse).toHaveProperty('updatedAt');
      
      // 扩展字段验证
      expect(meResponse).toHaveProperty('refreshToken');
      expect(meResponse).toHaveProperty('refreshTokenExp');
      expect(meResponse).toHaveProperty('profile');
      
      // Profile 结构验证
      if (meResponse.profile) {
        expect(meResponse.profile).toHaveProperty('id');
        expect(meResponse.profile).toHaveProperty('userId');
        expect(meResponse.profile).toHaveProperty('fullName');
      }
    });
  });

  describe('药品模块响应格式验证', () => {
    test('GET /medicines - 药品列表响应格式', () => {
      const medicinesResponse = responseSamples.samples.medicines_list_page1;
      
      // v1.2 格式验证：顶级结构
      expect(medicinesResponse).toHaveProperty('success', true);
      expect(medicinesResponse).toHaveProperty('data');
      
      // 数据数组验证
      expect(Array.isArray(medicinesResponse.data)).toBe(true);
      expect(medicinesResponse.data.length).toBeGreaterThan(0);
      
      // 单个药品记录结构验证
      const firstMedicine = medicinesResponse.data[0];
      expect(firstMedicine).toHaveProperty('id');
      expect(firstMedicine).toHaveProperty('name');
      expect(firstMedicine).toHaveProperty('chineseName');
      expect(firstMedicine).toHaveProperty('englishName');
      expect(firstMedicine).toHaveProperty('pinyinName');
      expect(firstMedicine).toHaveProperty('sku');
      expect(firstMedicine).toHaveProperty('description');
      expect(firstMedicine).toHaveProperty('category');
      expect(firstMedicine).toHaveProperty('unit');
      expect(firstMedicine).toHaveProperty('requiresPrescription');
      expect(firstMedicine).toHaveProperty('basePrice');
      expect(firstMedicine).toHaveProperty('status');
      expect(firstMedicine).toHaveProperty('createdAt');
      expect(firstMedicine).toHaveProperty('updatedAt');
      
      // 字段类型验证
      expect(typeof firstMedicine.id).toBe('string');
      expect(typeof firstMedicine.name).toBe('string');
      expect(typeof firstMedicine.sku).toBe('string');
      expect(typeof firstMedicine.basePrice).toBe('number');
      expect(typeof firstMedicine.requiresPrescription).toBe('boolean');
      expect(['active', 'inactive', 'deprecated']).toContain(firstMedicine.status);
      
      // SKU 格式验证（基于拼音首字母）
      expect(firstMedicine.sku).toMatch(/^[A-Z]{1,5}$/);
    });

    test('GET /medicines?search= - 药品搜索响应格式', () => {
      const searchResponse = responseSamples.samples.medicines_search;
      
      if (searchResponse) {
        // 搜索响应也应该符合相同的列表格式
        expect(searchResponse).toHaveProperty('success', true);
        expect(searchResponse).toHaveProperty('data');
        expect(Array.isArray(searchResponse.data)).toBe(true);
      }
    });

    test('GET /medicines - 分页信息响应格式', () => {
      const paginatedResponse = responseSamples.samples.medicines_list_page2;
      
      if (paginatedResponse && paginatedResponse.meta && paginatedResponse.meta.pagination) {
        const pagination = paginatedResponse.meta.pagination;
        
        expect(pagination).toHaveProperty('total');
        expect(pagination).toHaveProperty('page');
        expect(pagination).toHaveProperty('limit');
        expect(pagination).toHaveProperty('totalPages');
        
        expect(typeof pagination.total).toBe('number');
        expect(typeof pagination.page).toBe('number');
        expect(typeof pagination.limit).toBe('number');
        expect(typeof pagination.totalPages).toBe('number');
        
        expect(pagination.page).toBeGreaterThan(0);
        expect(pagination.limit).toBeGreaterThan(0);
        expect(pagination.total).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('通用错误响应格式验证', () => {
    test('401 Unauthorized - 无效Token错误格式', () => {
      const errorResponse = responseSamples.samples.error_401_invalid_token;
      
      if (errorResponse) {
        // 通用错误格式验证
        expect(errorResponse).toHaveProperty('statusCode', 401);
        expect(errorResponse).toHaveProperty('message');
        expect(errorResponse).toHaveProperty('error');
        expect(errorResponse).toHaveProperty('timestamp');
        
        expect(typeof errorResponse.message).toBe('string');
        expect(typeof errorResponse.error).toBe('string');
      }
    });
  });

  describe('响应样本元数据验证', () => {
    test('API 响应样本文件结构验证', () => {
      // 文件元数据验证
      expect(responseSamples).toHaveProperty('title');
      expect(responseSamples).toHaveProperty('version', 'v1.2');
      expect(responseSamples).toHaveProperty('generatedAt');
      expect(responseSamples).toHaveProperty('baseUrl');
      expect(responseSamples).toHaveProperty('responseFormat');
      expect(responseSamples).toHaveProperty('endpoints');
      expect(responseSamples).toHaveProperty('samples');
      
      // 端点文档结构验证
      expect(responseSamples.endpoints).toHaveProperty('authentication');
      expect(responseSamples.endpoints).toHaveProperty('medicines');
      
      // 样本数据存在性验证
      expect(responseSamples.samples).toHaveProperty('auth_login_success');
      expect(responseSamples.samples).toHaveProperty('auth_refresh_success');
      expect(responseSamples.samples).toHaveProperty('medicines_list_page1');
    });
  });
}); 