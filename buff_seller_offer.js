/**
 * BUFF平台卖家发起报价 - JavaScript实现
 * 基于Steamauto项目的分析，实现卖家手动发起Steam报价功能
 * 
 * 功能包括：
 * 1. Steam Cookie处理（从Steam网站获取的格式化cookies）
 * 2. RSA+AES混合加密
 * 3. 发起Steam报价API调用
 * 
 * 使用方法：
 * const buffOffer = new BuffSellerOffer(buffCookie);
 * const result = await buffOffer.sendOffer(orderId, steamCookies);
 */

const crypto = require('crypto');

// 导入fetch (Node.js 18+ 内置，但为了兼容性添加polyfill)
let fetch;
if (typeof globalThis.fetch === 'undefined') {
    fetch = require('node-fetch');
} else {
    fetch = globalThis.fetch;
}

class BuffSellerOffer {
    /**
     * 构造函数
     * @param {string} buffCookie - BUFF平台的认证Cookie
     */
    constructor(buffCookie) {
        this.buffCookie = buffCookie;
        
        // BUFF平台的RSA公钥 (Base64编码)
        this.publicKey = `MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEArF75iD8PXTT+B5nAnnhw
qxg9I48t9uED7r6GuRcPYUZ0Ye3Vdvs71CVjuELyxALtj5cN+Pe1DwDSUAH1TF+9
dS7769gcJaMMdgEB6vyssm9fnPKB4KXqbUHdMT1MF2tylemDlqfsfpkV91wtAhHf
SkNtsQcPw4Juhn0IK+2xyvlm6HtXqFOkhial5T+miGBJk3snHfLPmQFsg/3EuHFM
tBzoLX29C46SNv/W33dwOk3mgIP1SMy4TLmm8CuyNiCuHPum53Q3RXSGrpR2nJps
4ICIWb0P3VZmPhCrDK1iWwwtVGj9jDkCT2zh+B18j26vfTkBDdac5s4sw739uAha
bH56BQflowPICHVWtptCEnORewxo/FDhFUtn4sjiQswgnTHJ6F/q0vwegRRsx0AT
f3SvpksR6dZuUqHzISthooQ/68PrJ8VaKfT17u43pif08/bFkZAkYdLev4Mk0SlZ
YOqpRoif+7Pi0yObTZ0bgpCwDb1kgAmqCHi9pFPS/LUMVqSqMa4maxAX2A8a/cbl
CJbjBHLn0zrZn3YW4hKlaVvGFG/Mmag+ALV5xII0y6JSoqdxlxpyhEmbOi/GCFMw
0Mn6lyvYDCvYVwS7UqLMw7NU3WXhbNUh8DgBSb5jo4yY9E42d24JiumZulzkSdgy
OSkVea8JGUUD8PliMtRJOQkCAwEAAQ==`;
    }

    /**
     * 从buffCookie中获取CSRF Token
     * @returns {string} CSRF Token
     */
    getCsrfToken() {
        try {
            console.log('从buffCookie中提取CSRF Token...');
            
            // 从buffCookie中查找csrf_token
            const csrfMatch = this.buffCookie.match(/csrf_token=([^;]+)/);
            if (csrfMatch && csrfMatch[1]) {
                const token = csrfMatch[1];
                console.log('提取的CSRF Token:', token);
                return token;
            }
            
            console.log('未在buffCookie中找到CSRF Token');
            return null;
        } catch (error) {
            console.error('提取CSRF Token失败:', error.message);
            return null;
        }
    }

    /**
     * 验证Steam Cookie有效性
     * @param {string} steamCookies - Steam Cookie字符串
     * @returns {boolean} 是否有效
     */
    validateSteamCookies(steamCookies) {
        // 检查是否包含关键的steamLoginSecure
        if (!steamCookies.includes('steamLoginSecure=')) {
            console.error('缺少steamLoginSecure Cookie');
            return false;
        }

        // 检查steamLoginSecure格式
        const steamLoginSecureMatch = steamCookies.match(/steamLoginSecure=([^;]+)/);
        if (!steamLoginSecureMatch) {
            console.error('steamLoginSecure格式错误');
            return false;
        }

        const steamLoginSecure = steamLoginSecureMatch[1];
        if (!steamLoginSecure.includes('%7C%7C')) {
            console.error('steamLoginSecure格式错误，缺少分隔符');
            return false;
        }

        return true;
    }

