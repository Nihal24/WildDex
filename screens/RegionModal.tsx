import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getAnimalProfile, AnimalInfo, Continent } from '../utils/claude';
import { WorldMap } from '../components/WorldMap';

const CONTINENT_ICONS: Record<Continent, string> = {
  Africa: '🌍',
  Asia: '🌏',
  Europe: '🌍',
  'North America': '🌎',
  'South America': '🌎',
  Oceania: '🌏',
  Antarctica: '🧊',
};

const RegionModal: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { label, photoUri } = route.params;

  const [info, setInfo] = useState<AnimalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = label
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  useEffect(() => {
    getAnimalProfile(label)
      .then(setInfo)
      .finally(() => setLoading(false));
  }, [label]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.grey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NATIVE RANGE</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Where in the world you'll find the{' '}
          <Text style={styles.subtitleAccent}>{displayName}</Text>
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.yellow} />
          </View>
        ) : info ? (
          <>
            <View style={styles.mapCard}>
              <WorldMap highlightedContinents={(info.continents ?? []) as Continent[]} />
            </View>

            <View style={styles.chipsWrap}>
              {(info.continents ?? []).map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipEmoji}>{CONTINENT_ICONS[c] ?? '🌐'}</Text>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>Could not load range data.</Text>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.nextBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PokédexModal', { label, photoUri })}
      >
        <Text style={styles.nextBtnText}>Pokédex Match</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default RegionModal;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    color: COLORS.yellow,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  scroll: { padding: 24, paddingBottom: 12, alignItems: 'center' },
  subtitle: {
    color: COLORS.grey,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  subtitleAccent: { color: COLORS.white, fontWeight: '700' },
  mapCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 12,
    marginBottom: 16,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipEmoji: { fontSize: 14 },
  chipText: { color: COLORS.white, fontSize: 13, fontWeight: '600' },
  loadingBox: { paddingVertical: 60 },
  errorText: { color: COLORS.grey, fontSize: 14, textAlign: 'center', marginTop: 40 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
