# 🚀 DAY 2 前端团队集成指南

## **📋 API端点确认**

### **药品模块API (已验证✅)**

**基础URL:** `http://localhost:3000/api/v1`

#### **1. 获取药品列表**
```javascript
GET /medicines?page=1&limit=10&sortBy=name&order=asc

// 响应格式
{
  "success": true,
  "data": [
    {
      "id": "cmc1bzk5x0004ugr4vxh8p7h7",
      "name": "人参",
      "chineseName": "人参", 
      "englishName": "Panax ginseng",
      "pinyinName": "renshen",
      "sku": "RS",
      "description": "人参 (Panax ginseng)",
      "category": "补益药",
      "unit": "g",
      "requiresPrescription": false,
      "basePrice": 15.5,
      "status": "active",
      "createdAt": "2025-06-18T02:26:39.190Z",
      "updatedAt": "2025-06-18T02:26:39.190Z"
    }
  ],
  "meta": {
    "timestamp": "2025-06-20T01:05:59.121Z",
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 10,
      "totalPages": 5
    }
  }
}
```

#### **2. 搜索药品**
```javascript
GET /medicines?search=人参
GET /medicines?search=renshen  // 拼音搜索
GET /medicines?search=ginseng  // 英文搜索

// 支持的搜索字段：
// - name (中文名)
// - chineseName (中文名)
// - englishName (英文名)
// - pinyinName (拼音名)
// - description (描述)
```

#### **3. 分页参数**
```javascript
GET /medicines?page=2&limit=5

// 分页参数：
// - page: 页码 (从1开始)
// - limit: 每页数量 (建议10-50)
// - sortBy: 排序字段 (name, createdAt, basePrice)
// - order: 排序方向 (asc, desc)
```

---

## **🎨 前端组件建议**

### **1. MedicineList 组件**
```typescript
interface MedicineListProps {
  searchTerm?: string;
  category?: string;
  pageSize?: number;
  onMedicineSelect?: (medicine: Medicine) => void;
}

const MedicineList: React.FC<MedicineListProps> = ({
  searchTerm,
  category,
  pageSize = 20,
  onMedicineSelect
}) => {
  // 实现列表逻辑
};
```

### **2. MedicineSearch 组件**
```typescript
interface MedicineSearchProps {
  onSearch: (term: string) => void;
  placeholder?: string;
  showFilters?: boolean;
}

const MedicineSearch: React.FC<MedicineSearchProps> = ({
  onSearch,
  placeholder = "搜索药品名称、拼音或英文...",
  showFilters = true
}) => {
  // 实现搜索逻辑，支持防抖
};
```

---

## **⚡ 性能优化建议**

### **1. API调用优化**
```javascript
// 使用防抖避免频繁搜索
const debouncedSearch = useMemo(
  () => debounce((term: string) => {
    // 执行搜索API调用
  }, 300),
  []
);

// 使用React Query缓存
const { data, isLoading, error } = useQuery(
  ['medicines', page, searchTerm],
  () => fetchMedicines({ page, search: searchTerm }),
  {
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000 // 5分钟缓存
  }
);
```

### **2. 虚拟滚动 (大数据量)**
```javascript
import { FixedSizeList as List } from 'react-window';

const VirtualizedMedicineList = ({ medicines }) => (
  <List
    height={600}
    itemCount={medicines.length}
    itemSize={80}
    itemData={medicines}
  >
    {MedicineRow}
  </List>
);
```

---

## **🔧 API客户端示例**

### **apiClient.ts 扩展**
```typescript
// 基于DAY 1成功的apiClient，添加药品模块方法

export interface MedicineQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  sortBy?: 'name' | 'createdAt' | 'basePrice';
  order?: 'asc' | 'desc';
}

export interface MedicineResponse {
  success: boolean;
  data: Medicine[];
  meta: {
    timestamp: string;
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

class ApiClient {
  // ... 现有的认证方法 ...

  // 药品模块方法
  async getMedicines(params: MedicineQueryParams = {}): Promise<MedicineResponse> {
    const queryString = new URLSearchParams(
      Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined) acc[key] = String(value);
        return acc;
      }, {} as Record<string, string>)
    ).toString();

    const response = await this.request<MedicineResponse>(
      `/medicines${queryString ? `?${queryString}` : ''}`
    );
    return response;
  }

  async searchMedicines(searchTerm: string, options: Omit<MedicineQueryParams, 'search'> = {}): Promise<MedicineResponse> {
    return this.getMedicines({ ...options, search: searchTerm });
  }
}

export const apiClient = new ApiClient();
```

---

## **📊 测试用例建议**

### **1. 单元测试**
```javascript
// MedicineList.test.tsx
describe('MedicineList', () => {
  test('renders medicine list correctly', async () => {
    const mockMedicines = [
      { id: '1', name: '人参', englishName: 'Panax ginseng' }
    ];
    
    render(<MedicineList medicines={mockMedicines} />);
    expect(screen.getByText('人参')).toBeInTheDocument();
  });

  test('handles search correctly', async () => {
    const onSearch = jest.fn();
    render(<MedicineSearch onSearch={onSearch} />);
    
    fireEvent.change(screen.getByPlaceholderText(/搜索/), {
      target: { value: '人参' }
    });
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('人参');
    });
  });
});
```

### **2. 集成测试**
```javascript
// medicine-integration.test.tsx
describe('Medicine Integration', () => {
  test('full medicine search flow', async () => {
    render(<MedicinePage />);
    
    // 输入搜索词
    fireEvent.change(screen.getByPlaceholderText(/搜索/), {
      target: { value: 'renshen' }
    });
    
    // 验证搜索结果
    await waitFor(() => {
      expect(screen.getByText('人参')).toBeInTheDocument();
    });
  });
});
```

---

## **🎯 DAY 2 联调重点**

### **验证清单**
- [ ] **基础列表加载** - 验证药品列表正确显示
- [ ] **分页功能** - 验证分页切换和数据加载
- [ ] **搜索功能** - 验证中文/拼音/英文搜索
- [ ] **响应时间** - 确保API调用<500ms
- [ ] **错误处理** - 验证网络错误和空结果处理
- [ ] **用户体验** - 验证加载状态和交互反馈

### **性能目标**
- ✅ 列表加载: <1秒
- ✅ 搜索响应: <500ms  
- ✅ 分页切换: <300ms
- ✅ 用户交互: 即时反馈

---

## **🚨 注意事项**

### **1. 字符编码**
- API返回的中文可能在某些终端显示为乱码
- 前端应用中显示正常
- 使用UTF-8编码确保兼容性

### **2. 搜索优化**
- 实现搜索防抖，避免频繁请求
- 支持多字段搜索匹配
- 考虑搜索历史和建议

### **3. 数据缓存**
- 使用React Query或SWR缓存API响应
- 实现智能缓存失效策略
- 优化重复请求处理

---

## **🎉 DAY 2 成功标准**

基于DAY 1的完美成功，DAY 2的目标是：

1. **功能完整性**: 药品模块所有功能100%可用
2. **性能优秀**: 所有操作响应时间符合标准
3. **用户体验**: 界面友好，交互流畅
4. **代码质量**: 测试覆盖率>90%，无技术债务

**让我们继续DAY 1的辉煌，创造DAY 2的技术奇迹！** 🚀✨ 