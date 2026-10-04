const api = require('../../utils/api');
const calc = require('../../utils/calc');

const NUMERIC_FIELDS = [
  'moisture', 'impurity', 'moldy', 'gross', 'tare',
  'deductSite', 'deductMoisture', 'deductImpurity', 'deductMoldy', 'pricePerKg', 'unloadFee',
];

const EMPTY = {
  date: calc.today(),
  product: '玉米',
  grade: '',
  vehicleNo: '',
  moisture: '',
  impurity: '',
  moldy: '',
  gross: '',
  tare: '',
  deductSite: '',
  deductMoisture: '',
  deductImpurity: '',
  deductMoldy: '',
  pricePerKg: '',
  unloadFee: '',
  unloadSpot: '',
  warehouse: '',
  phone: '',
  bankCard: '',
  bankName: '',
  note: '',
};

Page({
  data: {
    farmer: null,
    farmerQuery: '',
    farmerResults: [],
    showResults: false,
    manualFarmer: false,
    manual: { name: '', idNumber: '', address: '' },
    form: EMPTY,
    computed: { netWeightText: '0', pricedWeightText: '0', totalAmountText: '0.00' },
    overDeducted: false,
    showMore: false,
    busy: false,
    error: '',
  },

  onLoad(query) {
    // 从识别结果页「去开单」跳入时，带农户信息
    const app = getApp();
    if (query.farmerId && app.globalData.pendingFarmer) {
      this.setData({ farmer: app.globalData.pendingFarmer });
      app.globalData.pendingFarmer = null;
    }
    api
      .getSettings()
      .then((settings) => {
        const form = {
          ...this.data.form,
          product: settings.defaultProduct || this.data.form.product,
          pricePerKg:
            settings.defaultPricePerKg && Number(settings.defaultPricePerKg) > 0
              ? settings.defaultPricePerKg
              : this.data.form.pricePerKg,
        };
        this.setData({ form });
        this.updateComputed(form);
      })
      .catch(() => {});
    this.updateComputed(this.data.form);
  },

  updateComputed(form) {
    const derived = calc.computeForm(form);
    this.setData({
      computed: {
        netWeightText: calc.fmtWeight(derived.netWeight),
        pricedWeightText: calc.fmtWeight(derived.pricedWeight),
        totalAmountText: calc.fmtAmount(derived.totalAmount),
      },
      overDeducted: derived.pricedWeight < 0,
    });
  },

  onFarmerQuery(event) {
    const q = event.detail.value;
    this.setData({ farmerQuery: q });
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      api
        .searchFarmers(q)
        .then((data) => this.setData({ farmerResults: data.items, showResults: true }))
        .catch(() => {});
    }, 250);
  },

  pickFarmer(event) {
    const id = event.currentTarget.dataset.id;
    const item = this.data.farmerResults.find((row) => row.id === id);
    if (!item) return;
    this.setData({ farmer: item, farmerQuery: item.name, showResults: false, manualFarmer: false });
  },

  resetFarmer() {
    this.setData({ farmer: null, farmerQuery: '' });
  },

  toggleManual() {
    this.setData({ manualFarmer: !this.data.manualFarmer });
  },

  onManualInput(event) {
    this.setData({ [`manual.${event.currentTarget.dataset.k}`]: event.detail.value });
  },

  setField(event) {
    const form = { ...this.data.form, [event.currentTarget.dataset.k]: event.detail.value };
    this.setData({ form });
    this.updateComputed(form);
  },

  onDateChange(event) {
    const form = { ...this.data.form, date: event.detail.value };
    this.setData({ form });
  },

  toggleMore() {
    this.setData({ showMore: !this.data.showMore });
  },

  async save() {
    const { farmer, manual, form } = this.data;
    this.setData({ error: '' });
    if (!farmer && !(manual.name && manual.idNumber)) {
      this.setData({ error: '请先选择农户（或手填姓名和身份证号）' });
      return;
    }
    if (!form.gross && !form.tare) {
      this.setData({ error: '请填写毛重和皮重' });
      return;
    }
    this.setData({ busy: true });
    try {
      let farmerId = farmer ? farmer.id : '';
      if (!farmerId) {
        const created = await api.submitFarmer({
          name: manual.name,
          idNumber: manual.idNumber,
          address: manual.address,
          phone: form.phone,
        });
        farmerId = created.farmer.id;
      }
      const payload = { farmerId, ...form };
      NUMERIC_FIELDS.forEach((key) => {
        payload[key] = Number(payload[key]) || 0;
      });
      const record = await api.createRecord(payload);
      getApp().globalData.currentRecord = record;
      wx.redirectTo({ url: `/pages/record-detail/record-detail?id=${record.id}` });
    } catch (error) {
      this.setData({ error: error.message, busy: false });
    }
  },
});
