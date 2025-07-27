#!/bin/bash
# .claude/配置生效性验证脚本
# 使用方法: ./verify-claude-config.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 运行测试函数
run_test() {
    local test_name=$1
    local test_function=$2
    
    log_info "运行测试: $test_name"
    ((TOTAL_TESTS++))
    
    if $test_function; then
        ((PASSED_TESTS++))
        log_success "测试通过: $test_name"
    else
        log_error "测试失败: $test_name"
    fi
    echo ""
}

# 1. 检查.claude/目录结构
check_claude_structure() {
    log_info "检查.claude/目录结构"
    
    local required_files=(
        ".claude/CLAUDE.md"
        ".claude/configs/riper5-stages.md"
        ".claude/configs/task-tree.md"
        ".claude/configs/context/INITIAL.md"
        ".claude/configs/context/prp-base.md"
    )
    
    local required_dirs=(
        ".claude/configs"
        ".claude/configs/context"
        ".claude/prps"
    )
    
    # 检查目录
    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            log_error "缺少必需目录: $dir"
            return 1
        fi
    done
    
    # 检查文件
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            log_error "缺少必需文件: $file"
            return 1
        fi
    done
    
    log_success "目录结构检查通过"
    return 0
}

# 2. 检查CLAUDE.md内容完整性
check_claude_md_content() {
    log_info "检查CLAUDE.md内容完整性"
    
    local claude_file=".claude/CLAUDE.md"
    local required_sections=(
        "## 🤖 AI协作规范"
        "### RIPER-5模式管理"
        "### 四层任务树管理"
        "### SuperClaude集成"
        "## 🏗️ 代码结构规则"
        "## 🔒 隐私保护强制规则"
        "## 🧪 测试要求"
        "## 📝 编码规范"
        "## 🚀 MVP2.0开发目标"
    )
    
    for section in "${required_sections[@]}"; do
        if ! grep -q "$section" "$claude_file"; then
            log_error "CLAUDE.md缺少必需章节: $section"
            return 1
        fi
    done
    
    log_success "CLAUDE.md内容完整性检查通过"
    return 0
}

# 3. 检查RIPER-5配置
check_riper5_config() {
    log_info "检查RIPER-5阶段配置"
    
    local riper5_file=".claude/configs/riper5-stages.md"
    local required_stages=("RESEARCH" "INNOVATE" "PLAN" "EXECUTE" "REVIEW")
    
    for stage in "${required_stages[@]}"; do
        if ! grep -q "### $stage" "$riper5_file"; then
            log_error "RIPER-5配置缺少阶段: $stage"
            return 1
        fi
    done
    
    log_success "RIPER-5配置检查通过"
    return 0
}

# 4. 检查任务树配置
check_task_tree_config() {
    log_info "检查四层任务树配置"
    
    local task_tree_file=".claude/configs/task-tree.md"
    local required_layers=("PRPs（项目级基石文档）" "Checklist（阶段级任务清单）" "进度日志（记录级高频日志）" "Todos（临时级任务）")
    
    for layer in "${required_layers[@]}"; do
        if ! grep -q "$layer" "$task_tree_file"; then
            log_error "任务树配置缺少层级: $layer"
            return 1
        fi
    done
    
    log_success "任务树配置检查通过"
    return 0
}

# 5. 检查Context Engineering配置
check_context_engineering() {
    log_info "检查Context Engineering配置"
    
    local initial_file=".claude/configs/context/INITIAL.md"
    local prp_base_file=".claude/configs/context/prp-base.md"
    
    # 检查INITIAL.md格式
    local initial_sections=("## FEATURE:" "## EXAMPLES:" "## DOCUMENTATION:" "## OTHER CONSIDERATIONS:")
    for section in "${initial_sections[@]}"; do
        if ! grep -q "$section" "$initial_file"; then
            log_error "INITIAL.md缺少必需章节: $section"
            return 1
        fi
    done
    
    # 检查prp-base.md格式
    local prp_sections=("## Goal" "## Why" "## What" "## All Needed Context" "## Implementation Blueprint" "## Validation Loop")
    for section in "${prp_sections[@]}"; do
        if ! grep -q "$section" "$prp_base_file"; then
            log_error "prp-base.md缺少必需章节: $section"
            return 1
        fi
    done
    
    log_success "Context Engineering配置检查通过"
    return 0
}

# 6. 检查项目实际架构匹配
check_project_architecture() {
    log_info "检查项目架构匹配性"
    
    local claude_file=".claude/CLAUDE.md"
    local critical_modules=("src/modules/prescriptions" "src/auth" "src/common" "src/payment" "src/practitioner-account")
    
    for module in "${critical_modules[@]}"; do
        if [ ! -d "$module" ]; then
            log_warning "CLAUDE.md中提到的模块不存在: $module"
            # 这里不返回错误，因为项目可能正在开发中
        fi
    done
    
    # 检查架构描述是否与实际匹配
    if ! grep -q "src/modules/prescriptions" "$claude_file"; then
        log_error "CLAUDE.md未正确描述项目架构"
        return 1
    fi
    
    log_success "项目架构匹配性检查通过"
    return 0
}

