// 把单据绘制成图片（用于打印或转发）
const WIDTH = 900;
const HEIGHT = 620;
const SCALE = 2;
const MARGIN = 40;
const LABEL_WIDTH = 170;
const ROW_MIN_HEIGHT = 62;

function wrapText(ctx, text, maxWidth) {
  const value = String(text || '');
  if (!value) return [''];
  const lines = [];
  let current = '';
  for (const char of value) {
    const next = current + char;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawSlip(canvas, data) {
  const ctx = canvas.getContext('2d');
  const valueWidth = WIDTH - MARGIN * 2 - LABEL_WIDTH - 32;

  // 先按字体量出文字换行，确定画布高度（地址很长时自动变高）
  ctx.font = '28px sans-serif';
  const rows = [
    { label: '姓　　名', value: data.name },
    { label: '身份证号', value: data.idNumber },
    { label: '地　　址', value: data.address },
  ].map((row) => ({ label: row.label, lines: wrapText(ctx, row.value, valueWidth) }));

  const heights = rows.map((row) => Math.max(ROW_MIN_HEIGHT, row.lines.length * 40 + 22));
  const tableHeight = heights.reduce((sum, height) => sum + height, 0);
  const headerHeight = data.companyTitle ? 128 : 72;
  const canvasHeight = Math.max(HEIGHT, headerHeight + 92 + tableHeight + 70);

  canvas.width = WIDTH * SCALE;
  canvas.height = canvasHeight * SCALE;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, canvasHeight);

  let cursorY = 72;
  ctx.fillStyle = '#111111';
  ctx.textAlign = 'center';

  if (data.companyTitle) {
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(data.companyTitle, WIDTH / 2, cursorY);
    cursorY += 56;
  }

  ctx.font = '34px sans-serif';
  ctx.fillText(data.slipTitle, WIDTH / 2, cursorY);
  const titleWidth = ctx.measureText(data.slipTitle).width;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - titleWidth / 2, cursorY + 12);
  ctx.lineTo(WIDTH / 2 + titleWidth / 2, cursorY + 12);
  ctx.stroke();
  cursorY += 64;

  ctx.textAlign = 'left';
  ctx.font = '26px sans-serif';
  ctx.fillText(`日期：${data.dateText}`, MARGIN, cursorY);
  cursorY += 28;

  const tableX = MARGIN;
  const tableWidth = WIDTH - MARGIN * 2;

  ctx.font = '28px sans-serif';
  ctx.strokeRect(tableX, cursorY, tableWidth, tableHeight);

  let rowY = cursorY;
  rows.forEach((row, index) => {
    const height = heights[index];
    if (index > 0) {
      ctx.beginPath();
      ctx.moveTo(tableX, rowY);
      ctx.lineTo(tableX + tableWidth, rowY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(tableX + LABEL_WIDTH, rowY);
    ctx.lineTo(tableX + LABEL_WIDTH, rowY + height);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    ctx.fillText(row.label, tableX + LABEL_WIDTH / 2, rowY + height / 2 + 10);

    ctx.textAlign = 'left';
    row.lines.forEach((text, lineIndex) => {
      ctx.fillText(text, tableX + LABEL_WIDTH + 16, rowY + 40 + lineIndex * 40);
    });

    rowY += height;
  });

  ctx.textAlign = 'right';
  ctx.font = '22px sans-serif';
  ctx.fillStyle = '#555555';
  ctx.fillText(`扫描时间：${data.timestampText}`, tableX + tableWidth, rowY + 36);
  ctx.textAlign = 'left';
}

/**
 * 生成单据图片，返回临时文件路径
 * @param {object} page 页面实例（用于选择页面内的 canvas 节点）
 * @param {object} data 单据数据
 */
function exportImage(page, data) {
  return new Promise((resolve, reject) => {
    wx.createSelectorQuery()
      .in(page)
      .select('#slipCanvas')
      .fields({ node: true, size: true })
      .exec((result) => {
        const item = result && result[0];
        if (!item || !item.node) {
          reject(new Error('画布初始化失败，请重试'));
          return;
        }
        try {
          drawSlip(item.node, data);
        } catch (error) {
          reject(new Error('绘制单据失败'));
          return;
        }
        wx.canvasToTempFilePath({
          canvas: item.node,
          success: (res) => resolve(res.tempFilePath),
          fail: () => reject(new Error('生成单据图片失败')),
        });
      });
  });
}

module.exports = { exportImage, drawSlip };
