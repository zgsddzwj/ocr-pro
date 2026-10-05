const api = require('../../utils/api');
const store = require('../../utils/store');
const icons = require('../../utils/icons');

Page({
  data: {
    icons,
    recognizing: false,
    previewPath: '',
    historyCount: 0,
  },

  onLoad() {
    this.setData({ icons });
  },

  onShow() {
    this.setData({ historyCount: store.getHistory().length });
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
          warnings: ['未能识别，请手动填写'],
          rows: [],
          provider: '',
          elapsedMs: 0,
        };
        wx.navigateTo({ url: '/pages/result/result' });
      },
    });
  },

  goHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  },
});
