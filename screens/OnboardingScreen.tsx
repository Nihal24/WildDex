import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, TouchableOpacity, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';

const { width } = Dimensions.get('window');

export const ONBOARDING_KEY = 'wilddex_onboarding_done';

const SLIDES = [
  {
    id: '1',
    emoji: '🦁',
    title: 'Welcome to WildDex',
    sub: 'Your personal Pokédex for the real animal kingdom!',
    accent: '#A83220',
  },
  {
    id: '2',
    icon: 'camera-outline' as const,
    emoji: null,
    title: 'Spot & Identify',
    sub: 'Point your camera at any animal and AI identifies it in seconds!',
    accent: '#F5A623',
  },
  {
    id: '3',
    icon: 'book-outline' as const,
    emoji: null,
    title: 'Build Your WildDex',
    sub: 'Every species you discover gets logged in your personal collection. How many can you catch?',
    accent: '#4CAF50',
  },
  {
    id: '4',
    icon: 'people-outline' as const,
    emoji: null,
    title: 'Join the Community',
    sub: 'Share sightings, follow other spotters, and climb the leaderboard!',
    accent: '#3B4CCA',
  },
];

const OnboardingScreen: React.FC<{ onDone: () => void; userId: string }> = ({ onDone, userId }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [index, setIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);

  const finish = async () => {
    await AsyncStorage.setItem(`${ONBOARDING_KEY}_${userId}`, 'true');
    onDone();
  };

  const next = () => {
    if (index < SLIDES.length - 1) {
      const nextIndex = index + 1;
      flatRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setIndex(nextIndex);
    } else {
      finish();
    }
  };

  const handleScrollEnd = (e: any) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
    setIndex(newIndex);
  };

  const isLast = index === SLIDES.length - 1;
  const accent = SLIDES[index].accent;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={[styles.skipText, isLast && { opacity: 0 }]}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={{ flex: 1 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.iconCircle, { backgroundColor: item.accent + '20', borderColor: item.accent + '50' }]}>
              {item.emoji
                ? <Text style={styles.emoji}>{item.emoji}</Text>
                : <Ionicons name={item.icon!} size={72} color={item.accent} />
              }
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>{item.sub}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === index && { backgroundColor: accent, width: 22 },
            ]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: accent }]}
        onPress={next}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>{isLast ? "Let's Go!" : 'Next'}</Text>
        {!isLast && <Ionicons name="arrow-forward" size={18} color={COLORS.white} />}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default OnboardingScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  skipBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipText: { color: COLORS.grey, fontSize: 15 },
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 164, height: 164, borderRadius: 82,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2,
    marginBottom: 12,
  },
  emoji: { fontSize: 80 },
  title: {
    fontSize: 28, fontWeight: '900', color: COLORS.white,
    textAlign: 'center', letterSpacing: 0.3,
  },
  sub: {
    fontSize: 16, color: COLORS.grey,
    textAlign: 'center', lineHeight: 25,
  },
  dots: {
    flexDirection: 'row', gap: 6, marginBottom: 20,
  },
  dot: {
    height: 6, width: 6, borderRadius: 3,
    backgroundColor: COLORS.cardBorder,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 24,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    width: width - 48,
  },
  btnText: { color: COLORS.white, fontWeight: '800', fontSize: 17 },
});
