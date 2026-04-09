import React, { useEffect, useState, Component } from 'react';
import { View, ActivityIndicator, Platform, Text, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import RootNavigator from './navigation/RootNavigator';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/OnboardingScreen';
import { supabase } from './utils/supabase';
import { migrateLocalSightingsToSupabase, clearUserIdCache } from './utils/storage';
import { initNotifications } from './utils/notifications';
import { ThemeProvider, useTheme } from './utils/ThemeContext';

const sentryDsn = Constants.expoConfig?.extra?.sentryDsn;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, tracesSampleRate: 0.2 });
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (sentryDsn) Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D0505', padding: 32, gap: 16 }}>
          <Text style={{ fontSize: 48 }}>🐾</Text>
          <Text style={{ color: '#F5ECD7', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Something went wrong</Text>
          <Text style={{ color: '#8A6060', fontSize: 14, textAlign: 'center' }}>Please restart WildDex to continue.</Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: '#CC0000', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32, marginTop: 8 }}
          >
            <Text style={{ color: '#F5ECD7', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

async function registerPushToken() {
  if (!Device.isDevice) return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  const { status } = existing === 'granted' ? { status: existing } : await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').upsert({ id: user.id, push_token: token });
  }
}

const AppInner: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [hasUsername, setHasUsername] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      migrateLocalSightingsToSupabase();
      registerPushToken();
      initNotifications();
      AsyncStorage.getItem(`${ONBOARDING_KEY}_${session.user.id}`).then((v) => setOnboardingDone(v === 'true'));
      supabase.from('profiles').select('username').eq('id', session.user.id).single().then(({ data }) => {
        setHasUsername(!!data?.username);
      });
    } else {
      clearUserIdCache();
      setOnboardingDone(null);
      setHasUsername(null);
    }
  }, [session]);

  if (loading || (session && (onboardingDone === null || hasUsername === null))) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.yellow} size="large" />
      </View>
    );
  }

  if (!session) return <AuthScreen />;

  if (!hasUsername) {
    return <AuthScreen startAtUsername onUsernameSet={() => setHasUsername(true)} />;
  }

  if (!onboardingDone) {
    return <OnboardingScreen userId={session.user.id} onDone={() => setOnboardingDone(true)} />;
  }

  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
