// 本地存储：设置项 + 识别历史
const HISTORY_KEY = 'ocr_history';
const SETTINGS_KEY = 'ocr_settings';
const HISTORY_LIMIT = 200;

function getSettings() {
  return wx.getStorageSync(SETTINGS_KEY) || {};
}

function saveSettings(patch) {
  const next = Object.assign({}, getSettings(), patch || {});
  wx.setStorageSync(SETTINGS_KEY, next);
  return next;
}

function getHistory() {
  return wx.getStorageSync(HISTORY_KEY) || [];
}

function addHistory(record) {
  const list = getHistory().filter((item) => !(
    item.idNumber && record.idNumber && item.idNumber === record.idNumber
    && item.name === record.name
  ));
  list.unshift(Object.assign({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: Date.now(),
  }, record));
  const trimmed = list.slice(0, HISTORY_LIMIT);
  wx.setStorageSync(HISTORY_KEY, trimmed);
  return trimmed;
}

function removeHistory(id) {
  const list = getHistory().filter((item) => item.id !== id);
  wx.setStorageSync(HISTORY_KEY, list);
  return list;
}

function clearHistory() {
  wx.setStorageSync(HISTORY_KEY, []);
  return [];
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

module.exports = {
  getSettings,
  saveSettings,
  getHistory,
  addHistory,
  removeHistory,
  clearHistory,
  formatTime,
};
