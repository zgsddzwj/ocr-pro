const api = require('../../utils/api');

Page({
  data: {
    mode: 'login', // setup=首次设密 / login=登录
    password: '',
    confirm: '',
    busy: false,
    error: '',
    ready: false,
  },

  onLoad() {
    api
      .authStatus()
      .then((status) => this.setData({ mode: status.needsSetup ? 'setup' : 'login', ready: true }))
      .catch((error) => this.setData({ error: error.message, ready: true }));
  },

  onPassword(event) {
    this.setData({ password: event.detail.value });
  },

  onConfirm(event) {
    this.setData({ confirm: event.detail.value });
  },

  async submit() {
    const { mode, password, confirm } = this.data;
    if (!password) {
      this.setData({ error: '请输入密码' });
      return;
    }
    if (mode === 'setup') {
      if (password.length < 6) {
        this.setData({ error: '密码至少 6 位' });
        return;
      }
      if (password !== confirm) {
        this.setData({ error: '两次输入的密码不一致' });
        return;
      }
    }
    this.setData({ busy: true, error: '' });
    try {
      const data = mode === 'setup' ? await api.setupPassword(password) : await api.login(password);
      api.setToken(data.token);
      wx.navigateBack({
        fail: () => wx.reLaunch({ url: '/pages/scan/scan' }),
      });
    } catch (error) {
      this.setData({ error: error.message, busy: false });
    }
  },
});
