#!/bin/bash

echo "🧪 开始.claude/配置生效性验证"
echo "=================================="

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0

# 运行测试函数
run_test() {
    local test_name="$1"
    local test_result="$2"
    
    echo "🔍 测试: $test_name"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [ "$test_result" = "0" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo "✅ 通过: $test_name"
    else
        echo "❌ 失败: $test_name"
    fi
    echo ""
}

# 1. 检查.claude/目录结构
check_claude_structure() {
    if [ -f ".claude/CLAUDE.md" ] && [ -f ".claude/configs/riper5-stages.md" ] && [ -f ".claude/configs/task-tree.md" ] && [ -f ".claude/configs/context/INITIAL.md" ] && [ -f ".claude/configs/context/prp-base.md" ] && [ -d ".claude/prps" ]; then
        return 0
    else
        return 1
    fi
}

# 2. 检查CLAUDE.md内容
check_claude_md_content() {
    if grep -q "## 🤖 AI协作规范" .claude/CLAUDE.md && grep -q "### RIPER-5模式管理" .claude/CLAUDE.md && grep -q "### 四层任务树管理" .claude/CLAUDE.md; then
        return 0
    else
        return 1
    fi
}

# 3. 检查RIPER-5配置
check_riper5_config() {
    if grep -q "### RESEARCH" .claude/configs/riper5-stages.md && grep -q "### EXECUTE" .claude/configs/riper5-stages.md; then
        return 0
    else
        return 1
    fi
}

# 4. 检查Context Engineering配置
check_context_engineering() {
    if grep -q "## FEATURE:" .claude/configs/context/INITIAL.md && grep -q "## Goal" .claude/configs/context/prp-base.md; then
        return 0
    else
        return 1
    fi
}

# 5. 检查SuperClaude集成
check_superclaude_integration() {
    if grep -q "/build --nest --prisma --persona-backend" .claude/CLAUDE.md; then
        return 0
    else
        return 1
    fi
}

# 6. 检查医疗平台要求
check_medical_requirements() {
    if grep -q "应用层加密" .claude/CLAUDE.md && grep -q "医疗数据隐私保护" .claude/CLAUDE.md; then
        return 0
    else
        return 1
    fi
}

# 运行所有测试
echo "开始运行配置验证测试..."
echo ""

check_claude_structure
run_test "目录结构检查" $?

check_claude_md_content
run_test "CLAUDE.md内容检查" $?

check_riper5_config
run_test "RIPER-5配置检查" $?

check_context_engineering
run_test "Context Engineering配置" $?

check_superclaude_integration
run_test "SuperClaude集成检查" $?

check_medical_requirements
run_test "医疗平台要求检查" $?

# 生成测试报告
echo "📊 测试报告"
echo "=================================="
echo "总测试数: $TOTAL_TESTS"
echo "通过测试: $PASSED_TESTS"
echo "失败测试: $((TOTAL_TESTS - PASSED_TESTS))"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo "🎉 所有测试通过！.claude/配置完全生效"
    echo ""
    echo "📋 下一步操作："
    echo "1. 测试AI交互：向AI发送开发请求，验证RIPER-5模式识别"
    echo "2. 测试SuperClaude命令：尝试使用 /build, /analyze, /test 等命令"
    echo "3. 测试Context Engineering：运行 /generate-prp INITIAL.md"
    exit 0
else
    echo "⚠️  部分测试失败，请检查配置文件"
    exit 1
fi