import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getToken } from '../lib/api';
import { fmtAmount, fmtWeight, maskIdNumber } from '../lib/format';

const STATUS = {
  draft: { label: '草稿', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: '已确认', cls: 'bg-brand-light text-brand' },
  void: { label: '已作废', cls: 'bg-gray-200 text-gray-500' },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const response = await fetch('/api/records/export.xlsx', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error((detail && (detail.detail || detail.error)) || `导出失败（HTTP ${response.status}）`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      link.href = url;
      link.download = `收购明细_${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const load = () => {
    api
      .get('/api/stats/summary')
      .then(setSummary)
      .catch((err) => setError(err.message));
    api
      .get(`/api/records?status=${status}&q=${encodeURIComponent(q)}&page_size=50`)
      .then((data) => setRecords(data.items))
      .catch((err) => setError(err.message));
  };

  useEffect(load, [status]);

  const search = (event) => {
    event.preventDefault();
    load();
  };

  const cards = summary
    ? [
        { label: '今日车数', value: summary.today.count, unit: '车' },
        { label: '今日收购量', value: fmtWeight(summary.today.tons), unit: '吨' },
        { label: '今日结算额', value: fmtAmount(summary.today.amount), unit: '元' },
        { label: '本月结算额', value: fmtAmount(summary.month.amount), unit: '元' },
      ]
    : [];

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
            <div className="text-xs text-gray-500 sm:text-sm">{card.label}</div>
            <div className="mt-2 text-xl font-bold text-ink sm:text-2xl">
              {card.value}
              <span className="ml-1 text-sm font-normal text-gray-400">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="-mx-4 flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-sm md:mx-0 md:w-fit">
          {[
            ['all', '全部'],
            ['draft', '草稿'],
            ['confirmed', '已确认'],
            ['void', '已作废'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition ${
                status === value ? 'bg-brand font-semibold text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={search} className="flex sm:w-64">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="编号 / 姓名 / 身份证号"
              className="h-10 w-full rounded-l-xl border border-r-0 border-gray-200 px-4 text-sm outline-none focus:border-brand"
            />
            <button className="h-10 shrink-0 rounded-r-xl border border-gray-200 bg-white px-4 text-sm text-gray-600 hover:bg-gray-50">
              搜索
            </button>
          </form>
          <div className="flex gap-2">
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="flex h-10 items-center justify-center rounded-xl border border-brand px-4 text-sm font-semibold text-brand transition hover:bg-brand-light disabled:opacity-50"
            >
              {exporting ? '导出中…' : '导出 Excel'}
            </button>
            <Link
              to="/records/new"
              className="flex h-10 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
            >
              + 开新单
            </Link>
          </div>
        </div>
      </div>

      {/* 手机：卡片流 */}
      <div className="space-y-3 md:hidden">
        {records.map((record) => (
          <div
            key={record.id}
            onClick={() => navigate(`/records/${record.id}`)}
            className="cursor-pointer rounded-2xl bg-white p-4 shadow-sm active:bg-brand-light/40"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-500">{record.receiptNo}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS[record.status]?.cls}`}>
                {STATUS[record.status]?.label || record.status}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-3">
              <span className="font-semibold">{record.farmerName}</span>
              <span className="font-bold text-brand">{fmtAmount(record.totalAmount)} 元</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {record.date} · {record.product} · 计价净重 {fmtWeight(record.pricedWeight)} 公斤
            </div>
          </div>
        ))}
        {!records.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-gray-400 shadow-sm">
            还没有收购单，点上方「开新单」开始
          </div>
        ) : null}
      </div>

      {/* 桌面：表格 */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-3 font-medium">编号</th>
              <th className="px-4 py-3 font-medium">日期</th>
              <th className="px-4 py-3 font-medium">农户</th>
              <th className="px-4 py-3 font-medium">身份证号</th>
              <th className="px-4 py-3 font-medium">品名</th>
              <th className="px-4 py-3 text-right font-medium">毛重</th>
              <th className="px-4 py-3 text-right font-medium">计价净重</th>
              <th className="px-4 py-3 text-right font-medium">结算金额</th>
              <th className="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr
                key={record.id}
                onClick={() => navigate(`/records/${record.id}`)}
                className="cursor-pointer border-b border-gray-50 hover:bg-brand-light/40"
              >
                <td className="px-4 py-3 font-mono text-xs">{record.receiptNo}</td>
                <td className="px-4 py-3 text-gray-600">{record.date}</td>
                <td className="px-4 py-3 font-medium">{record.farmerName}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{maskIdNumber(record.farmerIdNumber)}</td>
                <td className="px-4 py-3">{record.product}</td>
                <td className="px-4 py-3 text-right">{fmtWeight(record.gross)}</td>
                <td className="px-4 py-3 text-right">{fmtWeight(record.pricedWeight)}</td>
                <td className="px-4 py-3 text-right font-semibold">{fmtAmount(record.totalAmount)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS[record.status]?.cls}`}>
                    {STATUS[record.status]?.label || record.status}
                  </span>
                </td>
              </tr>
            ))}
            {!records.length ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-gray-400">
                  还没有收购单，点右上角「开新单」开始
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
