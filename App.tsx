import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabs from './navigation/BottomTabs';

const App: React.FC = () => {
  return (
    <NavigationContainer>
      <BottomTabs />
    </NavigationContainer>
  );
};

export default App;
