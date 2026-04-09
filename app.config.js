export default {
  expo: {
    name: 'WildDex',
    slug: 'wilddex',
    scheme: 'wilddex',
    version: '1.0.0',
    icon: './assets/icon.png',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#0F0A06',
    },
    extra: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      sentryDsn: process.env.SENTRY_DSN,
      eas: { projectId: '6777bdbf-f5a4-4d86-a971-310b0a004f90' },
    },
    plugins: [
      ['expo-notifications', { icon: './assets/icon.png', color: '#A83220' }],
      '@sentry/react-native/expo',
    ],
    android: {
      package: 'com.nihalmandava.wilddex',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0F0A06',
      },
    },
    ios: {
      bundleIdentifier: 'com.nihalmandava.wilddex',
      buildNumber: '1',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'WildDex uses your location to log where you spotted each animal.',
        NSPhotoLibraryUsageDescription: 'WildDex needs photo access to set your profile picture.',
        NSCameraUsageDescription: 'WildDex uses your camera to identify and photograph animals.',
        NSPhotoLibraryAddUsageDescription: 'WildDex saves your sighting cards to Photos.',
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
        ],
      },
    },
  },
};
