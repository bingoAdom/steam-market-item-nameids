const axios = require('axios');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

// 尝试读取配置文件
let steamCookies = '';
try {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
    steamCookies = config.cookies || '';
} catch (err) {
    console.log('未找到配置文件或配置无效，继续执行但可能无法获取完整数据');
}

// 原始正则表达式保持不变
const regex = /Market_LoadOrderSpread\(\s*(\d+)\s*\)/;
// 添加备用正则表达式
const backupRegex = /ItemActivityTicker\.Start\(\s*(\d+)\s*\)/;

try {
    names = JSON.parse(fs.readFileSync('names.json', 'utf-8'));
    known = JSON.parse(fs.readFileSync('ids.json', 'utf-8'));
    console.log(`已加载 ${names.length} 个物品名称和 ${Object.keys(known).length} 个已知ID`);
}
catch (err) {
    console.log(err);
    if (!names) names = [];
    if (!known) known = {};
}
ids = {};

// 延迟函数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 保存进度函数
const saveProgress = () => {
    const combinedIds = { ...known, ...ids };
    fs.writeFileSync("ids.json", JSON.stringify(combinedIds));
    console.log(`进度已保存：共 ${Object.keys(combinedIds).length} 个物品ID`)
};

// 尝试从页面内容中提取ID的函数
function extractItemId(content) {
    // 尝试主要正则表达式
    const match = content.match(regex);
    if (match && match[1]) {
        return parseInt(match[1]);
    }
    
    // 尝试备用正则表达式
    const backupMatch = content.match(backupRegex);
    if (backupMatch && backupMatch[1]) {
        return parseInt(backupMatch[1]);
    }
    
    // 再尝试一个通用的ID匹配模式
    const generalMatch = content.match(/item_nameid['":\s]*(\d+)/i);
    if (generalMatch && generalMatch[1]) {
        return parseInt(generalMatch[1]);
    }
    
    throw new Error("在页面中未找到物品ID");
}

async function get_ids() {
    // 配置代理
    const proxy = 'http://127.0.0.1:7890';
    const agent = new HttpsProxyAgent(proxy);
    
    // 配置参数
    const delayTime = 2000; // 延迟时间（毫秒）
    const saveInterval = 10; // 减少保存间隔
    let processedCount = 0;
    let newIdsCount = 0;
    let failedItems = [];

    console.log(`开始处理总计 ${names.length} 个物品...`);
    console.log(`Steam登录状态: ${steamCookies ? '已配置cookies' : '未登录'}`);

    for (const name of names) {
        if (known[name] != undefined) {
            ids[name] = known[name]
            continue
        }
        
        try {
            processedCount++;
            
            let url = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(name)}`;
            console.log(`正在获取: ${name}`);
            
            let page = await axios.get(url, { 
                responseType: 'document',
                httpsAgent: agent,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Cookie': steamCookies // 添加cookies
                }
            });
            
            // 尝试提取ID
            try {
                let id = extractItemId(page.data);
                console.log(`成功获取 ${name}: ${id}`);
                ids[name] = id;
                newIdsCount++;
            } catch (extractErr) {
                console.log(`无法从页面提取ID: ${extractErr.message}`);
                
                // 保存第一个失败的页面以供分析
                if (failedItems.length === 0) {
                    const safeFilename = name.replace(/[^a-zA-Z0-9]/g, '_');
                    fs.writeFileSync(`failed_page_${safeFilename}.html`, page.data);
                    console.log(`已保存问题页面到: failed_page_${safeFilename}.html`);
                }
                
                failedItems.push(name);
                continue; // 跳过此物品，继续下一个
            }
            
            // 定期保存进度
            if (newIdsCount % saveInterval === 0) {
                saveProgress();
            }
            
            // 添加请求延迟
            console.log(`等待 ${delayTime/1000} 秒后继续...`);
            await delay(delayTime);
            
        }
        catch (err) {
            console.log(`处理 "${name}" 时出错: ${err.message}`);
            failedItems.push(name);
            
            if (err.response && err.response.status === 429) {
                console.log('请求过于频繁，Steam限制了访问，等待30秒...');
                await delay(30000);
                continue; // 重试当前物品
            }
            
            console.log('保存当前进度并继续下一个物品');
            await delay(10000); // 出错后等待时间更长
        }
    }
    
    // 保存失败的物品列表
    if (failedItems.length > 0) {
        fs.writeFileSync("failed_items.json", JSON.stringify(failedItems));
        console.log(`有 ${failedItems.length} 个物品处理失败，已保存到failed_items.json`);
    }
    
    console.log(`处理完成! 共处理 ${processedCount} 个物品，新增 ${newIdsCount} 个ID`);
    saveProgress();
}

get_ids().then(() => {
    // 合并并保存所有ID
    const combinedIds = { ...known, ...ids };
    fs.writeFile("ids.json", JSON.stringify(combinedIds), function (err) {
        if (err) {
            console.log(err)
        } else {
            console.log(`全部完成! 成功保存 ${Object.keys(combinedIds).length} 个物品ID`)
        }
    })
}).catch(err => {
    console.log('程序执行过程中发生错误:', err);
});