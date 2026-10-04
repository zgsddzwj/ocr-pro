// 与本地识别服务通信
const config = require('../config');
const store = require('./store');

function serverBase() {
  const settings = store.getSettings();
  const base = settings.serverBase || config.serverBase || '';
  return base.replace(/\/+$/, '');
}

function readBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: () => reject(new Error('读取图片失败，请重试')),
    });
  });
}

function post(base64, mime) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${serverBase()}/api/ocr/idcard`,
      method: 'POST',
      timeout: config.requestTimeout,
      header: { 'content-type': 'application/json' },
      data: { imageBase64: base64, mime: mime || 'image/jpeg' },
      success: (response) => {
        const body = response.data || {};
        if (response.statusCode === 200 && body.ok) {
          resolve(body);
          return;
        }
        reject(new Error(body.error || `识别服务返回异常（HTTP ${response.statusCode}）`));
      },
      fail: (error) => {
        reject(new Error(`连接识别服务失败，请确认电脑上的服务已启动、设置里的地址正确`));
      },
    });
  });
}

/**
 * 识别身份证人像面
 * @param {string} filePath 本地图片路径
 * @returns {Promise<{name:string,idNumber:string,address:string,warnings:string[],rows:string[],provider:string,elapsedMs:number}>}
 */
async function recognizeIdCard(filePath) {
  const base64 = await readBase64(filePath);
  return post(base64, 'image/jpeg');
}

/**
 * 提交农户信息到平台（按身份证号幂等：已存在则更新）
 * @returns {Promise<{ok:boolean,created:boolean,farmer:{id:string,name:string}}>}
 */
function submitFarmer(farmer) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${serverBase()}/api/farmers/submit`,
      method: 'POST',
      timeout: config.requestTimeout,
      header: { 'content-type': 'application/json' },
      data: {
        name: farmer.name || '',
        idNumber: farmer.idNumber || '',
        address: farmer.address || '',
        phone: farmer.phone || '',
      },
      success: (response) => {
        const body = response.data || {};
        if (response.statusCode === 200 && body.ok) {
          resolve(body);
          return;
        }
        reject(new Error(body.detail || body.error || `提交失败（HTTP ${response.statusCode}）`));
      },
      fail: () => reject(new Error('连接平台失败，请确认电脑上的服务已启动、设置里的地址正确')),
    });
  });
}

/**
 * 检查识别服务连通性（失败时带上实际请求地址与底层原因，便于排障）
 * @returns {Promise<{ok:boolean,url:string,provider?:string,model?:string,error?:string,detail?:string}>}
 */
function checkHealth() {
  const url = `${serverBase()}/api/health`;
  return new Promise((resolve) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 8000,
      success: (response) => {
        const body = response.data || {};
        if (response.statusCode === 200 && body.ok) {
          resolve({ ok: true, url, provider: body.provider, model: body.model });
          return;
        }
        resolve({ ok: false, url, error: `服务返回异常（HTTP ${response.statusCode}）` });
      },
      fail: (error) => {
        resolve({ ok: false, url, error: '无法连接', detail: error.errMsg || '' });
      },
    });
  });
}

module.exports = { recognizeIdCard, submitFarmer, checkHealth, serverBase };
