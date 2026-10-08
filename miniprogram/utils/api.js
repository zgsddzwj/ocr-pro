// 与本地识别服务/平台后端通信
const config = require('../config');
const store = require('./store');

const TOKEN_KEY = 'ocr_pro_token';

function serverBase() {
  const settings = store.getSettings();
  const base = settings.serverBase || config.serverBase || '';
  return base.replace(/\/+$/, '');
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || '';
}

function setToken(token) {
  if (token) wx.setStorageSync(TOKEN_KEY, token);
  else wx.removeStorageSync(TOKEN_KEY);
}

/** 统一请求：自动带登录态；401 时清 token 并标记 needLogin */
function request(path, { method = 'GET', data, auth = true } = {}) {
  return new Promise((resolve, reject) => {
    const header = {
      'content-type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    const token = getToken();
    if (auth && token) header.Authorization = `Bearer ${token}`;
    wx.request({
      url: `${serverBase()}${path}`,
      method,
      data,
      header,
      timeout: config.requestTimeout,
      success: (response) => {
        const body = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(body);
          return;
        }
        if (response.statusCode === 401 && auth) {
          setToken('');
          const error = new Error(body.detail || '请先登录平台');
          error.needLogin = true;
          reject(error);
          return;
        }
        reject(new Error(body.detail || body.error || `请求失败（HTTP ${response.statusCode}）`));
      },
      fail: () => reject(new Error('连接平台失败，请检查服务地址与网络')),
    });
  });
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

/** 识别身份证人像面（免登录，与小程序契约一致） */
async function recognizeIdCard(filePath) {
  const base64 = await readBase64(filePath);
  return request('/api/ocr/idcard', { method: 'POST', data: { imageBase64: base64, mime: 'image/jpeg' }, auth: false });
}

/** 提交农户信息到平台（免登录，按身份证号幂等） */
function submitFarmer(farmer) {
  return request('/api/farmers/submit', {
    method: 'POST',
    data: {
      name: farmer.name || '',
      idNumber: farmer.idNumber || '',
      address: farmer.address || '',
      phone: farmer.phone || '',
    },
    auth: false,
  });
}

/** 检查识别服务连通性（失败时带上实际请求地址与底层原因，便于排障） */
function checkHealth() {
  const url = `${serverBase()}/api/health`;
  return new Promise((resolve) => {
    wx.request({
      url,
      method: 'GET',
      header: { 'ngrok-skip-browser-warning': 'true' },
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

// ---------- 平台账号 ----------
function authStatus() {
  return request('/api/auth/status', { auth: false });
}

function login(password) {
  return request('/api/auth/login', { method: 'POST', data: { password }, auth: false });
}

function setupPassword(password) {
  return request('/api/auth/setup', { method: 'POST', data: { password }, auth: false });
}

// ---------- 平台数据 ----------
function getStats() {
  return request('/api/stats/summary');
}

function getRecords(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return request(`/api/records?${query}`);
}

function getRecord(id) {
  return request(`/api/records/${id}`);
}

function createRecord(data) {
  return request('/api/records', { method: 'POST', data });
}

function confirmRecord(id) {
  return request(`/api/records/${id}/confirm`, { method: 'POST' });
}

function voidRecord(id) {
  return request(`/api/records/${id}/void`, { method: 'POST' });
}

function deleteRecord(id) {
  return request(`/api/records/${id}`, { method: 'DELETE' });
}

function searchFarmers(q, pageSize = 8) {
  return request(`/api/farmers?q=${encodeURIComponent(q || '')}&page_size=${pageSize}`);
}

function getSettings() {
  return request('/api/settings');
}

module.exports = {
  serverBase,
  getToken,
  setToken,
  recognizeIdCard,
  submitFarmer,
  checkHealth,
  authStatus,
  login,
  setupPassword,
  getStats,
  getRecords,
  getRecord,
  createRecord,
  confirmRecord,
  voidRecord,
  deleteRecord,
  searchFarmers,
  getSettings,
};
