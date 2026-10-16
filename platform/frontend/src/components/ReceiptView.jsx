import { fmtAmount, fmtPrice, fmtWeight } from '../lib/format';

const TH = 'border border-black bg-gray-100 px-1 py-1 text-center text-[12px] font-normal whitespace-nowrap';
const TD = 'border border-black px-1 py-1 text-center';

/** 桌面/打印/PDF 共用的表格版版式（严格对齐纸质样单，12 栏网格） */
function ReceiptSheet({ record }) {
  const inOutText = record.weighInAt
    ? `${record.weighInAt}${record.weighOutAt ? ` / ${record.weighOutAt}` : ''}`
    : '';

  return (
    <>
      <div className="text-center">
        {record.companyTitle ? (
          <div className="text-[22px] font-bold tracking-wide">{record.companyTitle}</div>
        ) : null}
        <div
          className={`font-semibold underline underline-offset-4 ${
            record.companyTitle ? 'mt-1 text-[17px]' : 'text-[20px]'
          }`}
        >
          {record.slipTitle || '原粮收购统一凭证'}
        </div>
      </div>

      <table className="mt-1 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <th className={TH} colSpan={2}>
              单位：公斤；元
            </th>
            <td className={TD} colSpan={2} />
            <th className={TH}>日期：</th>
            <td className={TD} colSpan={3}>
              {record.date}
            </td>
            <th className={TH} colSpan={2}>
              检质证号：
            </th>
            <td className={TD} colSpan={2}>
              {record.receiptNo}
            </td>
          </tr>

          <tr>
            <th className={TH}>产品名称</th>
            <td className={TD}>{record.product}</td>
            <th className={TH}>农户姓名</th>
            <td className={`${TD} font-semibold`}>{record.farmerName}</td>
            <th className={TH}>身份证号</th>
            <td className={`${TD} whitespace-nowrap font-mono text-[11px]`} colSpan={2}>
              {record.farmerIdNumber}
            </td>
            <th className={TH}>地址</th>
            <td className={`${TD} break-all text-left`} colSpan={2}>
              {record.farmerAddress}
            </td>
            <th className={TH}>联系电话</th>
            <td className={TD}>{record.phone}</td>
          </tr>

          <tr>
            <th className={TH}>产品等级</th>
            <th className={TH}>水分</th>
            <th className={TH}>杂质霉变</th>
            <th className={TH}>毛重</th>
            <th className={TH}>皮重</th>
            <th className={TH} colSpan={2}>
              综合扣量
            </th>
            <th className={TH}>净重</th>
            <th className={TH}>单价</th>
            <th className={TH}>市斤价</th>
            <th className={TH} colSpan={2}>
              金额
            </th>
          </tr>
          <tr>
            <td className={TD}>{record.grade}</td>
            <td className={TD}>{record.moisture}</td>
            <td className={TD}>{record.impurity}</td>
            <td className={TD}>{fmtWeight(record.gross)}</td>
            <td className={TD}>{fmtWeight(record.tare)}</td>
            <td className={TD} colSpan={2}>
              {fmtWeight(record.deductTotal)}
            </td>
            <td className={`${TD} font-semibold`}>{fmtWeight(record.netWeight)}</td>
            <td className={TD}>{fmtPrice(record.pricePerKg)}</td>
            <td className={TD}>{fmtPrice(record.pricePerJin)}</td>
            <td className={`${TD} font-bold`} colSpan={2}>
              {fmtAmount(record.grainAmount)}
            </td>
          </tr>

          <tr>
            <th className={TH}>卸车货位</th>
            <td className={TD} colSpan={2}>
              {record.unloadSpot}
            </td>
            <th className={TH}>金额大写</th>
            <td className={`${TD} text-left font-semibold`} colSpan={4}>
              {record.amountCn || ''}
            </td>
            <th className={TH}>银行账号</th>
            <td className={`${TD} font-mono text-xs`} colSpan={3}>
              {record.bankCard}
            </td>
          </tr>
          <tr>
            <th className={`${TH} text-left`} colSpan={2}>
              化验员：
            </th>
            <td className={`${TD} text-left text-xs`} colSpan={2}>
              {record.checker || ''}
            </td>
            <th className={`${TH} text-left`} colSpan={2}>
              监管员：
            </th>
            <td className={`${TD} text-left text-xs`} colSpan={2}>
              {record.supervisor || ''}
            </td>
            <th className={`${TH} text-left`} colSpan={2}>
              进出时间：
            </th>
            <td className={`${TD} text-left text-xs`} colSpan={2}>
              {inOutText}
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

/** 手机端堆叠版的一行：标签 + 值 */
function MRow({ label, value, strong, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-gray-300 py-1">
      <span className="shrink-0 text-xs text-gray-500">{label}</span>
      <span className={`break-all text-right ${mono ? 'font-mono text-xs' : ''} ${strong ? 'font-bold' : ''}`}>
        {value == null || value === '' ? '—' : value}
      </span>
    </div>
  );
}

function MSection({ title, children }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-xs font-bold text-gray-400">{title}</div>
      {children}
    </div>
  );
}

/**
 * 原粮收购统一凭证。桌面/打印 = 12 栏表格版（严格对齐纸质样单）；手机 = 同字段顺序的堆叠版。
 * record: 后端 RecordOut；检质证号复用系统单据编号 receiptNo。
 * 离屏 .pdf-stage 常驻一份表格版，供「存为 PDF」用 html2canvas 截图导出。
 */
export default function ReceiptView({ record }) {
  if (!record) return null;
  const statusText =
    record.status === 'confirmed' ? '已确认' : record.status === 'void' ? '已作废' : '草稿';
  const inOutText = record.weighInAt
    ? `${record.weighInAt}${record.weighOutAt ? ` / ${record.weighOutAt}` : ''}`
    : '';

  return (
    <div className="receipt receipt-print mx-auto w-full max-w-[900px] bg-white text-black">
      {/* ---------- 桌面 / 打印：表格版（打印时强制使用，与 PDF 一致） ---------- */}
      <div className="receipt-table hidden p-4 text-[13px] leading-tight md:block">
        <ReceiptSheet record={record} />
      </div>

      {/* ---------- 手机：堆叠卡片版（同字段顺序，不参与打印） ---------- */}
      <div className="receipt-stacked p-4 md:hidden">
        <div className="text-center">
          {record.companyTitle ? (
            <div className="text-xl font-bold tracking-wide">{record.companyTitle}</div>
          ) : null}
          <div className="font-semibold underline underline-offset-4">
            {record.slipTitle || '原粮收购统一凭证'}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-gray-600">
          <span>单位：公斤；元</span>
          <span>日期：{record.date}</span>
        </div>
        <div className="mt-1 text-xs text-gray-600">检质证号：{record.receiptNo}</div>

        <MSection title="卖方">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="产品名称" value={record.product} />
            <MRow label="农户姓名" value={record.farmerName} strong />
          </div>
          <MRow label="身份证号" value={record.farmerIdNumber} mono />
          <MRow label="地址" value={record.farmerAddress} />
          <MRow label="联系电话" value={record.phone} />
        </MSection>

        <MSection title="粮情检斤">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="产品等级" value={record.grade} />
            <MRow label="水分" value={record.moisture} />
            <MRow label="杂质霉变" value={record.impurity} />
            <MRow label="毛重" value={fmtWeight(record.gross)} />
            <MRow label="皮重" value={fmtWeight(record.tare)} />
            <MRow label="综合扣量" value={fmtWeight(record.deductTotal)} />
          </div>
          <MRow label="净重" value={fmtWeight(record.netWeight)} strong />
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="单价" value={fmtPrice(record.pricePerKg)} />
            <MRow label="市斤价" value={fmtPrice(record.pricePerJin)} />
          </div>
          <MRow label="金额" value={`${fmtAmount(record.grainAmount)} 元`} strong />
          <MRow label="金额大写" value={record.amountCn || ''} strong />
        </MSection>

        <MSection title="单据">
          <MRow label="卸车货位" value={record.unloadSpot} />
          <MRow label="银行账号" value={record.bankCard} mono />
        </MSection>

        <MSection title="签字">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="化验员" value={record.checker} />
            <MRow label="监管员" value={record.supervisor} />
          </div>
          <MRow label="进出时间" value={inOutText} />
        </MSection>
      </div>

      <div className="px-4 pb-3 text-right text-[10px] text-gray-500">
        {statusText} · 打印时间 {new Date().toLocaleString('zh-CN', { hour12: false })}
      </div>

      {/* ---------- 离屏常驻表格版：供「存为 PDF」截图，不参与打印 ---------- */}
      <div className="pdf-stage" aria-hidden="true">
        <div className="receipt-pdf-sheet bg-white p-4 pb-10 text-[13px] leading-tight text-black">
          <ReceiptSheet record={record} />
        </div>
      </div>
    </div>
  );
}
