import { MedicineDataExpander, type RawMedicineData } from '../expand-medicines-ai';
import * as fs from 'fs';
import * as path from 'path';

describe('MedicineDataExpander', () => {
  let expander: MedicineDataExpander;
  const testDataDir = path.join(__dirname, 'test-data');

  beforeAll(() => {
    expander = new MedicineDataExpander();
    
    // 确保测试数据目录存在
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试数据
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('parseRawCSV', () => {
    it('应该正确解析CSV文件', async () => {
      const testCsvPath = path.join(testDataDir, 'test-medicines.csv');
      const csvContent = `中文名,Price/g
当归,0.015
川芎,0.012
白芍,0.018`;
      
      fs.writeFileSync(testCsvPath, csvContent, 'utf-8');

      const result = await expander.parseRawCSV(testCsvPath);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        chineseName: '当归',
        pricePerGram: 0.015
      });
      expect(result[1]).toEqual({
        chineseName: '川芎',
        pricePerGram: 0.012
      });
      expect(result[2]).toEqual({
        chineseName: '白芍',
        pricePerGram: 0.018
      });
    });

    it('应该跳过标题行', async () => {
      const testCsvPath = path.join(testDataDir, 'test-with-header.csv');
      const csvContent = `药品名称,每克价格
当归,0.015
川芎,0.012`;
      
      fs.writeFileSync(testCsvPath, csvContent, 'utf-8');

      const result = await expander.parseRawCSV(testCsvPath);

      expect(result).toHaveLength(2);
      expect(result[0].chineseName).toBe('当归');
    });

    it('应该处理不同的分隔符', async () => {
      const testCsvPath = path.join(testDataDir, 'test-tab-separated.csv');
      const csvContent = `当归\t0.015
川芎\t0.012`;
      
      fs.writeFileSync(testCsvPath, csvContent, 'utf-8');

      const result = await expander.parseRawCSV(testCsvPath);

      expect(result).toHaveLength(2);
      expect(result[0].chineseName).toBe('当归');
      expect(result[0].pricePerGram).toBe(0.015);
    });

    it('应该过滤无效行', async () => {
      const testCsvPath = path.join(testDataDir, 'test-invalid-lines.csv');
      const csvContent = `当归,0.015
川芎,无效价格
,0.012
白芍,0.018`;
      
      fs.writeFileSync(testCsvPath, csvContent, 'utf-8');

      const result = await expander.parseRawCSV(testCsvPath);

      expect(result).toHaveLength(2); // 只有当归和白芍有效
      expect(result[0].chineseName).toBe('当归');
      expect(result[1].chineseName).toBe('白芍');
    });
  });

  describe('expandMedicine', () => {
    it('应该正确扩展已知药材信息', async () => {
      const rawData: RawMedicineData = {
        chineseName: '当归',
        pricePerGram: 0.015
      };

      const result = await expander.expandMedicine(rawData, 1);

      expect(result.name).toBe('当归');
      expect(result.chineseName).toBe('当归');
      expect(result.pinyinName).toBe('danggui');
      expect(result.englishName).toBe('Angelica sinensis');
      expect(result.category).toBe('补血药');
      expect(result.sku).toBe('TCM-DA-001');
      expect(result.basePrice).toBe(0.015);
      expect(result.unit).toBe('克');
      expect(result.requiresPrescription).toBe(true);
      expect(result.status).toBe('active');
      expect(result.description).toContain('补血养血');
    });

    it('应该为未知药材生成默认信息', async () => {
      const rawData: RawMedicineData = {
        chineseName: '未知药材',
        pricePerGram: 0.02
      };

      const result = await expander.expandMedicine(rawData, 999);

      expect(result.name).toBe('未知药材');
      expect(result.chineseName).toBe('未知药材');
      expect(result.category).toBe('其他中药');
      expect(result.sku).toBe('TCM-WE-999');
      expect(result.basePrice).toBe(0.02);
      expect(result.description).toContain('未知药材，中药材');
    });

    it('应该生成唯一的SKU', async () => {
      const rawData1: RawMedicineData = {
        chineseName: '当归',
        pricePerGram: 0.015
      };
      const rawData2: RawMedicineData = {
        chineseName: '川芎',
        pricePerGram: 0.012
      };

      const result1 = await expander.expandMedicine(rawData1, 1);
      const result2 = await expander.expandMedicine(rawData2, 2);

      expect(result1.sku).not.toBe(result2.sku);
      expect(result1.sku).toBe('TCM-DA-001');
      expect(result2.sku).toBe('TCM-CH-002');
    });

    it('应该包含metadata信息', async () => {
      const rawData: RawMedicineData = {
        chineseName: '当归',
        pricePerGram: 0.015
      };

      const result = await expander.expandMedicine(rawData, 1);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.expandedBy).toBe('AI');
      expect(result.metadata.expandedAt).toBeDefined();
      expect(result.metadata.originalData).toEqual(rawData);
    });
  });

  describe('generateCompleteCSV', () => {
    it('应该生成正确格式的CSV文件', async () => {
      const expandedData = [
        {
          name: '当归',
          chineseName: '当归',
          englishName: 'Angelica sinensis',
          pinyinName: 'danggui',
          sku: 'TCM-DA-001',
          description: '补血养血，适用于血虚证',
          category: '补血药',
          unit: '克',
          requiresPrescription: true,
          basePrice: 0.015,
          metadata: { expandedBy: 'AI' },
          status: 'active'
        }
      ];

      const outputPath = path.join(testDataDir, 'output.csv');
      await expander.generateCompleteCSV(expandedData, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');
      const lines = content.split('\n');

      // 检查标题行
      expect(lines[0]).toContain('name,chineseName,englishName');
      
      // 检查数据行
      expect(lines[1]).toContain('当归');
      expect(lines[1]).toContain('Angelica sinensis');
      expect(lines[1]).toContain('TCM-DA-001');
    });

    it('应该正确转义CSV中的特殊字符', async () => {
      const expandedData = [
        {
          name: '测试"药材',
          chineseName: '测试"药材',
          englishName: 'Test, Medicine',
          pinyinName: 'test',
          sku: 'TCM-TE-001',
          description: '这是一个"测试"描述，包含特殊字符',
          category: '其他中药',
          unit: '克',
          requiresPrescription: true,
          basePrice: 0.01,
          metadata: { test: 'value' },
          status: 'active'
        }
      ];

      const outputPath = path.join(testDataDir, 'special-chars.csv');
      await expander.generateCompleteCSV(expandedData, outputPath);

      const content = fs.readFileSync(outputPath, 'utf-8');
      
      // CSV应该正确转义引号和逗号
      expect(content).toContain('"测试""药材"');
      expect(content).toContain('"Test, Medicine"');
      expect(content).toContain('"这是一个""测试""描述，包含特殊字符"');
    });
  });

  describe('showStatistics', () => {
    it('应该正确计算统计信息', async () => {
      const expandedData = [
        {
          name: '当归',
          chineseName: '当归',
          englishName: 'Angelica sinensis',
          pinyinName: 'danggui',
          sku: 'TCM-DA-001',
          description: '补血养血',
          category: '补血药',
          unit: '克',
          requiresPrescription: true,
          basePrice: 0.015,
          metadata: {},
          status: 'active'
        },
        {
          name: '川芎',
          chineseName: '川芎',
          englishName: 'Ligusticum chuanxiong',
          pinyinName: 'chuanxiong',
          sku: 'TCM-CH-002',
          description: '活血化瘀',
          category: '活血化瘀药',
          unit: '克',
          requiresPrescription: true,
          basePrice: 0.012,
          metadata: {},
          status: 'active'
        },
        {
          name: '白芍',
          chineseName: '白芍',
          englishName: 'Paeonia lactiflora',
          pinyinName: 'baishao',
          sku: 'TCM-BA-003',
          description: '补血养血',
          category: '补血药',
          unit: '克',
          requiresPrescription: true,
          basePrice: 0.018,
          metadata: {},
          status: 'active'
        }
      ];

      // 捕获console.log输出来验证统计信息
      const logSpy = jest.spyOn(console, 'log').mockImplementation();

      await expander.showStatistics(expandedData);

      // 验证统计输出
      expect(logSpy).toHaveBeenCalledWith('总计药品数量: 3');
      expect(logSpy).toHaveBeenCalledWith('  补血药: 2条');
      expect(logSpy).toHaveBeenCalledWith('  活血化瘀药: 1条');
      expect(logSpy).toHaveBeenCalledWith('  最低价: ¥0.0120/克');
      expect(logSpy).toHaveBeenCalledWith('  最高价: ¥0.0180/克');
      expect(logSpy).toHaveBeenCalledWith('  平均价: ¥0.0150/克');

      logSpy.mockRestore();
    });
  });

  describe('综合功能测试', () => {
    it('应该完成完整的处理流程', async () => {
      // 创建测试CSV文件
      const testCsvPath = path.join(testDataDir, 'integration-test.csv');
      const csvContent = `中文名,Price/g
当归,0.015
川芎,0.012
白芍,0.018
甘草,0.010`;
      
      fs.writeFileSync(testCsvPath, csvContent, 'utf-8');

      // 1. 解析CSV
      const rawData = await expander.parseRawCSV(testCsvPath);
      expect(rawData).toHaveLength(4);

      // 2. 扩展数据
      const expandedData = [];
      for (let i = 0; i < rawData.length; i++) {
        const expanded = await expander.expandMedicine(rawData[i], i + 1);
        expandedData.push(expanded);
      }

      expect(expandedData).toHaveLength(4);
      expect(expandedData[0].chineseName).toBe('当归');
      expect(expandedData[1].chineseName).toBe('川芎');

      // 3. 生成输出CSV
      const outputPath = path.join(testDataDir, 'integration-output.csv');
      await expander.generateCompleteCSV(expandedData, outputPath);

      // 验证输出文件
      expect(fs.existsSync(outputPath)).toBe(true);
      
      const outputContent = fs.readFileSync(outputPath, 'utf-8');
      expect(outputContent).toContain('当归');
      expect(outputContent).toContain('川芎');
      expect(outputContent).toContain('白芍');
      expect(outputContent).toContain('甘草');
    });
  });
}); 