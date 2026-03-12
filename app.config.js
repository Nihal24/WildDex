export default {
  expo: {
    name: 'WildDex',
    slug: 'wilddex',
    version: '1.0.0',
    icon: './assets/icon.png',
    extra: {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    },
    android: {
      package: 'com.anonymous.wilddex',
    },
    ios: {
      bundleIdentifier: 'com.anonymous.wilddex',
    },
  },
};
