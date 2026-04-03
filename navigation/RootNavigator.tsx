import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BottomTabs from './BottomTabs';
import UserProfileScreen from '../screens/UserProfileScreen';

export type RootStackParamList = {
  Main: undefined;
  UserProfile: { userId: string };
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
  </Stack.Navigator>
);

export default RootNavigator;
