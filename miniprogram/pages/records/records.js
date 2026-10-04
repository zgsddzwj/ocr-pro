const api = require('../../utils/api');
const calc = require('../../utils/calc');

const STATUS = { draft: '草稿', confirmed: '已确认', void: '已作废' };

Page({
  data: {
    stats: [],
    filter: 'all',
    list: [],
    loading: false,
    error: '',
    filters: [
      { v: 'all', label: '全部' },
      { v: 'draft', label: '草稿' },
      { v: 'confirmed', label: '已确认' },
      { v: 'void', label: '已作废' },
    ],
  },

  onShow() {
    if (!api.getToken()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.load();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh());
  },

  async load(done) {
    this.setData({ error: '' });
    try {
      const [stats, records] = await Promise.all([
        api.getStats(),
        api.getRecords({ status: this.data.filter, page_size: 50 }),
      ]);
      const list = records.items.map((item) => ({
        ...item,
        statusText: STATUS[item.status] || item.status,
        amountText: calc.fmtAmount(item.totalAmount),
        weightText: calc.fmtWeight(item.pricedWeight),
      }));
      this.setData({
        stats: [
          { label: '今日车数', value: String(stats.today.count), unit: '车' },
          { label: '今日收购量', value: calc.fmtWeight(stats.today.tons), unit: '吨' },
          { label: '今日结算额', value: calc.fmtAmount(stats.today.amount), unit: '元' },
          { label: '本月结算额', value: calc.fmtAmount(stats.month.amount), unit: '元' },
        ],
        list,
      });
    } catch (error) {
      if (error.needLogin) {
        wx.navigateTo({ url: '/pages/login/login' });
        return;
      }
      this.setData({ error: error.message });
    } finally {
      if (done) done();
    }
  },

  setFilter(event) {
    this.setData({ filter: event.currentTarget.dataset.v });
    this.load();
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/record-create/record-create' });
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?id=${event.currentTarget.dataset.id}`,
    });
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },
});
