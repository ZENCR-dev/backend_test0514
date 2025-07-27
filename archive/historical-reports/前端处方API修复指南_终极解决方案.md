# 前端处方API修复指南 - 终极解决方案

**日期**: 2025年6月26日  
**状态**: ✅ 已验证 - 后端API完全正常  
**问题**: 前端数据格式与后端DTO不匹配  

---

## 🎯 核心问题确认

经过详细调试，处方保存功能的报错原因是**数据格式不匹配**，不是后端API问题。

### ✅ 后端API状态确认
- ✅ 服务器运行正常 (端口: 4000)
- ✅ 认证系统正常工作
- ✅ 处方保存API完全正常
- ✅ 数据验证和保存逻辑正确

---

## 🔧 前端需要修复的问题

### 1. 认证端点错误
```javascript
// ❌ 错误的API端点
GET /api/v1/users/me

// ✅ 正确的API端点  
GET /api/v1/auth/me
```

### 2. 处方数据格式错误

#### ❌ 前端当前发送的错误格式:
```javascript
{
  "clinicId": "cmc9svktq0001ugucdwn5u1ou",
  "patientInfo": {
    "name": "患者姓名",
    "dateOfBirth": "1990-01-01",    // ❌ 错误字段
    "gender": "M"
  },
  "medicines": [{
    "medicineId": "xxx",
    "quantity": 7,
    "dosageInstructions": "用法说明"
  }],
  "totalAmount": 350.00,            // ❌ 多余字段
  "notes": "处方备注"
}
```

#### ✅ 正确的数据格式:
```javascript
{
  "clinicId": "cmc9svktq0001ugucdwn5u1ou",
  "patientInfo": {
    "name": "患者姓名",              // ✅ 必填
    "age": 35,                      // ✅ 使用age代替dateOfBirth
    "gender": "M",                  // ✅ 可选
    "phone": "02188888888",         // ✅ 可选
    "symptoms": "患者症状描述",      // ✅ 可选
    "diagnosis": "诊断信息"          // ✅ 可选
  },
  "medicines": [{
    "medicineId": "xxx",            // ✅ 必填
    "quantity": 7,                  // ✅ 必填，最小值1
    "dosageInstructions": "用法说明", // ✅ 必填
    "notes": "药品备注"             // ✅ 可选
  }],
  // totalAmount字段会由后端自动计算，不需要前端提供
  "notes": "处方备注"               // ✅ 可选
}
```

---

## 🛠️ 具体修复步骤

### Step 1: 修复用户信息获取
```javascript
// 将所有 /users/me 改为 /auth/me
const userResponse = await axios.get('/api/v1/auth/me', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Step 2: 修复处方数据格式
```javascript
// 在处方创建函数中
const prescriptionData = {
  clinicId: selectedClinicId,
  patientInfo: {
    name: patientName,              // 保持不变
    age: calculateAge(dateOfBirth), // 计算年龄而不是发送生日
    gender: gender,                 // 保持不变
    phone: phone,                   // 保持不变
    symptoms: symptoms,             // 新增字段
    diagnosis: diagnosis            // 新增字段
  },
  medicines: medicines.map(medicine => ({
    medicineId: medicine.id,
    quantity: medicine.quantity,
    dosageInstructions: medicine.dosageInstructions, // 确保字段名正确
    notes: medicine.notes  // 可选
  })),
  // 移除totalAmount字段
  notes: prescriptionNotes
};
```

### Step 3: 添加年龄计算函数
```javascript
function calculateAge(dateOfBirth) {
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}
```

---

## 🧪 验证代码示例

### 完整的处方保存函数
```javascript
async function savePrescription(prescriptionForm) {
  try {
    // 1. 获取认证token
    const token = localStorage.getItem('accessToken');
    
    // 2. 准备正确格式的数据
    const prescriptionData = {
      clinicId: prescriptionForm.clinicId,
      patientInfo: {
        name: prescriptionForm.patientName,
        age: calculateAge(prescriptionForm.dateOfBirth),
        gender: prescriptionForm.gender,
        phone: prescriptionForm.phone,
        symptoms: prescriptionForm.symptoms,
        diagnosis: prescriptionForm.diagnosis
      },
      medicines: prescriptionForm.medicines.map(medicine => ({
        medicineId: medicine.id,
        quantity: parseInt(medicine.quantity),
        dosageInstructions: medicine.dosageInstructions,
        notes: medicine.notes
      })),
      notes: prescriptionForm.notes
    };
    
    // 3. 发送请求
    const response = await axios.post('/api/v1/prescriptions', prescriptionData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ 处方保存成功:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ 处方保存失败:', error.response?.data);
    throw error;
  }
}
```

---

## 🎯 测试验证

### 测试数据示例
```javascript
const testPrescription = {
  clinicId: "cmc9svktq0001ugucdwn5u1ou",
  patientName: "测试患者",
  dateOfBirth: "1990-01-01",
  gender: "M",
  phone: "02188888888",
  symptoms: "头痛，失眠",
  diagnosis: "神经衰弱",
  medicines: [{
    id: "cmc1bzn21000pugr4luvxa52o",
    quantity: 7,
    dosageInstructions: "水煎服，每次1剂，每日2次，温服"
  }],
  notes: "测试处方"
};

// 调用保存函数
await savePrescription(testPrescription);
```

---

## 📋 DTO字段对照表

| 前端字段 | 后端DTO字段 | 类型 | 必填 | 说明 |
|---------|------------|------|------|------|
| `patientName` | `patientInfo.name` | string | ✅ | 患者姓名 |
| `dateOfBirth` | `patientInfo.age` | number | ❌ | 需要计算年龄 |
| `gender` | `patientInfo.gender` | string | ❌ | 性别 |
| `phone` | `patientInfo.phone` | string | ❌ | 联系电话 |
| `symptoms` | `patientInfo.symptoms` | string | ❌ | 症状描述 |
| `diagnosis` | `patientInfo.diagnosis` | string | ❌ | 诊断信息 |
| `medicineId` | `medicines[].medicineId` | string | ✅ | 药品ID |
| `quantity` | `medicines[].quantity` | number | ✅ | 数量(≥1) |
| `dosageInstructions` | `medicines[].dosageInstructions` | string | ✅ | 用药说明 |
| `medicineNotes` | `medicines[].notes` | string | ❌ | 药品备注 |
| `totalAmount` | 自动计算 | - | ❌ | 后端自动计算 |
| `prescriptionNotes` | `notes` | string | ❌ | 处方备注 |

---

## 🚀 立即行动清单

1. **[ ] 修复认证端点**: 所有 `/users/me` → `/auth/me`
2. **[ ] 移除totalAmount字段**: 从前端处方数据中删除
3. **[ ] 添加年龄计算**: `dateOfBirth` → `age`
4. **[ ] 添加可选字段**: `symptoms`, `diagnosis`
5. **[ ] 测试验证**: 使用提供的测试数据验证修复

---

## ✅ 预期结果

修复后，处方保存API将返回：
```javascript
{
  "success": true,
  "data": {
    "id": "cmcct1i5y0001ugysusp0ilos",
    "prescriptionId": "RX-1750907371316-Z2T7XS",
    "status": "DRAFT",
    "totalAmount": "73.5",  // 后端自动计算
    "patientInfo": { ... },
    "medicines": [ ... ]
  },
  "message": "处方创建成功"
}
```

---

**修复优先级**: 🔴 P0 - 立即修复  
**预估修复时间**: 30分钟  
**验证方法**: 使用提供的测试代码验证功能 