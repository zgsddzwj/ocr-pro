import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/api/auth/status')
      .then((data) => setNeedsSetup(data.needsSetup))
      .catch((error) => setError(error.message));
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (needsSetup && password !== confirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setBusy(true);
    try {
      const path = needsSetup ? '/api/auth/setup' : '/api/auth/login';
      const data = await api.post(path, { password });
      setToken(data.token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-bold text-white">
            粮
          </div>
          <h1 className="text-xl font-bold">收粮收购平台</h1>
          <p className="mt-1 text-sm text-gray-500">
            {needsSetup === null ? '正在连接…' : needsSetup ? '首次使用，请设置管理密码' : '请输入管理密码'}
          </p>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={needsSetup ? '设置密码（至少 6 位）' : '管理密码'}
            autoFocus
            className="h-11 w-full rounded-xl border border-gray-200 px-4 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {needsSetup ? (
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="再次输入密码"
              className="h-11 w-full rounded-xl border border-gray-200 px-4 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || needsSetup === null || !password}
            className="h-11 w-full rounded-xl bg-brand font-semibold text-white shadow-md shadow-brand/25 transition hover:bg-brand-dark disabled:bg-gray-300"
          >
            {busy ? '请稍候…' : needsSetup ? '设置并进入' : '登 录'}
          </button>
        </form>
      </div>
    </div>
  );
}
