const https = require('https');
let bundledKey = '';
try {
  bundledKey = require('./secret.local').amapWebServiceKey || '';
} catch (error) {
  bundledKey = '';
}

const ENDPOINTS = {
  geocode: 'https://restapi.amap.com/v3/geocode/geo',
  taxi: 'https://restapi.amap.com/v5/direction/driving',
  transit: 'https://restapi.amap.com/v5/direction/transit/integrated',
  ebike: 'https://restapi.amap.com/v5/direction/electrobike',
  bicycle: 'https://restapi.amap.com/v5/direction/bicycling'
};

function requestJson(endpoint, params) {
  const url = new URL(endpoint);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'TutorValueMiniProgram/0.1' }, timeout: 16000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (String(payload.status) !== '1') {
            const code = String(payload.infocode || '未知状态码');
            if (code === '10009' || payload.info === 'USERKEY_PLAT_NOMATCH') reject(new Error('当前高德 Key 不是 Web 服务类型，请在高德控制台创建“Web 服务”Key（10009）'));
            else reject(new Error(`${payload.info || '高德地图请求失败'}（${code}）`));
          }
          else resolve(payload);
        } catch (error) { reject(new Error('高德地图返回了无法识别的数据')); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('高德地图请求超时')));
    request.on('error', reject);
  });
}

async function geocode(address, city, key) {
  const query = address.includes(city) ? address : `${city}${address}`;
  const payload = await requestJson(ENDPOINTS.geocode, { address: query, city, output: 'JSON', key });
  const item = (payload.geocodes || [])[0];
  if (!item || !item.location) throw new Error(`无法定位地址：${address}`);
  const [lng, lat] = item.location.split(',').map(Number);
  return { lng, lat, citycode: Array.isArray(item.citycode) ? item.citycode[0] : item.citycode, level: item.level || '', formattedAddress: item.formatted_address || query };
}

function point(location) { return `${location.lng.toFixed(6)},${location.lat.toFixed(6)}`; }
function asList(value) { return Array.isArray(value) ? value : value ? [value] : []; }

async function routeOnce(mode, origin, destination, key) {
  if (mode === 'transit') {
    if (!origin.citycode || !destination.citycode) throw new Error('地址缺少公交查询所需的城市代码，请填写更具体的地址');
    const payload = await requestJson(ENDPOINTS.transit, { origin: point(origin), destination: point(destination), city1: origin.citycode, city2: destination.citycode, strategy: '0', AlternativeRoute: '1', show_fields: 'cost', key });
    const transit = ((payload.route || {}).transits || [])[0];
    if (!transit) throw new Error('高德地图没有返回可用公交路线');
    const legs = [];
    let walkingMeters = 0;
    asList(transit.segments).forEach((segment) => {
      walkingMeters += Number((segment.walking || {}).distance || 0);
      const line = asList((segment.bus || {}).buslines || (segment.bus || {}).busline)[0];
      if (line) legs.push({ line: line.name || '公交线路', departureStop: (line.departure_stop || {}).name || '上车站待确认', arrivalStop: (line.arrival_stop || {}).name || '下车站待确认' });
      const railway = segment.railway || {};
      if (railway.name) legs.push({ line: railway.name, departureStop: (railway.departure_stop || {}).name || '上车站待确认', arrivalStop: (railway.arrival_stop || {}).name || '下车站待确认' });
    });
    const cost = transit.cost || {};
    return { distanceMeters: Number(transit.distance || 0), durationSeconds: Number(cost.duration || transit.duration || 0), taxiFee: 0, boardings: legs.length, transfers: Math.max(0, legs.length - 1), walkingMeters, transitLegs: legs };
  }

  const endpoint = ENDPOINTS[mode === 'free' ? 'taxi' : mode];
  const payload = await requestJson(endpoint, { origin: point(origin), destination: point(destination), show_fields: 'cost', alternative_route: '1', key });
  const route = payload.route || {};
  const path = (route.paths || [])[0];
  if (!path) throw new Error('高德地图没有返回可用路线');
  const cost = path.cost || {};
  const taxiFee = Number(route.taxi_cost || 0);
  if (mode === 'taxi' && taxiFee <= 0) throw new Error('高德地图没有返回有效打车费');
  return { distanceMeters: Number(path.distance || 0), durationSeconds: Number(cost.duration || path.duration || 0), taxiFee };
}

function sharedBikeCost(seconds) {
  const minutes = Math.max(0, seconds / 60);
  return Math.round((2 + Math.max(0, Math.ceil((minutes - 10) / 10)) * 1.5) * 2 * 100) / 100;
}

function bicycleCost(meters) {
  const km = Math.max(0, meters / 1000);
  return (Math.max(1, Math.ceil(km / 5)) * 5 + (km >= 10 ? 10 : 0)) * 2;
}

exports.main = async (event) => {
  try {
    const key = String(process.env.AMAP_WEB_SERVICE_KEY || bundledKey || '').trim();
    if (key.length < 8) throw new Error('云函数尚未配置 AMAP_WEB_SERVICE_KEY');
    const mode = String(event.travelMode || 'taxi');
    if (!['taxi', 'transit', 'ebike', 'bicycle', 'free'].includes(mode)) throw new Error('不支持的出行方式');
    const originText = String(event.origin || '').trim();
    const destinationText = String(event.destination || '').trim();
    const city = String(event.city || '嘉兴市').trim();
    if (!originText || !destinationText) throw new Error('出发点或目的地为空');
    const [origin, destination] = await Promise.all([geocode(originText, city, key), geocode(destinationText, city, key)]);
    const outbound = await routeOnce(mode, origin, destination, key);
    let travelCost = 0;
    if (mode === 'taxi') travelCost = outbound.taxiFee * 2;
    if (mode === 'transit') travelCost = outbound.boardings * 4;
    if (mode === 'ebike') travelCost = sharedBikeCost(outbound.durationSeconds);
    if (mode === 'bicycle') travelCost = bicycleCost(outbound.distanceMeters);
    return {
      ok: true,
      provider: 'amap',
      travelMode: mode,
      roundTripEstimated: true,
      origin,
      destination,
      roundTrip: { distanceMeters: outbound.distanceMeters * 2, durationSeconds: outbound.durationSeconds * 2, travelCost },
      transit: mode === 'transit' ? { boardingsOneWay: outbound.boardings, transfersOneWay: outbound.transfers, walkingMetersOneWay: outbound.walkingMeters, legs: outbound.transitLegs } : null
    };
  } catch (error) {
    return { ok: false, error: error.message || '路线计算失败' };
  }
};
