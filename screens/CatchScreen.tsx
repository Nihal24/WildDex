import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getSightings } from '../utils/storage';
import { BADGES, Badge } from '../utils/badges';

const CatchScreen: React.FC = () => {
  const { colors: COLORS, theme } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { label, photoUri } = route.params ?? {};

  const [isNew, setIsNew] = useState(false);
  const [speciesCount, setSpeciesCount] = useState(0);
  const [thisSpeciesCount, setThisSpeciesCount] = useState(1);
  const [earnedBadge, setEarnedBadge] = useState<Badge | null>(null);

  const displayName = label
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
    ]).start();

    getSightings().then((sightings) => {
      const forThisSpecies = sightings.filter((s) => s.label === label).length;
      const newSpeciesCount = new Set(sightings.map((s) => s.label)).size;
      setIsNew(forThisSpecies === 1);
      setThisSpeciesCount(forThisSpecies);
      setSpeciesCount(newSpeciesCount);
      const badge = BADGES.find((b) => b.threshold === newSpeciesCount);
      if (badge) setEarnedBadge(badge);
    });
  }, []);

  const dismiss = () => navigation.goBack();

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Tap outside to dismiss */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={dismiss} />

      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Photo */}
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
          <Ionicons name="close" size={18} color={COLORS.white} />
        </TouchableOpacity>

        {/* Body */}
        <View style={styles.body}>
          {isNew && (
            <View style={styles.discoveryBadge}>
              <Ionicons name="star" size={11} color={COLORS.yellow} />
              <Text style={styles.discoveryText}>NEW DISCOVERY</Text>
            </View>
          )}

          <Text style={styles.name}>
            {theme === 'pokedex' ? `A wild ${displayName} appeared!` : `You found a ${displayName}!`}
          </Text>

          <View style={styles.loggedBadge}>
            <Ionicons name="checkmark-circle" size={13} color="#4CAF50" />
            <Text style={styles.loggedText}>Logged to WildDex</Text>
          </View>

          {earnedBadge && (
            <View style={[styles.badgeEarned, { borderColor: earnedBadge.color + '60', backgroundColor: earnedBadge.color + '18' }]}>
              <Text style={styles.badgeEarnedEmoji}>{earnedBadge.emoji}</Text>
              <View>
                <Text style={[styles.badgeEarnedTitle, { color: earnedBadge.color }]}>
                  {earnedBadge.label} Badge Unlocked!
                </Text>
                <Text style={styles.badgeEarnedSub}>{earnedBadge.description} discovered</Text>
              </View>
            </View>
          )}

          <Text style={styles.statsLine}>
            Spotted {thisSpeciesCount}×{'  ·  '}{speciesCount} species in Dex
          </Text>

          <TouchableOpacity
            style={styles.learnMoreBtn}
            activeOpacity={0.85}
            onPress={() => {
              navigation.goBack();
              setTimeout(() => navigation.navigate('InfoModal', { label, photoUri }), 300);
            }}
          >
            <Text style={styles.learnMoreBtnText}>Learn More</Text>
            <Ionicons name="arrow-forward" size={17} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

export default CatchScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  photo: {
    width: '100%',
    height: 220,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 16,
    padding: 6,
  },
  body: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 8,
  },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  loggedText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.yellow + '18',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.yellow + '40',
    marginBottom: 2,
  },
  discoveryText: {
    color: COLORS.yellow,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  statsLine: {
    fontSize: 12,
    color: COLORS.grey,
    textAlign: 'center',
    marginTop: 2,
  },
  learnMoreBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  learnMoreBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  badgeEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    width: '100%',
  },
  badgeEarnedEmoji: { fontSize: 26 },
  badgeEarnedTitle: { fontSize: 13, fontWeight: '800' },
  badgeEarnedSub: { fontSize: 11, color: COLORS.grey, marginTop: 1 },
});
