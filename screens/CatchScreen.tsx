import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  StatusBar,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getSightings } from '../utils/storage';

const { height } = Dimensions.get('window');

const CatchScreen: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { label, photoUri } = route.params;

  const [isNew, setIsNew] = useState(false);

  const displayName = label
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();

    // Check if this is the first ever sighting of this species
    getSightings().then((sightings) => {
      const count = sightings.filter((s) => s.label === label).length;
      setIsNew(count === 1);
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.grey} />
      </TouchableOpacity>

      {/* Photo */}
      <View style={styles.photoWrapper}>
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        <View style={styles.photoBadge}>
          <Ionicons name="checkmark-circle" size={15} color="#4CAF50" />
          <Text style={styles.photoBadgeText}>LOGGED TO WILDDEX</Text>
        </View>
      </View>

      {/* Info */}
      <Animated.View style={[styles.info, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {isNew && (
          <View style={styles.discoveryBadge}>
            <Ionicons name="star" size={12} color={COLORS.yellow} />
            <Text style={styles.discoveryText}>NEW DISCOVERY</Text>
          </View>
        )}

        <Text style={styles.name}>{displayName}</Text>

        <TouchableOpacity
          style={styles.learnMoreBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('InfoModal', { label, photoUri })}
        >
          <Text style={styles.learnMoreBtnText}>Learn More</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default CatchScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  backBtn: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 20,
  },
  photoWrapper: {
    height: height * 0.52,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoBadge: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#4CAF50' + '60',
  },
  photoBadgeText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  info: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  discoveryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.yellow + '18',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.yellow + '40',
  },
  discoveryText: {
    color: COLORS.yellow,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  name: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  learnMoreBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  learnMoreBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
