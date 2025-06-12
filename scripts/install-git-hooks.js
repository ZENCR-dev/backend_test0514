#!/usr/bin/env node

/**
 * Git钩子安装脚本
 * 
 * 用途：自动安装pre-push钩子，确保推送前执行本地CI自检
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const gitHooksDir = path.join(process.cwd(), '.git', 'hooks');
const prePushHookPath = path.join(gitHooksDir, 'pre-push');

// pre-push钩子内容
const prePushHookContent = `#!/bin/sh
#
# 本地CI自检 - Pre-push钩子
# 
# 在推送到远程仓库前，强制执行本地CI自检流程
# 只有当所有检查通过时，才允许推送
#

echo "🔍 Pre-push钩子：开始执行本地CI自检..."

# 检查是否是文档类提交（可绕过CI检查）
# 获取要推送的文件列表
remote="$1"
url="$2"

# 获取本地分支名
branch=$(git rev-parse --abbrev-ref HEAD)

# 获取要推送的commit范围
if [ "$branch" = "main" ] || [ "$branch" = "develop" ]; then
    # 对于主要分支，检查最近的commits
    commits=$(git rev-list HEAD --not --remotes=origin)
else
    # 对于feature分支，检查与main分支的差异
    commits=$(git rev-list HEAD --not --remotes=origin/main --not --remotes=origin/develop)
fi

# 检查是否只修改了文档文件
doc_only=true
for commit in $commits; do
    changed_files=$(git diff-tree --no-commit-id --name-only -r $commit)
    for file in $changed_files; do
        # 如果文件不是文档类文件，则需要完整CI检查
        case "$file" in
            *.md|*.txt|*.rst|docs/*|CHANGELOG*|LICENSE*|NOTICE*)
                # 文档文件，继续检查
                ;;
            *)
                # 非文档文件，需要CI检查
                doc_only=false
                break
                ;;
        esac
    done
    if [ "$doc_only" = false ]; then
        break
    fi
done

# 如果只是文档更新，允许跳过CI检查
if [ "$doc_only" = true ]; then
    echo "📝 检测到仅文档文件更新，跳过CI自检"
    echo "✅ Pre-push检查完成"
    exit 0
fi

# 执行完整的CI自检
echo "🚀 执行完整的本地CI自检流程..."
npm run ci-check

ci_result=$?

if [ $ci_result -eq 0 ]; then
    echo "✅ Pre-push检查通过！开始推送到远程仓库..."
    exit 0
else
    echo "❌ Pre-push检查失败！"
    echo "🚫 推送被阻止。请修复CI自检中的问题后重试。"
    echo ""
    echo "💡 提示："
    echo "   • 运行 'npm run ci-check' 查看详细错误"
    echo "   • 修复所有错误后再次尝试推送"
    echo "   • 如需强制推送，使用 'git push --no-verify'（不推荐）"
    exit 1
fi
`;

function installPrePushHook() {
    try {
        // 检查.git目录是否存在
        if (!fs.existsSync(gitHooksDir)) {
            console.log(chalk.red('❌ 错误：未找到.git目录，请确保在Git仓库根目录执行此脚本'));
            process.exit(1);
        }

        // 写入pre-push钩子
        fs.writeFileSync(prePushHookPath, prePushHookContent);
        
        // 设置执行权限（Unix系统）
        if (process.platform !== 'win32') {
            fs.chmodSync(prePushHookPath, '755');
        }

        console.log(chalk.green('✅ Pre-push钩子安装成功！'));
        console.log(chalk.blue('ℹ️  钩子位置：' + prePushHookPath));
        console.log(chalk.yellow('⚠️  注意：该钩子将在每次git push前自动执行CI自检'));
        
    } catch (error) {
        console.error(chalk.red('❌ 安装pre-push钩子失败：' + error.message));
        process.exit(1);
    }
}

function main() {
    console.log(chalk.blue('🔧 开始安装Git pre-push钩子...'));
    
    if (fs.existsSync(prePushHookPath)) {
        console.log(chalk.yellow('⚠️  Pre-push钩子已存在，将被覆盖'));
    }
    
    installPrePushHook();
    
    console.log(chalk.green('\n🎉 Git钩子安装完成！'));
    console.log(chalk.blue('现在每次推送前都会自动执行本地CI自检'));
}

if (require.main === module) {
    main();
}

module.exports = { installPrePushHook }; 