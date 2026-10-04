import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelCls = 'mb-1 block text-xs text-gray-500';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [pwd, setPwd] = useState({ oldPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/api/settings')
      .then(setSettings)
      .catch((err) => setError(err.message));
  }, []);

  const saveSettings = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const data = await api.put('/api/settings', settings);
      setSettings(data);
      setMessage('✓ 已保存');
    } catch (err) {
      setError(err.message);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setPwdMessage('');
    setError('');
    try {
      await api.put('/api/auth/password', pwd);
      setPwdMessage('✓ 密码已修改');
      setPwd({ oldPassword: '', newPassword: '' });
    } catch (err) {
      setPwdMessage(err.message);
    }
  };

  if (!settings) return <p className="py-16 text-center text-gray-400">加载中…</p>;

  const field = (key, label, placeholder) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        value={settings[key] ?? ''}
        onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );

  return (
    <div className="grid max-w-4xl grid-cols-1 gap-5 lg:grid-cols-2">
      <form onSubmit={saveSettings} className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold">单据与默认值</h2>
        <div className="space-y-4">
          {field('companyTitle', '公司抬头（打印在凭证顶部）', '如：德州鸣达农业发展有限公司')}
          {field('slipTitle', '凭证标题', '如：原粮收购统一凭证')}
          {field('checkNoPrefix', '检质证号前缀', '可选')}
          {field('defaultProduct', '默认品名', '如：玉米')}
          {field('defaultPricePerKg', '默认单价（元/公斤）', '如：2.36')}
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark">
            保存设置
          </button>
          {message ? <span className="text-sm text-brand">{message}</span> : null}
          {error ? <span className="text-sm text-red-600">{error}</span> : null}
        </div>
      </form>

      <form onSubmit={changePassword} className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold">修改管理密码</h2>
        <div className="space-y-4">
          <div>
            <label className={labelCls}>原密码</label>
            <input
              type="password"
              value={pwd.oldPassword}
              onChange={(event) => setPwd({ ...pwd, oldPassword: event.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>新密码（至少 6 位）</label>
            <input
              type="password"
              value={pwd.newPassword}
              onChange={(event) => setPwd({ ...pwd, newPassword: event.target.value })}
              className={inputCls}
            />
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark">
            修改密码
          </button>
          {pwdMessage ? <span className="text-sm text-brand">{pwdMessage}</span> : null}
        </div>
      </form>
    </div>
  );
}
