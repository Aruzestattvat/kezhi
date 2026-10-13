const store = require('../../utils/store');
const orderUtils = require('../../utils/orders');

const GENDERS = [
  { value: 'any', label: '暂不筛选性别' },
  { value: 'male', label: '男老师' },
  { value: 'female', label: '女老师' }
];

Page({
  data: {
    settings: {},
    genderLabels: GENDERS.map((item) => item.label),
    genderIndex: 0
  },
  onShow() {
    const settings = store.getSettings();
    const genderIndex = Math.max(0, GENDERS.findIndex((item) => item.value === settings.teacherGender));
    this.setData({ settings, genderIndex });
  },
  changeGender(event) { this.setData({ genderIndex: Number(event.detail.value) }); },
  save(event) {
    const values = event.detail.value;
    const oldSettings = store.getSettings();
    const settings = Object.assign({}, oldSettings, {
      routeBackend: 'cloud',
      mapProvider: 'amap',
      teacherGender: GENDERS[this.data.genderIndex].value,
      origin: String(values.origin || '').trim() || store.defaults.origin,
      city: String(values.city || '').trim() || store.defaults.city,
      maxOneWayKm: Number(values.maxOneWayKm) || store.defaults.maxOneWayKm,
      bufferMinutes: Number(values.bufferMinutes) || 0,
      defaultHours: Number(values.defaultHours) || store.defaults.defaultHours,
      minimumNet: Number(values.minimumNet) || store.defaults.minimumNet
    });
    const routeContextChanged = ['routeBackend', 'origin', 'city', 'mapProvider'].some((key) => oldSettings[key] !== settings[key]);
    if (routeContextChanged) store.saveOrders(store.getOrders().map((item) => orderUtils.changeRouteContext(item, oldSettings, settings)));
    store.saveSettings(settings);
    wx.showToast({ title: '设置已保存', icon: 'success' });
    this.onShow();
  },
  clearAll() {
    wx.showModal({
      title: '删除所有订单',
      content: `现有 ${store.getOrders().length} 条订单。收藏和群聊页面默认保留，下一步可选择删除范围。`,
      confirmText: '选择范围',
      confirmColor: '#a35142',
      success: (result) => {
        if (!result.confirm) return;
        wx.showActionSheet({
          itemList: ['仅删除所有订单', '删除订单和群聊', '删除订单、群聊和收藏'],
          success: (choice) => {
            store.clearOrders({ groups: choice.tapIndex >= 1, favorites: choice.tapIndex >= 2 });
            getApp().globalData.selectedGroup = 'all';
            wx.showToast({ title: '删除完成', icon: 'success' });
          }
        });
      }
    });
  }
});
