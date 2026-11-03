import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app ships the UI from native-www/ (built by `npm run build:native`) and only talks to the server for data.
const config: CapacitorConfig = {
  appId: process.env.IOS_BUNDLE_ID || 'app.sidebet.ios',
  appName: 'Sidebet',
  webDir: 'native-www',
  ios: { contentInset: 'never', scheme: 'Sidebet', backgroundColor: '#1d2620' },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};
export default config;
