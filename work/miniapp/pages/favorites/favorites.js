const store = require('../../utils/store');
const orderUtils = require('../../utils/orders');

Page({
  data: { orders: [] },
  onShow() {
    const settings = store.getSettings();
    const ids = new Set(store.getFavorites());
    const orders = store.getOrders().filter((item) => ids.has(item.id)).map((item) => {
      const derived = orderUtils.derive(item, settings);
      return Object.assign({}, derived, {
        title: `${derived.grade || '年级待确认'} · ${derived.subject || '科目待确认'}`,
        rateLabel: Number.isFinite(derived.hourlyRate) ? `¥${orderUtils.round(derived.hourlyRate, 0)}/h` : '薪资待确认',
        netLabel: Number.isFinite(derived.netHourlyRounded) ? `¥${derived.netHourlyRounded}/h` : '待计算'
      });
    });
    this.setData({ orders });
  },
  openDetail(event) { wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` }); }
});
