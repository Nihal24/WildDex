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
  Alert,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getSightings, getLocalSightings, Sighting, updateSightingLocation, deleteSighting } from '../utils/storage';
import { getAnimalProfile, AnimalInfo, AnimalStats } from '../utils/claude';
import { getRarityFromConservationStatus, RarityInfo } from '../utils/rarity';
import { WorldMap } from '../components/WorldMap';
import { Continent } from '../utils/claude';
import { getEarnedBadges, Badge } from '../utils/badges';

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// --- Segmented Control ---
const SegmentedControl: React.FC<{ active: 'collection' | 'sightings'; onChange: (v: 'collection' | 'sightings') => void }> = ({ active, onChange }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  return (
    <View style={styles.segmentWrapper}>
      <TouchableOpacity style={[styles.segment, active === 'collection' && styles.segmentActive]} onPress={() => onChange('collection')}>
        <Text style={[styles.segmentText, active === 'collection' && styles.segmentTextActive]}>Collection</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.segment, active === 'sightings' && styles.segmentActive]} onPress={() => onChange('sightings')}>
        <Text style={[styles.segmentText, active === 'sightings' && styles.segmentTextActive]}>Sightings</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- Discovered Card ---
const DiscoveredCard: React.FC<{ label: string; photoUri: string; number: string; rarityColor?: string; glow?: boolean; onPress: () => void }> = ({ label, photoUri, number, rarityColor, glow, onPress }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!glow) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]),
      { iterations: 5 }
    ).start();
  }, [glow]);

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.cardBorder, COLORS.yellow],
  });

  return (
    <TouchableOpacity activeOpacity={0.75} onPress={onPress}>
      <Animated.View style={[styles.card, glow && { borderColor, borderWidth: 2 }]}>
        <Image source={{ uri: photoUri }} style={styles.cardImage} />
        {rarityColor && <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />}
        <View style={styles.cardFooter}>
          <Text style={styles.cardNumber}>{number}</Text>
          <Text style={styles.cardName} numberOfLines={1}>{formatLabel(label)}</Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// --- Sighting Row ---
const SightingRow: React.FC<{ item: Sighting; onEdit: () => void; onDelete: () => void }> = ({ item, onEdit, onDelete }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [photoExists, setPhotoExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (item.photoUri.startsWith('http')) { setPhotoExists(true); return; }
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
        {item.location ? (
          <Text style={styles.rowLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={11} color={COLORS.grey} /> {item.location}
          </Text>
        ) : null}
        <Text style={styles.rowDate}>{new Date(item.timestamp).toLocaleDateString()}</Text>
      </View>
      <TouchableOpacity onPress={onEdit} style={{ padding: 6 }}>
        <Ionicons name="pencil-outline" size={16} color={COLORS.grey} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onDelete} style={{ padding: 6 }}>
        <Ionicons name="trash-outline" size={16} color={COLORS.grey} />
      </TouchableOpacity>
    </View>
  );
};

// --- Info Row for Detail Modal ---
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={18} color={COLORS.yellow} style={styles.infoIcon} />
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

// --- Pokémon Stat Bar ---
const STAT_CONFIG: { key: keyof AnimalStats; label: string; color: string }[] = [
  { key: 'hp',             label: 'HP',     color: '#4ade80' },
  { key: 'attack',         label: 'ATK',    color: '#f97316' },
  { key: 'defense',        label: 'DEF',    color: '#60a5fa' },
  { key: 'speed',          label: 'SPD',    color: '#facc15' },
  { key: 'special_attack', label: 'SP.ATK', color: '#c084fc' },
  { key: 'special_defense',label: 'SP.DEF', color: '#34d399' },
];

const StatBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value / 100, duration: 600, useNativeDriver: false }).start();
  }, [value]);
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarTrack}>
        <Animated.View style={[styles.statBarFill, { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
};

// --- Main Screen ---
const WildDexScreen: React.FC<{ route?: any; navigation?: any }> = ({ route, navigation }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const newLabel = route?.params?.newLabel as string | undefined;
  const [newBadge, setNewBadge] = useState<Badge | null>(null);
  const badgeScaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!newLabel) return;
    const timer = setTimeout(() => {
      navigation?.setParams({ newLabel: undefined });
    }, 7200);
    return () => clearTimeout(timer);
  }, [newLabel]);

  useEffect(() => {
    if (!newBadge) return;
    Animated.spring(badgeScaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [newBadge]);
  const [tab, setTab] = useState<'collection' | 'sightings'>('collection');
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionSpecies, setCollectionSpecies] = useState<{ label: string; photoUri: string; number: string }[]>([]);
  const [rarityMap, setRarityMap] = useState<Map<string, string>>(new Map());
  const rarityCache = useRef<Map<string, string>>(new Map());
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selected, setSelected] = useState<{ label: string; photoUri: string; number: string } | null>(null);
  const [animalInfo, setAnimalInfo] = useState<AnimalInfo | null>(null);
  const [rarity, setRarity] = useState<RarityInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'info' | 'range' | 'pokemon'>('info');
  const [editingSighting, setEditingSighting] = useState<Sighting | null>(null);
  const [editSearch, setEditSearch] = useState('');
  const [editSuggestions, setEditSuggestions] = useState<{ city: string; region: string; country: string }[]>([]);
  const [editCoords, setEditCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const editTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const modalScrollRef = useRef<ScrollView>(null);
  const tabRowY = useRef(0);

  const showToast = () => {
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const loadData = async (checkBadge = false) => {
    const allSightings = await getSightings();
    const seen = new Set<string>();
    const uniqueSpecies = [...allSightings].sort((a, b) => a.timestamp - b.timestamp).filter(s => {
      const key = s.label.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const newCount = uniqueSpecies.length;
    const collection = uniqueSpecies.map((s, i) => ({
      label: s.label,
      photoUri: s.photoUri,
      number: `#${String(i + 1).padStart(3, '0')}`,
    }));
    setCollectionSpecies(collection);
    setDiscoveredCount(newCount);
    setSightings(allSightings);

    if (checkBadge) {
      // Use local sightings for badge count — always up to date immediately after a catch
      // (Supabase may not have received the insert yet when this runs)
      const localSightings = await getLocalSightings();
      const localSeen = new Set<string>();
      const localCount = localSightings.filter(s => {
        const key = s.label.toLowerCase().trim();
        if (localSeen.has(key)) return false;
        localSeen.add(key);
        return true;
      }).length;
      const badgeCount = Math.max(newCount, localCount);

      const shownRaw = await AsyncStorage.getItem('wilddex_shown_badges');
      const shown: string[] = shownRaw ? JSON.parse(shownRaw) : [];
      const earned = getEarnedBadges(badgeCount).find(b => !shown.includes(b.id));
      if (earned) {
        badgeScaleAnim.setValue(0);
        setNewBadge(earned);
        await AsyncStorage.setItem('wilddex_shown_badges', JSON.stringify([...shown, earned.id]));
      }
    }

    // Fetch rarity — only for labels not already cached
    const { supabase } = await import('../utils/supabase');
    const labels = uniqueSpecies.map(s => s.label);
    const newLabels = labels.filter(l => !rarityCache.current.has(l));
    if (newLabels.length > 0) {
      const { data } = await supabase.from('animal_cache').select('label, data').in('label', newLabels);
      if (data) {
        for (const row of data) {
          const status = (row.data as any)?.conservationStatus ?? '';
          if (status) rarityCache.current.set(row.label, getRarityFromConservationStatus(status).color);
        }
      }
    }
    if (labels.length > 0) {
      const map = new Map<string, string>();
      for (const l of labels) {
        const color = rarityCache.current.get(l);
        if (color) map.set(l, color);
      }
      setRarityMap(map);
    }
  };

  useFocusEffect(useCallback(() => {
    loadData(true);
  }, [newLabel]));

  const onEditSearchChange = (text: string) => {
    setEditSearch(text);
    setEditSuggestions([]);
    if (editTimeout.current) clearTimeout(editTimeout.current);
    if (!text.trim()) return;
    editTimeout.current = setTimeout(async () => {
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
        setEditSuggestions(addrs);
        setEditCoords(features.map((f: any) => ({ latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0] })));
      } catch {}
    }, 400);
  };

  const handleDelete = (photoUri: string, timestamp?: number) => {
    Alert.alert('Delete sighting?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSighting(photoUri, timestamp);
            loadData();
          } catch (e: any) {
            Alert.alert('Delete failed', e.message);
          }
        },
      },
    ]);
  };

  const saveEditLocation = async (index: number) => {
    if (!editingSighting) return;
    const { latitude, longitude } = editCoords[index];
    const s = editSuggestions[index];
    const location = [s.city, s.region, s.country].filter(Boolean).join(', ');
    try {
      await updateSightingLocation(editingSighting.photoUri, location, latitude, longitude);
      setSightings((prev) =>
        prev.map((sg) => sg.photoUri === editingSighting.photoUri ? { ...sg, location, latitude, longitude } : sg)
      );
      showToast();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setEditingSighting(null);
    setEditSearch('');
    setEditSuggestions([]);
  };

  const openDetail = (item: { label: string; photoUri: string }) => {
    setSelected(item);
    setDetailTab('info');
    setAnimalInfo(null);
    setRarity(null);
    setInfoError(null);
    setInfoLoading(true);
    // Don't await — modal opens immediately, info loads in background
    getAnimalProfile(item.label)
      .then((info) => {
        setAnimalInfo(info);
        setRarity(getRarityFromConservationStatus(info.conservationStatus));
      })
      .catch((e: any) => setInfoError(`Error: ${e?.message || 'Unknown error'}`))
      .finally(() => setInfoLoading(false));
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
        <Text style={styles.headerTitle}>WildDex</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{discoveredCount} species</Text>
        </View>
      </View>

      <SegmentedControl active={tab} onChange={(t) => { setTab(t); setSearchQuery(''); }} />

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.darkGrey} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search animals..."
          placeholderTextColor={COLORS.darkGrey}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.darkGrey} />
          </TouchableOpacity>
        )}
      </View>

      {tab === 'collection' ? (
        collectionSpecies.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="paw-outline" size={64} color={COLORS.darkGrey} />
            <Text style={styles.emptyTitle}>No animals found yet</Text>
            <Text style={styles.emptySub}>Start identifying animals to build your collection!</Text>
          </View>
        ) : (
          <FlatList
            key="collection"
            data={collectionSpecies.filter(s => formatLabel(s.label).toLowerCase().includes(searchQuery.toLowerCase()))}
            keyExtractor={(item) => item.label}
            numColumns={3}
            contentContainerStyle={styles.grid}
            windowSize={8}
            removeClippedSubviews
            maxToRenderPerBatch={12}
            initialNumToRender={18}
            renderItem={({ item }) => (
              <DiscoveredCard
                label={item.label}
                photoUri={item.photoUri}
                number={item.number}
                rarityColor={rarityMap.get(item.label)}
                glow={item.label === newLabel}
                onPress={() => openDetail({ label: item.label, photoUri: item.photoUri, number: item.number })}
              />
            )}
          />
        )
      ) : sightings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="eye-outline" size={64} color={COLORS.darkGrey} />
          <Text style={styles.emptyTitle}>No sightings yet</Text>
          <Text style={styles.emptySub}>Identify an animal to log your first sighting</Text>
        </View>
      ) : (
        <FlatList
          key="sightings"
          data={sightings.filter(s => s.label.replace(/_/g, ' ').toLowerCase().includes(searchQuery.toLowerCase()))}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          windowSize={8}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          initialNumToRender={15}
          renderItem={({ item }) => <SightingRow item={item} onEdit={() => { setEditingSighting(item); setEditSearch(item.location ?? ''); setEditSuggestions([]); }} onDelete={() => handleDelete(item.photoUri, item.timestamp)} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Edit Location Modal */}
      <Modal visible={!!editingSighting} animationType="slide" transparent presentationStyle="overFullScreen">
        <TouchableOpacity style={styles.editOverlay} activeOpacity={1} onPress={() => { setEditingSighting(null); setEditSearch(''); setEditSuggestions([]); }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>Edit Location</Text>
            <View style={styles.editInputRow}>
              <Ionicons name="search" size={16} color={COLORS.darkGrey} style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.editInput}
                placeholder="City, park, or address..."
                placeholderTextColor={COLORS.darkGrey}
                value={editSearch}
                onChangeText={onEditSearchChange}
                autoCorrect={false}
              />
              {editSearch.length > 0 && (
                <TouchableOpacity onPress={() => { setEditSearch(''); setEditSuggestions([]); }} style={{ marginRight: 12 }}>
                  <Ionicons name="close-circle" size={18} color={COLORS.darkGrey} />
                </TouchableOpacity>
              )}
            </View>
            {editSuggestions.length > 0 && (
              <ScrollView style={styles.editDropdown} keyboardShouldPersistTaps="always">
                {editSuggestions.map((s, i) => {
                  const sub = [s.region, s.country].filter(Boolean).join(', ');
                  return (
                    <TouchableOpacity key={i} style={[styles.editDropdownItem, i > 0 && styles.editDropdownDivider]} onPress={() => saveEditLocation(i)}>
                      <Ionicons name="location-outline" size={16} color={COLORS.yellow} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.dropdownLine1}>{s.city}</Text>
                        {sub ? <Text style={styles.dropdownLine2}>{sub}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity onPress={() => { setEditingSighting(null); setEditSearch(''); setEditSuggestions([]); }} style={styles.editCancel}>
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
        <Ionicons name="checkmark-circle" size={16} color={COLORS.yellow} />
        <Text style={styles.toastText}>Location updated</Text>
      </Animated.View>

      {/* Badge Earned Modal */}
      <Modal visible={!!newBadge} transparent animationType="fade">
        <View style={styles.badgeOverlay}>
          <Animated.View style={[styles.badgeCard, { transform: [{ scale: badgeScaleAnim }] }]}>
            <Text style={styles.badgeEarnedLabel}>BADGE EARNED</Text>
            <Text style={styles.badgeEmoji}>{newBadge?.emoji}</Text>
            <Text style={styles.badgeName}>{newBadge?.label}</Text>
            <Text style={styles.badgeDesc}>{newBadge?.description} discovered</Text>
            <TouchableOpacity
              style={[styles.badgeBtn, { backgroundColor: newBadge?.color }]}
              onPress={() => setNewBadge(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.badgeBtnText}>Awesome!</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetail} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.modalHeaderNum}>{selected ? `${selected.number}  ${formatLabel(selected.label)}` : ''}</Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView ref={modalScrollRef} contentContainerStyle={styles.modalScroll}>
            <View style={styles.shareCard}>
            {selected?.photoUri ? (
              <Image source={{ uri: selected.photoUri }} style={styles.detailPhoto} />
            ) : (
              <View style={styles.detailPhotoPlaceholder}>
                <Ionicons name="image-outline" size={48} color={COLORS.darkGrey} />
              </View>
            )}

            <Text style={styles.detailName}>{animalInfo?.commonName || (selected ? formatLabel(selected.label) : '')}</Text>
            {animalInfo && <Text style={styles.sciName}>{animalInfo.scientificName}</Text>}
            {rarity && (
              <View style={[styles.rarityBadge, { borderColor: rarity.color }]}>
                <Text style={styles.rarityEmoji}>{rarity.emoji}</Text>
                <Text style={[styles.rarityLabel, { color: rarity.color }]}>{rarity.label}</Text>
              </View>
            )}
            </View>

            {/* Info / Range / Pokédex tab switcher */}
            <View
              style={styles.detailTabRow}
              onLayout={(e) => { tabRowY.current = e.nativeEvent.layout.y; }}
            >
              <TouchableOpacity
                style={[styles.detailTabBtn, detailTab === 'info' && styles.detailTabActive]}
                onPress={() => { setDetailTab('info'); modalScrollRef.current?.scrollTo({ y: tabRowY.current, animated: true }); }}
              >
                <Text style={[styles.detailTabText, detailTab === 'info' && styles.detailTabTextActive]}>Info</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailTabBtn, detailTab === 'range' && styles.detailTabActive]}
                onPress={() => { setDetailTab('range'); modalScrollRef.current?.scrollTo({ y: tabRowY.current, animated: true }); }}
              >
                <Text style={[styles.detailTabText, detailTab === 'range' && styles.detailTabTextActive]}>Range</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.detailTabBtn, detailTab === 'pokemon' && styles.detailTabActive]}
                onPress={() => { setDetailTab('pokemon'); modalScrollRef.current?.scrollTo({ y: tabRowY.current, animated: true }); }}
              >
                <Text style={[styles.detailTabText, detailTab === 'pokemon' && styles.detailTabTextActive]}>Pokédex</Text>
              </TouchableOpacity>
            </View>

            {infoLoading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={COLORS.yellow} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            )}

            {infoError && <Text style={styles.errorText}>{infoError}</Text>}

            {/* All tab content rendered simultaneously for instant switching — hidden when inactive */}
            {animalInfo && (
              <>
                <View style={[styles.infoCard, detailTab !== 'info' && { display: 'none' }]}>
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

                <View style={[styles.rangeCard, detailTab !== 'range' && { display: 'none' }]}>
                  <Text style={styles.rangeTitle}>NATIVE RANGE</Text>
                  <WorldMap highlightedContinents={(animalInfo.continents ?? []) as Continent[]} />
                </View>

                <View style={[styles.infoCard, detailTab !== 'pokemon' && { display: 'none' }]}>
                  {animalInfo.stats && (
                    <View style={styles.statsSection}>
                      <Text style={styles.statsSectionTitle}>BASE STATS</Text>
                      {STAT_CONFIG.map(({ key, label, color }) => (
                        <StatBar key={key} label={label} value={animalInfo.stats![key] ?? 0} color={color} />
                      ))}
                      <Text style={styles.statsFooter}>Scored 0–100 relative to all animals</Text>
                    </View>
                  )}
                  {animalInfo.closestPokemon?.length > 0 ? (
                    <View style={[styles.pokeRow, animalInfo.stats && { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.cardBorder }]}>
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
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.pokeEmptyText}>No Pokédex data yet</Text>
                  )}
                </View>
              </>
            )}
          </ScrollView>

        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

