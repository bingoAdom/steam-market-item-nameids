const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

//steam store app id, 730 for CS2
const game_id = 730

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 尝试读取已有数据
let names = [];
try {
    names = JSON.parse(fs.readFileSync('names.json', 'utf-8'));
    console.log(`已加载 ${names.length} 个物品名称`);
}
catch (err) {
    console.log('JSON error. 创建新的空数据数组.');
    names = [];
}

// 保存进度函数
const saveProgress = () => {
    const uniqueNames = [...new Set(names)]; // 移除重复
    fs.writeFileSync("names.json", JSON.stringify(uniqueNames));
    console.log(`进度已保存：共 ${uniqueNames.length} 个物品名称`);
};

async function get_names() {
    // 配置代理
    const proxy = 'http://127.0.0.1:7890';
    const agent = new HttpsProxyAgent(proxy);
    
    // 配置参数
    const delayTime = 8000; // 8秒延迟（避免API限制）
    const saveInterval = 5; // 每获取5页保存一次
    let initialPage = 0; // 起始页码
    let fetchCount = 0; // 获取次数计数
    let newItemsCount = 0; // 新增物品计数
    
    console.log('正在获取物品总数...');
    
    // 获取总物品数
    try {
        const response = await axios.get(`https://steamcommunity.com/market/search/render/?norender=1&appid=${game_id}&sort_column=name`, {
            httpsAgent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (response.data && response.data.total_count) {
            const total_names_count = response.data.total_count;
            console.log(`检测到总共有 ${total_names_count} 个物品`);
            
            // 检查已有数据，确定起始页
            if (names.length > 0) {
                initialPage = Math.floor(names.length / 10);
                console.log(`已有${names.length}个物品记录，从第${initialPage}页继续获取`);
            }
            
            // 分页获取物品
            const totalPages = Math.ceil(total_names_count / 10);
            
            for (let i = 0; i < totalPages; i++) {
                try {
                    console.log(`获取第 ${i+1}/${totalPages} 页物品数据...`);
                    
                    let response = await axios.get(`https://steamcommunity.com/market/search/render/?norender=1&query=&start=${10 * i}&count=10&search_descriptions=0&sort_column=name&sort_dir=asc&appid=${game_id}`, {
                        httpsAgent: agent,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json'
                        }
                    });
                    
                    // 检查响应是否有效
                    if (!response.data || !response.data.results || response.data.results.length === 0) {
                        console.log(`第 ${i+1} 页数据为空或无效，重试...`);
                        i--; // 重试当前页
                        await delay(delayTime * 2); // 等待更长时间
                        continue;
                    }
                    
                    // 处理获取到的物品名称
                    const initialCount = names.length;
                    response.data.results.forEach(item => {
                        if (item.asset_description && item.asset_description.market_hash_name) {
                            // 避免添加重复物品
                            if (!names.includes(item.asset_description.market_hash_name)) {
                                names.push(item.asset_description.market_hash_name);
                            }
                        }
                    });
                    
                    newItemsCount += (names.length - initialCount);
                    fetchCount++;
                    
                    console.log(`第 ${i+1} 页: 获取了 ${response.data.results.length} 个物品，新增 ${names.length - initialCount} 个非重复物品`);
                    console.log(`当前共有 ${names.length} 个物品`);
                    
                    // 定期保存进度
                    if (fetchCount % saveInterval === 0) {
                        saveProgress();
                    }
                    
                    // 添加API等待时间
                    console.log(`等待 ${delayTime/1000} 秒后继续...`);
                    await delay(delayTime);
                    
                    // 每获取50页后额外休息
                    if (fetchCount % 50 === 0) {
                        console.log('批量处理完成，额外休息30秒...');
                        await delay(30000);
                    }
                    
                } catch (err) {
                    // 处理错误
                    console.log(`获取第 ${i+1} 页时出错: ${err.message}`);
                    
                    if (err.response && err.response.status === 429) {
                        console.log('请求频率过高，Steam限制了访问，等待180秒...');
                        await delay(180000);
                        i--; // 重试当前页
                        continue;
                    }
                    
                    // 保存当前进度
                    console.log(`在i = ${i}处出错，保存当前进度`);
                    saveProgress();
                    
                    // 等待较长时间后继续
                    console.log('等待30秒后继续...');
                    await delay(30000);
                    
                    // 如果是连续多次出错，可能需要退出
                    if (err.message.includes('ETIMEDOUT') || err.message.includes('ECONNRESET')) {
                        console.log('网络连接问题，尝试继续...');
                    }
                }
            }
            
            console.log(`全部页面处理完成! 总共获取了 ${newItemsCount} 个新物品`);
            
        } else {
            console.log('无法获取物品总数，响应数据无效');
        }
    } catch (err) {
        console.log(`获取物品总数时出错: ${err.message}`);
    }
    
    // 最终保存并去重
    const uniqueNames = [...new Set(names)];
    console.log(`所有处理完成! 共有 ${uniqueNames.length} 个唯一物品名称`);
    
    return uniqueNames;
}

// 主程序
get_names().then((uniqueNames) => {
    fs.writeFile("names.json", JSON.stringify(uniqueNames), function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log(`所有物品名称已保存到names.json`);
        }
    });
}).catch(err => {
    console.log('程序执行过程中发生错误:', err);
});