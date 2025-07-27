/**
 * Day 3-C: API响应样本生成脚本
 * 为前端团队生成完整的API响应样本
 */

const fs = require('fs');
const path = require('path');

async function generateAPISamples() {
  console.log('📄 开始生成API响应样本...\n');
  
  const baseUrl = 'http://localhost:3001/api/v1';
  const samples = {};
  
  try {
    // 1. 认证相关API样本
    console.log('📋 生成认证API样本...');
    
    // 登录成功
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    samples.auth_login_success = await loginResponse.json();
    
    // 登录失败
    const loginFailResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'wrongpassword'
      })
    });
    samples.auth_login_error = await loginFailResponse.json();
    
    // 获取用户信息
    if (samples.auth_login_success.data?.accessToken) {
      const token = samples.auth_login_success.data.accessToken;
      const meResponse = await fetch(`${baseUrl}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      samples.auth_me_success = await meResponse.json();
    }
    
    // Token刷新
    if (samples.auth_login_success.data?.refreshToken) {
      const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: samples.auth_login_success.data.refreshToken
        })
      });
      samples.auth_refresh_success = await refreshResponse.json();
    }
    
    // 2. 药品相关API样本
    console.log('📋 生成药品API样本...');
    
    // 药品列表 - 第一页
    const medicinesPage1Response = await fetch(`${baseUrl}/medicines?page=1&limit=5`);
    samples.medicines_list_page1 = await medicinesPage1Response.json();
    
    // 药品列表 - 第二页
    const medicinesPage2Response = await fetch(`${baseUrl}/medicines?page=2&limit=5`);
    samples.medicines_list_page2 = await medicinesPage2Response.json();
    
    // 药品搜索
    const medicinesSearchResponse = await fetch(`${baseUrl}/medicines?search=当归&page=1&limit=5`);
    samples.medicines_search = await medicinesSearchResponse.json();
    
    // 大分页测试
    const medicinesLargePageResponse = await fetch(`${baseUrl}/medicines?page=1&limit=20`);
    samples.medicines_large_page = await medicinesLargePageResponse.json();
    
    // 边界条件 - 超出范围的页码
    const medicinesOutOfRangeResponse = await fetch(`${baseUrl}/medicines?page=999&limit=5`);
    samples.medicines_out_of_range = await medicinesOutOfRangeResponse.json();
    
    // 3. 错误响应样本
    console.log('📋 生成错误响应样本...');
    
    // 无效的API端点
    const notFoundResponse = await fetch(`${baseUrl}/invalid-endpoint`);
    samples.error_404_not_found = await notFoundResponse.json();
    
    // 无效的token
    const invalidTokenResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    samples.error_401_invalid_token = await invalidTokenResponse.json();
    
    // 4. 生成文档结构
    const documentation = {
      title: "新西兰中医处方平台 API 响应样本",
      version: "v1.2",
      generatedAt: new Date().toISOString(),
      baseUrl: baseUrl,
      description: "本文档包含所有API端点的标准响应格式示例，供前端开发团队参考",
      
      responseFormat: {
        description: "所有API响应都遵循统一的v1.2格式",
        structure: {
          success: "boolean - 请求是否成功",
          data: "any - 成功响应的数据内容",
          error: {
            code: "string - 错误代码",
            message: "string - 错误消息",
            details: "any - 错误详情（可选）",
            timestamp: "string - 错误发生时间"
          },
          meta: {
            timestamp: "string - 响应生成时间",
            pagination: {
              total: "number - 总记录数",
              page: "number - 当前页码",
              limit: "number - 每页记录数",
              totalPages: "number - 总页数"
            }
          }
        }
      },
      
      endpoints: {
        authentication: {
          "POST /auth/login": {
            description: "用户登录",
            successSample: "auth_login_success",
            errorSample: "auth_login_error"
          },
          "GET /auth/me": {
            description: "获取当前用户信息",
            successSample: "auth_me_success",
            errorSample: "error_401_invalid_token"
          },
          "POST /auth/refresh": {
            description: "刷新访问令牌",
            successSample: "auth_refresh_success"
          }
        },
        medicines: {
          "GET /medicines": {
            description: "获取药品列表（支持分页和搜索）",
            samples: {
              "第一页": "medicines_list_page1",
              "第二页": "medicines_list_page2",
              "搜索结果": "medicines_search",
              "大分页": "medicines_large_page",
              "超出范围": "medicines_out_of_range"
            }
          }
        }
      },
      
      samples: samples
    };
    
    // 5. 保存文档
    const outputDir = 'output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 保存完整文档
    fs.writeFileSync(
      path.join(outputDir, 'api-response-samples.json'),
      JSON.stringify(documentation, null, 2)
    );
    
    // 保存简化版（仅样本）
    fs.writeFileSync(
      path.join(outputDir, 'api-samples-only.json'),
      JSON.stringify(samples, null, 2)
    );
    
    // 生成Markdown文档
    const markdownContent = generateMarkdownDoc(documentation);
    fs.writeFileSync(
      path.join(outputDir, 'API-Response-Samples.md'),
      markdownContent
    );
    
    console.log('✅ API响应样本生成完成！');
    console.log(`📄 完整文档: ${path.join(outputDir, 'api-response-samples.json')}`);
    console.log(`📄 样本数据: ${path.join(outputDir, 'api-samples-only.json')}`);
    console.log(`📄 Markdown文档: ${path.join(outputDir, 'API-Response-Samples.md')}`);
    console.log(`📊 生成样本数量: ${Object.keys(samples).length}`);
    
  } catch (error) {
    console.error('❌ 生成API样本失败:', error.message);
  }
}

function generateMarkdownDoc(documentation) {
  const { title, version, description, responseFormat, endpoints, samples } = documentation;
  
  let markdown = `# ${title}\n\n`;
  markdown += `**版本**: ${version}\n`;
  markdown += `**生成时间**: ${documentation.generatedAt}\n`;
  markdown += `**基础URL**: ${documentation.baseUrl}\n\n`;
  markdown += `${description}\n\n`;
  
  markdown += `## 响应格式规范\n\n`;
  markdown += `${responseFormat.description}\n\n`;
  markdown += `### 成功响应格式\n`;
  markdown += `\`\`\`json\n`;
  markdown += `{\n`;
  markdown += `  "success": true,\n`;
  markdown += `  "data": "响应数据",\n`;
  markdown += `  "meta": {\n`;
  markdown += `    "timestamp": "2025-06-18T03:19:50.012Z",\n`;
  markdown += `    "pagination": {\n`;
  markdown += `      "total": 50,\n`;
  markdown += `      "page": 1,\n`;
  markdown += `      "limit": 5,\n`;
  markdown += `      "totalPages": 10\n`;
  markdown += `    }\n`;
  markdown += `  }\n`;
  markdown += `}\n`;
  markdown += `\`\`\`\n\n`;
  
  markdown += `### 错误响应格式\n`;
  markdown += `\`\`\`json\n`;
  markdown += `{\n`;
  markdown += `  "success": false,\n`;
  markdown += `  "error": {\n`;
  markdown += `    "code": "INVALID_CREDENTIALS",\n`;
  markdown += `    "message": "邮箱或密码错误",\n`;
  markdown += `    "timestamp": "2025-06-18T03:19:50.012Z"\n`;
  markdown += `  },\n`;
  markdown += `  "meta": {\n`;
  markdown += `    "timestamp": "2025-06-18T03:19:50.012Z"\n`;
  markdown += `  }\n`;
  markdown += `}\n`;
  markdown += `\`\`\`\n\n`;
  
  // 添加各个端点的样本
  markdown += `## API端点响应样本\n\n`;
  
  Object.entries(endpoints).forEach(([category, apis]) => {
    markdown += `### ${category === 'authentication' ? '认证相关' : '药品相关'}\n\n`;
    
    Object.entries(apis).forEach(([endpoint, info]) => {
      markdown += `#### ${endpoint}\n`;
      markdown += `${info.description}\n\n`;
      
      if (info.successSample && samples[info.successSample]) {
        markdown += `**成功响应样本:**\n`;
        markdown += `\`\`\`json\n`;
        markdown += JSON.stringify(samples[info.successSample], null, 2);
        markdown += `\n\`\`\`\n\n`;
      }
      
      if (info.samples) {
        Object.entries(info.samples).forEach(([desc, sampleKey]) => {
          if (samples[sampleKey]) {
            markdown += `**${desc}响应样本:**\n`;
            markdown += `\`\`\`json\n`;
            markdown += JSON.stringify(samples[sampleKey], null, 2);
            markdown += `\n\`\`\`\n\n`;
          }
        });
      }
    });
  });
  
  return markdown;
}

generateAPISamples(); 