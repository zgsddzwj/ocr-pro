import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import ReceiptView from '../components/ReceiptView';

export default function Print() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/api/records/${id}`)
      .then(setRecord)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="p-10 text-center text-red-600">{error}</p>;
  if (!record) return <p className="p-10 text-center text-gray-400">加载中…</p>;

  return (
    <div className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[940px] items-center justify-between px-2 no-print">
        <button onClick={() => navigate(`/records/${id}`)} className="text-sm text-brand hover:underline">
          ← 返回单据
        </button>
        <div className="flex items-center gap-3">
          {record.status !== 'confirmed' ? (
            <span className="text-xs text-amber-600">提示：这是草稿，建议先确认再打印</span>
          ) : null}
          <button
            onClick={() => window.print()}
            className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
          >
            打印 / 存为 PDF
          </button>
        </div>
      </div>
      <div className="shadow-xl print:shadow-none">
        <ReceiptView record={record} />
      </div>
    </div>
  );
}
