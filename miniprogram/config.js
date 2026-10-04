// 全局配置：可在小程序内「设置」里覆盖，改完立即生效
module.exports = {
  // 识别服务地址：默认走公网隧道（电脑在后端开机自启 + 隧道服务的状态下，任何网络都能连）
  // 注意：隧道进程重启后地址会变，用 tools/tunnel-url.sh 查最新地址并同步这里
  serverBase: 'https://enough-mariah-bouquet-leon.trycloudflare.com',

  // 单据抬头（公司/单位名称），留空则只显示副标题
  companyTitle: '',

  // 单据副标题
  slipTitle: '原粮收购统一凭证',

  // 单次识别请求超时（毫秒）；云端大模型识别一般 1~3 秒
  requestTimeout: 45000,
};
