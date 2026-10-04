const api = require('../../utils/api');
const calc = require('../../utils/calc');

const STATUS = { draft: '草稿', confirmed: '已确认', void: '已作废' };

Page({
  data: {
    record: null,
    rows: [],
    busy: false,
    error: '',
  },

  onLoad(query) {
    this.recordId = query.id;
  },

  onShow() {
    this.load();
  },

  decorate(record) {
    const weightRows = [
      ['品名', record.product],
      ['等级', record.grade],
      ['车号', record.vehicleNo],
      ['毛重（公斤）', calc.fmtWeight(record.gross)],
      ['皮重（公斤）', calc.fmtWeight(record.tare)],
      ['净重（公斤）', calc.fmtWeight(record.netWeight)],
      ['水分%', record.moisture],
      ['杂质%', record.impurity],
      ['生霉粒%', record.moldy],
      ['扣量总重（公斤）', calc.fmtWeight(record.deductTotal)],
      ['计价净重（公斤）', calc.fmtWeight(record.pricedWeight)],
    ];
    const settleRows = [
      ['单价（元/公斤）', calc.fmtWeight(record.pricePerKg)],
      ['市斤价', calc.fmtWeight(record.pricePerJin)],
      ['粮食价款（元）', calc.fmtAmount(record.grainAmount)],
      ['卸车费（元）', calc.fmtAmount(record.unloadFee)],
      ['结算价款（元）', calc.fmtAmount(record.totalAmount)],
      ['实付大写', record.amountCn],
      ['入库仓号', record.warehouse],
      ['卸车货位', record.unloadSpot],
      ['联系电话', record.phone],
      ['银行卡号', record.bankCard],
      ['开户行', record.bankName],
      ['备注', record.note],
    ];
    return {
      ...record,
      statusText: STATUS[record.status] || record.status,
      weightRows: weightRows.map(([label, value]) => ({ label, value: value === '' ? '—' : value })),
      settleRows: settleRows.map(([label, value]) => ({ label, value: value === '' || value == null ? '—' : value })),
      sellerAddress: record.farmerAddress || '—',
    };
  },

  async load() {
    this.setData({ error: '' });
    try {
      const record = await api.getRecord(this.recordId);
      this.setData({ record: this.decorate(record) });
    } catch (error) {
      if (error.needLogin) {
        wx.navigateTo({ url: '/pages/login/login' });
        return;
      }
      this.setData({ error: error.message });
    }
  },

  copyAll() {
    const r = this.data.record;
    if (!r) return;
    const text = [
      `编号：${r.receiptNo}`,
      `日期：${r.date}`,
      `姓名：${r.farmerName}`,
      `身份证号：${r.farmerIdNumber}`,
      `住址：${r.farmerAddress}`,
      `品名：${r.product}`,
      `毛重：${calc.fmtWeight(r.gross)} 公斤`,
      `皮重：${calc.fmtWeight(r.tare)} 公斤`,
      `计价净重：${calc.fmtWeight(r.pricedWeight)} 公斤`,
      `单价：${r.pricePerKg} 元/公斤`,
      `结算价款：${calc.fmtAmount(r.totalAmount)} 元`,
    ].join('\n');
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '已复制', icon: 'success' }) });
  },

  async setStatus(action) {
    this.setData({ busy: true });
    try {
      await (action === 'confirm' ? api.confirmRecord(this.recordId) : api.voidRecord(this.recordId));
      this.setData({ busy: false });
      this.load();
    } catch (error) {
      this.setData({ busy: false });
      wx.showModal({ title: '操作失败', content: error.message, showCancel: false });
    }
  },

  confirmSlip() {
    this.setStatus('confirm');
  },

  voidSlip() {
    wx.showModal({
      title: '作废这张单据？',
      content: '作废后不参与统计，无法恢复',
      confirmColor: '#C2453D',
      success: (res) => {
        if (res.confirm) this.setStatus('void');
      },
    });
  },

  deleteDraft() {
    wx.showModal({
      title: '删除这张草稿？',
      content: '删除后无法恢复',
      confirmColor: '#C2453D',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await api.deleteRecord(this.recordId);
          wx.navigateBack();
        } catch (error) {
          wx.showModal({ title: '删除失败', content: error.message, showCancel: false });
        }
      },
    });
  },
});
