import { PrismaClient } from '@prisma/client';

class DuplicateCleaner {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async findDuplicates() {
    console.log('🔍 查找重复药品...');
    
    // 查找重复的中文名
    const duplicates = await this.prisma.medicine.groupBy({
      by: ['chineseName'],
      _count: {
        chineseName: true
      },
      having: {
        chineseName: {
          _count: {
            gt: 1
          }
        }
      },
      orderBy: {
        _count: {
          chineseName: 'desc'
        }
      }
    });

    console.log(`📊 发现 ${duplicates.length} 个重复的药材名称`);
    
    for (const duplicate of duplicates) {
      console.log(`   ${duplicate.chineseName}: ${duplicate._count.chineseName}条记录`);
    }

    return duplicates.map(d => d.chineseName);
  }

  async cleanDuplicates(dryRun: boolean = true) {
    const duplicateNames = await this.findDuplicates();
    
    if (duplicateNames.length === 0) {
      console.log('✅ 没有发现重复数据');
      return;
    }

    let totalDeleted = 0;
    
    for (const chineseName of duplicateNames) {
      // 查找该药材的所有记录，按创建时间排序
      const records = await this.prisma.medicine.findMany({
        where: { chineseName },
        orderBy: { createdAt: 'desc' }
      });

      if (records.length <= 1) continue;

      // 保留最新的记录，删除其他的
      const toKeep = records[0];
      const toDelete = records.slice(1);

      console.log(`\n🔄 处理 "${chineseName}": 保留1条，删除${toDelete.length}条`);
      console.log(`   保留: ${toKeep.id} (${toKeep.createdAt})`);
      
      for (const record of toDelete) {
        console.log(`   删除: ${record.id} (${record.createdAt})`);
        
        if (!dryRun) {
          try {
            await this.prisma.medicine.delete({
              where: { id: record.id }
            });
            totalDeleted++;
          } catch (error) {
            console.error(`   ❌ 删除失败: ${error.message}`);
          }
        }
      }
    }

    if (dryRun) {
      console.log(`\n🔍 预览模式: 将删除 ${duplicateNames.reduce((sum, name) => {
        const records = duplicateNames.filter(n => n === name);
        return sum + Math.max(0, records.length - 1);
      }, 0)} 条重复记录`);
      console.log('💡 使用 --execute 参数执行实际删除');
    } else {
      console.log(`\n✅ 清理完成! 删除了 ${totalDeleted} 条重复记录`);
    }
  }

  async showStats() {
    const total = await this.prisma.medicine.count();
    const uniqueNames = await this.prisma.medicine.groupBy({
      by: ['chineseName'],
      _count: {
        chineseName: true
      }
    });

    console.log(`\n📊 当前数据统计:`);
    console.log(`   总记录数: ${total}`);
    console.log(`   独特药材: ${uniqueNames.length}`);
    console.log(`   重复程度: ${total - uniqueNames.length} 条重复记录`);
  }

  async close() {
    await this.prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');
  
  console.log('🧹 药品数据重复清理工具');
  console.log('============================\n');

  const cleaner = new DuplicateCleaner();

  try {
    await cleaner.showStats();
    await cleaner.cleanDuplicates(!executeMode);
    
    if (executeMode) {
      await cleaner.showStats();
    }
  } catch (error) {
    console.error('❌ 清理过程中出错:', error);
  } finally {
    await cleaner.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
} 