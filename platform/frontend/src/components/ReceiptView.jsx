import { fmtAmount, fmtPrice, fmtWeight } from '../lib/format';

const TH = 'border border-black bg-gray-100 px-2 py-1 text-center font-normal whitespace-nowrap';
const TD = 'border border-black px-2 py-1 text-center';

const ROLE_MAP = { 化验员: 'checker', 检斤员: 'weigher', 管理员: 'manager', 监管员: 'supervisor', 付款员: 'payer' };

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
 * 收购凭证。桌面/打印 = 7 列表格版（对齐纸质样单）；手机 = 堆叠卡片版。
 * record: 后端 RecordOut（含 farmerName/farmerIdNumber/farmerAddress/companyTitle/slipTitle）
 */
export default function ReceiptView({ record }) {
  if (!record) return null;
  const statusText =
    record.status === 'confirmed' ? '已确认' : record.status === 'void' ? '已作废' : '草稿';

  return (
    <div className="receipt receipt-print mx-auto w-full max-w-[900px] bg-white text-black">
      {/* ---------- 桌面 / 打印：表格版 ---------- */}
      <div className="hidden p-4 text-[13px] leading-tight md:block">
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
          <span>单位:公斤;元</span>
          <span>日期：{record.date}</span>
          <span>编号：{record.receiptNo}</span>
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
              <th className={TH}>品名</th>
              <th className={TH}>等级</th>
              <th className={TH}>水分%</th>
              <th className={TH}>杂质%</th>
              <th className={TH}>生霉粒%</th>
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
              <th className={TH}>单价（公斤）</th>
              <th className={TH}>市斤价</th>
              <th className={TH}>粮食价款</th>
              <th className={TH}>卸车费</th>
              <th className={TH}>结算价款</th>
              <th className={TH}>卸车货位</th>
              <th className={TH}>车号</th>
            </tr>
            <tr>
              <td className={TD}>{fmtPrice(record.pricePerKg)}</td>
              <td className={TD}>{fmtPrice(record.pricePerJin)}</td>
              <td className={TD}>{fmtAmount(record.grainAmount)}</td>
              <td className={TD}>{fmtAmount(record.unloadFee)}</td>
              <td className={`${TD} font-bold`}>{fmtAmount(record.totalAmount)}</td>
              <td className={TD}>{record.unloadSpot}</td>
              <td className={TD}>{record.vehicleNo}</td>
            </tr>

            <tr>
              <th className={TH}>实付大写</th>
              <td className={`${TD} text-left font-semibold`} colSpan={3}>
                {record.amountCn || '—'}
              </td>
              <th className={TH}>入库仓号</th>
              <td className={TD} colSpan={2}>
                {record.warehouse}
              </td>
            </tr>
            <tr>
              <th className={TH}>银行卡号</th>
              <td className={`${TD} font-mono text-xs`} colSpan={2}>
                {record.bankCard}
              </td>
              <th className={TH}>开户行</th>
              <td className={TD} colSpan={3}>
                {record.bankName}
              </td>
            </tr>
            <tr>
              <th className={TH}>联系电话</th>
              <td className={TD} colSpan={2}>
                {record.phone}
              </td>
              <th className={TH}>进出时间</th>
              <td className={`${TD} text-xs`} colSpan={3}>
                {record.weighInAt}
                {record.weighOutAt ? ` / ${record.weighOutAt}` : ''}
              </td>
            </tr>
            <tr>
              {Object.keys(ROLE_MAP).map((role) => (
                <td key={role} className={`${TD} text-left text-xs`}>
                  {role}：{record[ROLE_MAP[role]] || ''}
                </td>
              ))}
              <td className={`${TD} text-left text-xs`} colSpan={2}>
                备注：{record.note || '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ---------- 手机：堆叠卡片版 ---------- */}
      <div className="p-4 md:hidden">
        <div className="text-center">
          {record.companyTitle ? (
            <div className="text-xl font-bold tracking-wide">{record.companyTitle}</div>
          ) : null}
          <div className="font-semibold underline underline-offset-4">
            {record.slipTitle || '原粮收购统一凭证'}
          </div>
        </div>

        <div className="mt-2 flex justify-between text-xs text-gray-600">
          <span>日期：{record.date}</span>
          <span>编号：{record.receiptNo}</span>
        </div>

        <MSection title="卖方">
          <MRow label="姓名" value={record.farmerName} strong />
          <MRow label="身份证号" value={record.farmerIdNumber} mono />
          <MRow label="地址" value={record.farmerAddress} />
        </MSection>

        <MSection title="粮情检斤">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="品名" value={record.product} />
            <MRow label="等级" value={record.grade} />
            <MRow label="水分%" value={record.moisture} />
            <MRow label="杂质%" value={record.impurity} />
            <MRow label="生霉粒%" value={record.moldy} />
            <MRow label="毛重" value={fmtWeight(record.gross)} />
            <MRow label="皮重" value={fmtWeight(record.tare)} />
          </div>
        </MSection>

        <MSection title="扣量">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="场地扣量" value={fmtWeight(record.deductSite)} />
            <MRow label="水分扣量" value={fmtWeight(record.deductMoisture)} />
            <MRow label="杂质扣量" value={fmtWeight(record.deductImpurity)} />
            <MRow label="生霉扣量" value={fmtWeight(record.deductMoldy)} />
            <MRow label="扣前净重" value={fmtWeight(record.netWeight)} />
            <MRow label="扣量总重" value={fmtWeight(record.deductTotal)} strong />
            <MRow label="扣后净重" value={fmtWeight(record.pricedWeight)} strong />
          </div>
        </MSection>

        <MSection title="结算">
          <div className="grid grid-cols-2 gap-x-4">
            <MRow label="单价（公斤）" value={fmtPrice(record.pricePerKg)} />
            <MRow label="市斤价" value={fmtPrice(record.pricePerJin)} />
            <MRow label="粮食价款" value={fmtAmount(record.grainAmount)} />
            <MRow label="卸车费" value={fmtAmount(record.unloadFee)} />
            <MRow label="车号" value={record.vehicleNo} />
            <MRow label="卸车货位" value={record.unloadSpot} />
            <MRow label="入库仓号" value={record.warehouse} />
            <MRow label="联系电话" value={record.phone} />
            <MRow label="银行卡号" value={record.bankCard} mono />
            <MRow label="开户行" value={record.bankName} />
            <MRow label="进出时间" value={record.weighInAt ? `${record.weighInAt}${record.weighOutAt ? ` / ${record.weighOutAt}` : ''}` : ''} />
          </div>
          <MRow label="结算价款" value={`${fmtAmount(record.totalAmount)} 元`} strong />
          <MRow label="实付大写" value={record.amountCn || '—'} strong />
        </MSection>

        <MSection title="人员">
          <div className="grid grid-cols-2 gap-x-4">
            {Object.keys(ROLE_MAP).map((role) => (
              <MRow key={role} label={role} value={record[ROLE_MAP[role]]} />
            ))}
          </div>
          <MRow label="备注" value={record.note} />
        </MSection>
      </div>

      <div className="px-4 pb-3 text-right text-[10px] text-gray-500">
        {statusText} · 打印时间 {new Date().toLocaleString('zh-CN', { hour12: false })}
      </div>
    </div>
  );
}
