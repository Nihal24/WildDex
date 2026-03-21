import React, { useState, useCallback, useEffect } from 'react';
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
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getDiscoveredLabels, getLatestPhotoForLabel, getSightings, Sighting } from '../utils/storage';
import { getAnimalProfile, AnimalInfo } from '../utils/claude';
import { getRarityFromConservationStatus, RarityInfo } from '../utils/rarity';

const ALL_SPECIES = [
  { id: '001', label: 'bald_eagle' },
  { id: '002', label: 'canada_goose' },
  { id: '003', label: 'crow' },
  { id: '004', label: 'flamingo' },
  { id: '005', label: 'great_horned_owl' },
  { id: '006', label: 'hummingbird' },
  { id: '007', label: 'mallard_duck' },
  { id: '008', label: 'parrot' },
  { id: '009', label: 'peacock' },
  { id: '010', label: 'pelican' },
  { id: '011', label: 'penguin' },
  { id: '012', label: 'pigeon' },
  { id: '013', label: 'robin' },
  { id: '014', label: 'toucan' },
  { id: '015', label: 'chicken' },
  { id: '016', label: 'cat' },
  { id: '017', label: 'cow' },
  { id: '018', label: 'dog' },
  { id: '019', label: 'goat' },
  { id: '020', label: 'horse' },
  { id: '021', label: 'pig' },
  { id: '022', label: 'rabbit' },
  { id: '023', label: 'sheep' },
  { id: '024', label: 'raccoon' },
  { id: '025', label: 'red_fox' },
  { id: '026', label: 'squirrel' },
  { id: '027', label: 'white_tailed_deer' },
  { id: '028', label: 'wolf' },
  { id: '029', label: 'grizzly_bear' },
  { id: '030', label: 'polar_bear' },
  { id: '031', label: 'cheetah' },
  { id: '032', label: 'chimpanzee' },
  { id: '033', label: 'elephant' },
  { id: '034', label: 'giant_panda' },
  { id: '035', label: 'giraffe' },
  { id: '036', label: 'gorilla' },
  { id: '037', label: 'hippo' },
  { id: '038', label: 'kangaroo' },
  { id: '039', label: 'koala' },
  { id: '040', label: 'leopard' },
  { id: '041', label: 'lion' },
  { id: '042', label: 'orangutan' },
  { id: '043', label: 'rhino' },
  { id: '044', label: 'tiger' },
  { id: '045', label: 'zebra' },
  { id: '046', label: 'chameleon' },
  { id: '047', label: 'crocodile' },
  { id: '048', label: 'komodo_dragon' },
  { id: '049', label: 'turtle' },
  { id: '050', label: 'dolphin' },
];

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

interface SpeciesCardData {
  id: string;
  label: string;
  discovered: boolean;
  photoUri: string | null;
}

// --- Segmented Control ---
const SegmentedControl: React.FC<{ active: 'collection' | 'sightings'; onChange: (v: 'collection' | 'sightings') => void }> = ({ active, onChange }) => (
  <View style={styles.segmentWrapper}>
    <TouchableOpacity style={[styles.segment, active === 'collection' && styles.segmentActive]} onPress={() => onChange('collection')}>
      <Text style={[styles.segmentText, active === 'collection' && styles.segmentTextActive]}>Collection</Text>
    </TouchableOpacity>
    <TouchableOpacity style={[styles.segment, active === 'sightings' && styles.segmentActive]} onPress={() => onChange('sightings')}>
      <Text style={[styles.segmentText, active === 'sightings' && styles.segmentTextActive]}>Sightings</Text>
    </TouchableOpacity>
  </View>
);

// --- Species Card ---
const SpeciesCard: React.FC<{ item: SpeciesCardData; onPress: () => void }> = ({ item, onPress }) => {
  const [photoExists, setPhotoExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (item.discovered && item.photoUri) {
      FileSystem.getInfoAsync(item.photoUri).then(({ exists }) => setPhotoExists(exists));
    } else {
      setPhotoExists(false);
    }
  }, [item.photoUri, item.discovered]);

  return (
    <TouchableOpacity
      style={[styles.card, item.discovered ? styles.cardDiscovered : styles.cardUndiscovered]}
      onPress={item.discovered ? onPress : undefined}
      activeOpacity={item.discovered ? 0.7 : 1}
    >
      {photoExists ? (
        <Image source={{ uri: item.photoUri! }} style={styles.cardImage} />
      ) : (
        <View style={styles.silhouette}>
          <Text style={styles.questionMark}>?</Text>
        </View>
      )}
      <View style={styles.cardFooter}>
        <Text style={styles.cardNumber}>#{item.id}</Text>
        <Text style={styles.cardName}>{item.discovered ? formatLabel(item.label) : '???'}</Text>
      </View>
    </TouchableOpacity>
  );
};

