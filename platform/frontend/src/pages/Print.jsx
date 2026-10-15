import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import ReceiptView from '../components/ReceiptView';

/** A5 横向页面尺寸（毫米） */
const PAGE = { width: 210, height: 148, margin: 6 };

export default function Print() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [error, setError] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/api/records/${id}`)
      .then(setRecord)
      .catch((err) => setError(err.message));
  }, [id]);

  /** 导出 PDF 文件：截取离屏表格版凭证 → 按 A5 横向等比排版 → 直接下载 */
  const savePdf = async () => {
    const node = document.querySelector('.pdf-stage .receipt-pdf-sheet');
    if (!node || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
      const availW = PAGE.width - PAGE.margin * 2;
      const availH = PAGE.height - PAGE.margin * 2;
      const ratio = Math.min(availW / canvas.width, availH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        PAGE.margin + (availW - w) / 2,
        PAGE.margin + (availH - h) / 2,
        w,
        h,
      );
      pdf.save(`${record.receiptNo || 'receipt'}.pdf`);
    } catch (err) {
      setError(`导出 PDF 失败：${err.message || err}`);
    } finally {
      setPdfBusy(false);
    }
  };

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
            onClick={savePdf}
            disabled={pdfBusy}
            className="h-10 rounded-xl border border-brand bg-white px-5 text-sm font-semibold text-brand hover:bg-brand-light disabled:opacity-60"
          >
            {pdfBusy ? '生成中…' : '存为 PDF'}
          </button>
          <button
            onClick={() => window.print()}
            className="h-10 rounded-xl bg-brand px-6 text-sm font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark"
          >
            打印
          </button>
        </div>
      </div>
      <div className="shadow-xl print:shadow-none">
        <ReceiptView record={record} />
      </div>
    </div>
  );
}
