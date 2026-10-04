const store = require('../../utils/store');
const slip = require('../../utils/slip');
const config = require('../../config');
const icons = require('../../utils/icons');
const api = require('../../utils/api');
const { isValidIdNumber } = require('../../utils/validate');

const ENGINE_LABEL = {
  bailian: '云端大模型识别',
  vision: '本机离线识别',
  tencent: '腾讯云识别',
};

function pad(value) {
  return String(value).padStart(2, '0');
}

Page({
  data: {
    icons,
    companyTitle: '',
    slipTitle: '',
    dateText: '',
    name: '',
    idNumber: '',
    address: '',
    idInvalid: false,
    warnings: [],
    rows: [],
    imagePath: '',
    engineText: '',
    showRaw: false,
    saving: false,
    saved: false,
    submitting: false,
    submitted: false,
    submittedFarmerId: '',
  },

  onLoad() {
    const current = getApp().globalData.current || {};
    const settings = store.getSettings();
    const now = new Date();
    const engineParts = [];
    if (ENGINE_LABEL[current.provider]) engineParts.push(ENGINE_LABEL[current.provider]);
    if (current.addressVerified) engineParts.push('住址已多角度复核');
    if (current.elapsedMs) engineParts.push(`耗时 ${(current.elapsedMs / 1000).toFixed(1)} 秒`);

    this.setData({
      icons,
      companyTitle: settings.companyTitle || config.companyTitle || '',
      slipTitle: settings.slipTitle || config.slipTitle,
      dateText: `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`,
      name: current.name || '',
      idNumber: current.idNumber || '',
      address: current.address || '',
      idInvalid: !isValidIdNumber(current.idNumber),
      warnings: current.warnings || [],
      rows: current.rows || [],
      imagePath: current.imagePath || '',
      engineText: engineParts.join(' · '),
    });
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({
      [field]: event.detail.value,
      idInvalid: field === 'idNumber' ? !isValidIdNumber(event.detail.value) : this.data.idInvalid,
    });
  },

  copyField(event) {
    const field = event.currentTarget.dataset.field;
    const value = this.data[field] || '';
    if (!value) {
      wx.showToast({ title: '内容为空', icon: 'none' });
      return;
    }
    wx.setClipboardData({ data: value });
  },

  copyAll() {
    const text = `姓名：${this.data.name}\n身份证号：${this.data.idNumber}\n住址：${this.data.address}`;
    wx.setClipboardData({
      data: text,
      success: () => wx.showToast({ title: '已复制，可粘贴到收购系统', icon: 'none' }),
    });
  },

  saveRecord() {
    const { name, idNumber, address } = this.data;
    if (!name && !idNumber && !address) {
      wx.showToast({ title: '还没有内容可保存', icon: 'none' });
      return;
    }
    store.addHistory({ name, idNumber, address });
    this.setData({ saved: true });
    wx.showToast({ title: '已存入历史', icon: 'success' });
  },

  async submitToPlatform() {
    const { name, idNumber, address, submitting, submitted } = this.data;
    if (submitting) return;
    if (submitted) {
      this.goCreateRecord();
      return;
    }
    if (!name && !idNumber) {
      wx.showToast({ title: '请先填写姓名和身份证号', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      const result = await api.submitFarmer({ name, idNumber, address });
      getApp().globalData.pendingFarmer = result.farmer;
      this.setData({ submitted: true, submitting: false, submittedFarmerId: result.farmer.id });
      wx.showToast({ title: result.created ? '已录入平台' : '平台信息已更新', icon: 'success' });
    } catch (error) {
      this.setData({ submitting: false });
      wx.showModal({ title: '提交失败', content: error.message || '请重试', showCancel: false });
    }
  },

  goCreateRecord() {
    if (!this.data.submittedFarmerId) return;
    wx.navigateTo({ url: `/pages/record-create/record-create?farmerId=${this.data.submittedFarmerId}` });
  },

  async exportImage() {
    if (this.data.saving) return;
    this.setData({ saving: true });
    wx.showLoading({ title: '生成单据…', mask: true });

    const now = new Date();
    const timestampText = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    try {
      const filePath = await slip.exportImage(this, {
        companyTitle: this.data.companyTitle,
        slipTitle: this.data.slipTitle,
        dateText: this.data.dateText,
        name: this.data.name,
        idNumber: this.data.idNumber,
        address: this.data.address,
        timestampText,
      });
      wx.hideLoading();
      this.setData({ saving: false });
      this.saveToAlbum(filePath);
      wx.previewImage({ urls: [filePath] });
    } catch (error) {
      wx.hideLoading();
      this.setData({ saving: false });
      wx.showToast({ title: error.message || '生成单据失败', icon: 'none' });
    }
  },

  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (error) => {
        if (/auth|deny|authorize/i.test(error.errMsg || '')) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存单据图片需要相册权限，请在设置中开启后重试',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            },
          });
        }
      },
    });
  },

  previewIdCard() {
    if (!this.data.imagePath) return;
    wx.previewImage({ urls: [this.data.imagePath] });
  },

  toggleRaw() {
    this.setData({ showRaw: !this.data.showRaw });
  },

  rescan() {
    wx.navigateBack();
  },
});
