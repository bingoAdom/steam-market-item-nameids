const fs = require('fs');

/**
 * 清理ids.json文件中的重复和无效数据，并按名称排序
 */
async function cleanIdsJson() {
    try {
        // 读取现有文件
        console.log('正在读取ids.json文件...');
        const idsData = fs.readFileSync('ids.json', 'utf-8');
        let ids = JSON.parse(idsData);
        
        console.log(`原始数据包含 ${Object.keys(ids).length} 个条目`);
        
        // 统计信息
        let invalidValues = 0;
        let duplicatedNames = 0;
        const uniqueIds = {};
        
        // 检查每个条目
        for (const [name, id] of Object.entries(ids)) {
            // 检查ID是否有效
            if (id === null || id === undefined || isNaN(id) || id === 0) {
                console.log(`发现无效ID: ${name} -> ${id}`);
                invalidValues++;
                continue;
            }
            
            // 检查是否已存在相同名称的条目（实际上对象键是唯一的，但以防万一）
            if (uniqueIds[name] !== undefined && uniqueIds[name] !== id) {
                console.log(`发现重复名称但ID不同: ${name} -> ${uniqueIds[name]} vs ${id}`);
                duplicatedNames++;
                // 保留较新的ID（假设较新的更准确）
                uniqueIds[name] = id;
            } else {
                uniqueIds[name] = id;
            }
        }
        
        // 按名称排序
        console.log('正在对数据按物品名称排序...');
        const sortedNames = Object.keys(uniqueIds).sort();
        const sortedIds = {};
        
        // 创建排序后的对象
        sortedNames.forEach(name => {
            sortedIds[name] = uniqueIds[name];
        });
        
        // 格式化输出
        console.log(`清理完成:`);
        console.log(`- 移除了 ${invalidValues} 个无效ID`);
        console.log(`- 处理了 ${duplicatedNames} 个重复名称`);
        console.log(`- 最终保留 ${Object.keys(sortedIds).length} 个有效条目`);
        console.log(`- 所有条目已按名称字母顺序排序`);
        
        // 将整理后的数据写回文件
        fs.writeFileSync('ids.json', JSON.stringify(sortedIds, null, 2));
        console.log('已成功保存整理后的数据到ids.json');
        
        // 验证保存是否成功
        const verifyData = JSON.parse(fs.readFileSync('ids.json', 'utf-8'));
        console.log(`验证: ids.json现在包含 ${Object.keys(verifyData).length} 个条目`);
        
    } catch (err) {
        console.error('处理过程中发生错误:', err);
    }
}

// 执行清理
cleanIdsJson();
