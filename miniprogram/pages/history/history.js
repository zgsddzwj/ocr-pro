const store = require('../../utils/store');
const icons = require('../../utils/icons');

Page({
  data: {
    icons,
    list: [],
    keyword: '',
  },

  allList: [],

  onLoad() {
    this.setData({ icons });
  },

  onShow() {
    this.load();
  },

  load() {
    this.allList = store.getHistory().map((item) => Object.assign({}, item, {
      timeText: store.formatTime(item.createdAt),
      initial: (item.name || '？').slice(0, 1),
    }));
    this.applyFilter(this.data.keyword);
  },

  applyFilter(keyword) {
    const value = String(keyword || '').trim().toLowerCase();
    const list = !value
      ? this.allList
      : this.allList.filter((item) => (
        (item.name || '').toLowerCase().includes(value)
        || (item.idNumber || '').includes(value)
        || (item.address || '').toLowerCase().includes(value)
      ));
    this.setData({ list, keyword });
  },

  onSearch(event) {
    this.applyFilter(event.detail.value);
  },

  copyItem(event) {
    const item = this.data.list.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (!item) return;
    wx.setClipboardData({
      data: `姓名：${item.name}\n身份证号：${item.idNumber}\n住址：${item.address}`,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  removeItem(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除这条记录？',
      content: '删除后无法恢复',
      confirmColor: '#C2453D',
      success: (res) => {
        if (!res.confirm) return;
        store.removeHistory(id);
        this.load();
      },
    });
  },

  clearAll() {
    if (!this.data.list.length) return;
    wx.showModal({
      title: '清空全部记录？',
      content: `共 ${this.data.list.length} 条，删除后无法恢复`,
      confirmColor: '#C2453D',
      success: (res) => {
        if (!res.confirm) return;
        store.clearHistory();
        this.load();
      },
    });
  },

  goScan() {
    wx.navigateBack();
  },
});