export default WildDexScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
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
  card: { width: (Dimensions.get('window').width - 60) / 3, margin: 6, borderRadius: 10, overflow: 'hidden', borderWidth: 1, backgroundColor: COLORS.card, borderColor: COLORS.cardBorder },
  cardImage: { width: '100%', aspectRatio: 1 },
  rarityDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  cardFooter: { padding: 6, alignItems: 'center' },
  cardNumber: { fontSize: 9, color: COLORS.yellow, fontWeight: '700', letterSpacing: 0.5 },
  cardName: { fontSize: 11, color: COLORS.white, fontWeight: '700', textTransform: 'capitalize' },

  // Sightings list
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 12, padding: 12, gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  thumbPlaceholder: { width: 56, height: 56, borderRadius: 8, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  rowInfo: { flex: 1 },
  rowLabel: { color: COLORS.white, fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  rowConfidence: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  rowLocation: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  rowDate: { color: COLORS.darkGrey, fontSize: 11, marginTop: 2 },
  separator: { height: 10 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: 10, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 9, gap: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  searchInput: { flex: 1, color: COLORS.white, fontSize: 14, padding: 0, letterSpacing: 0 },
  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  editSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 },
  editTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  editInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder },
  editInput: { flex: 1, padding: 14, color: COLORS.white, fontSize: 15 },
  editDropdown: { backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  editDropdownItem: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  editDropdownDivider: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  dropdownLine1: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  dropdownLine2: { color: COLORS.grey, fontSize: 12, marginTop: 1 },
  editCancel: { alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, marginTop: 4 },
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
  editCancelText: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
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
  detailPhoto: { width: '100%', height: 300, borderRadius: 16 },
  detailPhotoPlaceholder: { width: '100%', height: 300, borderRadius: 16, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center' },
  detailName: { fontSize: 24, fontWeight: '700', color: COLORS.white, marginTop: 12, letterSpacing: 0.3, textTransform: 'capitalize' },
  sciName: { fontSize: 14, color: COLORS.grey, fontStyle: 'italic', marginTop: 4, marginBottom: 16 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  loadingText: { color: COLORS.grey, fontSize: 14 },
  errorText: { color: COLORS.primary, marginTop: 20, textAlign: 'center' },
  detailTabRow: { flexDirection: 'row', width: '100%', backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.cardBorder, marginTop: 16, padding: 4, gap: 2 },
  detailTabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  detailTabActive: { backgroundColor: COLORS.primary },
  detailTabText: { color: COLORS.grey, fontWeight: '500', fontSize: 13, letterSpacing: 0.3 },
  detailTabTextActive: { color: COLORS.white, fontWeight: '600', letterSpacing: 0.3 },
  rangeCard: { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginTop: 8 },
  rangeTitle: { color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
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
  pokeCard: { width: '100%', backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, padding: 16, marginTop: 12, marginBottom: 20 },
  pokeTitle: { color: COLORS.primary, fontSize: 12, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginBottom: 14 },
  pokeHeaderRow: { marginBottom: 4 },
  pokeTabTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  pokeTabSubtitle: { color: COLORS.grey, fontSize: 13, lineHeight: 19 },
  pokeEmptyText: { color: COLORS.darkGrey, fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  pokeRow: { flexDirection: 'row', justifyContent: 'space-around' },
  pokeItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  pokeSprite: { width: 80, height: 80 },
  pokeSritePlaceholder: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 8 },
  pokePlaceholderText: { color: COLORS.darkGrey, fontSize: 24, fontWeight: '900' },
  pokeName: { color: COLORS.yellow, fontSize: 12, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  statsSection: { marginTop: 20, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: 16 },
  statsSectionTitle: { color: COLORS.grey, fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 14 },
  statRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statLabel: { color: COLORS.grey, fontSize: 11, fontWeight: '700', width: 54 },
  statBarTrack: { flex: 1, height: 8, backgroundColor: COLORS.background, borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  statBarFill: { height: '100%', borderRadius: 4 },
  statValue: { fontSize: 12, fontWeight: '700', width: 30, textAlign: 'right' },
  statsFooter: { color: COLORS.grey, fontSize: 11, marginTop: 10, textAlign: 'center', fontStyle: 'italic', letterSpacing: 0.3 },
  badgeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  badgeCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    padding: 32,
    gap: 8,
  },
  badgeEarnedLabel: {
    color: COLORS.yellow,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  badgeEmoji: { fontSize: 72 },
  badgeName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
    marginTop: 8,
  },
  badgeDesc: {
    fontSize: 14,
    color: COLORS.grey,
    marginBottom: 16,
  },
  badgeBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
    marginTop: 8,
  },
  badgeBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
