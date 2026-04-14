import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../utils/supabase';
import { getSightings, getDiscoveredLabels, getMyDisplayName, updateAvatarUrl, getMyAvatarUrl, calculateSightingStreak, getMyFollowCounts, getProfileStatsCache, setProfileStatsCache } from '../utils/storage';
import { BADGES, getNextBadge } from '../utils/badges';
import { RootStackParamList } from '../navigation/RootNavigator';

const ProfileScreen: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [username, setUsername] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sightingCount, setSightingCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myId, setMyId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Hydrate from cache immediately so there's no flicker on nav
  useEffect(() => {
    getProfileStatsCache().then((cached) => {
      if (!cached) return;
      setSightingCount(cached.sightingCount);
      setStreak(cached.streak);
      setFollowersCount(cached.followersCount);
      setFollowingCount(cached.followingCount);
      if (cached.username) setUsername(cached.username);
      if (cached.avatarUrl) setAvatarUrl(cached.avatarUrl);
    });
  }, []);

  useFocusEffect(useCallback(() => {
    Promise.all([
      getMyDisplayName(),
      getMyAvatarUrl(),
      getSightings(),
      getDiscoveredLabels(),
      getMyFollowCounts(),
      supabase.auth.getUser(),
    ]).then(([name, avatar, sightings, discovered, followCounts, authData]) => {
      const sc = sightings.length;
      const st = calculateSightingStreak(sightings);
      const fc = followCounts.followersCount;
      const fg = followCounts.followingCount;
      setUsername(name);
      setAvatarUrl(avatar);
      setSightingCount(sc);
      setStreak(st);
      setDiscoveredCount(discovered.size);
      setFollowersCount(fc);
      setFollowingCount(fg);
      setMyId(authData.data.user?.id ?? null);
      // Save to cache for instant next-nav render
      setProfileStatsCache({ sightingCount: sc, streak: st, followersCount: fc, followingCount: fg, username: name, avatarUrl: avatar });
    });
  }, []));

  const pickAvatar = async () => {
    Alert.alert('Profile Photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission required', 'Allow camera access to take a profile photo.'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled) await uploadAvatar(result.assets[0].uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permission required', 'Allow photo access to set a profile picture.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
          if (!result.canceled) await uploadAvatar(result.assets[0].uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadAvatar = async (uri: string) => {
    setAvatarUploading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      const filename = `${userId}/avatar.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const { error } = await supabase.storage.from('sighting-photos').upload(filename, formData, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('sighting-photos').getPublicUrl(filename);
      await updateAvatarUrl(data.publicUrl);
      setAvatarUrl(data.publicUrl);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setAvatarUploading(false);
    }
  };


  const avatarLetter = username.charAt(0).toUpperCase();
  const nextBadge = getNextBadge(discoveredCount);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color={COLORS.grey} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero card with gradient banner */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={[COLORS.primary + 'CC', COLORS.primary + '44', 'transparent']}
            style={styles.heroBanner}
          />
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper} disabled={avatarUploading}>
            <View style={styles.avatarCircle}>
              {avatarUploading
                ? <ActivityIndicator color={COLORS.white} />
                : avatarUrl
                ? <Image source={{ uri: avatarUrl }} style={{ width: 84, height: 84, borderRadius: 42 }} resizeMode="cover" />
                : <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              }
            </View>
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          <Text style={styles.displayName}>{username ? `@${username}` : 'Set a username'}</Text>

          <View style={styles.followRow}>
            <TouchableOpacity
              style={styles.followStat}
              onPress={() => myId && navigation.navigate('FollowList', { userId: myId, type: 'followers' })}
            >
              <Text style={styles.followNum}>{followersCount}</Text>
              <Text style={styles.followLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.followDot} />
            <TouchableOpacity
              style={styles.followStat}
              onPress={() => myId && navigation.navigate('FollowList', { userId: myId, type: 'following' })}
            >
              <Text style={styles.followNum}>{followingCount}</Text>
              <Text style={styles.followLabel}>Following</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{sightingCount}</Text>
              <Text style={styles.statLabel}>Sightings</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{streak > 0 ? `${streak}🔥` : '—'}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
          </View>
        </View>

        {/* Badges */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>BADGES</Text>
          <View style={styles.badgeGrid}>
            {BADGES.map((badge) => {
              const earned = discoveredCount >= badge.threshold;
              return (
                <View key={badge.id} style={styles.badgeSlot}>
                  <View style={[styles.badgeCircle, earned ? { backgroundColor: badge.color, shadowColor: badge.color } : styles.badgeCircleLocked]}>
                    <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>{badge.emoji}</Text>
                  </View>
                  <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]}>{badge.label}</Text>
                  <Text style={styles.badgeDesc}>{badge.description}</Text>
                </View>
              );
            })}
          </View>
          {nextBadge && (
            <View style={styles.nextBadgeRow}>
              <Ionicons name="arrow-up-circle-outline" size={13} color={COLORS.grey} />
              <Text style={styles.nextBadgeText}>
                Next: {nextBadge.label} — {nextBadge.threshold - discoveredCount} more species
              </Text>
            </View>
          )}
        </View>


      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3, textTransform: 'uppercase' },
  settingsBtn: { padding: 4 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  heroCard: {
    backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1,
    borderColor: COLORS.cardBorder, alignItems: 'center', paddingHorizontal: 24,
    paddingBottom: 24, gap: 8, overflow: 'hidden',
  },
  heroBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  avatarWrapper: { position: 'relative', marginTop: 24 },
  avatarCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, borderRadius: 11,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.card,
  },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  displayName: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  followStat: { alignItems: 'center' },
  followNum: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  followLabel: { fontSize: 11, color: COLORS.grey, marginTop: 1 },
  followDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.cardBorder },
  statsDivider: { width: '100%', height: 1, backgroundColor: COLORS.cardBorder, marginTop: 8 },
  statsRow: { flexDirection: 'row', width: '100%', paddingTop: 8 },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '900', color: COLORS.yellow },
  statLabel: { fontSize: 12, color: COLORS.grey, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.cardBorder },

  card: {
    backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1,
    borderColor: COLORS.cardBorder, overflow: 'hidden',
  },
  cardTitle: { color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  badgeSlot: { width: '25%', alignItems: 'center', paddingVertical: 10, gap: 4 },
  badgeCircle: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8, elevation: 6,
  },
  badgeCircleLocked: { backgroundColor: COLORS.cardBorder },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeLabel: { color: COLORS.white, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  badgeLabelLocked: { color: COLORS.grey },
  badgeDesc: { color: COLORS.darkGrey, fontSize: 9, textAlign: 'center' },
  nextBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 14 },
  nextBadgeText: { color: COLORS.grey, fontSize: 12, flex: 1 },

});
