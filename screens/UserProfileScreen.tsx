import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  getUserProfile, getUserFeedSightings, isFollowing, followUser, unfollowUser,
  getCurrentUserId_public, FeedSighting,
} from '../utils/storage';
import { getEarnedBadges, getNextBadge, BADGES } from '../utils/badges';

type RouteParams = { userId: string };

const formatLabel = (label: string) =>
  label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const timeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(timestamp).toLocaleDateString();
};

const UserProfileScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<{ displayName: string; speciesCount: number; totalSightings: number; followersCount: number; followingCount: number } | null>(null);
  const [sightings, setSightings] = useState<FeedSighting[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [prof, userSightings, followStatus, myId] = await Promise.all([
        getUserProfile(userId),
        getUserFeedSightings(userId),
        isFollowing(userId),
        getCurrentUserId_public(),
      ]);
      setProfile(prof);
      setSightings(userSightings);
      setFollowing(followStatus);
      setIsOwnProfile(myId === userId);
      setLoading(false);
    };
    load();
  }, [userId]);

  const toggleFollow = async () => {
    setFollowLoading(true);
    if (following) {
      await unfollowUser(userId);
      setFollowing(false);
    } else {
      await followUser(userId);
      setFollowing(true);
    }
    setFollowLoading(false);
  };

  const earnedBadges = getEarnedBadges(profile?.speciesCount ?? 0);
  const nextBadge = getNextBadge(profile?.speciesCount ?? 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const Header = () => (
    <View>
      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {profile?.avatarUrl
            ? <Image source={{ uri: profile.avatarUrl }} style={{ width: 80, height: 80, borderRadius: 40 }} resizeMode="cover" />
            : <Text style={styles.avatarLetter}>{profile?.displayName.charAt(0).toUpperCase()}</Text>
          }
        </View>
        <Text style={styles.displayName}>{profile?.displayName || 'unknown'}</Text>
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('FollowList', { userId, type: 'followers' })}>
            <Text style={styles.statNum}>{profile?.followersCount ?? 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('FollowList', { userId, type: 'following' })}>
            <Text style={styles.statNum}>{profile?.followingCount ?? 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>
        {!isOwnProfile && (
          <TouchableOpacity
            style={[styles.followBtn, following && styles.followingBtn]}
            onPress={toggleFollow}
            disabled={followLoading}
          >
            {followLoading
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={styles.followBtnText}>{following ? 'Following' : 'Follow'}</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges</Text>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge) => {
            const earned = (profile?.speciesCount ?? 0) >= badge.threshold;
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
      </View>
      <Text style={styles.sightingsLabel}>SIGHTINGS</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <View style={{ width: 38 }} />
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={sightings}
        keyExtractor={(_, i) => String(i)}
        ListHeaderComponent={<Header />}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No sightings yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.gridCard}>
            <Image source={{ uri: item.photoUrl }} style={styles.gridPhoto} />
            <View style={styles.gridInfo}>
              <Text style={styles.gridAnimal} numberOfLines={1}>{formatLabel(item.label)}</Text>
              <Text style={styles.gridTime}>{timeAgo(item.timestamp)}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  profileHeader: { alignItems: 'center', padding: 24, gap: 12 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  displayName: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    width: '100%',
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 26, fontWeight: '800', color: COLORS.yellow },
  statLabel: { fontSize: 12, color: COLORS.grey, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: COLORS.cardBorder },
  followBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  followingBtn: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder },
  followBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badgeSlot: { width: '25%', alignItems: 'center', paddingVertical: 10, gap: 5 },
  badgeCircle: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 10, elevation: 6,
  },
  badgeCircleLocked: { backgroundColor: COLORS.cardBorder },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeLabel: { color: COLORS.white, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  badgeLabelLocked: { color: COLORS.grey },
  badgeDesc: { color: COLORS.darkGrey, fontSize: 9, textAlign: 'center' },
  nextBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  nextBadgeText: { color: COLORS.grey, fontSize: 12 },
  emptyText: { color: COLORS.grey, fontSize: 14 },
  sightingsLabel: { paddingHorizontal: 16, paddingBottom: 8, color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  gridContent: { paddingBottom: 20 },
  gridRow: { paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  gridCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.cardBorder },
  gridPhoto: { width: '100%', height: 120 },
  gridInfo: { padding: 8 },
  gridAnimal: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  gridTime: { color: COLORS.grey, fontSize: 10, marginTop: 2 },
});
