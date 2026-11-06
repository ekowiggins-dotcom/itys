import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app ships the UI from native-www/ (built by `npm run build:native`) and only talks to the server for data.
const config: CapacitorConfig = {
  appId: process.env.IOS_BUNDLE_ID || 'app.wholl.ios',
  appName: 'Who’ll',
  webDir: 'native-www',
  ios: { contentInset: 'never', scheme: 'Calld', backgroundColor: '#17201B' },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};
export default config;
