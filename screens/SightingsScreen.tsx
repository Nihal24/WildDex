import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { COLORS } from '../constants/theme';
import { getSightings, Sighting } from '../utils/storage';

const SightingRow: React.FC<{ item: Sighting }> = ({ item }) => {
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
        <Text style={styles.rowConfidence}>{(item.confidence * 100).toFixed(1)}% confidence</Text>
        <Text style={styles.rowDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={COLORS.yellow} />
    </View>
  );
};

const SightingsScreen: React.FC = () => {
  const [sightings, setSightings] = useState<Sighting[]>([]);

  useFocusEffect(useCallback(() => {
    getSightings().then(setSightings);
  }, []));

  const renderItem = ({ item }: { item: Sighting }) => <SightingRow item={item} />;

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
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.yellow,
    letterSpacing: 3,
  },
  badge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  list: { padding: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { color: COLORS.white, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  rowConfidence: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  rowDate: { color: COLORS.darkGrey, fontSize: 11, marginTop: 2 },
  separator: { height: 10 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  emptySub: { fontSize: 14, color: COLORS.grey, textAlign: 'center', paddingHorizontal: 40 },
});
