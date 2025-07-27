#!/bin/bash

# 安全数据库迁移执行脚本
# 创建日期: 2025年7月12日
# 用途: 安全地执行从Order为中心到Prescription为中心的数据库迁移

set -e  # 遇到错误立即停止

# 配置
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"your_database"}
DB_USER=${DB_USER:-"your_user"}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="./migration_$(date +%Y%m%d_%H%M%S).log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# 检查必要工具
check_dependencies() {
    log "检查依赖工具..."
    
    if ! command -v psql &> /dev/null; then
        error "psql 未安装。请安装 PostgreSQL 客户端。"
    fi
    
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump 未安装。请安装 PostgreSQL 客户端。"
    fi
    
    log "✅ 依赖检查通过"
}

# 创建备份目录
create_backup_dir() {
    log "创建备份目录: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
}

# 数据库连接测试
test_connection() {
    log "测试数据库连接..."
    
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        error "无法连接到数据库。请检查连接参数。"
    fi
    
    log "✅ 数据库连接成功"
}

# 创建完整数据库备份
create_full_backup() {
    log "创建完整数据库备份..."
    
    local backup_file="$BACKUP_DIR/full_database_backup.sql"
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$backup_file"; then
        log "✅ 完整备份创建成功: $backup_file"
        
        # 验证备份文件
        if [ -s "$backup_file" ]; then
            local backup_size=$(du -h "$backup_file" | cut -f1)
            log "备份文件大小: $backup_size"
        else
            error "备份文件为空，备份失败"
        fi
    else
        error "完整备份创建失败"
    fi
}

# 创建关键表备份
create_table_backups() {
    log "创建关键表的详细备份..."
    
    local tables=("prescriptions" "prescription_medicines" "orders" "order_items" "medicines" "users")
    
    for table in "${tables[@]}"; do
        local backup_file="$BACKUP_DIR/${table}_backup.sql"
        
        log "备份表: $table"
        if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t "$table" --data-only > "$backup_file"; then
            local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;")
            log "✅ $table 备份完成，记录数: $count"
        else
            warn "表 $table 备份失败（可能不存在）"
        fi
    done
}

# 验证当前数据状态
verify_current_state() {
    log "验证当前数据库状态..."
    
    # 检查关键表存在性
    local tables=("prescriptions" "orders" "medicines")
    for table in "${tables[@]}"; do
        local exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='$table';")
        if [ "$exists" -gt 0 ]; then
            local count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM $table;")
            log "表 $table 存在，记录数: $count"
        else
            error "关键表 $table 不存在"
        fi
    done
    
    log "✅ 当前状态验证完成"
}

# 执行迁移前检查
pre_migration_check() {
    log "执行迁移前检查..."
    
    # 检查是否有活跃连接
    local active_connections=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname='$DB_NAME' AND state='active';")
    log "当前活跃连接数: $active_connections"
    
    if [ "$active_connections" -gt 10 ]; then
        warn "活跃连接数较多 ($active_connections)，建议在低峰期执行迁移"
        read -p "是否继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "用户取消迁移"
        fi
    fi
    
    log "✅ 迁移前检查完成"
}

# 执行迁移
execute_migration() {
    log "开始执行数据库迁移..."
    
    # 开始事务
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
BEGIN;

-- 设置当前用户ID用于审计
SET LOCAL app.current_user_id = 'MIGRATION_SYSTEM';

-- 执行迁移脚本
\i migration-to-prescription-focused.sql

-- 如果到这里没有错误，提交事务
COMMIT;

-- 验证迁移结果
SELECT 'Migration completed successfully' as status;
EOF

    if [ $? -eq 0 ]; then
        log "✅ 数据库迁移执行成功"
    else
        error "数据库迁移执行失败，请检查错误信息"
    fi
}

