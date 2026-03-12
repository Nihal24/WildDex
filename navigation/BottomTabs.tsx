import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

import ExploreScreen from '../screens/ExploreScreen';
import CameraScreen from '../screens/CameraScreen';
import WildDexScreen from '../screens/WildDexScreen';
import SightingsScreen from '../screens/SightingsScreen';
import { COLORS } from '../constants/theme';

export type BottomTabParamList = {
  Explore: undefined;
  Camera: undefined;
  WildDex: undefined;
  Sightings: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const CameraTabIcon = ({ focused }: { focused: boolean }) => (
  <View style={[styles.cameraTab, focused && styles.cameraTabActive]}>
    <Ionicons name="camera" size={28} color={COLORS.white} />
  </View>
);

const BottomTabs: React.FC = () => {
  return (
    <Tab.Navigator
      initialRouteName="Camera"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.yellow,
        tabBarInactiveTintColor: COLORS.grey,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={24} color={focused ? COLORS.yellow : COLORS.grey} />
          ),
        }}
      />
      <Tab.Screen
        name="Camera"
        component={CameraScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: ({ focused }) => <CameraTabIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="WildDex"
        component={WildDexScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={focused ? COLORS.yellow : COLORS.grey} />
          ),
        }}
      />
      <Tab.Screen
        name="Sightings"
        component={SightingsScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={focused ? COLORS.yellow : COLORS.grey} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111111',
    borderTopColor: COLORS.primary,
    borderTopWidth: 2,
    height: 72,
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  cameraTab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.darkGrey,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  cameraTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
});
