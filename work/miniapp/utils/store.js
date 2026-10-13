const KEYS = {
  settings: 'tutor-value-mini-settings-v1',
  orders: 'tutor-value-mini-orders-v1',
  groups: 'tutor-value-mini-groups-v1',
  favorites: 'tutor-value-mini-favorites-v1'
};

const defaults = {
  mapProvider: 'amap',
  routeBackend: 'cloud',
  travelMode: 'taxi',
  rankingMode: 'netHourly',
  teacherGender: 'any',
  origin: '嘉兴大学梁林校区',
  city: '嘉兴市',
  maxOneWayKm: 20,
  bufferMinutes: 20,
  defaultHours: 2,
  minimumNet: 60
};

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value === '' || value === undefined || value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  wx.setStorageSync(key, value);
}

function getSettings() {
  return Object.assign({}, defaults, read(KEYS.settings, {}), { routeBackend: 'cloud', mapProvider: 'amap' });
}

function saveSettings(settings) {
  write(KEYS.settings, Object.assign({}, defaults, settings, { routeBackend: 'cloud', mapProvider: 'amap' }));
}

function getOrders() { return read(KEYS.orders, []); }
function saveOrders(orders) { write(KEYS.orders, orders); }
function getGroups() { return read(KEYS.groups, []); }
function saveGroups(groups) { write(KEYS.groups, groups); }
function getFavorites() { return read(KEYS.favorites, []); }
function saveFavorites(favorites) { write(KEYS.favorites, favorites); }

function ensureInitialized() {
  if (!read(KEYS.settings, null)) saveSettings(defaults);
  if (!Array.isArray(read(KEYS.orders, null))) saveOrders([]);
  if (!Array.isArray(read(KEYS.groups, null))) saveGroups([]);
  if (!Array.isArray(read(KEYS.favorites, null))) saveFavorites([]);
}

function clearOrders(options) {
  const config = Object.assign({ groups: false, favorites: false }, options || {});
  saveOrders([]);
  if (config.groups) saveGroups([]);
  if (config.favorites) saveFavorites([]);
}

module.exports = {
  KEYS,
  defaults,
  ensureInitialized,
  getSettings,
  saveSettings,
  getOrders,
  saveOrders,
  getGroups,
  saveGroups,
  getFavorites,
  saveFavorites,
  clearOrders
};
