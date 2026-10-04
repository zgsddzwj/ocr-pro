import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { maskIdNumber } from '../lib/format';

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function Farmers() {
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  const load = () => {
    api
      .get(`/api/farmers?q=${encodeURIComponent(q)}&page_size=100`)
      .then((data) => {
        setList(data.items);
        setTotal(data.total);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const search = (event) => {
    event.preventDefault();
    load();
  };

  const openEdit = (item) => {
    setEditing(item.id);
    setForm({ name: item.name, address: item.address, phone: item.phone });
  };

  const save = async () => {
    try {
      await api.put(`/api/farmers/${editing}`, form);
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`删除农户「${item.name}」？`)) return;
    try {
      await api.del(`/api/farmers/${item.id}`);
      load();
    } catch (err) {
      window.alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={search} className="flex">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="搜索姓名 / 身份证号 / 地址"
            className="h-10 w-full rounded-l-xl border border-r-0 border-gray-200 px-4 text-sm outline-none focus:border-brand sm:w-72"
          />
          <button className="h-10 shrink-0 rounded-r-xl border border-gray-200 bg-white px-4 text-sm text-gray-600 hover:bg-gray-50">
            搜索
          </button>
        </form>
        <span className="text-sm text-gray-400">共 {total} 位农户</span>
      </div>

      {/* 手机：卡片流 */}
      <div className="space-y-3 md:hidden">
        {list.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-base font-semibold">{item.name}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs ${
                  item.source === 'miniprogram' ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {item.source === 'miniprogram' ? '小程序采集' : '手工录入'}
              </span>
            </div>
            <div className="mt-1 font-mono text-xs text-gray-500">{maskIdNumber(item.idNumber)}</div>
            <div className="mt-1 break-all text-sm text-gray-600">{item.address || '—'}</div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>
                {item.phone || '无电话'} · {item.createdAt.replace('T', ' ')}
              </span>
              <span className="text-sm">
                <button onClick={() => openEdit(item)} className="text-brand hover:underline">
                  编辑
                </button>
                <button onClick={() => remove(item)} className="ml-4 text-red-500 hover:underline">
                  删除
                </button>
              </span>
            </div>
          </div>
        ))}
        {!list.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-400 shadow-sm">
            还没有农户。让卖粮人用小程序扫一下身份证，或开单时手填。
          </div>
        ) : null}
      </div>

      {/* 桌面：表格 */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">身份证号</th>
              <th className="px-4 py-3 font-medium">地址</th>
              <th className="px-4 py-3 font-medium">电话</th>
              <th className="px-4 py-3 font-medium">来源</th>
              <th className="px-4 py-3 font-medium">采集时间</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 hover:bg-brand-light/40">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{maskIdNumber(item.idNumber)}</td>
                <td className="max-w-[280px] truncate px-4 py-3 text-gray-600" title={item.address}>
                  {item.address}
                </td>
                <td className="px-4 py-3 text-gray-600">{item.phone || '—'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      item.source === 'miniprogram' ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {item.source === 'miniprogram' ? '小程序采集' : '手工录入'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">{item.createdAt.replace('T', ' ')}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(item)} className="text-xs text-brand hover:underline">
                    编辑
                  </button>
                  <button onClick={() => remove(item)} className="ml-3 text-xs text-red-500 hover:underline">
                    删除
                  </button>
                </td>
              </tr>
            ))}
            {!list.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-14 text-center text-gray-400">
                  还没有农户。让卖粮人用小程序扫一下身份证，或开单时手填。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-bold">编辑农户</h3>
            <div className="mt-4 space-y-3">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="姓名" className={inputCls} />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="地址"
                className={inputCls}
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="电话"
                className={inputCls}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="h-10 rounded-xl border border-gray-200 px-5 text-sm text-gray-600 hover:bg-gray-50"
              >
                取消
              </button>
              <button onClick={save} className="h-10 rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-dark">
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
