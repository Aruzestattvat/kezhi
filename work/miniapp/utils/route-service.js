const orders = require('./orders');

function hash(text) {
  let value = 0;
  String(text || '').split('').forEach((char) => {
    value = ((value << 5) - value + char.charCodeAt(0)) | 0;
  });
  return Math.abs(value);
}

function sharedBikeCost(oneWayMinutes) {
  const oneWay = oneWayMinutes <= 10 ? 2 : 2 + Math.ceil((oneWayMinutes - 10) / 10) * 1.5;
  return Math.round(oneWay * 2 * 10) / 10;
}

function bicycleCost(oneWayKm) {
  const oneWay = Math.ceil(oneWayKm / 5) * 5 + (oneWayKm >= 10 ? 10 : 0);
  return oneWay * 2;
}

function mockRoute(order, settings) {
  const seed = hash(`${settings.city}|${order.address}`);
  const oneWayKm = 2.5 + (seed % 150) / 10;
  const mode = settings.travelMode;
  const speed = { taxi: 23, transit: 15, ebike: 18, bicycle: 13, free: 23 }[mode] || 20;
  const oneWayMinutes = Math.max(8, Math.round(oneWayKm / speed * 60 + (mode === 'transit' ? 10 : 0)));
  let travelCost = 0;
  if (mode === 'taxi') travelCost = Math.round((12 + Math.max(0, oneWayKm - 3) * 2.6) * 2);
  if (mode === 'transit') travelCost = oneWayKm > 12 ? 8 : 4;
  if (mode === 'ebike') travelCost = sharedBikeCost(oneWayMinutes);
  if (mode === 'bicycle') travelCost = bicycleCost(oneWayKm);
  return {
    ok: true,
    provider: 'mock',
    travelMode: mode,
    destination: { formattedAddress: `${settings.city}${order.address}` },
    roundTrip: {
      distanceMeters: Math.round(oneWayKm * 2 * 1000),
      durationSeconds: oneWayMinutes * 2 * 60,
      travelCost: order.transportCovered || mode === 'free' ? 0 : travelCost
    },
    transit: mode === 'transit' ? {
      boardingsOneWay: oneWayKm > 12 ? 2 : 1,
      transfersOneWay: oneWayKm > 12 ? 1 : 0,
      legs: [{ line: '原型演示线路', departureStop: '起点站', arrivalStop: '目的地站' }]
    } : null
  };
}

function normalizeCloudCallError(error) {
  const message = String(error && (error.errMsg || error.message) || error || '云函数调用失败');
  if (/FUNCTION_NOT_FOUND|-501000|function[^\n]*not found|云函数[^\n]*不存在/i.test(message)) {
    return '云端未找到 route 函数，请在微信开发者工具中右键 cloudfunctions/route，选择“上传并部署：云端安装依赖”';
  }
  if (/(env|environment|云环境|环境)[^\n]*(not found|invalid|不存在|无效)/i.test(message)) {
    return '当前小程序连接的云环境无效或与 route 函数所在环境不一致，请检查云开发环境 ID';
  }
  if (/permission|unauthorized|auth|权限|未授权|-502005/i.test(message)) {
    return '当前微信账号或小程序没有调用该云环境的权限，请检查开发者权限和云环境绑定';
  }
  if (/timeout|timed out|network|request:fail|网络/i.test(message)) {
    return '手机网络或云函数请求超时，请切换网络后重试，并检查 route 云函数日志';
  }
  return `云函数调用失败：${message}`;
}

function cloudRoute(order, settings) {
  if (typeof wx === 'undefined' || !wx.cloud) return Promise.reject(new Error('当前微信基础库不支持云开发，请升级微信后重试'));
  return wx.cloud.callFunction({
    name: 'route',
    data: {
      provider: settings.mapProvider,
      travelMode: settings.travelMode,
      origin: settings.origin,
      destination: order.address,
      city: settings.city
    }
  }).catch((error) => {
    throw new Error(normalizeCloudCallError(error));
  }).then((response) => {
    const result = response.result || {};
    if (!result.ok) throw new Error(result.error || '云端路线计算失败');
    return result;
  });
}

function calculate(order, settings) {
  if (!order.address || order.addressAmbiguous) return Promise.reject(new Error('请先补充明确的上课地址'));
  if (orders.eligibilityReason(order, settings)) return Promise.reject(new Error(`该订单已 PASS：${orders.eligibilityReason(order, settings)}`));
  return cloudRoute(order, Object.assign({}, settings, { routeBackend: 'cloud', mapProvider: 'amap' }));
}

function applyResult(order, result, settings) {
  const next = orders.clone(order);
  next.travelMode = settings.travelMode;
  next.travelCost = Number(result.roundTrip.travelCost);
  next.distanceKm = orders.round(Number(result.roundTrip.distanceMeters) / 1000, 1);
  next.driveMinutes = orders.round(Number(result.roundTrip.durationSeconds) / 60, 0);
  next.routeSource = result.provider || settings.mapProvider;
  next.resolvedMapAddress = result.destination && result.destination.formattedAddress || '';
  next.transitLegs = result.transit && result.transit.legs || [];
  next.routeError = null;
  next.updatedAt = new Date().toISOString();
  orders.cacheRoute(next, settings.travelMode, settings);
  return next;
}

module.exports = { calculate, applyResult, mockRoute, sharedBikeCost, bicycleCost, normalizeCloudCallError };
