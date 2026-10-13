const store = require('../../utils/store');
const orderUtils = require('../../utils/orders');

Page({
  data: { groups: [] },

  onShow() { this.refresh(); },

  refresh() {
    const settings = store.getSettings();
    const orders = store.getOrders();
    const names = Array.from(new Set(store.getGroups().concat(orders.map((item) => item.source).filter(Boolean))));
    const groups = names.map((name) => {
      const groupOrders = orders.filter((item) => item.source === name);
      const pending = groupOrders.filter((item) => !orderUtils.eligibilityReason(item, settings) && item.address && !item.addressAmbiguous && !Number.isFinite(item.driveMinutes)).length;
      return { name, count: groupOrders.length, pendingText: pending ? `${pending} 条待计算` : '已全部计算完毕' };
    });
    this.setData({ groups });
  },

  openImport() { wx.navigateTo({ url: '/pages/import/import' }); },

  selectGroup(event) {
    getApp().globalData.selectedGroup = event.currentTarget.dataset.name;
    wx.switchTab({ url: '/pages/home/home' });
  },

  clearGroup(event) {
    const name = event.currentTarget.dataset.name;
    const count = store.getOrders().filter((item) => item.source === name).length;
    wx.showModal({
      title: `清空“${name}”`,
      content: `将删除该群的 ${count} 条订单。确认后可继续选择是否保留群聊页面。`,
      confirmText: '继续',
      confirmColor: '#a35142',
      success: (result) => {
        if (!result.confirm) return;
        wx.showActionSheet({
          itemList: ['仅删除订单，保留群聊', '删除订单并删除群聊'],
          success: (choice) => {
            store.saveOrders(store.getOrders().filter((item) => item.source !== name));
            if (choice.tapIndex === 1) store.saveGroups(store.getGroups().filter((item) => item !== name));
            else if (!store.getGroups().includes(name)) store.saveGroups(store.getGroups().concat(name));
            this.refresh();
            wx.showToast({ title: '已清空', icon: 'success' });
          }
        });
      }
    });
  }
});
