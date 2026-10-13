const parser = require('./parser');

const TRAVEL_MODES = [
  { value: 'taxi', label: '打车' },
  { value: 'transit', label: '公交车' },
  { value: 'ebike', label: '共享电单车' },
  { value: 'bicycle', label: '自行车' },
  { value: 'free', label: '自由出行' }
];

function uid() {
  return `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** (digits || 0);
  return Math.round(value * factor) / factor;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function travelModeLabel(mode) {
  const found = TRAVEL_MODES.find((item) => item.value === mode);
  return found ? found.label : '打车';
}

function weekdayLabel(days) {
  const names = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  return Array.isArray(days) && days.length ? days.map((day) => names[day]).filter(Boolean).join('、') : '时间未明确';
}

function trimAddress(value) {
  return String(value || '')
    .replace(/^(?:在|位于|地点|地址|位置|家住|上课地)[:：]?/, '')
    .split(/(?:周[一二三四五六日天]|星期|每周|价格|课时|\d+\s*元|上午|下午|晚上)/)[0]
    .replace(/(?:附近|左右|这边|上课)$/, '')
    .trim();
}

function parseAddress(text) {
  const label = '(?:联系地址|学员地址|学生地址|家庭地址|上课地址|授课地址|家教地址|辅导地址|上课地点|辅导地点|地址|地点|位置|住址|家住)';
  const explicit = String(text || '').match(new RegExp(`(?:^|[\\n，,。；;])\\s*[【\\[]?\\s*${label}\\s*[】\\]]?\\s*[:：]?\\s*([^，,。；;\\n]{2,40})`));
  return explicit ? trimAddress(explicit[1]) : '';
}

function isAmbiguousAddress(address) {
  return /老师家|图书馆|或者|待定|另约|家长.*近一点/.test(address || '');
}

function parseSchedule(text) {
  const explicit = (String(text || '').match(/(?:^|\n)\s*[【\[]?(?:时间安排|时间)\s*[】\]]?\s*[:：]\s*([^\n]+)/) || [])[1];
  if (explicit) return explicit.trim();
  const found = String(text || '').match(/(?:周|星期)[一二三四五六日天1-7](?!\s*次)(?:上午|下午|晚上|白天)?|周末|上午|下午|晚上|时间可协商|时间面议/g) || [];
  const duration = parser.detectDuration(text);
  if (duration.source === 'time-range') found.push(duration.matched);
  return Array.from(new Set(found)).join('、');
}

function parseOrder(raw, source, settings) {
  const duration = parser.detectDuration(raw);
  const detected = Number.isFinite(duration.hours);
  const hours = detected ? duration.hours : settings.defaultHours;
  const hoursMax = detected ? (duration.hoursMax || duration.hours) : hours;
  const compensation = parser.parseCompensation(raw, detected ? hours : null, detected ? hoursMax : null);
  const frequency = parser.parseFrequency(raw);
  const address = parseAddress(raw);
  const transportCovered = parser.hasTransportReimbursement(raw);
  const mode = settings.travelMode || 'taxi';
  return {
    id: uid(),
    source: source || '未命名群',
    rawText: raw,
    orderCode: parser.extractOrderCode(raw),
    postedAt: parser.extractPostedAt(raw),
    grade: parser.parseGrade(raw),
    subject: parser.parseSubject(raw),
    address,
    addressSource: address ? 'explicit-prefix' : 'missing',
    addressAmbiguous: isAmbiguousAddress(address),
    requiresEmployedTeacher: parser.requiresEmployedTeacher(raw),
    teacherGenderRequirement: parser.parseTeacherGenderRequirement(raw),
    transportCovered,
    hourlyRate: compensation.hourlyRate,
    hourlyRateMin: compensation.hourlyRateMin,
    hourlyRateMax: compensation.hourlyRateMax,
    totalPrice: compensation.totalPrice,
    totalPriceMax: compensation.totalPriceMax || compensation.totalPrice,
    hours,
    hoursMax,
    assumedHours: !detected,
    durationSource: detected ? duration.source : 'default',
    durationMatched: duration.matched,
    weeklyTimes: frequency.weeklyTimes,
    weeklyTimesMax: frequency.weeklyTimesMax,
    schedule: parseSchedule(raw),
    weekdays: parser.parseWeekdays(raw),
    travelMode: mode,
    routeResults: {},
    travelCost: transportCovered || mode === 'free' ? 0 : null,
    distanceKm: null,
    driveMinutes: null,
    routeSource: null,
    routeError: null,
    createdAt: new Date().toISOString()
  };
}

function normalizeRaw(text) {
  return String(text || '').replace(/\s+/g, '').replace(/[，,。；;：:]/g, '').toLowerCase();
}

function mergeImported(existing, incoming) {
  const orders = clone(existing || []);
  const knownRaw = new Set(orders.map((item) => normalizeRaw(item.rawText)));
  let added = 0;
  let updated = 0;
  incoming.forEach((item) => {
    const index = item.orderCode ? orders.findIndex((old) => old.source === item.source && old.orderCode === item.orderCode) : -1;
    if (index >= 0) {
      const old = orders[index];
      if (old.address === item.address) {
        item.routeResults = old.routeResults || {};
        item.travelMode = old.travelMode || item.travelMode;
        restoreRoute(item, item.travelMode, null, true);
      }
      item.id = old.id;
      item.createdAt = old.createdAt || item.createdAt;
      orders[index] = item;
      updated += 1;
    } else if (!knownRaw.has(normalizeRaw(item.rawText))) {
      orders.push(item);
      knownRaw.add(normalizeRaw(item.rawText));
      added += 1;
    }
  });
  return { orders, added, updated };
}

function eligibilityReason(order, settings) {
  if (order.requiresEmployedTeacher || parser.requiresEmployedTeacher(order.rawText || '')) return '要求专职/在职老师';
  const required = order.teacherGenderRequirement || parser.parseTeacherGenderRequirement(order.rawText || '');
  if (settings.teacherGender !== 'any' && required !== 'any' && required !== settings.teacherGender) return required === 'female' ? '仅限女老师' : '仅限男老师';
  return '';
}

function passReason(order, settings) {
  const eligibility = eligibilityReason(order, settings);
  if (eligibility) return eligibility;
  const oneWay = Number.isFinite(order.distanceKm) ? order.distanceKm / 2 : null;
  if (Number.isFinite(oneWay) && oneWay > settings.maxOneWayKm) return `单程 ${round(oneWay, 1)} km，超过 ${settings.maxOneWayKm} km`;
  return '';
}

function derive(order, settings) {
  const travelCost = order.transportCovered ? 0 : number(order.travelCost);
  const income = Number.isFinite(order.totalPrice) ? order.totalPrice : Number.isFinite(order.hourlyRate) && Number.isFinite(order.hours) ? order.hourlyRate * order.hours : null;
  const cashNet = Number.isFinite(income) && Number.isFinite(travelCost) ? income - travelCost : null;
  const totalHours = Number.isFinite(order.hours) && Number.isFinite(order.driveMinutes) ? order.hours + order.driveMinutes / 60 + settings.bufferMinutes / 60 : null;
  const netHourly = Number.isFinite(cashNet) && totalHours > 0 ? cashNet / totalHours : null;
  const monthlyIncome = Number.isFinite(income) ? income * (order.weeklyTimes || 1) * 4.33 : null;
  const monthlyNet = Number.isFinite(cashNet) ? cashNet * (order.weeklyTimes || 1) * 4.33 : null;
  const weekdays = Array.isArray(order.weekdays) && order.weekdays.length ? order.weekdays : parser.parseWeekdays(order.schedule || order.rawText || '');
  const reason = passReason(order, settings);
  let status = 'pending';
  if (reason) status = 'passed';
  else if (Number.isFinite(netHourly)) status = netHourly >= settings.minimumNet ? 'ready' : 'low';
  return Object.assign({}, order, {
    travelCost,
    income,
    cashNet,
    netHourly,
    monthlyIncome,
    monthlyNet,
    weekdays,
    passReason: reason,
    status,
    netHourlyRounded: round(netHourly, 0),
    monthlyIncomeRounded: round(monthlyIncome, 0),
    monthlyNetRounded: round(monthlyNet, 0),
    distanceLabel: Number.isFinite(order.distanceKm) ? `${round(order.distanceKm, 1)} km` : '待计算',
    travelCostLabel: Number.isFinite(travelCost) ? `¥${round(travelCost, 0)}` : '待计算',
    modeLabel: travelModeLabel(order.travelMode)
  });
}

function routeFingerprint(order, mode, settings) {
  if (!settings) return '';
  return [mode, settings.routeBackend, settings.mapProvider, settings.origin, settings.city, order.address]
    .map((item) => String(item || '').trim().toLowerCase()).join('|');
}

function cacheRoute(order, mode, settings) {
  if (!order.routeResults) order.routeResults = {};
  order.routeResults[mode] = {
    fingerprint: routeFingerprint(order, mode, settings),
    travelCost: order.travelCost,
    distanceKm: order.distanceKm,
    driveMinutes: order.driveMinutes,
    routeSource: order.routeSource,
    resolvedMapAddress: order.resolvedMapAddress || '',
    transitLegs: order.transitLegs || [],
    updatedAt: order.updatedAt || new Date().toISOString()
  };
}

function restoreRoute(order, mode, settings, allowAnyFingerprint) {
  const cached = order.routeResults && order.routeResults[mode];
  if (!cached) return false;
  if (!allowAnyFingerprint && cached.fingerprint !== routeFingerprint(order, mode, settings)) return false;
  Object.assign(order, clone(cached), { travelMode: mode, routeError: null });
  if (order.transportCovered || mode === 'free') order.travelCost = 0;
  return Number.isFinite(order.driveMinutes) && Number.isFinite(order.travelCost);
}

function activateTravelMode(order, mode, settings) {
  const next = clone(order);
  if (next.travelMode && Number.isFinite(next.driveMinutes) && Number.isFinite(next.travelCost)) cacheRoute(next, next.travelMode, settings);
  if (!restoreRoute(next, mode, settings)) {
    next.travelMode = mode;
    next.travelCost = next.transportCovered || mode === 'free' ? 0 : null;
    next.distanceKm = null;
    next.driveMinutes = null;
    next.routeSource = null;
    next.resolvedMapAddress = '';
    next.routeError = '当前出行方式尚未计算';
  }
  return next;
}

function changeRouteContext(order, oldSettings, newSettings) {
  const next = clone(order);
  const mode = newSettings.travelMode || next.travelMode || 'taxi';
  if (next.travelMode && Number.isFinite(next.driveMinutes) && Number.isFinite(next.travelCost)) cacheRoute(next, next.travelMode, oldSettings);
  if (!restoreRoute(next, mode, newSettings)) {
    next.travelMode = mode;
    next.travelCost = next.transportCovered || mode === 'free' ? 0 : null;
    next.distanceKm = null;
    next.driveMinutes = null;
    next.routeSource = null;
    next.resolvedMapAddress = '';
    next.routeError = '路线设置已改变，请重新计算';
  }
  return next;
}

function rangeText(min, max, suffix) {
  if (!Number.isFinite(min)) return '待确认';
  const first = round(min, Number.isInteger(min) ? 0 : 1);
  const second = Number.isFinite(max) && max > min ? `–${round(max, Number.isInteger(max) ? 0 : 1)}` : '';
  return `${first}${second}${suffix || ''}`;
}

function copyText(order, settings) {
  const item = derive(order, settings);
  const summary = [
    `来源群：${item.source || '未命名群'}`,
    item.orderCode ? `订单号：${item.orderCode}` : '',
    `年级：${item.grade || '待确认'}`,
    `科目：${item.subject || '待确认'}`,
    `地址：${item.address || '待确认'}`,
    `薪资：${rangeText(item.hourlyRate, item.hourlyRateMax, '元/小时')}`,
    `每次时长：${rangeText(item.hours, item.hoursMax, '小时')}`,
    `每周次数：${rangeText(item.weeklyTimes, item.weeklyTimesMax, '次')}`,
    `时间安排：${item.schedule || '待确认'}`,
    `出行方式：${item.modeLabel}`,
    `往返距离：${item.distanceLabel}`,
    `往返出行费：${item.travelCostLabel}`,
    `实际净时薪：${Number.isFinite(item.netHourlyRounded) ? `¥${item.netHourlyRounded}/小时` : '待计算'}`,
    `预估月收入：${Number.isFinite(item.monthlyIncomeRounded) ? `¥${item.monthlyIncomeRounded}/月` : '待确认'}`
  ].filter(Boolean).join('\n');
  return `${item.rawText ? `${item.rawText.trim()}\n\n` : ''}——课值测算——\n${summary}`;
}

module.exports = {
  TRAVEL_MODES,
  clone,
  round,
  travelModeLabel,
  weekdayLabel,
  parseAddress,
  parseSchedule,
  parseOrder,
  mergeImported,
  normalizeRaw,
  eligibilityReason,
  passReason,
  derive,
  routeFingerprint,
  cacheRoute,
  restoreRoute,
  activateTravelMode,
  changeRouteContext,
  copyText
};
