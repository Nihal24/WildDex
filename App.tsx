import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RootNavigator from './navigation/RootNavigator';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/OnboardingScreen';
import { supabase } from './utils/supabase';
import { migrateLocalSightingsToSupabase, clearUserIdCache } from './utils/storage';
import { initNotifications } from './utils/notifications';
import { COLORS } from './constants/theme';

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

const App: React.FC = () => {
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

export default App;
