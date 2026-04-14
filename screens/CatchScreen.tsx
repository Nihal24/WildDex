import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

  const displayName = label
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const panelAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(panelAnim, { toValue: 0, friction: 9, tension: 65, useNativeDriver: true }),
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
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StatusBar barStyle="light-content" />

      {/* Full-screen photo */}
      <Image source={{ uri: photoUri }} style={styles.fullPhoto} resizeMode="cover" />

      {/* Tap outside glass panel to dismiss */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={dismiss} />

      {/* Top scrim for close button */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent']}
        style={styles.topScrim}
        pointerEvents="none"
      />

      {/* Close button */}
      <TouchableOpacity style={styles.closeBtn} onPress={dismiss}>
        <BlurView intensity={60} tint="dark" style={styles.closeBtnInner}>
          <Ionicons name="close" size={18} color="#fff" />
        </BlurView>
      </TouchableOpacity>

      {/* Glass panel at bottom */}
      <Animated.View style={[styles.panelWrapper, { transform: [{ translateY: panelAnim }] }]}>
        <BlurView intensity={85} tint="dark" style={styles.glassPanel}>
          {/* Handle */}
          <View style={styles.handle} />

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
            <Ionicons name="arrow-forward" size={17} color="#fff" />
          </TouchableOpacity>
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
};

export default CatchScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  panelWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  glassPanel: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 8,
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.yellow + '20',
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
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  loggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  loggedText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },
  statsLine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 2,
  },
  learnMoreBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 12,
  },
  learnMoreBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
