# PowerShell环境诊断脚本
# 用于检查Node.js、npm和PowerShell配置

Write-Host "🔍 开始环境诊断..." -ForegroundColor Green
Write-Host ""

# 1. 检查PowerShell版本和编码
Write-Host "📋 PowerShell环境信息:" -ForegroundColor Yellow
Write-Host "版本: $($PSVersionTable.PSVersion)"
Write-Host "编码: $([Console]::OutputEncoding.EncodingName)"
Write-Host "执行策略: $(Get-ExecutionPolicy)"
Write-Host ""

# 2. 检查Node.js安装
Write-Host "📋 Node.js环境检查:" -ForegroundColor Yellow
$nodePath = "C:\Program Files\nodejs\"
if (Test-Path $nodePath) {
    Write-Host "✅ Node.js安装目录存在: $nodePath" -ForegroundColor Green
    
    # 检查PATH环境变量
    $envPath = $env:PATH
    if ($envPath -like "*$nodePath*") {
        Write-Host "✅ Node.js已在PATH环境变量中" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js不在PATH环境变量中" -ForegroundColor Red
        Write-Host "需要添加到PATH: $nodePath" -ForegroundColor Yellow
    }
    
    # 尝试执行node命令
    try {
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Host "✅ Node.js版本: $nodeVersion" -ForegroundColor Green
        } else {
            Write-Host "❌ 无法执行node命令" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Node.js命令执行失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    # 尝试执行npm命令
    try {
        $npmVersion = & npm --version 2>$null
        if ($npmVersion) {
            Write-Host "✅ npm版本: $npmVersion" -ForegroundColor Green
        } else {
            Write-Host "❌ 无法执行npm命令" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ npm命令执行失败: $($_.Exception.Message)" -ForegroundColor Red
    }
    
} else {
    Write-Host "❌ Node.js安装目录不存在: $nodePath" -ForegroundColor Red
}
Write-Host ""

# 3. 检查当前工作目录和权限
Write-Host "📋 工作目录和权限检查:" -ForegroundColor Yellow
$currentDir = Get-Location
Write-Host "当前目录: $currentDir"

# 检查package.json
if (Test-Path "package.json") {
    Write-Host "✅ package.json存在" -ForegroundColor Green
} else {
    Write-Host "❌ package.json不存在" -ForegroundColor Red
}

# 检查node_modules
if (Test-Path "node_modules") {
    Write-Host "✅ node_modules目录存在" -ForegroundColor Green
} else {
    Write-Host "⚠️ node_modules目录不存在，可能需要运行npm install" -ForegroundColor Yellow
}

# 检查写入权限
try {
    $testFile = "test-write-permission.tmp"
    "test" | Out-File $testFile -ErrorAction Stop
    Remove-Item $testFile -ErrorAction SilentlyContinue
    Write-Host "✅ 当前目录有写入权限" -ForegroundColor Green
} catch {
    Write-Host "❌ 当前目录没有写入权限" -ForegroundColor Red
}
Write-Host ""

# 4. 环境变量检查
Write-Host "📋 关键环境变量:" -ForegroundColor Yellow
$envVars = @("PATH", "NODE_PATH", "NPM_CONFIG_PREFIX", "USERPROFILE", "TEMP")
foreach ($var in $envVars) {
    $value = [Environment]::GetEnvironmentVariable($var)
    if ($value) {
        if ($var -eq "PATH") {
            Write-Host "$var: (长度: $($value.Length) 字符)"
            # 显示PATH中与Node.js相关的部分
            $pathParts = $value -split ";"
            $nodeRelated = $pathParts | Where-Object { $_ -like "*node*" -or $_ -like "*npm*" }
            if ($nodeRelated) {
                Write-Host "  Node.js相关路径:"
                $nodeRelated | ForEach-Object { Write-Host "    - $_" }
            }
        } else {
            Write-Host "$var: $value"
        }
    } else {
        Write-Host "$var: (未设置)" -ForegroundColor Gray
    }
}
Write-Host ""

# 5. 建议的修复步骤
Write-Host "🔧 建议的修复步骤:" -ForegroundColor Cyan
Write-Host "1. 设置PowerShell编码为UTF-8:"
Write-Host "   [Console]::OutputEncoding = [System.Text.Encoding]::UTF8"
Write-Host ""
Write-Host "2. 添加Node.js到PATH (如果需要):"
Write-Host "   `$env:PATH += ';C:\Program Files\nodejs\'"
Write-Host ""
Write-Host "3. 设置执行策略 (如果需要):"
Write-Host "   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser"
Write-Host ""
Write-Host "4. 刷新环境变量:"
Write-Host "   refreshenv (如果安装了Chocolatey)"
Write-Host "   或重启PowerShell"
Write-Host ""

Write-Host "🎯 诊断完成！" -ForegroundColor Green