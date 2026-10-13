const store = require('../../utils/store');
const importer = require('../../utils/importer');
const orderUtils = require('../../utils/orders');
const routeService = require('../../utils/route-service');

const SAMPLE = `💤\n2026年08月25日 20:25\n育林1002697 秀洲开学\n学员地址：天星·如意湾\n辅导科目：英语数学\n学员情况：开学初一\n时间安排：周末2次，每次2h\n教员要求：男女不限，负责耐心，有经验\n老师薪水：80/h`;

Page({
  data: { groupOptions: ['＋ 新建群聊'], groupIndex: 0, newGroup: '', rawText: '', resultText: '', importing: false, importLabel: '识别、导入并计算' },
  onLoad() {
    const groups = store.getGroups();
    const selected = getApp().globalData.selectedGroup;
    const options = ['＋ 新建群聊'].concat(groups);
    const index = selected && selected !== 'all' ? Math.max(0, options.indexOf(selected)) : 0;
    this.setData({ groupOptions: options, groupIndex: index });
  },
  changeGroup(event) { this.setData({ groupIndex: Number(event.detail.value) }); },
  inputGroup(event) { this.setData({ newGroup: event.detail.value }); },
  inputText(event) { this.setData({ rawText: event.detail.value }); },
  fillSample() { this.setData({ rawText: SAMPLE }); },
  async parseAndImport() {
    if (this.data.importing) return;
    const source = this.data.groupIndex === 0 ? this.data.newGroup.trim() : this.data.groupOptions[this.data.groupIndex];
    if (!source) return wx.showToast({ title: '请先填写群聊名称', icon: 'none' });
    const blocks = importer.splitMessages(this.data.rawText);
    if (!blocks.length) return wx.showToast({ title: '没有识别到完整订单', icon: 'none' });
    this.setData({ importing: true, importLabel: '正在识别订单' });
    const settings = store.getSettings();
    const byCode = new Map();
    const withoutCode = [];
    blocks.map((block) => orderUtils.parseOrder(block, source, settings)).forEach((item) => {
      if (item.orderCode) byCode.set(item.orderCode, item);
      else withoutCode.push(item);
    });
    const incoming = withoutCode.concat(Array.from(byCode.values()));
    const merged = orderUtils.mergeImported(store.getOrders(), incoming);
    const touchedIds = new Set(incoming.map((item) => item.id));
    const all = merged.orders;
    store.saveOrders(all);
    if (!store.getGroups().includes(source)) store.saveGroups(store.getGroups().concat(source));
    getApp().globalData.selectedGroup = source;
    const candidates = all.map((item, index) => ({ item, index })).filter(({ item }) => touchedIds.has(item.id) && !orderUtils.eligibilityReason(item, settings) && item.address && !item.addressAmbiguous && !Number.isFinite(item.driveMinutes));
    const unresolved = incoming.filter((item) => !item.address || item.addressAmbiguous).length;
    let calculated = 0;
    let failed = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      const entry = candidates[index];
      this.setData({ importLabel: `自动计算 ${index + 1}/${candidates.length}` });
      try {
        const result = await routeService.calculate(entry.item, settings);
        all[entry.index] = routeService.applyResult(entry.item, result, settings);
        calculated += 1;
      } catch (error) {
        all[entry.index].routeError = '计算失败，请稍后重试';
        failed += 1;
      }
    }
    store.saveOrders(all);
    const calculationText = candidates.length ? `自动计算 ${calculated} 条${failed ? `，失败 ${failed} 条` : ''}` : '没有需要自动计算的路线';
    const unresolvedText = unresolved ? `，另有 ${unresolved} 条地址待确认` : '';
    const summary = `识别 ${incoming.length} 条：新增 ${merged.added} 条，更新 ${merged.updated} 条；${calculationText}${unresolvedText}。`;
    this.setData({ resultText: summary, importing: false, importLabel: '识别、导入并计算' });
    wx.showModal({
      title: '导入完成',
      content: summary,
      showCancel: false,
      success: () => wx.switchTab({ url: '/pages/home/home' })
    });
  }
});
