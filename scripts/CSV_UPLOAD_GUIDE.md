# 药品数据CSV文件上传操作指南

## 📋 概述

本指南将指导您如何准备和上传450种药品数据的CSV文件，并使用我们的药品数据处理系统进行完整测试。

---

## 📁 文件要求

### 🎯 文件位置和命名
```
项目根目录/scripts/user-data/
├── medicine-data-450.tsv        # 您的主要数据文件
├── medicine-data-backup.tsv     # 备份文件（可选）
└── README.txt                   # 数据说明文件（可选）
```

**重要**: 
- ✅ 文件必须放在 `scripts/user-data/` 目录下
- ✅ 推荐文件名: `medicine-data-450.tsv`
- ✅ 文件格式: TSV (制表符分隔值)
- ✅ 编码格式: UTF-8

---

## 📊 CSV/TSV文件格式规范

### 🔤 编码和分隔符
- **编码**: UTF-8（支持中文字符）
- **分隔符**: 制表符(Tab)，不是逗号或空格
- **换行符**: Windows(CRLF)或Unix(LF)均可
- **文件扩展名**: `.tsv` 或 `.csv`

### 📋 表头格式（第一行）
```
中文名	英文名	价格
```

**注意**: 
- ✅ 表头必须完全一致（区分大小写）
- ✅ 使用制表符分隔，不是空格
- ✅ 不要添加额外的列

### 📝 数据行格式
```
当归	Angelica sinensis	0.85
川芎	Ligusticum chuanxiong	0.92
白芍	Paeonia lactiflora	1.15
人参	Panax ginseng	15.50
党参	Codonopsis pilosula	1.25
```

### 🔍 数据验证规则

#### 中文名字段
- ✅ **必填**: 不能为空
- ✅ **长度**: 1-100个字符
- ✅ **内容**: 中文药材名称
- ✅ **示例**: `当归`, `五指毛桃`, `川贝母`
- ❌ **避免**: 空值、纯数字、特殊符号

#### 英文名字段
- ✅ **必填**: 不能为空
- ✅ **长度**: 1-200个字符
- ✅ **内容**: 标准学名或英文通用名
- ✅ **示例**: `Angelica sinensis`, `Panax ginseng`
- ❌ **避免**: 空值、中文字符、纯数字

#### 价格字段
- ✅ **必填**: 不能为空
- ✅ **格式**: 数字（支持小数点）
- ✅ **单位**: 元/克
- ✅ **范围**: 0.01 - 1000.00
- ✅ **示例**: `0.85`, `15.50`, `1.25`
- ❌ **避免**: 负数、超过1000、非数字

---

## 📄 标准CSV模板示例

### 完整示例文件内容：
```
中文名	英文名	价格
当归	Angelica sinensis	0.85
川芎	Ligusticum chuanxiong	0.92
白芍	Paeonia lactiflora	1.15
熟地黄	Rehmannia glutinosa	0.78
人参	Panax ginseng	15.50
党参	Codonopsis pilosula	1.25
黄芪	Astragalus membranaceus	0.65
甘草	Glycyrrhiza uralensis	0.45
陈皮	Citrus reticulata	0.55
半夏	Pinellia ternata	1.80
茯苓	Poria cocos	0.70
白术	Atractylodes macrocephala	1.20
薄荷	Mentha haplocalyx	0.60
厚朴	Magnolia officinalis	0.95
杜仲	Eucommia ulmoides	1.35
枸杞子	Lycium barbarum	2.80
牛膝	Achyranthes bidentata	0.88
车前子	Plantago asiatica	0.75
知母	Anemarrhena asphodeloides	1.05
浙贝母	Fritillaria thunbergii	8.50
川贝母	Fritillaria cirrhosa	25.00
藏红花	Crocus sativus	150.00
番泻叶	Cassia angustifolia	1.50
诃子	Terminalia chebula	2.20
没药	Commiphora myrrha	12.00
... 继续到450种药品
```

---

## 💾 文件准备步骤

### 第1步: 创建目录结构
```bash
# 在项目根目录下运行
cd D:\develop\backend_test0514\scripts
mkdir user-data
```

