const api = require('../../utils/api');
const store = require('../../utils/store');
const config = require('../../config');
const icons = require('../../utils/icons');

const PROVIDER_LABEL = {
  bailian: '云端大模型识别',
  vision: '本机离线识别',
  tencent: '腾讯云 OCR',
};

Page({
  data: {
    icons,
    recognizing: false,
    previewPath: '',
    historyCount: 0,
    connected: null,
    connectionText: '正在检查识别服务…',
    showSettings: false,
    testing: false,
    testResult: '',
    testState: '',
    effectiveBase: '',
    settings: { companyTitle: '', serverBase: '' },
  },

  onLoad() {
    this.setData({ icons });
  },

  onShow() {
    const stored = store.getSettings();
    // 一次性迁移：旧版本默认地址是局域网 IP（http://192.168.x.x），会随路由器漂移导致连不上。
    // 统一清掉，回落到 config.js 里的公网隧道默认地址；手动填过 https 自定义地址的不受影响。
    if (stored.serverBase && stored.serverBase.startsWith('http://')) {
      store.saveSettings({ serverBase: '' });
      stored.serverBase = '';
    }
    this.setData({
      historyCount: store.getHistory().length,
      settings: {
        companyTitle: stored.companyTitle || config.companyTitle,
        serverBase: stored.serverBase || config.serverBase,
      },
    });
    this.checkHealth();
  },

  async checkHealth() {
    this.setData({ connected: null, connectionText: '正在检查识别服务…' });
    const result = await api.checkHealth();
    this.lastHealth = result;
    this.applyHealth(result);
  },

  /** 点击状态条：连通则重测，不通则弹出具体原因（请求了哪个地址、底层报错） */
  async onStatusTap() {
    if (this.data.connected === null) return;
    this.setData({ connected: null, connectionText: '正在检查识别服务…' });
    const result = await api.checkHealth();
    this.lastHealth = result;
    this.applyHealth(result);
    if (!result.ok) {
      const lines = [
        `请求地址：${result.url}`,
        `失败原因：${result.error}${result.detail ? `（${result.detail}）` : ''}`,
      ];
      if ((result.detail || '').indexOf('domain') >= 0) {
        lines.push('提示：这是域名校验拦截——体验版需要在手机上打开「开发调试」，开发者工具需勾选「不校验合法域名」');
      }
      wx.showModal({
        title: '连接失败',
        content: lines.join('\n'),
        confirmText: '去设置',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) this.openSettings();
        },
      });
    }
  },

  applyHealth(result) {
    if (result.ok) {
      this.setData({
        connected: true,
        connectionText: `识别服务已连接 · ${PROVIDER_LABEL[result.provider] || result.provider}`,
      });
    } else {
      this.setData({
        connected: false,
        connectionText: '识别服务未连接，点这里重试',
      });
    }
  },

  onScan() {
    this.chooseImage('camera');
  },

  onPickAlbum() {
    this.chooseImage('album');
  },

  chooseImage(sourceType) {
    if (this.data.recognizing) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [sourceType],
      sizeType: ['compressed'],
      camera: 'back',
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file) return;
        this.setData({ previewPath: file.tempFilePath });
        this.recognize(file.tempFilePath);
      },
      fail: () => {},
    });
  },

  async recognize(filePath) {
    this.setData({ recognizing: true });
    wx.showLoading({ title: '识别中…', mask: true });
    try {
      const result = await api.recognizeIdCard(filePath);
      wx.hideLoading();
      this.setData({ recognizing: false });
      getApp().globalData.current = Object.assign({ imagePath: filePath }, result);
      wx.navigateTo({ url: '/pages/result/result' });
    } catch (error) {
      wx.hideLoading();
      this.setData({ recognizing: false });
      this.showFailure(error, filePath);
    }
  },

  showFailure(error, filePath) {
    wx.showModal({
      title: '识别失败',
      content: error.message || '请重试',
      confirmText: '重试',
      cancelText: '手动填写',
      success: (res) => {
        if (res.confirm) {
          this.recognize(filePath);
          return;
        }
        getApp().globalData.current = {
          imagePath: filePath,
          name: '',
          idNumber: '',
          address: '',
          warnings: ['未能自动识别，请手动填写'],
          rows: [],
          provider: '',
          elapsedMs: 0,
        };
        wx.navigateTo({ url: '/pages/result/result' });
      },
    });
  },

  goRecords() {
    wx.navigateTo({ url: '/pages/records/records' });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },

  openSettings() {
    this.setData({
      showSettings: true,
      testResult: '',
      testState: '',
      effectiveBase: api.serverBase(),
    });
  },

  closeSettings() {
    this.setData({ showSettings: false });
  },

  noop() {},

  onCompanyInput(event) {
    this.setData({ 'settings.companyTitle': event.detail.value });
  },

  onServerInput(event) {
    this.setData({ 'settings.serverBase': event.detail.value });
  },

  async testConnection() {
    store.saveSettings({ serverBase: (this.data.settings.serverBase || '').trim() });
    this.setData({ testing: true, testResult: '', testState: '' });
    const result = await api.checkHealth();
    this.setData({
      testing: false,
      testResult: result.ok ? '✓ 连接成功' : `✗ ${result.error}`,
      testState: result.ok ? 'ok' : 'bad',
    });
    this.applyHealth(result);
  },

  saveSettings() {
    const serverBase = (this.data.settings.serverBase || '').trim();
    if (serverBase && !/^https?:\/\//.test(serverBase)) {
      wx.showToast({ title: '地址需以 http:// 或 https:// 开头', icon: 'none' });
      return;
    }
    store.saveSettings({
      companyTitle: (this.data.settings.companyTitle || '').trim(),
      serverBase,
    });
    this.setData({ showSettings: false });
    wx.showToast({ title: '已保存', icon: 'success' });
    this.checkHealth();
  },
});
