import { fmtAmount, fmtPrice, fmtWeight } from '../lib/format';

const TH = 'border border-black bg-gray-100 px-2 py-1 text-center font-normal whitespace-nowrap';
const TD = 'border border-black px-2 py-1 text-center';

/** 桌面/打印/PDF 共用的表格版版式（严格对齐纸质样单） */
function ReceiptSheet({ record }) {
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

      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-gray-700">
        <span>单位：公斤；元</span>
        <span>日期：{record.date}</span>
        <span>检质证号：{record.receiptNo}</span>
      </div>

      <table className="mt-1 w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <th className={TH}>姓　名</th>
            <td className={`${TD} font-semibold`} colSpan={2}>
              {record.farmerName}
            </td>
            <th className={TH}>身份证号</th>
            <td className={`${TD} whitespace-nowrap font-mono text-xs`} colSpan={3}>
              {record.farmerIdNumber}
            </td>
          </tr>
          <tr>
            <th className={TH}>地　址</th>
            <td className={`${TD} break-all text-left`} colSpan={6}>
              {record.farmerAddress}
            </td>
          </tr>

          <tr>
            <th className={TH}>产品名称</th>
            <th className={TH}>等级</th>
            <th className={TH}>水分</th>
            <th className={TH}>杂质</th>
            <th className={TH}>生霉粒</th>
            <th className={TH}>毛重</th>
            <th className={TH}>皮重</th>
          </tr>
          <tr>
            <td className={TD}>{record.product}</td>
            <td className={TD}>{record.grade}</td>
            <td className={TD}>{record.moisture}</td>
            <td className={TD}>{record.impurity}</td>
            <td className={TD}>{record.moldy}</td>
            <td className={TD}>{fmtWeight(record.gross)}</td>
            <td className={TD}>{fmtWeight(record.tare)}</td>
          </tr>

          <tr>
            <th className={TH}>场地扣量</th>
            <th className={TH}>扣前净重</th>
            <th className={TH}>水分扣量</th>
            <th className={TH}>杂质扣量</th>
            <th className={TH}>生霉扣量</th>
            <th className={TH}>扣量总重</th>
            <th className={TH}>扣后净重</th>
          </tr>
          <tr>
            <td className={TD}>{fmtWeight(record.deductSite)}</td>
            <td className={`${TD} font-semibold`}>{fmtWeight(record.netWeight)}</td>
            <td className={TD}>{fmtWeight(record.deductMoisture)}</td>
            <td className={TD}>{fmtWeight(record.deductImpurity)}</td>
            <td className={TD}>{fmtWeight(record.deductMoldy)}</td>
            <td className={TD}>{fmtWeight(record.deductTotal)}</td>
            <td className={`${TD} font-semibold`}>{fmtWeight(record.pricedWeight)}</td>
          </tr>

          <tr>
            <th className={TH}>单价</th>
            <th className={TH}>粮食价款</th>
            <th className={TH}>卸车费</th>
            <th className={TH}>结算价款</th>
            <th className={TH}>市斤价</th>
            <th className={TH}>卸车货位</th>
            <th className={TH}>车号</th>
          </tr>
          <tr>
            <td className={TD}>{fmtPrice(record.pricePerKg)}</td>
            <td className={TD}>{fmtAmount(record.grainAmount)}</td>
            <td className={TD}>{fmtAmount(record.unloadFee)}</td>
            <td className={`${TD} font-bold`}>{fmtAmount(record.totalAmount)}</td>
            <td className={TD}>{fmtPrice(record.pricePerJin)}</td>
            <td className={TD}>{record.unloadSpot}</td>
            <td className={TD}>{record.vehicleNo}</td>
          </tr>

          <tr>
            <th className={TH}>大写金额</th>
            <td className={`${TD} text-left font-semibold`} colSpan={3}>
              {record.amountCn || ''}
            </td>
            <th className={TH}>开户行</th>
            <td className={TD} colSpan={2}>
              {record.bankName}
            </td>
          </tr>
          <tr>
            <th className={TH}>银行卡号</th>
            <td className={`${TD} font-mono text-xs`} colSpan={2}>
              {record.bankCard}
            </td>
            <th className={TH}>联系电话</th>
            <td className={TD} colSpan={3}>
              {record.phone}
            </td>
          </tr>
          <tr>
            <td className={`${TD} pb-4 text-left text-xs`} colSpan={2}>
              化验员：{record.checker || ''}
            </td>
            <td className={`${TD} pb-4 text-left text-xs`} colSpan={2}>
              监管员：{record.supervisor || ''}
            </td>
            <td className={`${TD} pb-4 text-left text-xs`} colSpan={3}>
              进出时间：{record.weighInAt ? `${record.weighInAt}${record.weighOutAt ? ` / ${record.weighOutAt}` : ''}` : ''}
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
 * 原粮收购统一凭证。桌面/打印 = 7 列表格版（严格对齐纸质样单）；手机 = 同字段顺序的堆叠版。
 * record: 后端 RecordOut（含 farmerName/farmerIdNumber/farmerAddress/companyTitle/slipTitle）
 * 检质证号复用系统单据编号 receiptNo。
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
          <MRow label="姓名" value={record.farmerName} strong />
          <MRow label="身份证号" value={record.farmerIdNumber} mono />
          <MRow label="地址" value={record.farmerAddress} />
        </MSection>

        <MSection title="粮情检斤">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="产品名称" value={record.product} />
            <MRow label="等级" value={record.grade} />
            <MRow label="水分" value={record.moisture} />
            <MRow label="杂质" value={record.impurity} />
            <MRow label="生霉粒" value={record.moldy} />
            <MRow label="毛重" value={fmtWeight(record.gross)} />
            <MRow label="皮重" value={fmtWeight(record.tare)} />
          </div>
        </MSection>

        <MSection title="扣量">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="场地扣量" value={fmtWeight(record.deductSite)} />
            <MRow label="扣前净重" value={fmtWeight(record.netWeight)} strong />
            <MRow label="水分扣量" value={fmtWeight(record.deductMoisture)} />
            <MRow label="杂质扣量" value={fmtWeight(record.deductImpurity)} />
            <MRow label="生霉扣量" value={fmtWeight(record.deductMoldy)} />
            <MRow label="扣量总重" value={fmtWeight(record.deductTotal)} />
            <MRow label="扣后净重" value={fmtWeight(record.pricedWeight)} strong />
          </div>
        </MSection>

        <MSection title="结算">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="单价" value={fmtPrice(record.pricePerKg)} />
            <MRow label="粮食价款" value={fmtAmount(record.grainAmount)} />
            <MRow label="卸车费" value={fmtAmount(record.unloadFee)} />
            <MRow label="市斤价" value={fmtPrice(record.pricePerJin)} />
            <MRow label="卸车货位" value={record.unloadSpot} />
            <MRow label="车号" value={record.vehicleNo} />
          </div>
          <MRow label="结算价款" value={`${fmtAmount(record.totalAmount)} 元`} strong />
          <MRow label="大写金额" value={record.amountCn || ''} strong />
          <MRow label="开户行" value={record.bankName} />
          <MRow label="银行卡号" value={record.bankCard} mono />
          <MRow label="联系电话" value={record.phone} />
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
