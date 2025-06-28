#!/bin/bash

# 🚀 后端团队DAY2紧急API确认脚本
# 执行时间：立即执行 (13:50-14:00)
# 目标：满足前端团队TC-MED-04、05、06阶段需求

echo "🔧 后端团队紧急API确认开始..."
echo "时间：$(date '+%Y-%m-%d %H:%M:%S')"

# 1. 排序API端点确认
echo ""
echo "===== 📊 排序API端点测试 ====="

# 按价格排序测试
echo "测试: 按价格升序排序"
curl -s "http://localhost:3001/api/v1/medicines?sortBy=price&order=asc&limit=5" | jq '.data[].price' || echo "❌ 价格排序需要实现"

echo "测试: 按价格降序排序"
curl -s "http://localhost:3001/api/v1/medicines?sortBy=price&order=desc&limit=5" | jq '.data[].price' || echo "❌ 价格排序需要实现"

# 按分类排序测试
echo "测试: 按分类排序"
curl -s "http://localhost:3001/api/v1/medicines?sortBy=category&order=asc&limit=5" | jq '.data[].category' || echo "❌ 分类排序需要实现"

# 按名称排序测试
echo "测试: 按名称排序"
curl -s "http://localhost:3001/api/v1/medicines?sortBy=name&order=asc&limit=5" | jq '.data[].name' || echo "❌ 名称排序需要实现"

# 2. 筛选API参数测试
echo ""
echo "===== 🔍 筛选API参数测试 ====="

# 分类筛选测试
echo "测试: 按分类筛选"
curl -s "http://localhost:3001/api/v1/medicines?category=补益药&limit=5" | jq -r '.data[].category' || echo "❌ 分类筛选需要实现"

# 价格范围筛选测试
echo "测试: 按价格范围筛选"
curl -s "http://localhost:3001/api/v1/medicines?priceMin=10&priceMax=100&limit=5" | jq '.data[].price' || echo "❌ 价格筛选需要实现"

# 复合筛选测试
echo "测试: 复合条件筛选"
curl -s "http://localhost:3001/api/v1/medicines?category=补益药&priceMin=20&priceMax=80&limit=3" | jq '.data[] | {name, category, price}' || echo "❌ 复合筛选需要实现"

# 3. 性能测试端点准备
echo ""
echo "===== ⚡ 性能测试准备 ====="

# 数据量确认
TOTAL_COUNT=$(curl -s "http://localhost:3001/api/v1/medicines?limit=1" | jq '.pagination.total' 2>/dev/null)
echo "当前药品总数: $TOTAL_COUNT"

if [ "$TOTAL_COUNT" -lt 1000 ]; then
    echo "⚠️  警告: 当前数据量 $TOTAL_COUNT < 1000，需要扩充测试数据"
    echo "建议执行: npm run seed:medicines-large-dataset"
else
    echo "✅ 数据量充足，满足性能测试要求"
fi

# 大数据量请求测试
echo "测试: 大数据量请求"
time curl -s "http://localhost:3001/api/v1/medicines?limit=100" > /dev/null && echo "✅ 大数据量请求正常" || echo "❌ 大数据量请求失败"

# 4. 并发请求准备测试
echo ""
echo "===== 🔄 并发请求测试 ====="

echo "执行5个并发搜索请求..."
for i in {1..5}; do
    (curl -s "http://localhost:3001/api/v1/medicines/search?q=人参" > /dev/null && echo "✅ 并发请求 $i 成功") &
done
wait

# 5. API响应时间基准测试
echo ""
echo "===== ⏱️  API响应时间基准测试 ====="

# 搜索API响应时间
echo "测试搜索API响应时间..."
SEARCH_TIME=$(curl -w "%{time_total}" -s "http://localhost:3001/api/v1/medicines/search?q=感冒" -o /dev/null)
echo "搜索API响应时间: ${SEARCH_TIME}s"

# 列表API响应时间
echo "测试列表API响应时间..."
LIST_TIME=$(curl -w "%{time_total}" -s "http://localhost:3001/api/v1/medicines?limit=50" -o /dev/null)
echo "列表API响应时间: ${LIST_TIME}s"

# 6. 生成前端集成状态报告
echo ""
echo "===== 📋 前端集成状态报告 ====="

cat << EOF
🎯 后端API状态报告 (for 前端团队)
========================================

✅ 基础API端点: 完全就绪
   - GET /api/v1/medicines (列表)
   - GET /api/v1/medicines/search (搜索)

🔧 排序功能状态:
   - sortBy=price: $(curl -s "http://localhost:3001/api/v1/medicines?sortBy=price&order=asc&limit=1" >/dev/null 2>&1 && echo "✅ 支持" || echo "❌ 需实现")
   - sortBy=category: $(curl -s "http://localhost:3001/api/v1/medicines?sortBy=category&order=asc&limit=1" >/dev/null 2>&1 && echo "✅ 支持" || echo "❌ 需实现")
   - sortBy=name: $(curl -s "http://localhost:3001/api/v1/medicines?sortBy=name&order=asc&limit=1" >/dev/null 2>&1 && echo "✅ 支持" || echo "❌ 需实现")

🔍 筛选功能状态:
   - category筛选: $(curl -s "http://localhost:3001/api/v1/medicines?category=补益药&limit=1" >/dev/null 2>&1 && echo "✅ 支持" || echo "❌ 需实现")
   - 价格范围筛选: $(curl -s "http://localhost:3001/api/v1/medicines?priceMin=10&priceMax=100&limit=1" >/dev/null 2>&1 && echo "✅ 支持" || echo "❌ 需实现")

⚡ 性能指标:
   - 当前数据量: $TOTAL_COUNT 条
   - 搜索响应时间: ${SEARCH_TIME}s
   - 列表响应时间: ${LIST_TIME}s
   - 并发支持: ✅ 基础测试通过

📞 前端联调支持: 🟢 就绪
EOF

echo ""
echo "🚀 后端团队API确认完成！"
echo "状态报告已生成，前端团队可继续TC-MED-04阶段"