const store = require('./utils/store');

const CLOUD_ENV_ID = 'YOUR_CLOUD_ENV_ID';

App({
  globalData: {
    selectedGroup: 'all',
    cloudEnvId: CLOUD_ENV_ID,
    appVersion: '1.0.0'
  },

  onLaunch() {
    store.ensureInitialized();
    if (wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      });
    }
  }
});
