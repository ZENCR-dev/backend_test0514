import { describe, test, expect } from '@jest/globals';
import request from 'supertest';

/**
 * API 契约测试 - 端点连通性验证
 * 对 Staging 环境的核心端点进行真实请求测试
 * 重点验证连通性和响应结构，不验证具体业务逻辑
 */
describe('API Endpoints Contract Tests', () => {
  // 从环境变量读取 API 基础地址，默认为本地环境
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
  const TEST_TIMEOUT = 15000; // 15秒超时

  // 测试用户凭据（用于连通性测试）
  const TEST_CREDENTIALS = {
    email: 'admin@example.com',
    password: 'password123'
  };

  let authToken: string | null = null;

  describe('认证端点连通性测试', () => {
    test('POST /api/v1/auth/login - 登录端点连通性', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send(TEST_CREDENTIALS)
        .timeout(TEST_TIMEOUT);

      // 连通性验证：应该能收到响应
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      // 基础响应结构验证（不依赖具体业务逻辑）
      if (response.status === 200 || response.status === 201) {
        // 成功响应：应该符合 v1.2 格式
        expect(response.body).toHaveProperty('success');
        if (response.body.success === true) {
          expect(response.body).toHaveProperty('data');
          expect(response.body).toHaveProperty('meta');
          
          // 如果登录成功，保存 token 用于后续测试
          if (response.body.data && response.body.data.accessToken) {
            authToken = response.body.data.accessToken;
          }
        }
      } else if (response.status === 400 || response.status === 401) {
        // 错误响应：应该有错误信息
        expect(response.body).toHaveProperty('statusCode');
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error');
      }

      // 关键：无论成功失败，都不应该是服务器错误
      expect(response.status).not.toBe(500);
      expect(response.status).not.toBe(502);
      expect(response.status).not.toBe(503);
    }, TEST_TIMEOUT);

    test('GET /api/v1/auth/me - 用户信息端点连通性', async () => {
      const requestAgent = request(API_BASE_URL).get('/api/v1/auth/me');

      // 如果有认证 token，添加到请求头
      if (authToken) {
        requestAgent.set('Authorization', `Bearer ${authToken}`);
      }

      const response = await requestAgent.timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      if (response.status === 200) {
        // 成功响应：用户信息结构验证
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('role');
      } else if (response.status === 401) {
        // 未授权：应该有错误信息
        expect(response.body).toHaveProperty('statusCode', 401);
        expect(response.body).toHaveProperty('message');
      }

      // 不应该是服务器错误
      expect(response.status).not.toBe(500);
    }, TEST_TIMEOUT);

    test('POST /api/v1/auth/refresh - Token刷新端点连通性', async () => {
      // 尝试 Token 刷新（使用虚拟 refresh token）
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/refresh')
        .send({ 
          refreshToken: 'test-refresh-token-for-connectivity-check' 
        })
        .timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      // 应该返回认证相关的状态码（不是服务器错误）
      expect([200, 201, 400, 401, 403]).toContain(response.status);

      if (response.status === 200 && response.body.success) {
        // 成功刷新：验证响应结构
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('accessToken');
      } else {
        // 失败情况：应该有错误信息
        expect(response.body).toHaveProperty('statusCode');
        expect(response.body).toHaveProperty('message');
      }
    }, TEST_TIMEOUT);
  });

  describe('药品端点连通性测试', () => {
    test('GET /api/v1/medicines - 药品列表端点连通性', async () => {
      const requestAgent = request(API_BASE_URL).get('/api/v1/medicines');

      // 如果有认证 token，添加到请求头
      if (authToken) {
        requestAgent.set('Authorization', `Bearer ${authToken}`);
      }

      const response = await requestAgent.timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      if (response.status === 200) {
        // 成功响应：列表结构验证
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // 如果有数据，验证第一条记录的基础结构
        if (response.body.data.length > 0) {
          const firstMedicine = response.body.data[0];
          expect(firstMedicine).toHaveProperty('id');
          expect(firstMedicine).toHaveProperty('name');
          expect(firstMedicine).toHaveProperty('sku');
          expect(firstMedicine).toHaveProperty('basePrice');
        }
      } else if (response.status === 401) {
        // 认证失败
        expect(response.body).toHaveProperty('statusCode', 401);
      }

      // 不应该是服务器错误
      expect(response.status).not.toBe(500);
    }, TEST_TIMEOUT);

    test('GET /api/v1/medicines?search= - 药品搜索端点连通性', async () => {
      const searchTerm = '五'; // 使用常见的中文字符进行搜索测试
      const requestAgent = request(API_BASE_URL)
        .get('/api/v1/medicines')
        .query({ search: searchTerm });

      // 如果有认证 token，添加到请求头
      if (authToken) {
        requestAgent.set('Authorization', `Bearer ${authToken}`);
      }

      const response = await requestAgent.timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      if (response.status === 200) {
        // 搜索成功：验证响应结构
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      } else if (response.status === 401) {
        // 认证失败
        expect(response.body).toHaveProperty('statusCode', 401);
      }

      // 不应该是服务器错误
      expect(response.status).not.toBe(500);
    }, TEST_TIMEOUT);

    test('GET /api/v1/medicines?page=1&limit=10 - 药品分页端点连通性', async () => {
      const requestAgent = request(API_BASE_URL)
        .get('/api/v1/medicines')
        .query({ page: 1, limit: 10 });

      // 如果有认证 token，添加到请求头
      if (authToken) {
        requestAgent.set('Authorization', `Bearer ${authToken}`);
      }

      const response = await requestAgent.timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      if (response.status === 200) {
        // 分页成功：验证响应结构
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);

        // 验证分页信息（如果存在）
        if (response.body.meta && response.body.meta.pagination) {
          expect(response.body.meta.pagination).toHaveProperty('page');
          expect(response.body.meta.pagination).toHaveProperty('limit');
          expect(response.body.meta.pagination).toHaveProperty('total');
        }
      }

      // 不应该是服务器错误
      expect(response.status).not.toBe(500);
    }, TEST_TIMEOUT);
  });

  describe('健康检查端点连通性测试', () => {
    test('GET /health - 系统健康检查端点', async () => {
      const response = await request(API_BASE_URL)
        .get('/health')
        .timeout(TEST_TIMEOUT);

      // 连通性验证
      expect(response.status).toBeDefined();
      expect(response.body).toBeDefined();

      // 健康检查应该可以无认证访问
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        // 健康：验证基础结构
        expect(response.body).toHaveProperty('status');
      }
    }, TEST_TIMEOUT);
  });

  describe('错误处理连通性测试', () => {
    test('GET /api/v1/nonexistent - 404 错误处理', async () => {
      const response = await request(API_BASE_URL)
        .get('/api/v1/nonexistent')
        .timeout(TEST_TIMEOUT);

      // 应该返回 404 且有错误信息
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('statusCode', 404);
      expect(response.body).toHaveProperty('message');
    }, TEST_TIMEOUT);

    test('POST /api/v1/auth/login - 无效数据处理', async () => {
      const response = await request(API_BASE_URL)
        .post('/api/v1/auth/login')
        .send({ 
          email: 'invalid-email',
          password: '' 
        })
        .timeout(TEST_TIMEOUT);

      // 应该返回客户端错误（400 系列）且有错误信息
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('message');
    }, TEST_TIMEOUT);
  });

  describe('CORS 和基础配置测试', () => {
    test('OPTIONS /api/v1/medicines - CORS 预检请求', async () => {
      const response = await request(API_BASE_URL)
        .options('/api/v1/medicines')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .timeout(TEST_TIMEOUT);

      // CORS 预检应该被正确处理
      expect(response.status).toBeDefined();
      // 通常是 200 或 204
      expect([200, 204]).toContain(response.status);
    }, TEST_TIMEOUT);
  });
}); 