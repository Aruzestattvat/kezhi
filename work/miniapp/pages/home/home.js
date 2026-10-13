const store = require('../../utils/store');
const orderUtils = require('../../utils/orders');
const routeService = require('../../utils/route-service');

const WEEKDAY_OPTIONS = [
  { value: 0, label: '星期：不限' },
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' }
];
const RANKING_MODES = [
  { value: 'netHourly', label: '按净时薪排行' },
  { value: 'monthlyIncome', label: '按月收入排行' }
];

function statusCopy(item) {
  if (item.status === 'passed') return { label: '已 PASS', css: 'tag-pass' };
  if (item.status === 'ready') return { label: '划算', css: 'tag-green' };
  if (item.status === 'low') return { label: '低于门槛', css: 'tag-warn' };
  return { label: '待确认', css: 'tag-warn' };
}

Page({
  data: {
    search: '',
    filter: 'all',
    selectedGroup: 'all',
    orders: [],
    stats: { best: '—', eligible: 0, passed: 0, pending: 0, average: '—' },
    pendingLabel: '已全部计算完毕',
    weekdayLabels: WEEKDAY_OPTIONS.map((item) => item.label),
    weekdayIndex: 0,
    weekdayValue: 0,
    rankingModeLabels: RANKING_MODES.map((item) => item.label),
    rankingModeIndex: 0,
    rankingModeLabel: '按净时薪排行',
    heroLabel: '当前最优净时薪',
    heroNote: '已扣除打车估算往返费用',
    listTitle: '订单性价比',
    travelModeLabels: orderUtils.TRAVEL_MODES.map((item) => item.label),
    travelModeIndex: 0,
    travelModeLabel: '打车',
    calculating: false,
    calculateLabel: '正在计算'
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    const settings = store.getSettings();
    const rankingMode = settings.rankingMode === 'monthlyIncome' ? 'monthlyIncome' : 'netHourly';
    const selectedGroup = getApp().globalData.selectedGroup || 'all';
    const rawOrders = store.getOrders();
    let view = rawOrders.map((item) => orderUtils.derive(item, settings));
    const query = this.data.search.trim().toLowerCase();
    if (selectedGroup !== 'all') view = view.filter((item) => item.source === selectedGroup);
    if (this.data.filter === 'all') view = view.filter((item) => item.status !== 'passed');
    else view = view.filter((item) => item.status === this.data.filter);
    if (this.data.weekdayValue) view = view.filter((item) => item.weekdays.includes(this.data.weekdayValue));
    if (query) view = view.filter((item) => [item.orderCode, item.grade, item.subject, item.address, item.source].join(' ').toLowerCase().includes(query));
    view.sort((a, b) => {
      const first = Number.isFinite(a[rankingMode]) ? a[rankingMode] : -Infinity;
      const second = Number.isFinite(b[rankingMode]) ? b[rankingMode] : -Infinity;
      return second - first || new Date(b.createdAt) - new Date(a.createdAt);
    });
    view = view.map((item, index) => {
      const status = statusCopy(item);
      const monthlyRanking = rankingMode === 'monthlyIncome';
      return Object.assign({}, item, {
        rank: String(index + 1).padStart(2, '0'),
        title: `${item.grade || '年级待确认'} · ${item.subject || '科目待确认'}`,
        statusLabel: status.label,
        statusClass: status.css,
        rateLabel: Number.isFinite(item.hourlyRate) ? `¥${orderUtils.round(item.hourlyRate, 0)}/h` : '待确认',
        hoursLabel: Number.isFinite(item.hours) ? `${orderUtils.round(item.hours, 1)}h` : '待确认',
        netLabel: Number.isFinite(item.netHourlyRounded) ? `¥${item.netHourlyRounded}` : '—',
        monthlyIncomeLabel: Number.isFinite(item.monthlyIncomeRounded) ? `¥${item.monthlyIncomeRounded}` : '待确认',
        rankValueNote: monthlyRanking ? '预估月收入' : '实际净时薪',
        rankValueLabel: monthlyRanking ? (Number.isFinite(item.monthlyIncomeRounded) ? `¥${item.monthlyIncomeRounded}` : '—') : (Number.isFinite(item.netHourlyRounded) ? `¥${item.netHourlyRounded}` : '—'),
        rankValueUnit: monthlyRanking ? '/ 月' : '/ 小时'
      });
    });
    const allDerived = rawOrders.map((item) => orderUtils.derive(item, settings));
    const eligible = allDerived.filter((item) => !item.passReason);
    const calculated = eligible.filter((item) => Number.isFinite(item.netHourly));
    const actionable = eligible.filter((item) => item.address && !item.addressAmbiguous && !Number.isFinite(item.driveMinutes));
    const rankable = eligible.filter((item) => Number.isFinite(item[rankingMode]));
    const best = rankable.slice().sort((a, b) => b[rankingMode] - a[rankingMode])[0];
    const average = calculated.length ? Math.round(calculated.reduce((sum, item) => sum + item.driveMinutes, 0) / calculated.length / 2) : '—';
    const modeIndex = Math.max(0, orderUtils.TRAVEL_MODES.findIndex((item) => item.value === settings.travelMode));
    const rankingModeIndex = Math.max(0, RANKING_MODES.findIndex((item) => item.value === rankingMode));
    const monthlyRanking = rankingMode === 'monthlyIncome';
    this.setData({
      selectedGroup,
      orders: view,
      travelModeIndex: modeIndex,
      travelModeLabel: orderUtils.travelModeLabel(settings.travelMode),
      rankingModeIndex,
      rankingModeLabel: RANKING_MODES[rankingModeIndex].label,
      heroLabel: monthlyRanking ? '当前最高预估月收入' : '当前最优净时薪',
      heroNote: monthlyRanking ? '按每月 4.33 周估算，未扣除出行费' : `已扣除${orderUtils.travelModeLabel(settings.travelMode)}估算往返费用`,
      listTitle: monthlyRanking ? '月收入排行' : '订单性价比',
      stats: {
        best: best ? orderUtils.round(best[rankingMode], 0) : '—',
        eligible: eligible.length,
        passed: allDerived.length - eligible.length,
        pending: actionable.length,
        average
      },
      pendingLabel: actionable.length ? `还有 ${actionable.length} 条待计算` : '已全部计算完毕'
    });
  },

  openImport() { wx.navigateTo({ url: '/pages/import/import' }); },
  openDetail(event) { wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` }); },
  onSearch(event) { this.setData({ search: event.detail.value }, () => this.refresh()); },
  setFilter(event) { this.setData({ filter: event.currentTarget.dataset.filter }, () => this.refresh()); },
  clearGroupFilter() { getApp().globalData.selectedGroup = 'all'; this.refresh(); },

  changeWeekday(event) {
    const index = Number(event.detail.value);
    const selected = WEEKDAY_OPTIONS[index] || WEEKDAY_OPTIONS[0];
    this.setData({ weekdayIndex: index, weekdayValue: selected.value }, () => this.refresh());
  },

  changeRankingMode(event) {
    const index = Number(event.detail.value);
    const selected = RANKING_MODES[index] || RANKING_MODES[0];
    store.saveSettings(Object.assign({}, store.getSettings(), { rankingMode: selected.value }));
    this.refresh();
  },

  changeTravelMode(event) {
    const index = Number(event.detail.value);
    const selected = orderUtils.TRAVEL_MODES[index];
    const settings = store.getSettings();
    if (!selected || selected.value === settings.travelMode) return;
    const nextSettings = Object.assign({}, settings, { travelMode: selected.value });
    const nextOrders = store.getOrders().map((item) => orderUtils.activateTravelMode(item, selected.value, nextSettings));
    store.saveSettings(nextSettings);
    store.saveOrders(nextOrders);
    const pending = nextOrders.filter((item) => !orderUtils.eligibilityReason(item, nextSettings) && item.address && !item.addressAmbiguous && !Number.isFinite(item.driveMinutes)).length;
    wx.showToast({ title: pending ? `还有 ${pending} 条待计算` : '已全部计算完毕', icon: 'none' });
    this.refresh();
  },

  async calculatePending() {
    if (this.data.calculating) return;
    const settings = store.getSettings();
    const all = store.getOrders();
    const indexes = all.map((item, index) => ({ item, index })).filter(({ item }) => !orderUtils.eligibilityReason(item, settings) && item.address && !item.addressAmbiguous && !Number.isFinite(item.driveMinutes));
    if (!indexes.length) return;
    this.setData({ calculating: true });
    let done = 0;
    let failed = 0;
    for (const entry of indexes) {
      this.setData({ calculateLabel: `计算 ${done + 1}/${indexes.length}` });
      try {
        const result = await routeService.calculate(entry.item, settings);
        all[entry.index] = routeService.applyResult(entry.item, result, settings);
      } catch (error) {
        all[entry.index].routeError = '计算失败，请稍后重试';
        failed += 1;
      }
      done += 1;
    }
    store.saveOrders(all);
    this.setData({ calculating: false });
    wx.showToast({ title: failed ? `完成 ${done - failed} 条，失败 ${failed} 条` : '已全部计算完毕', icon: 'none' });
    this.refresh();
  }
});
