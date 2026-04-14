import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, ActivityIndicator, Image, TouchableOpacity, Animated } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getSightings, purgeBrokenPhotoSightings, Sighting, getFollowingMapSightings, MapSighting } from '../utils/storage';
import { BlurView } from 'expo-blur';

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Unified marker type for display
type DisplaySighting = {
  key: string;
  label: string;
  photoUri: string;
  latitude: number;
  longitude: number;
  timestamp: number;
  location?: string;
  isMine: boolean;
  displayName?: string;
};

const AnimalMarker = ({ photoUri, isMine }: { photoUri: string; isMine: boolean }) => {
  const { colors: COLORS } = useTheme();
  const [failed, setFailed] = React.useState(false);
  return (
    <View style={styles_marker.container}>
      <View style={[styles_marker.bubble, isMine ? { borderColor: COLORS.yellow } : { borderColor: 'rgba(255,255,255,0.7)' }]}>
        {!failed ? (
          <Image
            source={{ uri: photoUri }}
            style={styles_marker.photo}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={[styles_marker.fallback, { backgroundColor: isMine ? COLORS.primary : '#444' }]}>
            <Ionicons name="paw" size={18} color="#fff" />
          </View>
        )}
      </View>
      <View style={[styles_marker.tail, isMine ? { borderTopColor: COLORS.yellow } : { borderTopColor: 'rgba(255,255,255,0.7)' }]} />
    </View>
  );
};

