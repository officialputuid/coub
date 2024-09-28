const fs = require('fs').promises;
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');
const path = require('path');
const qs = require('qs');
const { DateTime } = require('luxon');

class Coub {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://coub.com",
            "Referer": "https://coub.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
            "sec-ch-ua": '"Not)A;Brand";v="99", "Google Chrome";v="127", "Chromium";v="127"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site"
        };
        this.tokenFile = path.join(__dirname, 'token.json');
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i > 0; i--) {
            const timestamp = new Date().toLocaleTimeString();
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[${timestamp}] [*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    }

    async makeRequest(method, url, headers, data = null) {
        let retryCount = 0;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const config = { headers, method };
                if (method.toUpperCase() === 'GET' && data) {
                    config.params = data;
                } else if (method.toUpperCase() === 'POST') {
                    config.data = data;
                }
                const response = await axios(url, config);
                if (response.status >= 200 && response.status < 300) {
                    return response.data;
                } else if (response.status >= 500) {
                    if (retryCount >= 3) {
                        this.log(`Status Code : ${response.status} | Server Down`, 'error');
                        return null;
                    }
                    retryCount++;
                } else {
                    this.log(`Status Code : ${response.status}`, 'warning');
                    break;
                }
            } catch (error) {
                console.log(error);
                this.log(`Error: ${error.message}`, 'error');
                if (retryCount >= 3) return null;
                retryCount++;
            }
        }
    }

    async getRewards(token, xTgAuth) {
        const headers = { 
            ...this.headers, 
            authorization: `Bearer ${token}`,
            "x-tg-authorization": xTgAuth
        };
        const url = "https://rewards.coub.com/api/v2/get_user_rewards";
        try {
            return await this.makeRequest('GET', url, headers);
        } catch (error) {
            this.log(`Không thể đọc được phần thưởng. Error: ${error.message}`, 'error');
            return null;
        }
    }

    async claimTask(token, xTgAuth, taskId, taskTitle) {
        const headers = { 
            ...this.headers, 
            authorization: `Bearer ${token}`,
            "x-tg-authorization": xTgAuth
        };
        const url = "https://rewards.coub.com/api/v2/complete_task";
        const params = { task_reward_id: taskId };
        try {
            const response = await this.makeRequest('GET', url, headers, params);
            if (response) {
                this.log(`Nhiệm vụ ${taskTitle} Hoàn thành`, 'success');
                return response;
            } else {
                this.log(`Nhiệm vụ ${taskTitle} Thất bại`, 'warning');
                return null;
            }
        } catch (error) {
            this.log(`Nhiệm vụ ${taskTitle} Không thể nhận thưởng | error: ${error.message}`, 'error');
            return null;
        }
    }

    async loadTask() {
        try {
            const data = await fs.readFile('task.json', 'utf8');
            return JSON.parse(data);
        } catch (error) {
            this.log(`Không thể đọc nhiệm vụ: ${error.message}`, 'error');
            return [];
        }
    }

    parseAccountData(rawData) {
        const parsedData = qs.parse(rawData);
        const user = JSON.parse(decodeURIComponent(parsedData.user));
        return {
            user: JSON.stringify(user),
            chat_instance: parsedData.chat_instance,
            chat_type: parsedData.chat_type,
            start_param: parsedData.start_param,
            auth_date: parsedData.auth_date,
            hash: parsedData.hash
        };
    }

    async getAndSaveToken(rawAccountData, accountIndex) {
        const loginUrl = 'https://coub.com/api/v2/sessions/login_mini_app';
        const signupUrl = 'https://coub.com/api/v2/sessions/signup_mini_app';
        const parsedAccountData = this.parseAccountData(rawAccountData);
        const data = qs.stringify(parsedAccountData);

        const config = {
            headers: {
                ...this.headers
            }
        };

        let apiToken;
        try {
            const loginResponse = await axios.post(loginUrl, data, config);
            apiToken = loginResponse.data.api_token;
        } catch (error) {
            if (error.response && error.response.status === 404) {
                this.log('Đăng kí tài khoản...', 'warning');
                try {
                    const signupResponse = await axios.post(signupUrl, data, config);
                    apiToken = signupResponse.data.api_token;
                } catch (signupError) {
                    this.log(`Lỗi khi đăng kí: ${signupError.message}`, 'error');
                    throw signupError;
                }
            } else {
                this.log(`Lỗi khi login: ${error.message}`, 'error');
                throw error;
            }
        }

        if (!apiToken) {
            throw new Error('Không thể lấy được api_token');
        }

        try {
            const torusUrl = 'https://coub.com/api/v2/torus/token';
            const torusConfig = {
                headers: {
                    ...this.headers,
                    'x-auth-token': apiToken
                }
            };

            const torusResponse = await axios.post(torusUrl, null, torusConfig);
            const token = torusResponse.data.access_token;
            await this.updateTokenFile(token, accountIndex);

            return token;
        } catch (error) {
            this.log(`Lỗi khi lấy token từ torus: ${error.message}`, 'error');
            throw error;
        }
    }

    async readTokens() {
        try {
            const data = await fs.readFile(this.tokenFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.log('Không tìm thấy file token.json..tạo mới', 'info');
                return {};
            }
            this.log(`Lỗi đọc file token.json: ${error.message}`, 'error');
            return {};
        }
    }

    async updateTokenFile(token, accountIndex) {
        try {
            let tokens = await this.readTokens();
            const accountKey = `${accountIndex + 1}`;

            if (tokens[accountKey] !== token) {
                tokens[accountKey] = token;
                await fs.writeFile(this.tokenFile, JSON.stringify(tokens, null, 2));
                this.log(`Lấy token thành công cho tài khoản ${accountIndex + 1}`, 'success');
            } else {
                this.log(`Token của tài khoản ${accountIndex + 1} đã được cập nhật`, 'info');
            }
        } catch (error) {
            this.log(`Lỗi rồi: ${error.message}`, 'error');
            throw error;
        }
    }

    async readAccountData() {
        try {
            const dataFile = path.join(__dirname, 'data.txt');
            const data = await fs.readFile(dataFile, 'utf8');
            return data.split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .map(line => line.replace(/\r$/, ''));
        } catch (error) {
            throw new Error(`Không thể đọc file data.txt: ${error.message}`);
        }
    }

    isExpired(token) {
        const [header, payload, sign] = token.split('.');
        const decodedPayload = Buffer.from(payload, 'base64').toString();
        
        try {
            const parsedPayload = JSON.parse(decodedPayload);
            const now = Math.floor(DateTime.now().toSeconds());
            
            if (parsedPayload.exp) {
                const expirationDate = DateTime.fromSeconds(parsedPayload.exp).toLocal();
                this.log(colors.cyan(`Token hết hạn vào: ${expirationDate.toFormat('yyyy-MM-dd HH:mm:ss')}`));
                
                const isExpired = now > parsedPayload.exp;
                this.log(colors.cyan(`Token đã hết hạn chưa? ${isExpired ? 'Đúng rồi bạn cần thay token' : 'Chưa..chạy tẹt ga đi'}`));
                
                return isExpired;
            } else {
                this.log(colors.yellow(`Token vĩnh cửu không đọc được thời gian hết hạn`));
                return false;
            }
        } catch (error) {
            this.log(colors.red(`Lỗi rồi: ${error.message}`));
            return true;
        }
    }

    async main() {
        try {
            const accountsData = await this.readAccountData();

            if (accountsData.length === 0) {
                throw new Error('Không tìm thấy dữ liệu hợp lệ trong data.txt');
            }

            const tasks = await this.loadTask();
            let tokens = await this.readTokens();

            while (true) {
                for (let i = 0; i < accountsData.length; i++) {
                    const accountKey = `${i + 1}`;
                    let token = tokens[accountKey];
                    this.log(`========== Tài khoản ${i + 1} ==========`, 'custom');
                    
                    if (!token || this.isExpired(token)) {
                        this.log(`Token cho tài khoản ${i + 1} không tồn tại hoặc đã hết hạn. Đang lấy token mới...`, 'info');
                        try {
                            const rawAccountData = accountsData[i];
                            token = await this.getAndSaveToken(rawAccountData, i);
                            if (token) {
                                tokens = await this.readTokens();
                            } else {
                                this.log(`Lấy token thất bại cho tài khoản ${i + 1}. Chuyển tài khoản tiếp theo...`, 'error');
                                continue;
                            }
                        } catch (error) {
                            this.log(`Lấy token thất bại cho tài khoản ${i + 1}: ${error.message}`, 'error');
                            continue;
                        }
                    }

                    const parsedAccountData = this.parseAccountData(accountsData[i]);
                    const xTgAuth = qs.stringify(parsedAccountData);

                    const listId = [];
                    const dataReward = await this.getRewards(token, xTgAuth);
                    if (dataReward) {
                        dataReward.forEach(data => {
                            const id = data.id || 0;
                            listId.push(id);
                        });
                    } else {
                        this.log(`Không thể lấy phần thưởng cho tài khoản ${i + 1}`, 'warning');
                    }

                    for (const task of tasks) {
                        const id = task.id;
                        if (listId.includes(id)) {
                            this.log(`${task.title} Hoàn thành...`, 'success');
                        } else {
                            this.log(`Làm nhiệm vụ ${task.title.yellow}`, 'info');
                            await this.claimTask(token, xTgAuth, task.id, task.title);
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 5000));
                }

                const delay = 24 * 3600 + Math.floor(Math.random() * 3600);
                this.log(`Tất cả tài khoản đã được xử lý. Chờ ${Math.floor(delay / 3600)} giờ ${Math.floor((delay % 3600) / 60)} phút để chạy lại...`, 'info');
                await this.countdown(delay);
            }
        } catch (error) {
            console.log(error);
            this.log(`Lỗi rồi: ${error.message}`, 'error');
            if (error.stack) {
                this.log(`Stack trace: ${error.stack}`, 'error');
            }
        }
    }
}

const coub = new Coub();
coub.main().catch(error => coub.log(`Unhandled error: ${error.message}`, 'error'));