export function fmtWeight(value) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}

export function fmtAmount(value) {
  return Number(value || 0).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtPrice(value) {
  return Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

export function maskIdNumber(value) {
  const id = String(value || '');
  if (id.length < 11) return id;
  return id.slice(0, 4) + '**********' + id.slice(-4);
}

export function today() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// 与后端 compute_record 相同口径的即时预览计算（提交以后端为准）
const r3 = (v) => Math.round((v + Number.EPSILON) * 1000) / 1000;
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function computeForm(form) {
  const num = (v) => Number(v) || 0;
  const net = r3(num(form.gross) - num(form.tare));
  const deductTotal = r3(
    num(form.deductSite) + num(form.deductMoisture) + num(form.deductImpurity) + num(form.deductMoldy),
  );
  const priced = r3(net - deductTotal);
  const grain = r2(priced * num(form.pricePerKg));
  const total = r2(grain - num(form.unloadFee));
  return {
    netWeight: net,
    deductTotal,
    pricedWeight: priced,
    pricePerJin: r2(num(form.pricePerKg) / 2 * 10000) / 10000,
    grainAmount: grain,
    totalAmount: total,
  };
}
