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
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getDiscoveredLabels, getLatestPhotoForLabel, getSightings, Sighting } from '../utils/storage';
import { getAnimalProfile, AnimalInfo } from '../utils/claude';
import { getRarityFromConservationStatus, RarityInfo } from '../utils/rarity';

const ALL_SPECIES = [
  { id: '001', label: 'alligator' },
  { id: '002', label: 'american_goldfinch' },
  { id: '003', label: 'american_robin' },
  { id: '004', label: 'anaconda' },
  { id: '005', label: 'armadillo' },
  { id: '006', label: 'axolotl' },
  { id: '007', label: 'baboon' },
  { id: '008', label: 'bald_eagle' },
  { id: '009', label: 'barn_owl' },
  { id: '010', label: 'barn_swallow' },
  { id: '011', label: 'bat' },
  { id: '012', label: 'bearded_dragon' },
  { id: '013', label: 'beaver' },
  { id: '014', label: 'belted_kingfisher' },
  { id: '015', label: 'binturong' },
  { id: '016', label: 'bison' },
  { id: '017', label: 'black_bear' },
  { id: '018', label: 'black_vulture' },
  { id: '019', label: 'blue_heron' },
  { id: '020', label: 'blue_jay' },
  { id: '021', label: 'boa_constrictor' },
  { id: '022', label: 'bobcat' },
  { id: '023', label: 'bullfrog' },
  { id: '024', label: 'butterfly' },
  { id: '025', label: 'canada_goose' },
  { id: '026', label: 'capybara' },
  { id: '027', label: 'cardinal' },
  { id: '028', label: 'cassowary' },
  { id: '029', label: 'cat' },
  { id: '030', label: 'chameleon' },
  { id: '031', label: 'cheetah' },
  { id: '032', label: 'chicken' },
  { id: '033', label: 'chimpanzee' },
  { id: '034', label: 'chipmunk' },
  { id: '035', label: 'clownfish' },
  { id: '036', label: 'cobra' },
  { id: '037', label: 'cockatoo' },
  { id: '038', label: 'common_raven' },
  { id: '039', label: 'cougar' },
  { id: '040', label: 'cow' },
  { id: '041', label: 'coyote' },
  { id: '042', label: 'crab' },
  { id: '043', label: 'crane' },
  { id: '044', label: 'crocodile' },
  { id: '045', label: 'crow' },
  { id: '046', label: 'deer_mouse' },
  { id: '047', label: 'dingo' },
  { id: '048', label: 'dog' },
  { id: '049', label: 'dolphin' },
  { id: '050', label: 'dragonfly' },
  { id: '051', label: 'echidna' },
  { id: '052', label: 'egret' },
  { id: '053', label: 'elephant' },
  { id: '054', label: 'elephant_seal' },
  { id: '055', label: 'emu' },
  { id: '056', label: 'firefly' },
  { id: '057', label: 'flamingo' },
  { id: '058', label: 'fox_squirrel' },
  { id: '059', label: 'frog' },
  { id: '060', label: 'gecko' },
  { id: '061', label: 'giant_centipede' },
  { id: '062', label: 'giant_panda' },
  { id: '063', label: 'giant_squid' },
  { id: '064', label: 'gila_monster' },
  { id: '065', label: 'giraffe' },
  { id: '066', label: 'goat' },
  { id: '067', label: 'gorilla' },
  { id: '068', label: 'gray_squirrel' },
  { id: '069', label: 'gray_wolf' },
  { id: '070', label: 'great_horned_owl' },
  { id: '071', label: 'great_white_shark' },
  { id: '072', label: 'green_tree_frog' },
  { id: '073', label: 'grizzly_bear' },
  { id: '074', label: 'groundhog' },
  { id: '075', label: 'hammerhead_shark' },
  { id: '076', label: 'hawk' },
  { id: '077', label: 'hercules_beetle' },
  { id: '078', label: 'heron' },
  { id: '079', label: 'hippo' },
  { id: '080', label: 'honey_bee' },
  { id: '081', label: 'horse' },
  { id: '082', label: 'horseshoe_crab' },
  { id: '083', label: 'house_sparrow' },
  { id: '084', label: 'hummingbird' },
  { id: '085', label: 'humpback_whale' },
  { id: '086', label: 'hyena' },
  { id: '087', label: 'iguana' },
  { id: '088', label: 'jaguar' },
  { id: '089', label: 'jellyfish' },
  { id: '090', label: 'kangaroo' },
  { id: '091', label: 'killdeer' },
  { id: '092', label: 'koala' },
  { id: '093', label: 'komodo_dragon' },
  { id: '094', label: 'ladybug' },
  { id: '095', label: 'lemur' },
  { id: '096', label: 'leopard' },
  { id: '097', label: 'lion' },
  { id: '098', label: 'lobster' },
  { id: '099', label: 'luna_moth' },
  { id: '100', label: 'lynx' },
  { id: '101', label: 'macaw' },
  { id: '102', label: 'mallard' },
  { id: '103', label: 'manatee' },
  { id: '104', label: 'manta_ray' },
  { id: '105', label: 'mantis_shrimp' },
  { id: '106', label: 'meerkat' },
  { id: '107', label: 'mockingbird' },
  { id: '108', label: 'monarch_butterfly' },
  { id: '109', label: 'monitor_lizard' },
  { id: '110', label: 'moose' },
  { id: '111', label: 'mountain_goat' },
  { id: '112', label: 'mourning_dove' },
  { id: '113', label: 'mule_deer' },
  { id: '114', label: 'numbat' },
  { id: '115', label: 'octopus' },
  { id: '116', label: 'opossum' },
  { id: '117', label: 'orangutan' },
  { id: '118', label: 'orca' },
  { id: '119', label: 'osprey' },
  { id: '120', label: 'ostrich' },
  { id: '121', label: 'otter' },
  { id: '122', label: 'pangolin' },
  { id: '123', label: 'parrot' },
  { id: '124', label: 'peacock' },
  { id: '125', label: 'pelican' },
  { id: '126', label: 'penguin' },
  { id: '127', label: 'peregrine_falcon' },
  { id: '128', label: 'pig' },
  { id: '129', label: 'pigeon' },
  { id: '130', label: 'pileated_woodpecker' },
  { id: '131', label: 'platypus' },
  { id: '132', label: 'poison_dart_frog' },
  { id: '133', label: 'polar_bear' },
  { id: '134', label: 'porcupine' },
  { id: '135', label: 'praying_mantis' },
  { id: '136', label: 'puffin' },
  { id: '137', label: 'purple_martin' },
  { id: '138', label: 'rabbit' },
  { id: '139', label: 'raccoon' },
  { id: '140', label: 'rattlesnake' },
  { id: '141', label: 'red_eared_slider' },
  { id: '142', label: 'red_fox' },
  { id: '143', label: 'red_panda' },
  { id: '144', label: 'red_tailed_hawk' },
  { id: '145', label: 'red_winged_blackbird' },
  { id: '146', label: 'rhino' },
  { id: '147', label: 'roseate_spoonbill' },
  { id: '148', label: 'ruby_throated_hummingbird' },
  { id: '149', label: 'salamander' },
  { id: '150', label: 'sandhill_crane' },
  { id: '151', label: 'scarlet_macaw' },
  { id: '152', label: 'scorpion' },
  { id: '153', label: 'sea_lion' },
  { id: '154', label: 'sea_otter' },
  { id: '155', label: 'sea_turtle' },
  { id: '156', label: 'seagull' },
  { id: '157', label: 'seahorse' },
  { id: '158', label: 'seal' },
  { id: '159', label: 'secretary_bird' },
  { id: '160', label: 'shark' },
  { id: '161', label: 'sheep' },
  { id: '162', label: 'shoebill' },
  { id: '163', label: 'skunk' },
  { id: '164', label: 'sloth' },
  { id: '165', label: 'sloth_bear' },
  { id: '166', label: 'snake' },
  { id: '167', label: 'snapping_turtle' },
  { id: '168', label: 'snow_leopard' },
  { id: '169', label: 'snowy_owl' },
  { id: '170', label: 'sparrow' },
  { id: '171', label: 'squirrel' },
  { id: '172', label: 'starfish' },
  { id: '173', label: 'starling' },
  { id: '174', label: 'stingray' },
  { id: '175', label: 'stork' },
  { id: '176', label: 'swan' },
  { id: '177', label: 'tapir' },
  { id: '178', label: 'tarantula' },
  { id: '179', label: 'tiger' },
  { id: '180', label: 'tiger_salamander' },
  { id: '181', label: 'tortoise' },
  { id: '182', label: 'toucan' },
  { id: '183', label: 'turkey' },
  { id: '184', label: 'turkey_vulture' },
  { id: '185', label: 'turtle' },
  { id: '186', label: 'vulture' },
  { id: '187', label: 'walking_stick' },
  { id: '188', label: 'walrus' },
  { id: '189', label: 'warthog' },
  { id: '190', label: 'water_moccasin' },
  { id: '191', label: 'whale_shark' },
  { id: '192', label: 'white_tailed_deer' },
  { id: '193', label: 'whooping_crane' },
  { id: '194', label: 'wild_boar' },
  { id: '195', label: 'wolf' },
  { id: '196', label: 'wolverine' },
  { id: '197', label: 'wombat' },
  { id: '198', label: 'woodpecker' },
  { id: '199', label: 'yellow_warbler' },
  { id: '200', label: 'zebra' },
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
  const viewShotRef = useRef<View>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);

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
    setShareSheetVisible(false);
    setCapturedUri(null);
  };

  const openShareSheet = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await captureRef(viewShotRef, { format: 'png', quality: 1 });
      setCapturedUri(uri);
      setShareSheetVisible(true);
    } catch (e: any) {
      Alert.alert('Share failed', e?.message ?? String(e));
    }
  };

  const shareViaSystem = async () => {
    if (!capturedUri) return;
    setShareSheetVisible(false);
    await Sharing.shareAsync(capturedUri, { mimeType: 'image/png' });
  };

  const shareToInstagram = async () => {
    if (!capturedUri) return;
    setShareSheetVisible(false);
    const url = `instagram-stories://share?backgroundImage=${encodeURIComponent(capturedUri)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Instagram not installed', 'Install Instagram to share directly to Stories.');
    }
  };

  const saveToPhotos = async () => {
    if (!capturedUri) return;
    setShareSheetVisible(false);
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to save.');
      return;
    }
    await MediaLibrary.saveToLibraryAsync(capturedUri);
    Alert.alert('Saved!', 'Sighting card saved to your Photos.');
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
            <TouchableOpacity onPress={openShareSheet} style={styles.backButton}>
              <Ionicons name="share-outline" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View ref={viewShotRef} style={styles.shareCard} collapsable={false}>
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
            <Text style={styles.shareWatermark}>WildDex • Pokédex for the real world</Text>
            </View>

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

          {/* Share action sheet — inside detail modal to avoid nested modal conflicts */}
          {shareSheetVisible && (
            <TouchableOpacity style={styles.shareOverlay} activeOpacity={1} onPress={() => setShareSheetVisible(false)}>
              <View style={styles.shareSheet}>
                <Text style={styles.shareTitle}>Share Sighting</Text>

                <TouchableOpacity style={styles.shareOption} onPress={shareToInstagram}>
                  <View style={[styles.shareIconBg, { backgroundColor: '#E1306C' }]}>
                    <Ionicons name="logo-instagram" size={22} color="#fff" />
                  </View>
                  <Text style={styles.shareOptionText}>Instagram Stories</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.darkGrey} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption} onPress={shareViaSystem}>
                  <View style={[styles.shareIconBg, { backgroundColor: COLORS.primary }]}>
                    <Ionicons name="share-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.shareOptionText}>More (Twitter, Facebook…)</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.darkGrey} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareOption} onPress={saveToPhotos}>
                  <View style={[styles.shareIconBg, { backgroundColor: '#4CD964' }]}>
                    <Ionicons name="download-outline" size={22} color="#fff" />
                  </View>
                  <Text style={styles.shareOptionText}>Save to Photos</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.darkGrey} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.shareCancel} onPress={() => setShareSheetVisible(false)}>
                  <Text style={styles.shareCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
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
  shareCard: { width: '100%', alignItems: 'center', backgroundColor: COLORS.background, paddingBottom: 12 },
  shareWatermark: { fontSize: 11, color: COLORS.darkGrey, marginTop: 8, letterSpacing: 0.5 },
  shareOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 },
  shareSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 8 },
  shareTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 8 },
  shareOption: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 4 },
  shareIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  shareOptionText: { flex: 1, color: COLORS.white, fontSize: 15, fontWeight: '600' },
  shareCancel: { marginTop: 8, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12 },
  shareCancelText: { color: COLORS.grey, fontSize: 15, fontWeight: '600' },
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