    /**
     * RSA+AES混合加密 (基于Python实现)
     * @param {string} content - 要加密的内容
     * @returns {string} Base64编码的加密数据
     */
    encrypt(content) {
        try {
            console.log('开始RSA+AES混合加密...');
            
            // 1. 生成随机AES密钥和IV (使用16字节，与Python一致)
            const aesKey = crypto.randomBytes(16);
            const iv = crypto.randomBytes(16);
            console.log('AES密钥长度:', aesKey.length, 'IV长度:', iv.length);

            // 2. 加载RSA公钥 (使用DER格式，与Python一致)
            const publicKeyBuffer = Buffer.from(this.publicKey, 'base64');
            const publicKey = crypto.createPublicKey({
                key: publicKeyBuffer,
                format: 'der',
                type: 'spki'
            });
            console.log('RSA公钥加载成功');

            // 3. 使用RSA加密AES密钥 (PKCS1_v1_5填充)
            const encryptedAesKey = crypto.publicEncrypt(
                {
                    key: publicKey,
                    padding: crypto.constants.RSA_PKCS1_PADDING
                },
                aesKey
            );
            console.log('RSA加密AES密钥长度:', encryptedAesKey.length);

            // 4. 使用AES加密内容 (AES-128-CBC，与Python一致)
            const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);
            cipher.setAutoPadding(true);
            let encryptedContent = cipher.update(content, 'utf8', 'binary');
            encryptedContent += cipher.final('binary');
            console.log('AES加密内容长度:', Buffer.from(encryptedContent, 'binary').length);

            // 5. 拼接加密数据: RSA加密的AES密钥 + IV + AES加密的内容
            const encryptedData = Buffer.concat([
                encryptedAesKey,
                iv,
                Buffer.from(encryptedContent, 'binary')
            ]);
            console.log('总加密数据长度:', encryptedData.length);

            // 6. Base64编码
            const result = encryptedData.toString('base64');
            console.log('Base64编码结果长度:', result.length,result);
            
            return result;
            
        } catch (error) {
            console.error('RSA+AES加密失败:', error.message);
            throw new Error(`加密失败: ${error.message}`);
        }
    }

    /**
     * 获取加密后的卖家信息
     * @param {string} steamCookies - Steam Cookie字符串
     * @returns {string} 加密后的卖家信息
     */
    getSellerInfo(steamCookies) {
        // 验证Steam Cookie
        if (!this.validateSteamCookies(steamCookies)) {
            throw new Error('Steam Cookie无效或已过期');
        }

        // 使用RSA+AES加密Steam Cookie
        const encryptedSteamCookies = this.encrypt(steamCookies);
        return encryptedSteamCookies;
    }

    /**
     * 发起Steam报价
     * @param {string} orderId - 订单ID
     * @param {string} steamCookies - Steam Cookie字符串
     * @returns {Promise<Object>} API响应结果
     */
    async sendSteamOffer(orderId, steamCookies) {
        try {
            // 获取CSRF Token
            const csrfToken = this.getCsrfToken();
            if (!csrfToken) {
                throw new Error('无法获取CSRF Token');
            }

            // 获取加密后的卖家信息
            const sellerInfo = this.getSellerInfo(steamCookies);

            // 构造请求数据
            const postData = {
                seller_info: sellerInfo,
                bill_orders: [orderId],
                steamid:'76561199502763263',
            };

            // 设置请求头
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
                'X-CSRFToken': csrfToken,
                'X-Requested-With': 'XMLHttpRequest',
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Referer': 'https://buff.163.com/market/sell_order/create?game=csgo&steamid=76561199502763263',
                'Cookie': this.buffCookie
            };

            // 发送请求
            console.log('发送API请求...');
            console.log('请求URL:', 'https://buff.163.com/api/market/manual_plus/seller_send_offer');
            console.log('请求头:', JSON.stringify(headers, null, 2));
            console.log('请求数据:', JSON.stringify(postData, null, 2));
            
            const response = await fetch('https://buff.163.com/api/market/manual_plus/seller_send_offer', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(postData)
            });

            console.log('响应状态码:', response.status);
            console.log('响应头:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

            const result = await response.json();
            console.log('API响应结果:', JSON.stringify(result, null, 2));
            
            return result;
        } catch (error) {
            console.error('发起Steam报价失败:', error.message);
            throw new Error(`发起Steam报价失败: ${error.message}`);
        }
    }

    /**
     * 查询订单状态
     * @param {string} orderId - 订单ID
     * @returns {Promise<Object>} 订单状态信息
     */
    async getOrderStatus(orderId) {
        try {
            const csrfToken = this.getCsrfToken();
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
                'X-CSRFToken': csrfToken,
                'Referer': 'https://buff.163.com/market/sell_order/create?game=csgo',
                'Cookie': this.buffCookie
            };

            const response = await fetch(
                `https://buff.163.com/api/market/bill_order/batch/info?bill_orders=${orderId}`,
                { 
                    method: 'GET',
                    headers: headers
                }
            );

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('查询订单状态失败:', error.message);
            throw new Error(`查询订单状态失败: ${error.message}`);
        }
    }

    /**
     * 完整的卖家发起报价流程
     * @param {string} orderId - 订单ID
     * @param {string} steamCookies - Steam Cookie字符串
     * @returns {Promise<Object>} 完整流程结果
     */
    async sendOffer(orderId, steamCookies) {
        try {
            console.log(`开始为订单 ${orderId} 发起Steam报价...`);

            // 1. 发起Steam报价
            const offerResult = await this.sendSteamOffer(orderId, steamCookies);
            
            if (offerResult.code === 'OK') {
                console.log('Steam报价发起成功');
                
                // 2. 查询订单状态
                const statusResult = await this.getOrderStatus(orderId);
                
                if (statusResult.code === 'OK' && 
                    statusResult.data.items && 
                    statusResult.data.items.length > 0 &&
                    statusResult.data.items[0].tradeofferid) {
                    
                    const steamTradeOfferId = statusResult.data.items[0].tradeofferid;
                    console.log(`Steam交易报价ID: ${steamTradeOfferId}`);
                    
                    return {
                        success: true,
                        orderId: orderId,
                        steamTradeOfferId: steamTradeOfferId,
                        message: 'Steam报价发起成功'
                    };
                } else {
                    return {
                        success: true,
                        orderId: orderId,
                        message: 'Steam报价已发起，等待BUFF处理'
                    };
                }
            } else {
                throw new Error(`API返回错误: ${offerResult.msg || '未知错误'}`);
            }
        } catch (error) {
            console.error(`订单 ${orderId} 发起报价失败:`, error.message);
            return {
                success: false,
                orderId: orderId,
                error: error.message
            };
        }
    }
}


