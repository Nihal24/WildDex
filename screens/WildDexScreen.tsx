import React, { useState, useCallback } from 'react';
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
  ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getDiscoveredLabels, getLatestPhotoForLabel } from '../utils/storage';
import { getAnimalProfile, AnimalInfo } from '../utils/claude';
import { fetchRarity, RarityInfo } from '../utils/rarity';

const ALL_SPECIES = [
  // Birds
  { id: '001', label: 'chicken' },
  { id: '002', label: 'canada goose' },
  { id: '003', label: 'pidgeon', displayName: 'Pigeon' },
  { id: '004', label: 'mallard duck' },
  { id: '005', label: 'crow' },
  { id: '006', label: 'bald eagle' },
  { id: '007', label: 'great horned owl' },
  { id: '008', label: 'flamingo' },
  { id: '009', label: 'peacock' },
  { id: '010', label: 'penguin' },
  { id: '011', label: 'parrot' },
  { id: '012', label: 'robin' },
  { id: '013', label: 'hummingbird' },
  { id: '014', label: 'pelican' },
  { id: '015', label: 'toucan' },
  // Mammals - domestic/common
  { id: '016', label: 'dog' },
  { id: '017', label: 'cat' },
  { id: '018', label: 'rabbit' },
  { id: '019', label: 'horse' },
  { id: '020', label: 'cow' },
  { id: '021', label: 'goat' },
  { id: '022', label: 'pig' },
  { id: '023', label: 'sheep' },
  // Mammals - wildlife
  { id: '024', label: 'squirrel' },
  { id: '025', label: 'white-tailed deer' },
  { id: '026', label: 'red fox' },
  { id: '027', label: 'raccoon' },
  { id: '028', label: 'wolf' },
  { id: '029', label: 'grizzly bear' },
  { id: '030', label: 'polar bear' },
  // Mammals - zoo/exotic
  { id: '031', label: 'lion' },
  { id: '032', label: 'tiger' },
  { id: '033', label: 'cheetah' },
  { id: '034', label: 'leopard' },
  { id: '035', label: 'elephant' },
  { id: '036', label: 'giraffe' },
  { id: '037', label: 'zebra' },
  { id: '038', label: 'hippo' },
  { id: '039', label: 'rhino' },
  { id: '040', label: 'gorilla' },
  { id: '041', label: 'chimpanzee' },
  { id: '042', label: 'orangutan' },
  { id: '043', label: 'giant panda' },
  { id: '044', label: 'koala' },
  { id: '045', label: 'kangaroo' },
  // Reptiles / Amphibians
  { id: '046', label: 'crocodile' },
  { id: '047', label: 'komodo dragon' },
  { id: '048', label: 'green sea turtle' },
  { id: '049', label: 'chameleon' },
  // Aquatic
  { id: '050', label: 'dolphin' },
];

interface SpeciesCardData {
  id: string;
  label: string;
  displayName?: string;
  discovered: boolean;
  photoUri: string | null;
}

// --- Species Card ---
const SpeciesCard: React.FC<{ item: SpeciesCardData; onPress: () => void }> = ({ item, onPress }) => (
  <TouchableOpacity
    style={[styles.card, item.discovered ? styles.cardDiscovered : styles.cardUndiscovered]}
    onPress={item.discovered ? onPress : undefined}
    activeOpacity={item.discovered ? 0.7 : 1}
  >
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
        {item.discovered ? (item.displayName ?? (item.label.charAt(0).toUpperCase() + item.label.slice(1))) : '???'}
      </Text>
    </View>
  </TouchableOpacity>
);

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
  const [species, setSpecies] = useState<SpeciesCardData[]>([]);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [selected, setSelected] = useState<SpeciesCardData | null>(null);
  const [animalInfo, setAnimalInfo] = useState<AnimalInfo | null>(null);
  const [rarity, setRarity] = useState<RarityInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  const loadData = async () => {
    const discovered = await getDiscoveredLabels();
    const data = await Promise.all(
      ALL_SPECIES.map(async (s) => {
        const isDiscovered = discovered.has(s.label);
        const photoUri = isDiscovered ? await getLatestPhotoForLabel(s.label) : null;
        return { id: s.id, label: s.label, displayName: (s as any).displayName, discovered: isDiscovered, photoUri };
      })
    );
    setSpecies(data);
    setDiscoveredCount(data.filter((s) => s.discovered).length);
  };

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const openDetail = async (item: SpeciesCardData) => {
    setSelected(item);
    setAnimalInfo(null);
    setRarity(null);
    setInfoError(null);
    setInfoLoading(true);
    try {
      const [info, rarityInfo] = await Promise.all([
        getAnimalProfile(item.label),
        fetchRarity(item.label),
      ]);
      setAnimalInfo(info);
      setRarity(rarityInfo);
    } catch (e: any) {
      console.error('Animal profile error:', e?.message, e?.status, JSON.stringify(e));
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

      <FlatList
        data={species}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <SpeciesCard item={item} onPress={() => openDetail(item)} />
        )}
      />

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

            <Text style={styles.detailName}>
              {selected?.displayName ?? (selected?.label.charAt(0).toUpperCase() + (selected?.label.slice(1) ?? ''))}
            </Text>
            {animalInfo && <Text style={styles.sciName}>{animalInfo.scientificName}</Text>}
            {rarity && (
              <View style={[styles.rarityBadge, { borderColor: rarity.color }]}>
                <Text style={styles.rarityEmoji}>{rarity.emoji}</Text>
                <Text style={[styles.rarityLabel, { color: rarity.color }]}>{rarity.label}</Text>
                {rarity.observationCount >= 0 && (
                  <Text style={styles.rarityCount}>
                    {rarity.observationCount.toLocaleString()} sightings worldwide
                  </Text>
                )}
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

                {/* Closest Pokémon */}
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
                          <Text style={styles.pokeName}>
                            {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                          </Text>
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
  detailPhoto: { width: '100%', height: 220, borderRadius: 16, borderWidth: 2, borderColor: COLORS.yellow },
  detailPhotoPlaceholder: { width: '100%', height: 220, borderRadius: 16, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
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

  // Rarity badge
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
    gap: 6,
  },
  rarityEmoji: { fontSize: 14 },
  rarityLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  rarityCount: { fontSize: 11, color: COLORS.grey },

  // Pokémon section
  pokeCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 16,
    marginTop: 12,
    marginBottom: 20,
  },
  pokeTitle: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 14,
  },
  pokeRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  pokeItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  pokeSprite: {
    width: 80,
    height: 80,
  },
  pokeSritePlaceholder: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  pokePlaceholderText: {
    color: COLORS.darkGrey,
    fontSize: 24,
    fontWeight: '900',
  },
  pokeName: {
    color: COLORS.yellow,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  pokeReason: {
    color: COLORS.grey,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 2,
  },
});
