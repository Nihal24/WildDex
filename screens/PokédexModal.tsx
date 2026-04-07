import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS } from '../constants/theme';
import { getAnimalProfile, AnimalInfo, AnimalStats } from '../utils/claude';

const STATS: { key: keyof AnimalStats; label: string; color: string }[] = [
  { key: 'hp',             label: 'HP',     color: '#4ade80' },
  { key: 'attack',         label: 'ATK',    color: '#f97316' },
  { key: 'defense',        label: 'DEF',    color: '#60a5fa' },
  { key: 'speed',          label: 'SPD',    color: '#facc15' },
  { key: 'special_attack', label: 'SP.ATK', color: '#c084fc' },
  { key: 'special_defense',label: 'SP.DEF', color: '#34d399' },
];

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value / 100,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statBarTrack}>
        <Animated.View
          style={[
            styles.statBarFill,
            { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const PokédexModal: React.FC = () => {
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
        <Text style={styles.headerTitle}>POKÉDEX MATCH</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Pokémon most similar to the{' '}
          <Text style={styles.subtitleAccent}>{displayName}</Text>
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.yellow} />
          </View>
        ) : (
          <>
            {/* Pokémon sprites */}
            {info?.closestPokemon?.length ? (
              <View style={styles.pokeCard}>
                <View style={styles.pokeRow}>
                  {info.closestPokemon.map((p) => (
                    <View key={p.name} style={styles.pokeItem}>
                      <View style={styles.spriteCircle}>
                        {p.spriteUrl ? (
                          <Image source={{ uri: p.spriteUrl }} style={styles.sprite} />
                        ) : (
                          <Text style={styles.spritePlaceholder}>?</Text>
                        )}
                      </View>
                      <Text style={styles.pokeName}>
                        {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text style={styles.errorText}>No Pokédex data available.</Text>
            )}

            {/* Stats */}
            {info?.stats && (
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>BASE STATS</Text>
                {STATS.map(({ key, label: lbl, color }) => (
                  <StatBar
                    key={key}
                    label={lbl}
                    value={info.stats![key] ?? 0}
                    color={color}
                  />
                ))}
                <Text style={styles.statsFooter}>
                  Scored 0–100 relative to all animals
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.wilddexBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('Main', { screen: 'WildDex', params: { newLabel: label } })}
      >
        <Ionicons name="paw" size={18} color={COLORS.white} />
        <Text style={styles.wilddexBtnText}>View in my WildDex</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default PokédexModal;

const styles = StyleSheet.create({
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
  loadingBox: { paddingVertical: 60 },
  errorText: { color: COLORS.grey, fontSize: 14, textAlign: 'center', marginTop: 40 },
  pokeCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  pokeRow: {
    flexDirection: 'row',
    width: '100%',
  },
  pokeItem: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  spriteCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.background,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sprite: { width: 76, height: 76 },
  spritePlaceholder: { color: COLORS.darkGrey, fontSize: 28, fontWeight: '900' },
  pokeName: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Stats
  statsCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statsTitle: {
    color: COLORS.grey,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statLabel: {
    color: COLORS.grey,
    fontSize: 11,
    fontWeight: '700',
    width: 54,
  },
  statBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginHorizontal: 8,
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
  },
  statsFooter: {
    color: COLORS.darkGrey,
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  wilddexBtn: {
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
  wilddexBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
