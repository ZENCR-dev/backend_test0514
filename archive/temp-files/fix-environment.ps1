# PowerShell环境修复脚本
# 修复Node.js、npm和PowerShell配置问题

param(
    [switch]$Force,
    [switch]$Verbose
)

Write-Host "🚀 开始修复PowerShell和Node.js环境..." -ForegroundColor Green
Write-Host ""

# 函数：安全地设置环境变量
function Set-EnvironmentVariableSafely {
    param(
        [string]$Name,
        [string]$Value,
        [string]$Target = "Process"
    )
    
    try {
        [Environment]::SetEnvironmentVariable($Name, $Value, $Target)
        Write-Host "✅ 设置环境变量 $Name" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ 设置环境变量 $Name 失败: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# 步骤1: 修复PowerShell编码
Write-Host "📋 步骤1: 修复PowerShell编码" -ForegroundColor Yellow
try {
    # 设置控制台编码为UTF-8
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    [Console]::InputEncoding = [System.Text.Encoding]::UTF8
    
    # 设置PowerShell默认编码
    $PSDefaultParameterValues['*:Encoding'] = 'utf8'
    
    Write-Host "✅ PowerShell编码已设置为UTF-8" -ForegroundColor Green
} catch {
    Write-Host "❌ 设置PowerShell编码失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 步骤2: 检查和修复Node.js PATH
Write-Host "📋 步骤2: 检查和修复Node.js PATH" -ForegroundColor Yellow
$nodePath = "C:\Program Files\nodejs\"
$npmPath = "C:\Program Files\nodejs\"

if (Test-Path $nodePath) {
    Write-Host "✅ Node.js安装目录存在: $nodePath" -ForegroundColor Green
    
    # 检查PATH
    $currentPath = $env:PATH
    $needsUpdate = $false
    
    if ($currentPath -notlike "*$nodePath*") {
        Write-Host "⚠️ Node.js不在PATH中，正在添加..." -ForegroundColor Yellow
        $env:PATH = "$currentPath;$nodePath"
        $needsUpdate = $true
    }
    
    if ($needsUpdate) {
        Write-Host "✅ Node.js已添加到PATH" -ForegroundColor Green
    } else {
        Write-Host "✅ Node.js已在PATH中" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Node.js安装目录不存在: $nodePath" -ForegroundColor Red
    Write-Host "请确认Node.js安装路径是否正确" -ForegroundColor Yellow
}
Write-Host ""

# 步骤3: 测试Node.js和npm命令
Write-Host "📋 步骤3: 测试Node.js和npm命令" -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>$null
    if ($nodeVersion) {
        Write-Host "✅ Node.js可用，版本: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ Node.js命令不可用" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Node.js测试失败: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $npmVersion = & npm --version 2>$null
    if ($npmVersion) {
        Write-Host "✅ npm可用，版本: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "❌ npm命令不可用" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ npm测试失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 步骤4: 设置执行策略
Write-Host "📋 步骤4: 检查PowerShell执行策略" -ForegroundColor Yellow
$currentPolicy = Get-ExecutionPolicy
Write-Host "当前执行策略: $currentPolicy"

if ($currentPolicy -eq "Restricted") {
    Write-Host "⚠️ 执行策略过于严格，建议设置为RemoteSigned" -ForegroundColor Yellow
    if ($Force) {
        try {
            Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force
            Write-Host "✅ 执行策略已设置为RemoteSigned" -ForegroundColor Green
        } catch {
            Write-Host "❌ 设置执行策略失败: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "使用 -Force 参数自动设置执行策略" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ 执行策略适当" -ForegroundColor Green
}
Write-Host ""

# 步骤5: 创建PowerShell配置文件
Write-Host "📋 步骤5: 创建PowerShell配置文件" -ForegroundColor Yellow
$profilePath = $PROFILE
$profileDir = Split-Path $profilePath -Parent

if (!(Test-Path $profileDir)) {
    try {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
        Write-Host "✅ 创建PowerShell配置目录: $profileDir" -ForegroundColor Green
    } catch {
        Write-Host "❌ 创建配置目录失败: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# 创建或更新PowerShell配置文件
$profileContent = @"
# PowerShell配置文件 - 自动生成
# 设置编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
`$PSDefaultParameterValues['*:Encoding'] = 'utf8'

# 确保Node.js在PATH中
`$nodePath = "C:\Program Files\nodejs\"
if ((Test-Path `$nodePath) -and (`$env:PATH -notlike "*`$nodePath*")) {
    `$env:PATH += ";`$nodePath"
}

# 设置别名
Set-Alias -Name node -Value "C:\Program Files\nodejs\node.exe" -Force -ErrorAction SilentlyContinue
Set-Alias -Name npm -Value "C:\Program Files\nodejs\npm.cmd" -Force -ErrorAction SilentlyContinue

Write-Host "✅ PowerShell环境已配置" -ForegroundColor Green
"@

try {
    $profileContent | Out-File -FilePath $profilePath -Encoding UTF8 -Force
    Write-Host "✅ PowerShell配置文件已创建: $profilePath" -ForegroundColor Green
} catch {
    Write-Host "❌ 创建配置文件失败: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 步骤6: 验证修复结果
Write-Host "📋 步骤6: 验证修复结果" -ForegroundColor Yellow

# 重新测试命令
$tests = @(
    @{ Name = "node --version"; Command = { & node --version } },
    @{ Name = "npm --version"; Command = { & npm --version } },
    @{ Name = "npx --version"; Command = { & npx --version } }
)

foreach ($test in $tests) {
    try {
        $result = & $test.Command 2>$null
        if ($result) {
            Write-Host "✅ $($test.Name): $result" -ForegroundColor Green
        } else {
            Write-Host "❌ $($test.Name): 无输出" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $($test.Name): $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host ""

# 步骤7: 项目特定检查
Write-Host "📋 步骤7: 项目特定检查" -ForegroundColor Yellow
if (Test-Path "package.json") {
    Write-Host "✅ package.json存在" -ForegroundColor Green
    
    # 检查node_modules
    if (!(Test-Path "node_modules")) {
        Write-Host "⚠️ node_modules不存在，建议运行: npm install" -ForegroundColor Yellow
    } else {
        Write-Host "✅ node_modules存在" -ForegroundColor Green
    }
    
    # 检查关键依赖
    $keyDeps = @("prisma", "@prisma/client", "typescript", "ts-node")
    foreach ($dep in $keyDeps) {
        if (Test-Path "node_modules\$dep") {
            Write-Host "✅ $dep 已安装" -ForegroundColor Green
        } else {
            Write-Host "⚠️ $dep 未安装" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ package.json不存在" -ForegroundColor Red
}
Write-Host ""

# 总结
Write-Host "🎯 修复完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📝 后续步骤:" -ForegroundColor Cyan
Write-Host "1. 重启PowerShell以应用所有更改"
Write-Host "2. 运行 'npm install' 安装项目依赖"
Write-Host "3. 运行 'node check-database-sync-status.js' 测试数据库连接"
Write-Host "4. 如果仍有问题，请检查防火墙和代理设置"
Write-Host ""

if ($Verbose) {
    Write-Host "🔍 详细环境信息:" -ForegroundColor Cyan
    Write-Host "PowerShell版本: $($PSVersionTable.PSVersion)"
    Write-Host "执行策略: $(Get-ExecutionPolicy)"
    Write-Host "当前目录: $(Get-Location)"
    Write-Host "PATH长度: $($env:PATH.Length) 字符"
}