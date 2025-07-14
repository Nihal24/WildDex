import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ExploreScreen: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Explore Nearby Wildlife</Text>
    </View>
  );
};

export default ExploreScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 50,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
});
