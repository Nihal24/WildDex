import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import ExploreScreen from '../screens/ExploreScreen';
import CameraScreen from '../screens/CameraScreen';
import WildDexScreen from '../screens/WildDexScreen';
import SightingsScreen from '../screens/SightingsScreen';

export type BottomTabParamList = {
  Explore: undefined;
  Camera: undefined;
  WildDex: undefined;
  Sightings: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();

const BottomTabs: React.FC = () => {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="WildDex" component={WildDexScreen} />
      <Tab.Screen name="Sightings" component={SightingsScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabs;
