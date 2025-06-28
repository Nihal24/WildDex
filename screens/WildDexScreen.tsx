import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const WildDexScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>WildDex</Text>
    </View>
  );
};

export default WildDexScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
  },
});
