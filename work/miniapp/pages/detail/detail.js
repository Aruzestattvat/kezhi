const store = require('../../utils/store');
const orderUtils = require('../../utils/orders');
const routeService = require('../../utils/route-service');

function money(value) { return Number.isFinite(value) ? `¥${orderUtils.round(value, 0)}` : '待计算'; }

Page({
  data: { id: '', order: null, settings: {}, isFavorite: false, calculating: false, calculateDisabled: false },
  onLoad(options) { this.setData({ id: options.id || '' }); },
  onShow() { this.refresh(); },
  refresh() {
    const settings = store.getSettings();
    const raw = store.getOrders().find((item) => item.id === this.data.id);
    if (!raw) return wx.showToast({ title: '订单不存在或已删除', icon: 'none' });
    const item = orderUtils.derive(raw, settings);
    const status = item.status === 'passed' ? ['已 PASS', 'tag-pass'] : item.status === 'ready' ? ['划算', 'tag-green'] : item.status === 'low' ? ['低于门槛', 'tag-warn'] : ['待确认', 'tag-warn'];
    item.statusLabel = status[0];
    item.statusClass = status[1];
    item.routeSourceLabel = item.routeSource === 'mock' ? `原型模拟 · ${item.modeLabel}` : item.routeSource ? `高德地图 · ${item.modeLabel}` : `${item.modeLabel}路线待计算`;
    item.minutesLabel = Number.isFinite(item.driveMinutes) ? `${orderUtils.round(item.driveMinutes, 0)} 分钟` : '待计算';
    item.hoursLabel = Number.isFinite(item.hours) ? `${orderUtils.round(item.hours, 1)} 小时${item.assumedHours ? '（待确认）' : ''}` : '待确认';
    item.incomeLabel = money(item.income);
    item.cashNetLabel = money(item.cashNet);
    item.netLabel = Number.isFinite(item.netHourlyRounded) ? `¥${item.netHourlyRounded}/小时` : '待计算';
    item.monthlyIncomeLabel = Number.isFinite(item.monthlyIncomeRounded) ? `¥${item.monthlyIncomeRounded}/月` : '待确认';
    item.rateLabel = Number.isFinite(item.hourlyRate) ? `${item.hourlyRateMax > item.hourlyRate ? `${item.hourlyRate}–${item.hourlyRateMax}` : item.hourlyRate} 元/小时` : '待确认';
    item.weeklyLabel = `${item.weeklyTimes || 1}${item.weeklyTimesMax > item.weeklyTimes ? `–${item.weeklyTimesMax}` : ''} 次`;
    item.weekdayLabel = orderUtils.weekdayLabel(item.weekdays);
    this.setData({ settings, order: item, isFavorite: store.getFavorites().includes(item.id), calculateDisabled: this.data.calculating || Boolean(item.passReason) });
  },
  toggleFavorite() {
    const favorites = store.getFavorites();
    const index = favorites.indexOf(this.data.id);
    if (index >= 0) favorites.splice(index, 1);
    else favorites.push(this.data.id);
    store.saveFavorites(favorites);
    this.setData({ isFavorite: index < 0 });
    wx.showToast({ title: index < 0 ? '已收藏' : '已取消收藏', icon: 'none' });
  },
  copyOrder() {
    wx.setClipboardData({ data: orderUtils.copyText(this.data.order, this.data.settings) });
  },
  async calculate() {
    if (this.data.calculating) return;
    this.setData({ calculating: true, calculateDisabled: true });
    try {
      const result = await routeService.calculate(this.data.order, this.data.settings);
      const next = routeService.applyResult(this.data.order, result, this.data.settings);
      const all = store.getOrders();
      const index = all.findIndex((item) => item.id === this.data.id);
      if (index >= 0) all[index] = next;
      store.saveOrders(all);
      wx.showToast({ title: '计算完成', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: '计算失败，请稍后重试', icon: 'none' });
    } finally {
      this.setData({ calculating: false });
      this.refresh();
    }
  }
});
