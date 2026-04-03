import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import {
  getFeedSightings, getFollowingFeed, getMyFeedSightings, getLeaderboard,
  followUser, unfollowUser, getFollowingIds,
  getCurrentUserId_public, FeedSighting, LeaderboardEntry,
} from '../utils/storage';
import { RootStackParamList } from '../navigation/RootNavigator';

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

const Avatar = ({ name, size = 36 }: { name: string; size?: number }) => (
  <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarLetter, { fontSize: size * 0.4 }]}>
      {name.charAt(0).toUpperCase()}
    </Text>
  </View>
);

const FeedCard = ({
  item,
  myId,
  followingIds,
  onFollowChange,
  onUserPress,
}: {
  item: FeedSighting;
  myId: string | null;
  followingIds: Set<string>;
  onFollowChange: (userId: string, following: boolean) => void;
  onUserPress: (userId: string) => void;
}) => {
  const isOwn = item.userId === myId;
  const isFollowed = followingIds.has(item.userId);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    if (isFollowed) {
      await unfollowUser(item.userId);
      onFollowChange(item.userId, false);
    } else {
      await followUser(item.userId);
      onFollowChange(item.userId, true);
    }
    setLoading(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <TouchableOpacity onPress={() => onUserPress(item.userId)} style={styles.cardHeaderLeft}>
          <Avatar name={item.displayName} />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardUser}>{item.displayName ? `@${item.displayName}` : '@unknown'}</Text>
            <Text style={styles.cardTime}>{timeAgo(item.timestamp)}</Text>
          </View>
        </TouchableOpacity>
        {!isOwn && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowed && styles.followingBtn]}
            onPress={toggle}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Text style={[styles.followBtnText, isFollowed && styles.followingBtnText]}>
                  {isFollowed ? 'Following' : 'Follow'}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>
      <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} resizeMode="cover" />
      <View style={styles.cardFooter}>
        {item.caption ? <Text style={styles.cardCaption}>{item.caption}</Text> : null}
        <Text style={styles.cardAnimal}>{formatLabel(item.label)}</Text>
        <View style={styles.cardMeta}>
          {item.location && (
            <View style={styles.cardLocationRow}>
              <Ionicons name="location-outline" size={12} color={COLORS.grey} />
              <Text style={styles.cardLocation}>{item.location}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const LeaderboardRow = ({ entry, rank, myId, onPress }: { entry: LeaderboardEntry; rank: number; myId: string | null; onPress: () => void }) => {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const isMe = entry.userId === myId;
  return (
    <TouchableOpacity style={[styles.leaderRow, isMe && styles.leaderRowMe]} onPress={onPress}>
      <Text style={styles.leaderRank}>{medal ?? `#${rank}`}</Text>
      <Avatar name={entry.displayName} size={40} />
      <View style={styles.leaderInfo}>
        <Text style={styles.leaderName}>{entry.displayName ? `@${entry.displayName}` : '@unknown'}{isMe ? ' (you)' : ''}</Text>
        <Text style={styles.leaderSub}>{entry.totalSightings} sightings</Text>
      </View>
      <View style={styles.leaderSpecies}>
        <Text style={styles.leaderSpeciesNum}>{entry.speciesCount}</Text>
        <Text style={styles.leaderSpeciesLabel}>species</Text>
      </View>
    </TouchableOpacity>
  );
};

const FeedScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<'feed' | 'top'>('feed');
  const [feedFilter, setFeedFilter] = useState<'global' | 'following' | 'mine'>('global');
  const [feed, setFeed] = useState<FeedSighting[]>([]);
  const [followingFeed, setFollowingFeed] = useState<FeedSighting[]>([]);
  const [myFeed, setMyFeed] = useState<FeedSighting[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [feedData, lbData, followIds, userId, myData] = await Promise.all([
      getFeedSightings(),
      getLeaderboard(),
      getFollowingIds(),
      getCurrentUserId_public(),
      getMyFeedSightings(),
    ]);
    setFeed(feedData);
    setLeaderboard(lbData);
    setFollowingIds(new Set(followIds));
    setMyId(userId);
    setMyFeed(myData);

    if (followIds.length > 0) {
      const ff = await getFollowingFeed();
      setFollowingFeed(ff);
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleFollowChange = (userId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (following) next.add(userId); else next.delete(userId);
      return next;
    });
  };

  const handleInvite = async () => {
    await Share.share({
      message: `Join me on WildDex 🦁 — identify animals and build your collection! Download it on the App Store.`,
    });
  };

  const goToUser = (userId: string) => navigation.navigate('UserProfile', { userId });

  const activeFeed = feedFilter === 'following' ? followingFeed : feedFilter === 'mine' ? myFeed : feed;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}>
          <Ionicons name="person-add-outline" size={16} color={COLORS.white} />
          <Text style={styles.inviteBtnText}>Invite</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'feed' && styles.tabBtnActive]}
          onPress={() => setTab('feed')}
        >
          <Text style={[styles.tabText, tab === 'feed' && styles.tabTextActive]}>Recent</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'top' && styles.tabBtnActive]}
          onPress={() => setTab('top')}
        >
          <Text style={[styles.tabText, tab === 'top' && styles.tabTextActive]}>Top Spotters</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : tab === 'feed' ? (
        <>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterBtn, feedFilter === 'global' && styles.filterBtnActive]}
              onPress={() => setFeedFilter('global')}
            >
              <Text style={[styles.filterText, feedFilter === 'global' && styles.filterTextActive]}>Global</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, feedFilter === 'following' && styles.filterBtnActive]}
              onPress={() => setFeedFilter('following')}
            >
              <Text style={[styles.filterText, feedFilter === 'following' && styles.filterTextActive]}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterBtn, feedFilter === 'mine' && styles.filterBtnActive]}
              onPress={() => setFeedFilter('mine')}
            >
              <Text style={[styles.filterText, feedFilter === 'mine' && styles.filterTextActive]}>Mine</Text>
            </TouchableOpacity>
          </View>
          {activeFeed.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="leaf-outline" size={48} color={COLORS.darkGrey} />
              <Text style={styles.emptyTitle}>
                {feedFilter === 'following' ? 'Follow someone to see their sightings' : feedFilter === 'mine' ? 'No sightings yet' : 'No sightings yet'}
              </Text>
              <Text style={styles.emptySub}>Be the first to spot something!</Text>
            </View>
          ) : (
            <FlatList
              data={activeFeed}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <FeedCard
                  item={item}
                  myId={myId}
                  followingIds={followingIds}
                  onFollowChange={handleFollowChange}
                  onUserPress={goToUser}
                />
              )}
              contentContainerStyle={styles.feedList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.yellow} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : (
        leaderboard.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="trophy-outline" size={48} color={COLORS.darkGrey} />
            <Text style={styles.emptyTitle}>No data yet</Text>
            <Text style={styles.emptySub}>Start spotting to appear here</Text>
          </View>
        ) : (
          <FlatList
            data={leaderboard}
            keyExtractor={(item) => item.userId}
            renderItem={({ item, index }) => (
              <LeaderboardRow
                entry={item}
                rank={index + 1}
                myId={myId}
                onPress={() => goToUser(item.userId)}
              />
            )}
            contentContainerStyle={styles.leaderList}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.yellow} />}
            showsVerticalScrollIndicator={false}
          />
        )
      )}
    </SafeAreaView>
  );
};

