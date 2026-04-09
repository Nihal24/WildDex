import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';

import FeedScreen from '../screens/FeedScreen';
import ExploreScreen from '../screens/ExploreScreen';
import CameraScreen from '../screens/CameraScreen';
import WildDexScreen from '../screens/WildDexScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

export type BottomTabParamList = {
  Feed: undefined;
  Explore: undefined;
  Camera: undefined;
  WildDex: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const TabIcon = ({
  name, outlineName, focused, colors,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  outlineName: React.ComponentProps<typeof Ionicons>['name'];
  focused: boolean;
  colors: ColorScheme;
}) => (
  <Ionicons name={focused ? name : outlineName} size={24} color={focused ? colors.yellow : colors.grey} />
);

const CameraTabIcon = ({ focused, colors }: { focused: boolean; colors: ColorScheme }) => {
  const styles = makeStyles(colors);
  return (
    <View style={[styles.cameraTab, focused && styles.cameraTabActive]}>
      <Ionicons name="camera" size={26} color={colors.white} />
    </View>
  );
};

const BottomTabs: React.FC = () => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <Tab.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.yellow,
        tabBarInactiveTintColor: colors.grey,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} options={{ tabBarLabel: 'Community', tabBarIcon: ({ focused }) => <TabIcon name="people" outlineName="people-outline" focused={focused} colors={colors} /> }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon name="map" outlineName="map-outline" focused={focused} colors={colors} /> }} />
      <Tab.Screen name="Camera" component={CameraScreen} options={{ tabBarLabel: () => null, tabBarIcon: ({ focused }) => <CameraTabIcon focused={focused} colors={colors} /> }} />
      <Tab.Screen name="WildDex" component={WildDexScreen} options={{ tabBarLabel: 'Collection', tabBarIcon: ({ focused }) => <TabIcon name="paw" outlineName="paw-outline" focused={focused} colors={colors} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon name="person" outlineName="person-outline" focused={focused} colors={colors} /> }} />
    </Tab.Navigator>
  );
};

export default BottomTabs;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.cardBorder,
    borderTopWidth: 1,
    height: 76,
    paddingBottom: 12,
    paddingTop: 4,
  },
  tabLabel: { fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  cameraTab: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.darkGrey,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 8, borderWidth: 1.5, borderColor: COLORS.cardBorder,
  },
  cameraTabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
});
