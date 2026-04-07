import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabs from './BottomTabs';
import UserProfileScreen from '../screens/UserProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import FollowListScreen from '../screens/FollowListScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import AnimalDetailScreen from '../screens/AnimalDetailScreen';
import CatchScreen from '../screens/CatchScreen';
import InfoModal from '../screens/InfoModal';
import RegionModal from '../screens/RegionModal';
import PokédexModal from '../screens/PokédexModal';

export type RootStackParamList = {
  Main: undefined;
  UserProfile: { userId: string };
  Settings: undefined;
  FollowList: { userId: string; type: 'followers' | 'following' };
  Notifications: undefined;
  AnimalDetail: { label: string; photoUri?: string; id?: string; fromCatch?: boolean };
  Catch: { label: string; photoUri: string };
  InfoModal: { label: string; photoUri: string };
  RegionModal: { label: string; photoUri: string };
  PokédexModal: { label: string; photoUri: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Main" component={BottomTabs} />
    <Stack.Screen
      name="UserProfile"
      component={UserProfileScreen}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="FollowList"
      component={FollowListScreen}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="Notifications"
      component={NotificationsScreen}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="Catch"
      component={CatchScreen}
      options={{ presentation: 'card', animation: 'fade' }}
    />
    <Stack.Screen
      name="AnimalDetail"
      component={AnimalDetailScreen}
      options={{ presentation: 'card', animation: 'slide_from_bottom' }}
    />
    <Stack.Screen
      name="InfoModal"
      component={InfoModal}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="RegionModal"
      component={RegionModal}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
    <Stack.Screen
      name="PokédexModal"
      component={PokédexModal}
      options={{ presentation: 'card', animation: 'slide_from_right' }}
    />
  </Stack.Navigator>
);

export default RootNavigator;
