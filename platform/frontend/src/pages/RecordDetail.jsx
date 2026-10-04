import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import ReceiptView from '../components/ReceiptView';

const STATUS_TEXT = { draft: '草稿', confirmed: '已确认', void: '已作废' };

export default function RecordDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/api/records/${id}`)
      .then(setRecord)
      .catch((err) => setError(err.message));
  }, [id]);

  const act = async (action, message) => {
    setBusy(true);
    try {
      const updated = await api.post(`/api/records/${id}/${action}`);
      setRecord(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!record) return <p className="py-16 text-center text-gray-400">加载中…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <Link to="/" className="text-sm text-brand hover:underline">
            ← 返回工作台
          </Link>
          <h1 className="mt-1 text-lg font-bold">
            收购单 {record.receiptNo}
            <span
              className={`ml-3 rounded-full px-2.5 py-1 align-middle text-xs ${
                record.status === 'confirmed'
                  ? 'bg-brand-light text-brand'
                  : record.status === 'void'
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-amber-100 text-amber-700'
              }`}
            >
              {STATUS_TEXT[record.status]}
            </span>
          </h1>
        </div>
        <div className="flex gap-2">
          {record.status === 'draft' ? (
            <>
              <button
                onClick={() => navigate('/records/new')}
                className="h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-600 hover:bg-gray-50"
              >
                重开一单
              </button>
              <button
                onClick={() => act('confirm')}
                disabled={busy}
                className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:bg-gray-300"
              >
                确认开票
              </button>
            </>
          ) : null}
          {record.status !== 'void' ? (
            <button
              onClick={() => {
                if (window.confirm('确定作废这张单据？作废后不可恢复为有效单。')) act('void');
              }}
              disabled={busy}
              className="h-10 rounded-xl border border-red-200 bg-white px-4 text-sm text-red-600 hover:bg-red-50"
            >
              作废
            </button>
          ) : null}
          <button
            onClick={() => navigate(`/print/${record.id}`)}
            className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
          >
            打印收据 / 存 PDF
          </button>
        </div>
      </div>

      {record.status === 'draft' ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 no-print">
          这是草稿，核对无误后点「确认开票」锁定并打印。
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <ReceiptView record={record} />
      </div>
    </div>
  );
}