// --- Sighting Row ---
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
        <Text style={styles.rowLabel}>{formatLabel(item.label)}</Text>
        <Text style={styles.rowConfidence}>{(item.confidence * 100).toFixed(1)}% confidence</Text>
        <Text style={styles.rowDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={COLORS.yellow} />
    </View>
  );
};

// --- Info Row for Detail Modal ---
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.yellow} style={styles.infoIcon} />
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

// --- Main Screen ---
const WildDexScreen: React.FC = () => {
  const [tab, setTab] = useState<'collection' | 'sightings'>('collection');
  const [species, setSpecies] = useState<SpeciesCardData[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selected, setSelected] = useState<SpeciesCardData | null>(null);
  const [animalInfo, setAnimalInfo] = useState<AnimalInfo | null>(null);
  const [rarity, setRarity] = useState<RarityInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const loadData = async () => {
    const [discovered, allSightings] = await Promise.all([getDiscoveredLabels(), getSightings()]);
    const data = await Promise.all(
      ALL_SPECIES.map(async (s) => {
        const isDiscovered = discovered.has(s.label);
        const photoUri = isDiscovered ? await getLatestPhotoForLabel(s.label) : null;
        return { id: s.id, label: s.label, discovered: isDiscovered, photoUri };
      })
    );
    setSpecies(data);
    setDiscoveredCount(data.filter((s) => s.discovered).length);
    setSightings(allSightings);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openDetail = async (item: SpeciesCardData) => {
    setSelected(item);
    setAnimalInfo(null);
    setRarity(null);
    setInfoError(null);
    setInfoLoading(true);
    try {
      const info = await getAnimalProfile(item.label);
      setAnimalInfo(info);
      setRarity(getRarityFromConservationStatus(info.conservationStatus));
    } catch (e: any) {
      setInfoError(`Error: ${e?.message || 'Unknown error'}`);
    } finally {
      setInfoLoading(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setAnimalInfo(null);
    setRarity(null);
    setInfoError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>WILDDEX</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discoveredCount}/{ALL_SPECIES.length}</Text>
        </View>
      </View>

      <SegmentedControl active={tab} onChange={setTab} />

      {tab === 'collection' ? (
        <FlatList
          key="collection"
          data={species}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <SpeciesCard item={item} onPress={() => openDetail(item)} />
          )}
        />
      ) : sightings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="eye-outline" size={64} color={COLORS.darkGrey} />
          <Text style={styles.emptyTitle}>No sightings yet</Text>
          <Text style={styles.emptySub}>Identify an animal to log your first sighting</Text>
        </View>
      ) : (
        <FlatList
          key="sightings"
          data={sightings}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <SightingRow item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetail} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderNum}>#{selected?.id}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {selected?.photoUri ? (
              <Image source={{ uri: selected.photoUri }} style={styles.detailPhoto} />
            ) : (
              <View style={styles.detailPhotoPlaceholder}>
                <Ionicons name="image-outline" size={48} color={COLORS.darkGrey} />
              </View>
            )}

            <Text style={styles.detailName}>{selected ? formatLabel(selected.label) : ''}</Text>
            {animalInfo && <Text style={styles.sciName}>{animalInfo.scientificName}</Text>}
            {rarity && (
              <View style={[styles.rarityBadge, { borderColor: rarity.color }]}>
                <Text style={styles.rarityEmoji}>{rarity.emoji}</Text>
                <Text style={[styles.rarityLabel, { color: rarity.color }]}>{rarity.label}</Text>
              </View>
            )}

            {infoLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.yellow} />
                <Text style={styles.loadingText}>Asking Claude...</Text>
              </View>
            )}

            {infoError && <Text style={styles.errorText}>{infoError}</Text>}

            {animalInfo && (
              <>
                <View style={styles.infoCard}>
                  <Text style={styles.summaryText}>{animalInfo.summary}</Text>
                  <View style={styles.divider} />
                  <InfoRow icon="leaf-outline" label="Habitat" value={animalInfo.habitat} />
                  <InfoRow icon="restaurant-outline" label="Diet" value={animalInfo.diet} />
                  <InfoRow icon="shield-checkmark-outline" label="Conservation" value={animalInfo.conservationStatus} />
                  <View style={styles.funFactBox}>
                    <Text style={styles.funFactLabel}>Fun Fact</Text>
                    <Text style={styles.funFactText}>{animalInfo.funFact}</Text>
                  </View>
                </View>

                {animalInfo.closestPokemon?.length > 0 && (
                  <View style={styles.pokeCard}>
                    <Text style={styles.pokeTitle}>CLOSEST POKÉMON</Text>
                    <View style={styles.pokeRow}>
                      {animalInfo.closestPokemon.map((p) => (
                        <View key={p.name} style={styles.pokeItem}>
                          {p.spriteUrl ? (
                            <Image source={{ uri: p.spriteUrl }} style={styles.pokeSprite} />
                          ) : (
                            <View style={styles.pokeSritePlaceholder}>
                              <Text style={styles.pokePlaceholderText}>?</Text>
                            </View>
                          )}
                          <Text style={styles.pokeName}>{p.name.charAt(0).toUpperCase() + p.name.slice(1)}</Text>
                          <Text style={styles.pokeReason}>{p.reason}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default WildDexScreen;

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

  // Segmented control
  segmentWrapper: {
    flexDirection: 'row',
    margin: 12,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: COLORS.primary },
  segmentText: { fontSize: 13, fontWeight: '700', color: COLORS.grey },
  segmentTextActive: { color: COLORS.white },

  // Collection grid
  grid: { padding: 12 },
  card: { flex: 1, margin: 6, borderRadius: 10, overflow: 'hidden', borderWidth: 1 },
  cardDiscovered: { backgroundColor: COLORS.card, borderColor: COLORS.yellow },
  cardUndiscovered: { backgroundColor: COLORS.undiscovered, borderColor: COLORS.darkGrey },
  cardImage: { width: '100%', aspectRatio: 1 },
  silhouette: { width: '100%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  questionMark: { fontSize: 32, color: COLORS.darkGrey, fontWeight: '900' },
  cardFooter: { padding: 6, alignItems: 'center' },
  cardNumber: { fontSize: 10, color: COLORS.grey, fontWeight: '600' },
  cardName: { fontSize: 12, color: COLORS.white, fontWeight: '700', textTransform: 'capitalize' },

  // Sightings list
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { color: COLORS.white, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  rowConfidence: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  rowDate: { color: COLORS.darkGrey, fontSize: 11, marginTop: 2 },
  separator: { height: 10 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  emptySub: { fontSize: 14, color: COLORS.grey, textAlign: 'center', paddingHorizontal: 40 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  backButton: { padding: 4 },
  modalHeaderNum: { color: COLORS.grey, fontSize: 16, fontWeight: '600' },
  modalScroll: { padding: 20, alignItems: 'center' },
  detailPhoto: { width: '100%', height: 300, borderRadius: 16, borderWidth: 2, borderColor: COLORS.yellow },
  detailPhotoPlaceholder: { width: '100%', height: 300, borderRadius: 16, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  detailName: { fontSize: 32, fontWeight: '900', color: COLORS.yellow, marginTop: 16, letterSpacing: 1, textTransform: 'capitalize' },
  sciName: { fontSize: 14, color: COLORS.grey, fontStyle: 'italic', marginTop: 4, marginBottom: 16 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  loadingText: { color: COLORS.grey, fontSize: 14 },
  errorText: { color: COLORS.primary, marginTop: 20, textAlign: 'center' },
  infoCard: { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginTop: 8 },
  summaryText: { color: COLORS.white, fontSize: 14, lineHeight: 22 },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoIcon: { marginRight: 12, marginTop: 2 },
  infoText: { flex: 1 },
  infoLabel: { color: COLORS.grey, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: COLORS.white, fontSize: 14, marginTop: 2, lineHeight: 20 },
  funFactBox: { backgroundColor: COLORS.background, borderRadius: 10, padding: 12, marginTop: 4, borderLeftWidth: 3, borderLeftColor: COLORS.yellow },
  funFactLabel: { color: COLORS.yellow, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  funFactText: { color: COLORS.white, fontSize: 14, lineHeight: 20 },
  rarityBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, gap: 6 },
  rarityEmoji: { fontSize: 14 },
  rarityLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  pokeCard: { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.yellow, padding: 16, marginTop: 12, marginBottom: 20 },
  pokeTitle: { color: COLORS.primary, fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 14 },
  pokeRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pokeItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  pokeSprite: { width: 80, height: 80 },
  pokeSritePlaceholder: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8 },
  pokePlaceholderText: { color: COLORS.darkGrey, fontSize: 24, fontWeight: '900' },
  pokeName: { color: COLORS.yellow, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  pokeReason: { color: COLORS.grey, fontSize: 10, textAlign: 'center', marginTop: 2 },
});