// 使用示例
async function example() {
    
    // BUFF Cookie (需要替换为实际的Cookie)
    const buffCookie = 'Device-Id=J2RIEoaJAQot7YGwdspm; P_INFO=18707077373|1756692905|1|netease_buff|00&99|null&null&null#jix&360700#10#0|&0|null|18707077373; remember_me=U1103048872|v4ssGAj7ujvnKRW2kl7DruC8DDxajcIy; shop_last_check_date=20250901; session=1-1BOmnhenpXc6B3hiK2rJQGVDG69PoW8BHLRvtaqbzY5K2037493744; Locale-Supported=zh-Hans; game=csgo; csrf_token=ImExOWRlZjZiMWUyNmIyMmJjOGYyYjIwNWM4NGFjMWZkMmZhNjI3ZGMi.aLVbcg.-sApbuRoHA20vcCW_yUqH_KC9dk';
    
    // Steam Cookie字符串 (从Steam网站获取的格式化cookies)
    const steamCookies = 'steamLoginSecure=76561199502763263%7C%7CeyAidHlwIjogIkpXVCIsICJhbGciOiAiRWREU0EiIH0.eyAiaXNzIjogInI6MDAxN18yNkQ3RDkzMl9FREUyQSIsICJzdWIiOiAiNzY1NjExOTk1MDI3NjMyNjMiLCAiYXVkIjogWyAid2ViOmNvbW11bml0eSIgXSwgImV4cCI6IDE3NTY3ODU3ODYsICJuYmYiOiAxNzQ4MDU4MDc4LCAiaWF0IjogMTc1NjY5ODA3OCwgImp0aSI6ICIwMDBCXzI2RDdEOTM1XzRFMjY2IiwgIm9hdCI6IDE3NTY2OTgwNzcsICJydF9leHAiOiAxNzc1MjAzODU1LCAicGVyIjogMCwgImlwX3N1YmplY3QiOiAiMTU2LjIyOS4xNjcuMTcxIiwgImlwX2NvbmZpcm1lciI6ICIxNTYuMjI5LjE2Ny4xNzEiIH0.9vfEBluV1EdwZw59nsO-8wLOAoff-viBLrytJmCkQki0uvJqUGy-EnD5P8tQcynDjmqy4l1ygJSQyGIl2nKWBQ; browserid=46845232153325394; timezoneOffset=28800,0; strInventoryLastContext=730_2; sessionid=764b0d66a344a201b30fcc71';
    
    // 创建实例
    const buffOffer = new BuffSellerOffer(buffCookie);
    
    // 发起报价
    const orderId = '250901T3544557626';
    const result = await buffOffer.sendOffer(orderId, steamCookies);
    
    console.log('报价结果:', result);
}

// 导出类
module.exports = BuffSellerOffer;

// 如果直接运行此文件，执行示例
if (require.main === module) {
    example().catch(console.error);
} 