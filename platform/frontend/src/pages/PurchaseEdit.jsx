import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { computeForm, fmtAmount, fmtPrice, fmtWeight, today } from '../lib/format';

const inputCls =
  'h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const inputBigCls =
  'h-12 w-full rounded-lg border border-gray-200 px-3 text-lg font-semibold outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelCls = 'mb-1 block text-xs text-gray-500';
const sectionCls = 'rounded-2xl bg-white p-5 shadow-sm';
const sectionTitle = 'mb-4 text-sm font-bold text-ink';

// 字段与纸质样单一一对应：产品等级/水分/杂质霉变/毛重/皮重/综合扣量/单价/卸车货位/银行账号/联系电话/进出时间/化验员/监管员
const EMPTY = {
  date: today(),
  product: '玉米',
  grade: '',
  moisture: '',
  impurity: '',
  gross: '',
  tare: '',
  deductTotal: '',
  pricePerKg: '',
  unloadSpot: '',
  bankCard: '',
  phone: '',
  weighInAt: '',
  weighOutAt: '',
  checker: '',
  supervisor: '',
};

const NUMERIC_KEYS = ['moisture', 'impurity', 'gross', 'tare', 'deductTotal', 'pricePerKg'];

export default function PurchaseEdit() {
  const navigate = useNavigate();
  const [farmer, setFarmer] = useState(null);
  const [farmerQuery, setFarmerQuery] = useState('');
  const [farmerResults, setFarmerResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [manualFarmer, setManualFarmer] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualIdNumber, setManualIdNumber] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    api
      .get('/api/settings')
      .then((data) =>
        setForm((prev) => ({
          ...prev,
          product: data.defaultProduct || prev.product,
          pricePerKg:
            data.defaultPricePerKg && Number(data.defaultPricePerKg) > 0 ? data.defaultPricePerKg : prev.pricePerKg,
        })),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!farmerQuery.trim()) {
      setFarmerResults([]);
      return undefined;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      api
        .get(`/api/farmers?q=${encodeURIComponent(farmerQuery.trim())}&page_size=8`)
        .then((data) => {
          setFarmerResults(data.items);
          setShowResults(true);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [farmerQuery]);

  const derived = useMemo(() => computeForm(form), [form]);
  const overDeducted = derived.netWeight < 0;

  const pickFarmer = (item) => {
    setFarmer(item);
    setFarmerQuery(item.name);
    setShowResults(false);
    setManualFarmer(false);
    setForm((prev) => ({ ...prev, phone: item.phone || '' }));
  };

  const setField = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (!farmer && !(manualName && manualIdNumber)) {
      setError('请先选择农户（或手填姓名和身份证号）');
      return;
    }
    if (!form.gross && !form.tare) {
      setError('请填写毛重和皮重');
      return;
    }
    setBusy(true);
    try {
      let farmerId = farmer?.id;
      if (!farmerId) {
        const created = await api.post('/api/farmers/submit', {
          name: manualName,
          idNumber: manualIdNumber,
          address: manualAddress,
          phone: form.phone,
        });
        farmerId = created.farmer.id;
      }
      const payload = { farmerId, ...form };
      NUMERIC_KEYS.forEach((key) => {
        payload[key] = Number(payload[key]) || 0;
      });
      const record = await api.post('/api/records', payload);
      navigate(`/records/${record.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const textField = (key, label, placeholder) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input value={form[key]} onChange={setField(key)} placeholder={placeholder} className={inputCls} />
    </div>
  );

  const numField = (key, label, { big, step } = {}) => (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="number"
        inputMode="decimal"
        step={step || '0.001'}
        value={form[key]}
        onChange={setField(key)}
        placeholder="0"
        className={big ? inputBigCls : inputCls}
      />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-5">
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      {/* ① 卖方农户 */}
      <div className={sectionCls}>
        <div className={sectionTitle}>① 卖方农户</div>
        {farmer ? (
          <div className="flex items-center justify-between rounded-xl bg-brand-light px-4 py-3">
            <div className="min-w-0">
              <span className="font-semibold">{farmer.name}</span>
              <span className="ml-3 font-mono text-xs text-gray-500">{farmer.idNumber}</span>
              <span className="ml-3 hidden text-xs text-gray-500 sm:inline">{farmer.address}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setFarmer(null);
                setFarmerQuery('');
              }}
              className="shrink-0 text-xs text-brand hover:underline"
            >
              重选
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={farmerQuery}
              onChange={(event) => setFarmerQuery(event.target.value)}
              onFocus={() => setShowResults(true)}
              placeholder="输入姓名或身份证号搜索小程序采集的农户"
              className={inputCls}
            />
            {showResults && farmerResults.length ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                {farmerResults.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => pickFarmer(item)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-brand-light/60"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="font-mono text-xs text-gray-400">{item.idNumber}</span>
                    <span className="truncate text-xs text-gray-400">{item.address}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setManualFarmer(!manualFarmer)}
              className="mt-2 text-xs text-brand hover:underline"
            >
              {manualFarmer ? '收起手填' : '找不到？现场手填农户信息'}
            </button>
            {manualFarmer ? (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="姓名 *" className={inputCls} />
                <input
                  value={manualIdNumber}
                  onChange={(e) => setManualIdNumber(e.target.value)}
                  placeholder="身份证号 *"
                  className={`${inputCls} font-mono`}
                />
                <input
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="地址"
                  className={inputCls}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ② 收购信息（字段与凭证一致） */}
      <div className={sectionCls}>
        <div className={sectionTitle}>② 收购信息</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>日期</label>
            <input type="date" value={form.date} onChange={setField('date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>产品名称</label>
            <input value={form.product} onChange={setField('product')} className={inputCls} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {textField('grade', '产品等级', '如：一等')}
          {numField('moisture', '水分%', { step: '0.1' })}
          {numField('impurity', '杂质霉变%', { step: '0.1' })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {numField('gross', '毛重（公斤）', { big: true })}
          {numField('tare', '皮重（公斤）', { big: true })}
          {numField('deductTotal', '综合扣量（公斤）', { big: true })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {numField('pricePerKg', '单价（元/公斤）', { big: true, step: '0.0001' })}
          {textField('unloadSpot', '卸车货位', '如：3号位')}
          {textField('bankCard', '银行账号', '结算收款账号')}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {textField('phone', '联系电话', '如：13800000000')}
          {textField('weighInAt', '毛检时间', '如：08:30')}
          {textField('weighOutAt', '皮检时间', '如：09:10')}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          {textField('checker', '化验员', '')}
          {textField('supervisor', '监管员', '')}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-brand-light px-4 py-3 text-sm">
          <div>
            <span className="text-xs text-gray-500">净重</span>
            <div className={`font-bold ${overDeducted ? 'text-red-600' : 'text-brand'}`}>
              {fmtWeight(derived.netWeight)}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">市斤价</span>
            <div className="font-bold">{fmtPrice(derived.pricePerJin)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">金额</span>
            <div className={`font-bold ${overDeducted ? 'text-red-600' : 'text-brand'}`}>
              {fmtAmount(derived.grainAmount)}
            </div>
          </div>
        </div>
        {overDeducted ? <p className="mt-2 text-xs text-red-600">综合扣量已超过毛重减皮重，请检查扣量数字</p> : null}
      </div>

      <div className="sticky bottom-4 z-10 space-y-3 rounded-2xl bg-white p-4 shadow-lg sm:flex sm:items-center sm:justify-between sm:space-y-0 sm:px-5 sm:py-3">
        <div className="text-sm text-gray-600">
          金额：
          <span className="ml-1 text-xl font-bold text-brand">{fmtAmount(derived.grainAmount)}</span>
          <span className="ml-1 text-xs text-gray-400">（大写随单据自动生成）</span>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded-xl bg-brand px-8 font-semibold text-white shadow-md shadow-brand/25 hover:bg-brand-dark disabled:bg-gray-300 sm:w-auto"
        >
          {busy ? '保存中…' : '保存单据'}
        </button>
      </div>
    </form>
  );
}
