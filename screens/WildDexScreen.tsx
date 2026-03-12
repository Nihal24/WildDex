import React, { useState, useCallback } from 'react';
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
import { COLORS } from '../constants/theme';
import { getDiscoveredLabels, getLatestPhotoForLabel } from '../utils/storage';

const ALL_SPECIES = [
  { id: '001', label: 'chicken' },
  { id: '002', label: 'goose' },
  { id: '003', label: 'pidgeon' },
];

interface SpeciesCardData {
  id: string;
  label: string;
  discovered: boolean;
  photoUri: string | null;
}

const SpeciesCard: React.FC<{ item: SpeciesCardData }> = ({ item }) => (
  <View style={[styles.card, item.discovered ? styles.cardDiscovered : styles.cardUndiscovered]}>
    {item.discovered && item.photoUri ? (
      <Image source={{ uri: item.photoUri }} style={styles.cardImage} />
    ) : (
      <View style={styles.silhouette}>
        <Text style={styles.questionMark}>?</Text>
      </View>
    )}
    <View style={styles.cardFooter}>
      <Text style={styles.cardNumber}>#{item.id}</Text>
      <Text style={styles.cardName}>
        {item.discovered ? item.label.charAt(0).toUpperCase() + item.label.slice(1) : '???'}
      </Text>
    </View>
  </View>
);

const WildDexScreen: React.FC = () => {
  const [species, setSpecies] = useState<SpeciesCardData[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState(0);

  const loadData = async () => {
    const discovered = await getDiscoveredLabels();
    const data = await Promise.all(
      ALL_SPECIES.map(async (s) => {
        const isDiscovered = discovered.has(s.label);
        const photoUri = isDiscovered ? await getLatestPhotoForLabel(s.label) : null;
        return { ...s, discovered: isDiscovered, photoUri };
      })
    );
    setSpecies(data);
    setDiscoveredCount(data.filter((s) => s.discovered).length);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WILDDEX</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discoveredCount}/{ALL_SPECIES.length}</Text>
        </View>
      </View>

      <FlatList
        data={species}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => <SpeciesCard item={item} />}
      />
    </SafeAreaView>
  );
};

export default WildDexScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
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
  badgeText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  grid: {
    padding: 12,
  },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  cardDiscovered: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.yellow,
  },
  cardUndiscovered: {
    backgroundColor: COLORS.undiscovered,
    borderColor: COLORS.darkGrey,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
  },
  silhouette: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  questionMark: {
    fontSize: 32,
    color: COLORS.darkGrey,
    fontWeight: '900',
  },
  cardFooter: {
    padding: 6,
    alignItems: 'center',
  },
  cardNumber: {
    fontSize: 10,
    color: COLORS.grey,
    fontWeight: '600',
  },
  cardName: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