### 第2步: 准备CSV文件
1. 📝 使用Excel、Google Sheets或文本编辑器创建文件
2. 🔤 确保编码为UTF-8
3. 📊 按照上述格式填入450种药品数据
4. 💾 保存为 `medicine-data-450.tsv`

### 第3步: 验证文件格式
使用文本编辑器（如Notepad++、VS Code）检查：
- ✅ 确认使用制表符分隔
- ✅ 确认UTF-8编码
- ✅ 确认表头格式正确
- ✅ 确认数据无空行

---

## 🚀 测试执行步骤

### 环境检查
```bash
# 1. 确认当前目录
cd D:\develop\backend_test0514\scripts

# 2. 检查文件是否存在
dir user-data\medicine-data-450.tsv

# 3. 验证系统功能
npx tsx simple-test.ts
```

### 执行处理命令
```bash
# 处理450种药品数据
npx tsx process-medicines.ts user-data/medicine-data-450.tsv --output results
```

### 预期输出
系统将生成以下文件：
```
scripts/results/
├── medicine-data-450-processed.json      # 完整JSON数据
├── medicine-data-450-processed.csv       # 处理后的CSV
├── medicine-data-450-detailed.json       # 详细数据+元数据
└── medicine-data-450-report.json         # 处理报告
```

---

## 📊 质量指标预期

### 处理性能预期
- ⏱️ **处理时间**: 约1-3秒（450条记录）
- 🚀 **处理速度**: 1-5ms/条记录
- ✅ **成功率**: ≥95%
- 🔍 **错误恢复**: 单条错误不影响整体

### 数据质量预期
- 🔤 **拼音准确率**: ≥99%
- 🏷️ **SKU唯一性**: 100%
- 📂 **分类准确率**: ≥90%
- 💰 **价格验证**: 100%

### 输出格式验证
- 📄 **JSON格式**: 标准数据库格式
- 📊 **CSV格式**: 可导入Excel
- 📝 **处理报告**: 完整统计信息
- 🔍 **元数据**: 完整处理追踪

---

## ⚠️ 常见问题和解决方案

### 问题1: 文件编码错误
**症状**: 中文字符显示为乱码
**解决**: 
```bash
# 检查编码
file -i user-data/medicine-data-450.tsv
# 转换编码（如需要）
iconv -f GBK -t UTF-8 input.csv > user-data/medicine-data-450.tsv
```

### 问题2: 分隔符错误
**症状**: 解析失败，列数不匹配
**解决**: 确认使用制表符(Tab)，不是逗号或空格

### 问题3: 数据验证失败
**症状**: 价格为负数或超过限制
**解决**: 检查数据范围，修正异常值

### 问题4: 文件路径问题
**症状**: 找不到文件
**解决**: 
```bash
# 确认文件位置
ls -la user-data/
# 检查权限
chmod 644 user-data/medicine-data-450.tsv
```

---

## 📞 技术支持

### 验证工具
```bash
# 快速验证文件格式
npx tsx -e "
const fs = require('fs');
const content = fs.readFileSync('user-data/medicine-data-450.tsv', 'utf-8');
const lines = content.split('\n');
console.log('文件行数:', lines.length);
console.log('表头:', lines[0]);
console.log('前3行数据:');
lines.slice(1,4).forEach((line, i) => console.log(\`第\${i+1}行: \${line}\`));
"
```

### 联系信息
- 📧 技术支持: 通过项目issue提交问题
- 📖 文档地址: `scripts/README.md`
- 🔧 调试工具: `scripts/simple-test.ts`

---

## ✅ 检查清单

在执行测试前，请确认：

- [ ] 文件放在正确位置 (`scripts/user-data/medicine-data-450.tsv`)
- [ ] 文件编码为UTF-8
- [ ] 使用制表符分隔，不是逗号
- [ ] 表头格式: `中文名	英文名	价格`
- [ ] 数据完整性检查（无空值、格式正确）
- [ ] 文件大小合理（450条记录约30-50KB）
- [ ] 系统环境测试通过 (`npx tsx simple-test.ts`)

---

**🎉 准备就绪后，运行处理命令即可开始450种药品数据的完整测试！** 