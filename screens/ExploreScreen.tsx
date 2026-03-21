import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, Image } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getSightings, Sighting } from '../utils/storage';

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const AnimalMarker = ({ photoUri }: { photoUri: string }) => (
  <View style={styles.markerContainer}>
    <View style={styles.markerBubble}>
      <Image source={{ uri: photoUri }} style={styles.markerPhoto} />
    </View>
    <View style={styles.markerTail} />
  </View>
);

const ExploreScreen: React.FC = () => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      const [all, { status }] = await Promise.all([
        getSightings(),
        Location.requestForegroundPermissionsAsync(),
      ]);
      setSightings(all);
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      setLoading(false);
    };
    load();
  }, []));

  const located = sightings.filter((s) => s.latitude != null && s.longitude != null);

  const initialRegion = located.length > 0
    ? { latitude: located[0].latitude!, longitude: located[0].longitude!, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : userLocation
    ? { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 }
    : { latitude: 40.7128, longitude: -74.006, latitudeDelta: 10, longitudeDelta: 10 };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>EXPLORE</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{located.length} pinned</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : (
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton
          userInterfaceStyle="dark"
        >
          {located.map((s, i) => (
            <Marker
              key={i}
              coordinate={{ latitude: s.latitude!, longitude: s.longitude! }}
              anchor={{ x: 0.5, y: 1 }}
            >
              <AnimalMarker photoUri={s.photoUri} />
              <Callout>
                <View style={styles.callout}>
                  <Text style={styles.calloutLabel}>{formatLabel(s.label)}</Text>
                  <Text style={styles.calloutDate}>{new Date(s.timestamp).toLocaleDateString()}</Text>
                  <Text style={styles.calloutConf}>{(s.confidence * 100).toFixed(0)}% confidence</Text>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      )}

      {!loading && located.length === 0 && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="location-outline" size={48} color={COLORS.darkGrey} />
          <Text style={styles.emptyTitle}>No pins yet</Text>
          <Text style={styles.emptySub}>Identify an animal to drop a pin on the map</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default ExploreScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3 },
  badge: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyOverlay: { position: 'absolute', bottom: 80, left: 0, right: 0, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  emptySub: { fontSize: 13, color: COLORS.grey, textAlign: 'center', paddingHorizontal: 40 },
  markerContainer: { alignItems: 'center' },
  markerBubble: {
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  markerPhoto: { width: 48, height: 48 },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.primary,
    marginTop: -1,
  },
  callout: { padding: 8, minWidth: 140 },
  calloutLabel: { fontSize: 15, fontWeight: '700', color: '#000' },
  calloutDate: { fontSize: 12, color: '#555', marginTop: 2 },
  calloutConf: { fontSize: 12, color: '#555' },
});