# 验证迁移结果
verify_migration() {
    log "验证迁移结果..."
    
    # 验证新字段存在
    local new_fields=("copies" "gross_weight" "net_price" "is_high_value")
    for field in "${new_fields[@]}"; do
        local exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='prescriptions' AND column_name='$field';")
        if [ "$exists" -gt 0 ]; then
            log "✅ 新字段 $field 已添加"
        else
            error "新字段 $field 未找到"
        fi
    done
    
    # 验证数据完整性
    local prescription_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM prescriptions;")
    local order_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM orders;")
    
    log "迁移后数据统计:"
    log "- 处方数量: $prescription_count"
    log "- 订单数量: $order_count"
    
    # 检查高价值处方标记
    local high_value_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM prescriptions WHERE is_high_value = true;")
    log "- 高价值处方数量: $high_value_count"
    
    log "✅ 迁移结果验证完成"
}

# 生成迁移报告
generate_report() {
    log "生成迁移报告..."
    
    local report_file="$BACKUP_DIR/migration_report.txt"
    
    cat > "$report_file" << EOF
===========================================
数据库迁移报告
===========================================
迁移日期: $(date)
迁移类型: Order中心 → Prescription中心架构
数据库: $DB_NAME
备份位置: $BACKUP_DIR

迁移内容:
1. 添加Prescription表新字段: copies, grossWeight, netPrice, isHighValue
2. 重命名字段: dosageInstructions → notes
3. 移除隐私字段: patientInfo
4. 简化Order表为支付记录
5. 添加业务约束和触发器
6. 创建审计日志系统

数据统计:
$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
SELECT 
    'Prescriptions: ' || COUNT(*) 
FROM prescriptions
UNION ALL
SELECT 
    'Orders: ' || COUNT(*) 
FROM orders
UNION ALL
SELECT 
    'Prescription Medicines: ' || COUNT(*) 
FROM prescription_medicines
UNION ALL
SELECT 
    'High Value Prescriptions: ' || COUNT(*) 
FROM prescriptions 
WHERE is_high_value = true;")

备份文件:
$(ls -la "$BACKUP_DIR")

状态: 迁移成功完成 ✅
EOF

    log "✅ 迁移报告已生成: $report_file"
}

# 主执行流程
main() {
    log "=== 开始数据库迁移处理 ==="
    log "目标: 将系统从Order为中心重构为Prescription为中心"
    
    # 确认执行
    echo -e "${YELLOW}警告: 即将执行数据库迁移，这将修改现有数据结构${NC}"
    echo -e "${YELLOW}请确保已经停止应用服务并做好完整备份${NC}"
    read -p "确认继续? (yes/no): " -r
    
    if [[ ! $REPLY =~ ^yes$ ]]; then
        error "用户取消迁移"
    fi
    
    # 执行步骤
    check_dependencies
    create_backup_dir
    test_connection
    verify_current_state
    create_full_backup
    create_table_backups
    pre_migration_check
    execute_migration
    verify_migration
    generate_report
    
    log "=== 数据库迁移完成 ==="
    log "备份位置: $BACKUP_DIR"
    log "日志文件: $LOG_FILE"
    
    echo -e "${GREEN}✅ 迁移成功完成！请验证应用功能后再启动服务。${NC}"
}

# 错误处理
trap 'error "脚本执行过程中发生错误，行号: $LINENO"' ERR

# 参数检查
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "用法: $0"
    echo "环境变量:"
    echo "  DB_HOST     - 数据库主机 (默认: localhost)"
    echo "  DB_PORT     - 数据库端口 (默认: 5432)" 
    echo "  DB_NAME     - 数据库名称 (必需)"
    echo "  DB_USER     - 数据库用户 (必需)"
    echo ""
    echo "示例:"
    echo "  DB_NAME=mydb DB_USER=myuser $0"
    exit 0
fi

# 检查必需的环境变量
if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    error "请设置 DB_NAME 和 DB_USER 环境变量"
fi

# 执行主流程
main "$@"