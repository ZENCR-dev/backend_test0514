#!/usr/bin/env tsx

/**
 * DAY 2 药品模块联调测试套件
 * 基于DAY 1认证模块的完美成功，为DAY 2药品模块联调提供全面的API测试
 */

import chalk from 'chalk';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  responseTime: number;
  details: string;
}

class Day2IntegrationTester {
  private baseUrl: string;
  private results: TestResult[];
  private startTime: number;

  constructor() {
    this.baseUrl = 'http://localhost:3001/api/v1';
    this.results = [];
    this.startTime = Date.now();
  }

  private async makeRequest(endpoint: string): Promise<{response: any, responseTime: number}> {
    const startTime = Date.now();
    
    try {
      const fetch = await import('node-fetch').then(m => m.default);
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url);
      const responseTime = Date.now() - startTime;
      const data = await response.json();
      
      return { response: data, responseTime };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      throw { error, responseTime };
    }
  }

  private addTestResult(testName: string, status: 'PASS' | 'FAIL' | 'WARNING', responseTime: number, details: string) {
    this.results.push({ testName, status, responseTime, details });
  }

  async testBasicMedicinesList() {
    console.log(chalk.blue('\n📋 测试基础药品列表功能...'));

    try {
      const { response, responseTime } = await this.makeRequest('/medicines?page=1&limit=10');
      
      if (response.success && response.data && Array.isArray(response.data)) {
        this.addTestResult('药品列表获取', 'PASS', responseTime, 
          `成功获取${response.data.length}条药品，总数${response.meta?.pagination?.total}`);
      } else {
        this.addTestResult('药品列表获取', 'FAIL', responseTime, 
          '响应格式不正确或数据为空');
      }

      if (responseTime < 300) {
        this.addTestResult('列表响应时间', 'PASS', responseTime, 
          `响应时间${responseTime}ms，符合<300ms标准`);
      } else {
        this.addTestResult('列表响应时间', 'WARNING', responseTime, 
          `响应时间${responseTime}ms，超过300ms`);
      }

    } catch (error: any) {
      this.addTestResult('药品列表获取', 'FAIL', 0, 
        `请求失败: ${error.error?.message || error.message}`);
    }
  }

  async testSearchFeature() {
    console.log(chalk.blue('🔍 测试搜索功能...'));

    const searchTests = [
      { query: 'renshen', type: '拼音搜索' },
      { query: 'ginseng', type: '英文搜索' }
    ];

    for (const test of searchTests) {
      try {
        const { response, responseTime } = await this.makeRequest(`/medicines?search=${test.query}`);
        
        if (response.success && response.data && response.data.length > 0) {
          this.addTestResult(`${test.type}(${test.query})`, 'PASS', responseTime, 
            `找到${response.data.length}条结果`);
        } else {
          this.addTestResult(`${test.type}(${test.query})`, 'WARNING', responseTime, 
            '未找到搜索结果');
        }

      } catch (error: any) {
        this.addTestResult(`${test.type}(${test.query})`, 'FAIL', 0, 
          `搜索请求失败: ${error.message}`);
      }
    }
  }

  async testPagination() {
    console.log(chalk.blue('📄 测试分页功能...'));

    try {
      const { response, responseTime } = await this.makeRequest('/medicines?page=2&limit=5');
      
      if (response.success && response.meta?.pagination?.page === 2) {
        this.addTestResult('分页功能', 'PASS', responseTime, 
          `第2页数据正确，返回${response.data?.length}条记录`);
      } else {
        this.addTestResult('分页功能', 'FAIL', responseTime, 
          '分页信息不正确');
      }

    } catch (error: any) {
      this.addTestResult('分页功能', 'FAIL', 0, 
        `分页测试失败: ${error.message}`);
    }
  }

  private printResults() {
    const totalTime = Date.now() - this.startTime;
    
    console.log(chalk.yellow('\n' + '='.repeat(60)));
    console.log(chalk.yellow('🎯 DAY 2 药品模块联调测试结果'));
    console.log(chalk.yellow('='.repeat(60)));
    
    let totalPassed = 0;
    let totalFailed = 0;

    this.results.forEach(test => {
      const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
      const color = test.status === 'PASS' ? chalk.green : test.status === 'FAIL' ? chalk.red : chalk.yellow;
      
      console.log(color(`${icon} ${test.testName}: ${test.details}`));
      if (test.responseTime > 0) {
        console.log(color(`   响应时间: ${test.responseTime}ms`));
      }

      if (test.status === 'PASS') totalPassed++;
      else if (test.status === 'FAIL') totalFailed++;
    });

    console.log(chalk.yellow(`\n📊 总体统计: ${totalPassed}/${this.results.length} 通过`));
    console.log(chalk.blue(`⏱️ 总耗时: ${totalTime}ms`));

    if (totalFailed === 0) {
      console.log(chalk.green('\n🎉 所有测试通过！DAY 2药品模块联调技术准备完美！'));
    } else {
      console.log(chalk.yellow('\n⚠️ 发现问题，需要修复'));
    }
  }

  async runAllTests() {
    console.log(chalk.green('🚀 DAY 2 药品模块联调测试开始...'));
    console.log(chalk.blue(`测试目标: ${this.baseUrl}`));
    console.log(chalk.blue(`开始时间: ${new Date().toLocaleString()}`));

    await this.testBasicMedicinesList();
    await this.testSearchFeature();
    await this.testPagination();

    this.printResults();
  }
}

async function main() {
  const tester = new Day2IntegrationTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}
