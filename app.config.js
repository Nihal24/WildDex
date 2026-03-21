export default {
  expo: {
    name: 'WildDex',
    slug: 'wilddex',
    version: '1.0.0',
    icon: './assets/icon.png',
    extra: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      supabaseUrl: process.env.SUPABASE_URL,
      supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY,
    },
    android: {
      package: 'com.anonymous.wilddex',
    },
    ios: {
      bundleIdentifier: 'com.anonymous.wilddex',
      infoPlist: {
        NSLocationWhenInUseUsageDescription: 'WildDex uses your location to log where you spotted each animal.',
      },
    },
  },
};
