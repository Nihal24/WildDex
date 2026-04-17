import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { formatLabel } from '../utils/format';
const CONFETTI_COLORS = ['#FFCB05', '#CC0000', '#4CAF50', '#29B6F6', '#FF7043', '#AB47BC'];
const PARTICLES = Array.from({ length: 18 }, (_, i) => i);

const ConfettiBurst: React.FC<{ active: boolean }> = ({ active }) => {
  const anims = useRef(PARTICLES.map(() => ({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
  }))).current;

  useEffect(() => {
    if (!active) return;
    const animations = anims.map((a, i) => {
      const angle = (i / PARTICLES.length) * 2 * Math.PI;
      const dist = 80 + Math.random() * 80;
      a.x.setValue(0); a.y.setValue(0); a.opacity.setValue(1); a.rotate.setValue(0);
      return Animated.parallel([
        Animated.timing(a.x, { toValue: Math.cos(angle) * dist, duration: 600, useNativeDriver: true }),
        Animated.timing(a.y, { toValue: Math.sin(angle) * dist - 40, duration: 600, useNativeDriver: true }),
        Animated.timing(a.rotate, { toValue: 4, duration: 600, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(a.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
          Animated.timing(a.opacity, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.stagger(20, animations).start();
  }, [active]);

  if (!active) return null;
  return (
    <View style={{ position: 'absolute', top: '40%', left: '50%', zIndex: 10 }} pointerEvents="none">
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            transform: [{ translateX: a.x }, { translateY: a.y }, { rotate: a.rotate.interpolate({ inputRange: [0, 4], outputRange: ['0deg', '720deg'] }) }],
            opacity: a.opacity,
          }}
        />
      ))}
    </View>
  );
};
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getSightings } from '../utils/storage';

const CatchScreen: React.FC = () => {
  const { colors: COLORS, theme } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { label, photoUri } = route.params ?? {};

  const [isNew, setIsNew] = useState(false);
  const [speciesCount, setSpeciesCount] = useState(0);
  const [thisSpeciesCount, setThisSpeciesCount] = useState(1);

  const displayName = formatLabel(label);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
    ]).start();

    getSightings().then((sightings) => {
      const forThisSpecies = sightings.filter((s) => s.label === label).length;
      setIsNew(forThisSpecies === 1);
      setThisSpeciesCount(forThisSpecies);
      setSpeciesCount(new Set(sightings.map((s) => s.label)).size);
    });
  }, []);

  const dismiss = () => navigation.goBack();

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Tap outside to dismiss */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={dismiss} />

      <ConfettiBurst active={isNew} />

      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Photo */}
        <Image source={{ uri: photoUri }} style={styles.photo} contentFit="cover" />

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
});
