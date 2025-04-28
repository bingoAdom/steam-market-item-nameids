const fs = require('fs');

// 读取并清理names.json文件中的重复数据
async function cleanDuplicateNames() {
    try {
        // 读取现有文件
        console.log('正在读取names.json文件...');
        const namesData = fs.readFileSync('names.json', 'utf-8');
        const names = JSON.parse(namesData);
        
        console.log(`原始数据包含 ${names.length} 个条目`);
        
        // 使用Set去除重复项
        const uniqueNamesSet = new Set(names);
        const uniqueNames = Array.from(uniqueNamesSet);
        
        console.log(`去除重复后剩余 ${uniqueNames.length} 个条目`);
        console.log(`已删除 ${names.length - uniqueNames.length} 个重复项`);
        
        // 将去重后的数据写回文件
        fs.writeFileSync('names.json', JSON.stringify(uniqueNames, null, 2));
        
        console.log('已成功保存去重后的数据到names.json');
    } catch (err) {
        console.error('处理过程中发生错误:', err);
    }
}

// 执行清理
cleanDuplicateNames();
