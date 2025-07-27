# 公共药品API文档

## 📋 概述

公共药品API为前端应用提供无需认证的药品搜索和查询功能。所有接口遵循MVP 2.0标准化响应格式，确保与其他API的一致性。

**基础URL**: `/public/medicines`  
**认证要求**: 无  
**响应格式**: JSON (标准化格式)  
**版本**: v1.2

---

## 🔍 API端点

### 1. 药品搜索

**端点**: `GET /public/medicines`  
**描述**: 搜索药品信息，支持关键词搜索、分类筛选和分页

#### 请求参数
| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| search | string | 否 | - | 搜索关键词（支持中文、英文、拼音、SKU） |
| category | string | 否 | - | 药品分类筛选 |
| page | number | 否 | 1 | 页码 |
| limit | number | 否 | 20 | 每页数量（最大100） |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "med-001",
        "name": "阿司匹林",
        "englishName": "Aspirin",
        "chineseName": "阿司匹林",
        "pinyinName": "asipiling",
        "sku": "ASP001",
        "category": "解热镇痛药",
        "description": "用于解热镇痛，预防心血管疾病"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "药品搜索成功",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "public-medicines-api",
    "version": "v1.2",
    "isPublic": true
  }
}
```

#### 使用示例
```javascript
// 基础搜索
fetch('/public/medicines?search=阿司匹林')
  .then(res => res.json())
  .then(data => console.log(data.data.medicines));

// 分类筛选
fetch('/public/medicines?category=解热镇痛药&page=1&limit=10')
  .then(res => res.json())
  .then(data => console.log(data.data.medicines));
```

---

### 2. 获取药品分类

**端点**: `GET /public/medicines/categories`  
**描述**: 获取所有可用的药品分类列表

#### 响应示例
```json
{
  "success": true,
  "data": {
    "categories": [
      "解热镇痛药",
      "抗生素",
      "维生素",
      "心血管药物",
      "消化系统药物"
    ]
  },
  "message": "药品分类获取成功",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "public-medicines-api",
    "version": "v1.2",
    "isPublic": true
  }
}
```

#### 使用示例
```javascript
// 获取所有分类
fetch('/public/medicines/categories')
  .then(res => res.json())
  .then(data => {
    const categories = data.data.categories;
    // 用于构建分类筛选器
    categories.forEach(category => {
      console.log(category);
    });
  });
```

---

### 3. 获取热门药品

**端点**: `GET /public/medicines/popular`  
**描述**: 获取搜索频率最高的热门药品列表

#### 请求参数
| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| limit | number | 否 | 10 | 返回数量（最大50） |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "medicines": [
      {
        "id": "med-001",
        "name": "阿司匹林",
        "englishName": "Aspirin",
        "chineseName": "阿司匹林",
        "pinyinName": "asipiling",
        "sku": "ASP001",
        "category": "解热镇痛药",
        "description": "用于解热镇痛，预防心血管疾病"
      }
    ],
    "count": 10
  },
  "message": "热门药品获取成功",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "public-medicines-api",
    "version": "v1.2",
    "isPublic": true,
    "limit": 10
  }
}
```

#### 使用示例
```javascript
// 获取热门药品
fetch('/public/medicines/popular?limit=5')
  .then(res => res.json())
  .then(data => {
    const popularMedicines = data.data.medicines;
    // 用于首页推荐或快速选择
    popularMedicines.forEach(medicine => {
      console.log(`${medicine.name} - ${medicine.category}`);
    });
  });
```

---

### 4. 搜索建议

**端点**: `GET /public/medicines/search/suggestions`  
**描述**: 根据输入关键词提供搜索建议

#### 请求参数
| 参数 | 类型 | 必需 | 默认值 | 描述 |
|------|------|------|--------|------|
| q | string | 是 | - | 搜索关键词 |
| limit | number | 否 | 5 | 建议数量（最大20） |

#### 响应示例
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "阿司匹林",
      "阿莫西林",
      "阿奇霉素"
    ],
    "query": "阿",
    "count": 3
  },
  "message": "搜索建议获取成功",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "public-medicines-api",
    "version": "v1.2",
    "isPublic": true,
    "limit": 5
  }
}
```

#### 使用示例
```javascript
// 实时搜索建议
const searchInput = document.getElementById('search');
let debounceTimer;

searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = e.target.value.trim();
    if (query.length > 0) {
      fetch(`/public/medicines/search/suggestions?q=${encodeURIComponent(query)}&limit=5`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showSuggestions(data.data.suggestions);
          }
        });
    }
  }, 300); // 300ms防抖
});
```

---

## 🔧 前端集成指南

### React Hook示例

```javascript
// 药品搜索Hook
const useMedicineSearch = () => {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState(null);

  const searchMedicines = async (params) => {
    setLoading(true);
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/public/medicines?${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        setMedicines(data.data.medicines);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return { medicines, loading, pagination, searchMedicines };
};

// 分类Hook
const useMedicineCategories = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetch('/public/medicines/categories')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCategories(data.data.categories);
        }
      });
  }, []);

  return categories;
};
```

### Vue Composition API示例

```javascript
// 药品搜索组合式函数
import { ref, reactive } from 'vue';

export function useMedicineSearch() {
  const medicines = ref([]);
  const loading = ref(false);
  const pagination = reactive({});

  const searchMedicines = async (params) => {
    loading.value = true;
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/public/medicines?${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        medicines.value = data.data.medicines;
        Object.assign(pagination, data.data.pagination);
      }
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      loading.value = false;
    }
  };

  return { medicines, loading, pagination, searchMedicines };
}
```

---

## 🚀 性能优化建议

### 1. 搜索优化
- 使用防抖技术，建议300ms延迟
- 缓存搜索结果，避免重复请求
- 实现搜索历史记录

### 2. 分页处理
- 实现虚拟滚动或无限滚动
- 预加载下一页数据
- 缓存已加载的页面

### 3. 缓存策略
```javascript
// 简单的内存缓存示例
class MedicineCache {
  constructor(ttl = 5 * 60 * 1000) { // 5分钟TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
}

const medicineCache = new MedicineCache();
```

---

## 🔒 安全注意事项

### 1. 数据过滤
- 公共API不返回价格信息
- 不返回供应商敏感信息
- 只返回基本药品信息

### 2. 访问限制
- 建议实现IP级别的访问频率限制
- 监控异常访问模式
- 实现简单的反爬虫机制

### 3. 输入验证
- 所有查询参数都经过严格验证
- 防止SQL注入（Prisma自动处理）
- 限制搜索关键词长度

---

## 📊 监控和分析

### 1. 性能监控
- 所有公共API请求都被实时性能监控系统跟踪
- 可通过 `/dashboard/performance` 查看性能数据
- WebSocket实时性能警告

### 2. 使用统计
- 搜索关键词统计
- 热门药品访问统计
- API使用频率分析

---

## 🐛 错误处理

### 标准错误响应格式
```json
{
  "success": false,
  "data": null,
  "message": "具体错误信息",
  "meta": {
    "timestamp": "2025-01-09T10:30:00.000Z",
    "source": "public-medicines-api",
    "error": "ErrorType"
  }
}
```

### 常见错误码
- **400**: 请求参数错误
- **404**: 资源不存在
- **429**: 请求频率过高
- **500**: 服务器内部错误

---

本文档将随着API功能的扩展持续更新。如有问题，请联系开发团队。