const styles_marker = StyleSheet.create({
  container: { alignItems: 'center' },
  bubble: {
    borderRadius: 26,
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  photo: { width: 44, height: 44 },
  fallback: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

type SelectedItem = DisplaySighting;

const ExploreScreen: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const [mySightings, setMySightings] = useState<Sighting[]>([]);
  const [communitySightings, setCommunitySightings] = useState<MapSighting[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapMode, setMapMode] = useState<'mine' | 'following'>('mine');
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const mapRef = useRef<MapView>(null);
  const savedRegion = useRef<Region | null>(null);
  const prevLocatedCount = useRef(0);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      await purgeBrokenPhotoSightings();
      const [all, communityData, { status }] = await Promise.all([
        getSightings(),
        getFollowingMapSightings(),
        Location.requestForegroundPermissionsAsync(),
      ]);

      const located = all.filter((s) => s.latitude != null && s.longitude != null);

      if (located.length > prevLocatedCount.current && located.length > 0) {
        const newest = located[0];
        const newRegion = { latitude: newest.latitude!, longitude: newest.longitude!, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        savedRegion.current = newRegion;
        setTimeout(() => mapRef.current?.animateToRegion(newRegion, 600), 300);
      }
      prevLocatedCount.current = located.length;

      setMySightings(all);
      setCommunitySightings(communityData);

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      setLoading(false);
    };
    load();
  }, []));

  // Build display sightings based on mode
  const myLocated = mySightings.filter((s) => s.latitude != null && s.longitude != null);

  const getDisplaySightings = (): DisplaySighting[] => {
    if (mapMode === 'mine') {
      return myLocated.map((s) => ({
        key: `mine-${s.timestamp}`,
        label: s.label,
        photoUri: s.photoUri,
        latitude: s.latitude!,
        longitude: s.longitude!,
        timestamp: s.timestamp,
        location: s.location,
        isMine: true,
      }));
    }
    return communitySightings.map((s) => ({
      key: `following-${s.id}`,
      label: s.label,
      photoUri: s.photoUrl,
      latitude: s.latitude,
      longitude: s.longitude,
      timestamp: s.timestamp,
      location: s.location,
      isMine: false,
      displayName: s.displayName,
    }));
  };

  // Slightly offset markers sharing the same coordinate
  const rawDisplaySightings = getDisplaySightings();
  const coordCount = new Map<string, number>();
  const displaySightings = rawDisplaySightings.map((s) => {
    const key = `${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`;
    const count = coordCount.get(key) ?? 0;
    coordCount.set(key, count + 1);
    const angle = (count * 60 * Math.PI) / 180;
    const offset = count === 0 ? 0 : 0.0003;
    return {
      ...s,
      latitude: s.latitude + offset * Math.cos(angle),
      longitude: s.longitude + offset * Math.sin(angle),
    };
  });

  const initialRegion = savedRegion.current ?? (
    myLocated.length > 0
      ? { latitude: myLocated[0].latitude!, longitude: myLocated[0].longitude!, latitudeDelta: 0.1, longitudeDelta: 0.1 }
      : userLocation
      ? { ...userLocation, latitudeDelta: 0.1, longitudeDelta: 0.1 }
      : { latitude: 40.7128, longitude: -74.006, latitudeDelta: 10, longitudeDelta: 10 }
  );

  const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    map: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    // Mode toggle pill
    modeToggle: {
      position: 'absolute',
      top: 16,
      alignSelf: 'center',
      left: 0,
      right: 0,
      alignItems: 'center',
      zIndex: 10,
    },
    togglePill: {
      flexDirection: 'row',
      backgroundColor: COLORS.card,
      borderRadius: 24,
      padding: 3,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 5,
    },
    toggleOption: {
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 20,
    },
    toggleOptionActive: { backgroundColor: COLORS.primary },
    toggleText: { color: COLORS.grey, fontWeight: '600', fontSize: 13 },
    toggleTextActive: { color: '#fff', fontWeight: '700' },
    countPill: {
      position: 'absolute',
      top: 16,
      right: 16,
      backgroundColor: COLORS.card,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    countText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
    // Zoom controls - solid, no blur (blur bleeds map labels)
    zoomControls: {
      position: 'absolute',
      right: 16,
      bottom: 120,
      backgroundColor: COLORS.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.cardBorder,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 5,
    },
    zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    zoomDivider: { height: 1, backgroundColor: COLORS.cardBorder },
    // Floating selection card
    floatingCard: {
      position: 'absolute',
      bottom: 36,
      left: 16,
      right: 16,
      borderRadius: 18,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.45,
      shadowRadius: 12,
      elevation: 10,
    },
    floatingBlur: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
    floatingPhoto: { width: 68, height: 68, borderRadius: 12 },
    floatingInfo: { flex: 1, gap: 2 },
    floatingLabel: { color: '#fff', fontSize: 15, fontWeight: '800' },
    floatingMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
    floatingLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
    floatingLocation: { color: 'rgba(255,255,255,0.55)', fontSize: 12, flex: 1 },
    floatingClose: { padding: 4 },
    myDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.yellow, marginRight: 2 },
    communityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 2 },
  });

  const styles = makeStyles(COLORS);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {loading && mySightings.length === 0 ? (
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
            onPress={() => setSelectedItem(null)}
            showsUserLocation
            userInterfaceStyle="dark"
          >
            {displaySightings.map((s) => (
              <Marker
                key={s.key}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={(e) => { e.stopPropagation(); setSelectedItem(s); }}
              >
                <AnimalMarker photoUri={s.photoUri} isMine={s.isMine} />
              </Marker>
            ))}
          </MapView>

          {/* Mine / Everyone toggle */}
          <View style={styles.modeToggle}>
            <View style={styles.togglePill}>
              <TouchableOpacity
                style={[styles.toggleOption, mapMode === 'mine' && styles.toggleOptionActive]}
                onPress={() => { setMapMode('mine'); setSelectedItem(null); }}
              >
                <Text style={[styles.toggleText, mapMode === 'mine' && styles.toggleTextActive]}>My Sightings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleOption, mapMode === 'following' && styles.toggleOptionActive]}
                onPress={() => { setMapMode('following'); setSelectedItem(null); }}
              >
                <Text style={[styles.toggleText, mapMode === 'following' && styles.toggleTextActive]}>Following</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Count badge */}
          <View style={styles.countPill}>
            <Ionicons name="location" size={12} color={mapMode === 'mine' ? COLORS.yellow : COLORS.primary} />
            <Text style={styles.countText}>{displaySightings.length}</Text>
          </View>

          {/* Selected sighting card */}
          {selectedItem && (
            <View style={styles.floatingCard} onStartShouldSetResponder={() => true}>
              <BlurView intensity={75} tint="dark" style={styles.floatingBlur}>
                <Image source={{ uri: selectedItem.photoUri }} style={styles.floatingPhoto} />
                <View style={styles.floatingInfo}>
                  <Text style={styles.floatingLabel}>{formatLabel(selectedItem.label)}</Text>
                  {!selectedItem.isMine && selectedItem.displayName ? (
                    <Text style={styles.floatingMeta}>@{selectedItem.displayName}</Text>
                  ) : null}
                  <Text style={styles.floatingMeta}>{new Date(selectedItem.timestamp).toLocaleDateString()}</Text>
                  {selectedItem.location && (
                    <View style={styles.floatingLocationRow}>
                      <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.5)" />
                      <Text style={styles.floatingLocation} numberOfLines={1}>{selectedItem.location}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.floatingClose} onPress={() => setSelectedItem(null)}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
                </TouchableOpacity>
              </BlurView>
            </View>
          )}

          {/* Zoom controls - solid background (no blur to avoid map label bleed) */}
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
    </SafeAreaView>
  );
};

export default ExploreScreen;