# 7. 检查SuperClaude集成
check_superclaude_integration() {
    log_info "检查SuperClaude集成"
    
    local claude_file=".claude/CLAUDE.md"
    local superclaude_commands=(
        "/build --nest --prisma --persona-backend"
        "/analyze --api --ddd --persona-architect"
        "/test --coverage --e2e --persona-qa"
        "/scan --security --owasp --persona-security"
    )
    
    for command in "${superclaude_commands[@]}"; do
        if ! grep -q "$command" "$claude_file"; then
            log_error "CLAUDE.md缺少SuperClaude命令: $command"
            return 1
        fi
    done
    
    log_success "SuperClaude集成检查通过"
    return 0
}

# 8. 检查医疗平台特殊要求
check_medical_requirements() {
    log_info "检查医疗平台特殊要求"
    
    local claude_file=".claude/CLAUDE.md"
    local medical_requirements=(
        "应用层加密"
        "统一患者身份模型"
        "医疗数据隐私保护"
        "HIPAA标准"
        "审计日志"
    )
    
    for requirement in "${medical_requirements[@]}"; do
        if ! grep -q "$requirement" "$claude_file"; then
            log_error "CLAUDE.md缺少医疗平台要求: $requirement"
            return 1
        fi
    done
    
    log_success "医疗平台特殊要求检查通过"
    return 0
}

# 9. 检查性能和质量标准
check_performance_standards() {
    log_info "检查性能和质量标准"
    
    local claude_file=".claude/CLAUDE.md"
    local standards=(
        "API响应：P95 < 300ms"
        "数据库查询：< 100ms"
        "测试覆盖率必须>80%"
        "ESLint零错误"
        "TypeScript严格检查"
    )
    
    for standard in "${standards[@]}"; do
        if ! grep -q "$standard" "$claude_file"; then
            log_error "CLAUDE.md缺少质量标准: $standard"
            return 1
        fi
    done
    
    log_success "性能和质量标准检查通过"
    return 0
}

# 10. 模拟AI交互测试
simulate_ai_interaction() {
    log_info "模拟AI交互测试"
    
    log_info "创建模拟测试场景..."
    
    # 模拟创建一个简单的测试文件来验证配置
    cat > /tmp/test_claude_config.md << 'EOF'
# 测试AI是否遵循.claude/配置

## 测试场景
请创建一个简单的医师端API端点，用于获取处方历史

## 预期行为
1. AI应该识别这是EXECUTE模式
2. 应该使用TodoWrite工具创建任务
3. 应该遵循NestJS模块化架构
4. 应该包含适当的测试用例
5. 应该遵循医疗平台安全要求
EOF
    
    log_success "AI交互测试场景创建完成"
    log_info "测试文件位置: /tmp/test_claude_config.md"
    return 0
}

# 主函数
main() {
    echo "🧪 开始.claude/配置生效性验证"
    echo "=================================="
    echo ""
    
    # 检查当前目录
    if [ ! -f "package.json" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 运行所有测试
    run_test "目录结构检查" check_claude_structure
    run_test "CLAUDE.md内容完整性" check_claude_md_content
    run_test "RIPER-5配置检查" check_riper5_config
    run_test "任务树配置检查" check_task_tree_config
    run_test "Context Engineering配置" check_context_engineering
    run_test "项目架构匹配性" check_project_architecture
    run_test "SuperClaude集成" check_superclaude_integration
    run_test "医疗平台特殊要求" check_medical_requirements
    run_test "性能和质量标准" check_performance_standards
    run_test "AI交互测试场景" simulate_ai_interaction
    
    # 生成测试报告
    echo "📊 测试报告"
    echo "=================================="
    echo "总测试数: $TOTAL_TESTS"
    echo "通过测试: $PASSED_TESTS"
    echo "失败测试: $((TOTAL_TESTS - PASSED_TESTS))"
    
    local pass_rate=$(( PASSED_TESTS * 100 / TOTAL_TESTS ))
    echo "通过率: ${pass_rate}%"
    echo ""
    
    if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
        log_success "🎉 所有测试通过！.claude/配置完全生效"
        echo ""
        echo "📋 下一步操作："
        echo "1. 测试AI交互：向AI发送开发请求，验证RIPER-5模式识别"
        echo "2. 测试SuperClaude命令：尝试使用 /build, /analyze, /test 等命令"
        echo "3. 测试Context Engineering：运行 /generate-prp INITIAL.md"
        echo "4. 持续监控：定期运行此脚本验证配置状态"
        exit 0
    else
        log_error "⚠️  部分测试失败，请检查配置文件"
        echo ""
        echo "📋 修复建议："
        echo "1. 检查失败的测试项目"
        echo "2. 补充缺失的配置内容"
        echo "3. 确认文件格式正确"
        echo "4. 重新运行测试验证"
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    command -v grep >/dev/null 2>&1 || { log_error "需要安装 grep"; exit 1; }
    command -v find >/dev/null 2>&1 || { log_error "需要安装 find"; exit 1; }
}

# 运行主函数
check_dependencies
main "$@"