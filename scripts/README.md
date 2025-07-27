# 药品数据导入工具使用指南

## 概述

这套工具旨在帮助您将简单的中药名称+价格CSV文件转换为完整的药品数据库记录。整个流程分为两个阶段：

1. **AI数据扩展** - 将简单的CSV扩展为完整信息
2. **数据库导入** - 将扩展后的数据导入到数据库

## 📁 文件上传指南

### 1. 准备您的CSV文件

您的CSV文件格式应该是：
```csv
中文名,Price/g
当归,0.015
川芎,0.012
白芍,0.018
```

### 2. 上传文件位置

将您的400个中药SKU的CSV文件放到以下位置：
```
backend_test0514/data/user-input/medicines-raw.csv
```

**具体步骤：**

1. 在项目根目录创建 `data/user-input/` 文件夹（如果不存在）
2. 将您的CSV文件重命名为 `medicines-raw.csv`
3. 复制到 `data/user-input/` 目录下

### 3. 文件格式要求

- **编码**: UTF-8
- **分隔符**: 逗号 (,) 或制表符
- **标题行**: 可选（脚本会自动检测）
- **字段**: 中文名, 价格/克

## 🤖 使用AI扩展工具

### 预览模式（推荐首次使用）

```bash
npm run seed:medicines:preview
```

这将：
- 解析您的CSV文件
- 显示AI扩展的结果预览
- 展示数据统计信息
- **不会生成文件**，只是让您确认效果

### 完整扩展

```bash
npm run expand:medicines
```

或者指定自定义文件路径：
```bash
npx tsx scripts/expand-medicines-ai.ts --input=data/user-input/your-file.csv --output=data/expanded/medicines-complete.csv
```

### AI扩展功能

脚本会为每个中药自动生成：

- **拼音名称** (pinyinName): 例如 "当归" → "danggui"
- **英文名称** (englishName): 例如 "当归" → "Angelica sinensis"
- **药品分类** (category): 基于中医药传统分类
- **SKU编码** (sku): 例如 "TCM-DA-001"
- **描述信息** (description): 基于药性和功效
- **其他字段**: unit, requiresPrescription, status等

### 扩展选项

- `--preview-only`: 仅预览，不生成文件
- `--yes`: 跳过确认提示
- `--input=<path>`: 指定输入文件路径
- `--output=<path>`: 指定输出文件路径

## 💾 数据库导入

### 标准导入（推荐）

```bash
npm run seed:medicines
```

这将：
- 解析扩展后的CSV文件
- 验证数据完整性
- 备份现有数据
- 执行智能更新（upsert模式）

### 重置导入

```bash
npm run seed:medicines:reset
```

⚠️ **警告**: 这会删除所有现有药品数据！

### 自定义导入

```bash
# 仅验证数据，不导入
npx tsx scripts/seed-medicines.ts --validate-only

# 指定文件路径
npx tsx scripts/seed-medicines.ts --input=data/expanded/medicines-complete.csv

# 重置模式（清空后导入）
npx tsx scripts/seed-medicines.ts --mode=reset

# 跳过确认
npx tsx scripts/seed-medicines.ts --yes

# 跳过备份
npx tsx scripts/seed-medicines.ts --no-backup
```

### 导入模式

- **upsert模式** (默认): 存在则更新，不存在则创建
- **reset模式**: 清空表后重新插入所有数据

## 📊 完整工作流程

### 1. 准备阶段

```bash
# 确保数据库连接正常
npm run db:generate

# 运行最新迁移
npm run db:migrate
```

### 2. 处理数据

```bash
# 步骤1: 将您的CSV文件放到 data/user-input/medicines-raw.csv

# 步骤2: 预览AI扩展效果
npm run seed:medicines:preview

# 步骤3: 生成完整数据
npm run expand:medicines

# 步骤4: 导入数据库
npm run seed:medicines
```

### 3. 验证结果

```bash
# 启动开发服务器
npm run start:dev

# 测试API查询（在新终端）
curl "http://localhost:3000/medicines?search=当归"
curl "http://localhost:3000/medicines?category=补血药"
```

## 🛠️ 故障排除

### 常见问题

**Q: 文件编码问题，出现乱码**
A: 请确保CSV文件使用UTF-8编码保存

**Q: 解析失败，提示字段数量不匹配**
A: 检查CSV文件是否有空行或格式不规范的行

**Q: AI扩展的拼音不准确**
A: 脚本内置了常用中药的拼音映射，可以在 `expand-medicines-ai.ts` 中的 `pinyinMap` 对象里补充

**Q: 某些药材分类不正确**
A: 可以在 `categoryMap` 对象中添加或修正分类映射

**Q: 数据库连接失败**
A: 检查 `.env` 文件中的数据库连接配置

### 数据验证

脚本会自动验证：
- SKU唯一性
- 中文名唯一性
- 价格合理性（>0, <100元/克）
- 必需字段完整性

### 备份和恢复

自动备份位置：`data/backups/medicines-backup-[timestamp].json`

手动恢复：
```bash
# 从备份文件恢复（需要自定义脚本）
# 备份文件格式为标准JSON，可以通过编程方式恢复
```

## 📈 性能优化

- 大文件（>500条记录）会自动分批处理
- 数据库操作在事务中执行，确保一致性
- 支持断点续传（失败时会显示具体错误位置）

## 🔍 日志和监控

所有操作都有详细日志输出：
- 文件解析进度
- AI扩展进度
- 数据验证结果
- 导入成功/失败统计
- 性能指标（耗时）

## 📞 获得帮助

如果遇到问题：

1. 检查本README的故障排除部分
2. 查看控制台输出的详细错误信息
3. 确认文件路径和格式正确
4. 验证数据库连接和权限

## 🧪 测试建议

在处理400条真实数据前，建议：

1. 用提供的样本数据测试：`data/user-input/medicines-sample.csv`
2. 仅处理前10-20条记录验证流程
3. 确认AI扩展的准确性
4. 验证API查询功能正常

```bash
# 使用样本数据测试
npm run expand:medicines --input=data/user-input/medicines-sample.csv
npm run seed:medicines --input=data/expanded/medicines-complete.csv
``` 