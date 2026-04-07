import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getSightings, purgeBrokenPhotoSightings, Sighting } from '../utils/storage';

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const AnimalMarker = ({ photoUri, label, selected }: { photoUri: string; label: string; selected: boolean }) => {
  const [failed, setFailed] = React.useState(false);
  const initials = label.split('_').map((w) => w[0]?.toUpperCase()).join('').slice(0, 2);
  return (
    <View style={styles.markerContainer}>
      <View style={[styles.markerBubble, selected && styles.markerBubbleSelected]}>
        {!failed ? (
          <Image source={{ uri: photoUri }} style={styles.markerPhoto} onError={() => setFailed(true)} />
        ) : (
          <View style={styles.markerFallback}>
            <Text style={styles.markerInitials}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={[styles.markerTail, selected && styles.markerTailSelected]} />
    </View>
  );
};

const ExploreScreen: React.FC = () => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSighting, setSelectedSighting] = useState<(Sighting & { latitude: number; longitude: number }) | null>(null);
  const mapRef = useRef<MapView>(null);
  const savedRegion = useRef<Region | null>(null);
  const prevLocatedCount = useRef(0);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      await purgeBrokenPhotoSightings();
      const [all, { status }] = await Promise.all([
        getSightings(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      const located = all.filter((s) => s.latitude != null && s.longitude != null);

      // If a new located sighting was added, animate to it
      if (located.length > prevLocatedCount.current && located.length > 0) {
        const newest = located[0];
        const newRegion = { latitude: newest.latitude!, longitude: newest.longitude!, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        savedRegion.current = newRegion;
        setTimeout(() => mapRef.current?.animateToRegion(newRegion, 600), 300);
      }
      prevLocatedCount.current = located.length;

      setSightings(all);
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      setLoading(false);
    };
    load();
  }, []));

  const locatedRaw = sightings.filter((s) => s.latitude != null && s.longitude != null);

  // Slightly offset markers sharing the same coordinate so they're all tappable
  const coordCount = new Map<string, number>();
  const located = locatedRaw.map((s) => {
    const key = `${s.latitude!.toFixed(5)},${s.longitude!.toFixed(5)}`;
    const count = coordCount.get(key) ?? 0;
    coordCount.set(key, count + 1);
    const angle = (count * 60 * Math.PI) / 180;
    const offset = count === 0 ? 0 : 0.0003;
    return {
      ...s,
      latitude: s.latitude! + offset * Math.cos(angle),
      longitude: s.longitude! + offset * Math.sin(angle),
    };
  });

  const initialRegion = savedRegion.current ?? (
    located.length > 0
      ? { latitude: located[0].latitude!, longitude: located[0].longitude!, latitudeDelta: 0.1, longitudeDelta: 0.1 }
      : userLocation
      ? { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 }
      : { latitude: 40.7128, longitude: -74.006, latitudeDelta: 10, longitudeDelta: 10 }
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <View style={styles.badge}>
          <Ionicons name="location" size={13} color={COLORS.white} />
          <Text style={styles.badgeText}>{located.length} on map</Text>
        </View>
      </View>

      {loading && sightings.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            onRegionChangeComplete={(r) => { savedRegion.current = r; }}
            onPress={() => setSelectedSighting(null)}
            showsUserLocation
            userInterfaceStyle="dark"
          >
            {located.map((s) => (
              <Marker
                key={`${s.timestamp}-${s.label}`}
                coordinate={{ latitude: s.latitude!, longitude: s.longitude! }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={(e) => { e.stopPropagation(); setSelectedSighting(s); }}
              >
                <AnimalMarker
                  photoUri={s.photoUri}
                  label={s.label}
                  selected={false}
                />
              </Marker>
            ))}
          </MapView>

          {/* Custom floating card */}
          {selectedSighting && (
            <View style={styles.floatingCard} onStartShouldSetResponder={() => true}>
              <Image source={{ uri: selectedSighting.photoUri }} style={styles.floatingPhoto} />
              <View style={styles.floatingInfo}>
                <Text style={styles.floatingLabel}>{formatLabel(selectedSighting.label)}</Text>
                <Text style={styles.floatingDate}>{new Date(selectedSighting.timestamp).toLocaleDateString()}</Text>
                {selectedSighting.location && (
                  <View style={styles.floatingLocationRow}>
                    <Ionicons name="location-outline" size={11} color={COLORS.grey} />
                    <Text style={styles.floatingLocation}>{selectedSighting.location}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.floatingClose} onPress={() => setSelectedSighting(null)}>
                <Ionicons name="close" size={18} color={COLORS.grey} />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomButton} onPress={() => {
              const r = savedRegion.current ?? initialRegion;
              mapRef.current?.animateToRegion({ ...r, latitudeDelta: r.latitudeDelta / 2, longitudeDelta: r.longitudeDelta / 2 }, 300);
            }}>
              <Ionicons name="add" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity style={styles.zoomButton} onPress={() => {
              const r = savedRegion.current ?? initialRegion;
              mapRef.current?.animateToRegion({ ...r, latitudeDelta: Math.min(r.latitudeDelta * 2, 90), longitudeDelta: Math.min(r.longitudeDelta * 2, 180) }, 300);
            }}>
              <Ionicons name="remove" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity style={styles.zoomButton} onPress={() => {
              const r = savedRegion.current ?? initialRegion;
              mapRef.current?.animateToRegion({ ...r, latitudeDelta: 180, longitudeDelta: 360 }, 500);
            }}>
              <Ionicons name="earth-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
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
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3, textTransform: 'uppercase' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  map: { flex: 1 },
  zoomControls: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: { height: 1, backgroundColor: COLORS.cardBorder },
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
  markerBubbleSelected: {
    borderColor: COLORS.yellow,
    borderWidth: 3,
  },
  markerPhoto: { width: 48, height: 48 },
  markerFallback: { width: 48, height: 48, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  markerInitials: { color: COLORS.yellow, fontWeight: '900', fontSize: 16 },
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
  markerTailSelected: {
    borderTopColor: COLORS.yellow,
  },
  floatingCard: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingPhoto: { width: 64, height: 64, borderRadius: 10 },
  floatingInfo: { flex: 1, gap: 2 },
  floatingLabel: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  floatingDate: { color: COLORS.grey, fontSize: 12 },
  floatingLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  floatingLocation: { color: COLORS.grey, fontSize: 12 },
  floatingClose: { padding: 4 },
});
