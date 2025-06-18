# 前端团队药品数据格式规范便签

**发件人**: 后端开发团队  
**收件人**: 前端开发团队  
**日期**: 2025年6月18日  
**主题**: 药品数据格式规范 - 与Supabase后端Medicine表一致性要求

---

## 📋 重要通知

前端团队在处理药品数据时，必须严格遵循以下格式规范，确保与Supabase后端`medicines`表的字段格式完全一致。

## 🗄️ Medicine表结构规范

### 主要字段定义

```typescript
interface Medicine {
  id: string;                    // 主键ID (cuid格式)
  name: string;                  // 药品名称 (通常与chineseName相同)
  chineseName: string;           // 中文名称 (必填)
  englishName: string;           // 英文名称 (必填) 
  pinyinName: string;            // 拼音名称 (自动生成)
  sku: string;                   // SKU代码 (基于拼音首字母，如: DG, CX, SDH)
  description: string;           // 描述信息
  category: string;              // 药品分类 (补益药, 活血药, 理气药等)
  unit: string;                  // 计量单位 (默认: "g")
  requiresPrescription: boolean; // 是否需要处方 (boolean类型)
  basePrice: number;             // 基础价格 (number类型，单位: 元/克)
  metadata: object | null;       // 元数据 (JSON格式)
  status: string;                // 状态 (默认: "active")
  createdAt: Date;               // 创建时间 (ISO 8601格式)
  updatedAt: Date;               // 更新时间 (ISO 8601格式)
}
```

## 🔑 关键格式要求

### 1. SKU代码格式
- **格式**: 基于中文名拼音首字母的简短代码
- **示例**: 
  - 当归 → `DG` (danggui)
  - 川芎 → `CX` (chuanxiong)  
  - 熟地黄 → `SDH` (shudihuang)
- **注意**: 不是TCM-XX-XXX格式！

### 2. 价格字段
- **类型**: `number` (不是字符串)
- **单位**: 元/克
- **精度**: 支持小数点后2位
- **示例**: `0.85`, `15.50`, `1.25`

### 3. 布尔字段
- **requiresPrescription**: 严格使用`boolean`类型
- **正确**: `true` / `false`
- **错误**: `"是"` / `"否"` 或 `"true"` / `"false"`

### 4. 日期格式
- **格式**: ISO 8601字符串
- **示例**: `"2025-06-18T02:21:15.980Z"`
- **注意**: 必须包含时区信息

### 5. 分类标准
- 补益药 (tonifying medicines)
- 活血药 (blood-activating medicines)  
- 理气药 (qi-regulating medicines)
- 化痰药 (phlegm-resolving medicines)
- 其他中药 (other TCM medicines)

## 📊 API响应格式示例

```json
{
  "success": true,
  "data": [
    {
      "id": "cmc1bdn27008xug4sfinbcz9z",
      "name": "当归",
      "chineseName": "当归", 
      "englishName": "Angelica sinensis",
      "pinyinName": "danggui",
      "sku": "DG",
      "description": "当归 (Angelica sinensis)",
      "category": "补益药",
      "unit": "g",
      "requiresPrescription": false,
      "basePrice": 0.85,
      "metadata": {
        "importIndex": 1,
        "processedAt": "2025-06-18T02:21:15.980Z"
      },
      "status": "active",
      "createdAt": "2025-06-18T02:09:36.512Z",
      "updatedAt": "2025-06-18T02:09:36.512Z"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 450,
      "totalPages": 45
    }
  }
}
```

## ⚠️ 常见错误避免

### 1. 数据类型错误
```typescript
// ❌ 错误
{
  "basePrice": "0.85",           // 字符串类型
  "requiresPrescription": "否"    // 中文字符串
}

// ✅ 正确  
{
  "basePrice": 0.85,             // 数字类型
  "requiresPrescription": false   // 布尔类型
}
```

### 2. SKU格式错误
```typescript
// ❌ 错误
"sku": "TCM-DG-001"    // 旧格式

// ✅ 正确
"sku": "DG"            // 基于拼音首字母
```

### 3. 分页信息位置错误
```typescript
// ❌ 错误 - 分页信息在根级别
{
  "data": [...],
  "total": 450,
  "page": 1,
  "limit": 10
}

// ✅ 正确 - 分页信息在meta中
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10, 
      "total": 450,
      "totalPages": 45
    }
  }
}
```

## 🔧 验证工具

前端可以使用以下TypeScript类型来验证数据格式：

```typescript
// 药品数据验证函数
function validateMedicineData(medicine: any): medicine is Medicine {
  return (
    typeof medicine.id === 'string' &&
    typeof medicine.chineseName === 'string' &&
    typeof medicine.englishName === 'string' &&
    typeof medicine.sku === 'string' &&
    typeof medicine.basePrice === 'number' &&
    typeof medicine.requiresPrescription === 'boolean' &&
    medicine.unit === 'g' &&
    medicine.status === 'active'
  );
}
```

## 📞 联系方式

如有任何疑问，请联系后端开发团队。我们将在24小时内回复并提供技术支持。

---

**重要提醒**: 此格式规范是强制性的，任何偏离都可能导致前后端数据不一致和系统错误。请务必严格遵循！ 