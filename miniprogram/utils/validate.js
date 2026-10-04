// 本地校验工具

const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

/** 18 位身份证校验位校验；15 位旧证号视为合法；空值不校验 */
function isValidIdNumber(value) {
  const id = String(value || '').trim().toUpperCase();
  if (!id) return true;
  if (/^\d{15}$/.test(id)) return true;
  if (!/^\d{17}[\dX]$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(id[i]) * WEIGHTS[i];
  return CODES[sum % 11] === id[17];
}

module.exports = { isValidIdNumber };
