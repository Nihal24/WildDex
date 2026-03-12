export default {
  expo: {
    name: 'wilddex',
    slug: 'wilddex',
    version: '1.0.0',
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
