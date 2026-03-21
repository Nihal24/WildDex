import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import BottomTabs from './navigation/BottomTabs';
import { migrateLocalSightingsToSupabase } from './utils/storage';

const App: React.FC = () => {
  useEffect(() => {
    migrateLocalSightingsToSupabase();
  }, []);

  return (
    <NavigationContainer>
      <BottomTabs />
    </NavigationContainer>
  );
};

export default App;
