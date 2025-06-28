import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SightingsScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Sightings</Text>
    </View>
  );
};

export default SightingsScreen;

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
