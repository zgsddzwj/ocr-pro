// 金额/重量格式化与开单联动计算（口径与后端一致）
function num(value) {
  return Number(value) || 0;
}

const r3 = (v) => Math.round((v + Number.EPSILON) * 1000) / 1000;
const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function fmtWeight(value) {
  return num(value).toLocaleString('zh-CN', { maximumFractionDigits: 3 });
}

function fmtAmount(value) {
  return num(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function today() {
  const now = new Date();
  const pad = (v) => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 开单联动计算：净重/扣量总重/计价净重/结算价款 */
function computeForm(form) {
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
    grainAmount: grain,
    totalAmount: total,
  };
}

/** 18 位身份证号校验位校验（15 位旧证号视为合法；空值不校验） */
function isValidIdNumber(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!id) return true;
  if (/^\d{15}$/.test(id)) return true;
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * weights[i];
  return codes[sum % 11] === id[17];
}

module.exports = { fmtWeight, fmtAmount, today, computeForm, isValidIdNumber };
