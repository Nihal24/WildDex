export default {
  expo: {
    name: 'WildDex',
    slug: 'wilddex',
    scheme: 'wilddex',
    version: '1.0.0',
    icon: './assets/icon.png',
    extra: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
      inatApiToken: process.env.INAT_API_TOKEN,
    },
    plugins: [
      ['expo-notifications', { icon: './assets/icon.png', color: '#C0392B' }],
    ],
    android: {
      package: 'com.anonymous.wilddex',
    },
    ios: {
      bundleIdentifier: 'com.anonymous.wilddex',
      usesAppleSignIn: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'WildDex uses your location to log where you spotted each animal.',
        NSPhotoLibraryUsageDescription: 'WildDex needs photo access to set your profile picture.',
      },
    },
  },
};
