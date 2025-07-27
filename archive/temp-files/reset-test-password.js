const bcrypt = require('bcrypt');

async function generatePasswordUpdate() {
  const emailToUpdate = 'test@example.com';
  const newPassword = 'password123';
  const saltRounds = 10;

  try {
    console.log(`为密码 "${newPassword}" 生成哈希值...`);
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    console.log('哈希值生成成功!');
    
    console.log('\n请使用以下 SQL 语句更新数据库:');
    console.log('---------------------------------');
    const sqlStatement = `UPDATE users SET password = '${hashedPassword}' WHERE email = '${emailToUpdate}';`;
    console.log(sqlStatement);
    console.log('---------------------------------');

  } catch (error) {
    console.error('生成哈希或SQL语句时出错:', error);
  }
}

generatePasswordUpdate(); 