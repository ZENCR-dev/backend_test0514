# 药品数据测试样本使用指南

## 文件说明

### 1. small-sample.tsv (小型测试)
- **记录数量**: 10条
- **用途**: 快速功能验证
- **特点**: 包含常见中药，数据质量良好
- **适用场景**: 初始测试、功能演示

### 2. medium-sample.tsv (中型测试)
- **记录数量**: 25条
- **用途**: 标准功能测试
- **特点**: 覆盖更多药材类型
- **适用场景**: 常规开发测试、集成验证

### 3. large-sample.tsv (大型测试)
- **记录数量**: 50条
- **用途**: 全量功能测试
- **特点**: 完整的药材数据集
- **适用场景**: 完整性测试、生产环境验证

### 4. error-sample.tsv (错误数据测试)
- **记录数量**: 7条（包含各种错误）
- **用途**: 错误处理验证
- **错误类型**:
  - 空中文名
  - 空英文名
  - 负价格
  - 过长名称
  - 过高价格
- **适用场景**: 异常处理测试、边界条件验证

### 5. performance-sample.tsv (性能测试)
- **记录数量**: 100条
- **用途**: 性能压力测试
- **特点**: 大量数据，测试处理速度
- **适用场景**: 性能优化、压力测试

## 使用方法

### 基本测试流程

1. **选择合适的样本文件**
   ```bash
   # 快速测试
   npx tsx process-medicines.ts sample-data/small-sample.tsv
   
   # 标准测试
   npx tsx process-medicines.ts sample-data/medium-sample.tsv
   
   # 完整测试
   npx tsx process-medicines.ts sample-data/large-sample.tsv
   ```

2. **错误处理测试**
   ```bash
   npx tsx process-medicines.ts sample-data/error-sample.tsv
   ```

3. **性能测试**
   ```bash
   npx tsx process-medicines.ts sample-data/performance-sample.tsv
   ```

### 架构验证测试

```bash
# 运行完整架构测试
npx tsx test-architecture.ts

# 检查所有模块状态
npx tsx test-architecture.ts --verbose
```

### 自定义测试数据

如果需要自定义测试数据，请按以下格式创建TSV文件：

```
中文名	英文名	价格
当归	Angelica sinensis	0.85
川芎	Ligusticum chuanxiong	0.92
```

**注意事项**:
- 使用制表符(\t)分隔，不是空格
- 文件编码必须是UTF-8
- 价格使用小数格式，单位为元/克
- 第一行必须是表头

## 预期输出

成功处理后，系统会生成：

1. **processed-medicines.json** - 处理后的JSON数据
2. **processed-medicines.csv** - 处理后的CSV数据
3. **processing-report.json** - 详细处理报告
4. **processing-log.txt** - 处理日志

## 验证关键指标

- ✅ 拼音生成准确率 > 95%
- ✅ SKU生成唯一性 100%
- ✅ 数据验证通过率 > 90%
- ✅ 处理速度 < 50ms/条记录
- ✅ 错误恢复机制正常

