import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getSightings, Sighting, updateSightingLocation } from '../utils/storage';

// --- Edit Location Modal ---
interface EditModalProps {
  sighting: Sighting | null;
  onClose: () => void;
  onSaved: (timestamp: number, location: string, lat?: number, lon?: number) => void;
}

const EditLocationModal: React.FC<EditModalProps> = ({ sighting, onClose, onSaved }) => {
  const [search, setSearch] = useState(sighting?.location ?? '');
  const [suggestions, setSuggestions] = useState<{ city: string; region: string; country: string }[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearch(sighting?.location ?? '');
    setSuggestions([]);
  }, [sighting]);

  const onSearchChange = (text: string) => {
    setSearch(text);
    setSuggestions([]);
    if (timeout.current) clearTimeout(timeout.current);
    if (!text.trim()) return;
    timeout.current = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text.trim())}&limit=5&lang=en`;
        const res = await fetch(url);
        const data = await res.json();
        const features = data.features ?? [];
        const addrs = features.map((f: any) => {
          const p = f.properties;
          const name = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
          const city = p.city || p.town || p.village || '';
          const region = [city, p.state || p.county].filter(Boolean).join(', ');
          const country = p.country || '';
          return { city: name || city, region: name ? region : [p.state || p.county, country].filter(Boolean).join(', '), country: name ? country : '' };
        });
        setSuggestions(addrs);
        setCoords(features.map((f: any) => ({ latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] })));
      } catch {}
    }, 400);
  };

  const save = async (location: string, lat?: number, lon?: number) => {
    if (!sighting) return;
    setSaving(true);
    try {
      await updateSightingLocation(sighting.photoUri, location, lat, lon);
      onSaved(sighting.timestamp, location, lat, lon);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!sighting} animationType="slide" transparent presentationStyle="overFullScreen">
      <ScrollView
        contentContainerStyle={styles.overlay}
        keyboardShouldPersistTaps="always"
        scrollEnabled={false}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Edit Location</Text>
          <View style={styles.inputRow}>
            <Ionicons name="search" size={16} color={COLORS.darkGrey} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.input}
              placeholder="City, park, or address..."
              placeholderTextColor={COLORS.darkGrey}
              value={search}
              onChangeText={onSearchChange}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setSuggestions([]); }} style={{ marginRight: 12 }}>
                <Ionicons name="close-circle" size={18} color={COLORS.darkGrey} />
              </TouchableOpacity>
            )}
          </View>
          {suggestions.length > 0 && (
            <View style={styles.dropdown}>
              {suggestions.map((s, i) => {
                const sub = [s.region, s.country].filter(Boolean).join(', ');
                const location = [s.city, s.region, s.country].filter(Boolean).join(', ');
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dropdownItem, i > 0 && styles.dropdownDivider]}
                    onPress={() => save(location, coords[i]?.latitude, coords[i]?.longitude)}
                  >
                    <Ionicons name="location-outline" size={16} color={COLORS.yellow} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dropdownLine1}>{s.city}</Text>
                      {sub ? <Text style={styles.dropdownLine2}>{sub}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Modal>
  );
};

// --- Sighting Row ---
const SightingRow: React.FC<{ item: Sighting; onEdit: () => void }> = ({ item, onEdit }) => {
  const [photoExists, setPhotoExists] = useState<boolean | null>(null);

  useEffect(() => {
    FileSystem.getInfoAsync(item.photoUri).then(({ exists }) => setPhotoExists(exists));
  }, [item.photoUri]);

  return (
    <View style={styles.row}>
      {photoExists ? (
        <Image source={{ uri: item.photoUri }} style={styles.thumb} />
      ) : (
        <View style={styles.thumbPlaceholder}>
          <Ionicons name="image-outline" size={24} color={COLORS.darkGrey} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowLabel}>
          {item.label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
        </Text>
        {item.location ? (
          <Text style={styles.rowLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={COLORS.grey} /> {item.location}
          </Text>
        ) : null}
        <Text style={styles.rowDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
        <Ionicons name="pencil-outline" size={16} color={COLORS.grey} />
      </TouchableOpacity>
    </View>
  );
};

// --- Main Screen ---
const SightingsScreen: React.FC = () => {
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [editing, setEditing] = useState<Sighting | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = () => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  useFocusEffect(useCallback(() => {
    getSightings().then(setSightings);
  }, []));

  const handleSaved = (timestamp: number, location: string, lat?: number, lon?: number) => {
    setSightings((prev) =>
      prev.map((s) => s.timestamp === timestamp ? { ...s, location, latitude: lat, longitude: lon } : s)
    );
    setEditing(null);
    showToast();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SIGHTINGS</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{sightings.length}</Text>
        </View>
      </View>

      {sightings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="eye-outline" size={64} color={COLORS.darkGrey} />
          <Text style={styles.emptyTitle}>No sightings yet</Text>
          <Text style={styles.emptySub}>Identify an animal to log your first sighting</Text>
        </View>
      ) : (
        <FlatList
          data={sightings}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SightingRow item={item} onEdit={() => setEditing(item)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      <EditLocationModal
        sighting={editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
        <Ionicons name="checkmark-circle" size={16} color={COLORS.yellow} />
        <Text style={styles.toastText}>Location updated</Text>
      </Animated.View>
    </SafeAreaView>
  );
};

export default SightingsScreen;

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
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { color: COLORS.white, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  rowLocation: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  rowDate: { color: COLORS.darkGrey, fontSize: 11, marginTop: 2 },
  editBtn: { padding: 6 },
  separator: { height: 10 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  emptySub: { fontSize: 14, color: COLORS.grey, textAlign: 'center', paddingHorizontal: 40 },
  // Edit modal
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  input: { flex: 1, padding: 14, color: COLORS.white, fontSize: 15 },
  dropdown: { backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  dropdownDivider: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  dropdownLine1: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  dropdownLine2: { color: COLORS.grey, fontSize: 12, marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: COLORS.darkGrey, fontSize: 14 },
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  toastText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
});