export default FeedScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.primary,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  inviteBtnText: { color: COLORS.white, fontWeight: '600', fontSize: 13 },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 4,
    gap: 2,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.grey, fontWeight: '500', fontSize: 13, letterSpacing: 0.3 },
  tabTextActive: { color: COLORS.white, fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  filterBtnActive: { borderColor: COLORS.yellow, backgroundColor: 'rgba(255,203,5,0.1)' },
  filterText: { color: COLORS.grey, fontSize: 13, fontWeight: '500' },
  filterTextActive: { color: COLORS.yellow, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, textAlign: 'center', paddingHorizontal: 32 },
  emptySub: { fontSize: 13, color: COLORS.grey },
  feedList: { paddingHorizontal: 16, paddingBottom: 20, gap: 16 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: COLORS.white, fontWeight: '700' },
  cardHeaderInfo: { flex: 1 },
  cardUser: { color: COLORS.yellow, fontWeight: '700', fontSize: 14 },
  cardTime: { color: COLORS.grey, fontSize: 11, marginTop: 1 },
  followBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.cardBorder },
  followBtnText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
  followingBtnText: { color: COLORS.grey },
  cardPhoto: { width: '100%', height: 260 },
  cardFooter: { padding: 12, gap: 6 },
  cardCaption: { color: COLORS.white, fontSize: 14, lineHeight: 20, marginBottom: 2 },
  cardAnimal: { color: COLORS.grey, fontSize: 13, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  cardLocation: { color: COLORS.grey, fontSize: 12 },
  leaderList: { paddingHorizontal: 16, paddingBottom: 20 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 12,
  },
  leaderRowMe: { backgroundColor: 'rgba(255,203,5,0.05)', borderRadius: 8, paddingHorizontal: 8 },
  leaderRank: { width: 32, textAlign: 'center', color: COLORS.grey, fontSize: 14, fontWeight: '700' },
  leaderInfo: { flex: 1 },
  leaderName: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  leaderSub: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  leaderSpecies: { alignItems: 'center' },
  leaderSpeciesNum: { color: COLORS.yellow, fontSize: 20, fontWeight: '800' },
  leaderSpeciesLabel: { color: COLORS.grey, fontSize: 10 },
});
