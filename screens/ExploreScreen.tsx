import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

const ExploreScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EXPLORE</Text>
      </View>
      <View style={styles.placeholder}>
        <Ionicons name="map-outline" size={64} color={COLORS.darkGrey} />
        <Text style={styles.placeholderTitle}>Coming Soon</Text>
        <Text style={styles.placeholderSub}>
          See a map of wildlife sightings near you
        </Text>
      </View>
    </SafeAreaView>
  );
};

export default ExploreScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.yellow,
    letterSpacing: 3,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  placeholderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  placeholderSub: {
    fontSize: 14,
    color: COLORS.grey,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
