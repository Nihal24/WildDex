import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, ImageBackground, TouchableOpacity, ActivityIndicator, RefreshControl, Share,
  Modal, ScrollView, KeyboardAvoidingView, Platform, TextInput, Keyboard, TouchableWithoutFeedback,
  Animated, PanResponder,
} from 'react-native';
import { Image } from 'expo-image';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getFeedSightings, getFollowingFeed, getMyFeedSightings, getLeaderboard,
  followUser, unfollowUser, getFollowingIds, getLikedSightingIds,
  likeSighting, unlikeSighting, getComments, addComment, deleteComment,
  getCurrentUserId_public, FeedSighting, LeaderboardEntry, Comment,
  getUnreadNotificationCount, updateSightingVisibility, updateSightingCaption,
  getFeedCache, setFeedCache,
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

const Avatar = React.memo(({ name, photoUri, size = 36 }: { name: string; photoUri?: string; size?: number }) => {
  const { colors: COLORS } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
      {photoUri
        ? <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
        : <Text style={{ fontSize: size * 0.4, fontWeight: '900', color: COLORS.white }}>{name.charAt(0).toUpperCase()}</Text>
      }
    </View>
  );
});

const CommentSkeleton = () => {
  const { colors: COLORS } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={{ paddingHorizontal: 16, gap: 16, paddingTop: 8 }}>
      {[1, 2, 3].map((i) => (
        <Animated.View key={i} style={{ flexDirection: 'row', gap: 10, opacity: pulse }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.cardBorder }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '30%', height: 10, borderRadius: 5, backgroundColor: COLORS.cardBorder }} />
            <View style={{ width: '80%', height: 10, borderRadius: 5, backgroundColor: COLORS.cardBorder }} />
            <View style={{ width: '50%', height: 10, borderRadius: 5, backgroundColor: COLORS.cardBorder }} />
          </View>
        </Animated.View>
      ))}
    </View>
  );
};

const CommentsModal = ({
  sightingId,
  myId,
  visible,
  onClose,
  onCommentCountChange,
}: {
  sightingId: string;
  myId: string | null;
  visible: boolean;
  onClose: () => void;
  onCommentCountChange: (delta: number) => void;
}) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 0,
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100) {
          Animated.timing(translateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(onClose);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => { if (visible) translateY.setValue(0); }, [visible]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const deletingIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!sightingId) return;
    setLoading(true);
    const data = await getComments(sightingId);
    setComments(data);
    setLoading(false);
  }, [sightingId]);

  useEffect(() => { if (visible && sightingId) load(); }, [visible, sightingId, load]);

  const submit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    await addComment(sightingId, text.trim(), replyTo?.id);
    onCommentCountChange(1);
    setText('');
    setReplyTo(null);
    await load();
    setSubmitting(false);
  };

  const remove = async (commentId: string) => {
    if (deletingIds.current.has(commentId)) return;
    deletingIds.current.add(commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    onCommentCountChange(-1);
    await deleteComment(commentId);
    deletingIds.current.delete(commentId);
  };

  const renderComment = (c: Comment, isReply = false) => (
    <View key={c.id}>
      <View style={[styles.commentRow, isReply && styles.commentReplyRow]}>
        <Avatar name={c.displayName} photoUri={c.avatarUrl} size={isReply ? 26 : 32} />
        <View style={styles.commentBubble}>
          <Text style={styles.commentUser}>@{c.displayName || 'unknown'}</Text>
          <Text style={styles.commentText}>{c.text}</Text>
          <TouchableOpacity onPress={() => setReplyTo({ id: c.id, name: c.displayName })} style={styles.replyBtn}>
            <Text style={styles.replyBtnText}>Reply</Text>
          </TouchableOpacity>
        </View>
        {c.userId === myId && (
          <TouchableOpacity onPress={() => remove(c.id)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={14} color={COLORS.grey} />
          </TouchableOpacity>
        )}
      </View>
      {(c.replies ?? []).map((r) => renderComment(r, true))}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Tap backdrop to close */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalDragArea} {...panResponder.panHandlers}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Comments</Text>
                <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={COLORS.grey} /></TouchableOpacity>
              </View>
            </View>
            {loading ? (
              <CommentSkeleton />
            ) : comments.length === 0 ? (
              <View style={styles.modalCenter}>
                <Text style={styles.noComments}>No comments yet. Be the first!</Text>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                {comments.map((c) => renderComment(c))}
              </ScrollView>
            )}
            {replyTo && (
              <View style={styles.replyingTo}>
                <Text style={styles.replyingToText}>Replying to @{replyTo.name}</Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons name="close-circle" size={16} color={COLORS.grey} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.commentInput}>
              <TextInput
                style={styles.commentTextInput}
                placeholder={replyTo ? `Reply to @${replyTo.name}...` : 'Add a comment...'}
                placeholderTextColor={COLORS.grey}
                value={text}
                onChangeText={setText}
                maxLength={300}
                multiline
                returnKeyType="done"
                blurOnSubmit
              />
              <TouchableOpacity onPress={submit} disabled={submitting || !text.trim()} style={styles.sendBtn}>
                {submitting
                  ? <ActivityIndicator size="small" color={COLORS.yellow} />
                  : <Ionicons name="send" size={18} color={text.trim() ? COLORS.yellow : COLORS.grey} />
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const FeedCard = React.memo(({
  item,
  myId,
  isFollowed,
  isLiked,
  commentCount,
  onFollowChange,
  onLikeChange,
  onUserPress,
  onCommentPress,
  onMenuPress,
}: {
  item: FeedSighting;
  myId: string | null;
  isFollowed: boolean;
  isLiked: boolean;
  commentCount: number;
  onFollowChange: (userId: string, following: boolean) => void;
  onLikeChange: (sightingId: string, liked: boolean, delta: number) => void;
  onUserPress: (userId: string) => void;
  onCommentPress: (sightingId: string) => void;
  onMenuPress?: (item: FeedSighting) => void;
  onSharePress?: (item: FeedSighting) => void;
}) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const isOwn = item.userId === myId;
  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localLikeCount, setLocalLikeCount] = useState(item.likeCount);
  const [followLoading, setFollowLoading] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  useEffect(() => {
    setLocalLiked(isLiked);
  }, [isLiked]);

  useEffect(() => {
    setLocalLikeCount(item.likeCount);
  }, [item.likeCount]);

  const toggleFollow = async () => {
    setFollowLoading(true);
    if (isFollowed) { await unfollowUser(item.userId); onFollowChange(item.userId, false); }
    else { await followUser(item.userId); onFollowChange(item.userId, true); }
    setFollowLoading(false);
  };

  const toggleLike = async () => {
    if (!item.sightingId || likeLoading) return;
    const newLiked = !localLiked;
    setLocalLiked(newLiked);
    setLocalLikeCount(prev => prev + (newLiked ? 1 : -1));
    setLikeLoading(true);
    onLikeChange(item.sightingId, newLiked, newLiked ? 1 : -1);
    if (newLiked) await likeSighting(item.sightingId);
    else await unlikeSighting(item.sightingId);
    setLikeLoading(false);
  };

  return (
    <View style={styles.card}>
      {/* Photo with header overlaid */}
      <View style={styles.photoWrapper}>
        <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} contentFit="cover" recyclingKey={item.sightingId} />
        {/* Top gradient scrim for avatar readability */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent']}
          style={styles.photoTopScrim}
          pointerEvents="none"
        />
        {/* Bottom gradient scrim for animal name */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.72)']}
          style={styles.photoBottomScrim}
          pointerEvents="none"
        />
        {/* Header overlaid on photo */}
        <View style={styles.cardHeaderOverlay}>
          <TouchableOpacity onPress={() => onUserPress(item.userId)} style={styles.cardHeaderLeft}>
            <Avatar name={item.displayName} photoUri={item.avatarUrl} />
            <View style={styles.cardHeaderInfo}>
              <Text style={styles.cardUser}>{item.displayName || 'unknown'}</Text>
              <View style={styles.cardTimeRow}>
                <Text style={styles.cardTime}>{timeAgo(item.timestamp)}</Text>
                <Ionicons
                  name={item.visibility === 'private' ? 'lock-closed-outline' : item.visibility === 'followers' ? 'people-outline' : 'earth-outline'}
                  size={13}
                  color="rgba(255,255,255,0.6)"
                />
              </View>
            </View>
          </TouchableOpacity>
          {!isOwn ? (
            <TouchableOpacity
              style={[styles.followBtn, isFollowed && styles.followingBtn]}
              onPress={toggleFollow}
              disabled={followLoading}
            >
              {followLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.followBtnText, isFollowed && styles.followingBtnText]}>
                    {isFollowed ? 'Following' : 'Follow'}
                  </Text>
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.menuBtn} onPress={() => onMenuPress?.(item)}>
              <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          )}
        </View>
        {/* Animal name at bottom of photo */}
        <View style={styles.photoLabel}>
          <Text style={styles.cardAnimal}>{formatLabel(item.label)}</Text>
          {item.location ? (
            <View style={styles.photoLocationRow}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.6)" />
              <Text style={styles.cardLocation} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer: caption + actions */}
      <View style={styles.cardFooter}>
        {item.caption ? <Text style={styles.cardCaption}>{item.caption}</Text> : null}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={toggleLike} disabled={likeLoading}>
            <Ionicons name={localLiked ? 'heart' : 'heart-outline'} size={20} color={localLiked ? '#E05C5C' : COLORS.grey} />
            {localLikeCount > 0 && <Text style={[styles.actionCount, localLiked && { color: '#E05C5C' }]}>{localLikeCount}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onCommentPress(item.sightingId)}>
            <Ionicons name="chatbubble-outline" size={18} color={COLORS.grey} />
            {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
          </TouchableOpacity>
          {isOwn && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => onSharePress?.(item)}>
              <Ionicons name="share-outline" size={18} color={COLORS.grey} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
});

const ShareModal = React.memo(({ item, onClose }: { item: FeedSighting | null; onClose: () => void }) => {
  const { colors: COLORS } = useTheme();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const shareCardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const doShare = async () => {
    setSharing(true);
    try {
      const uri = await captureRef(shareCardRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: `${formatLabel(item!.label)} on WildDex` });
      } else {
        await Share.share({ url: item!.photoUrl, message: `Check out this ${formatLabel(item!.label)} I spotted on WildDex! 🦁` });
      }
    } catch {
      if (item) await Share.share({ url: item.photoUrl, message: `Check out this ${formatLabel(item.label)} I spotted on WildDex! 🦁` });
    } finally {
      setSharing(false);
      onClose();
    }
  };

  if (!item) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.shareOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.shareContainer} onPress={() => {}}>
          <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
            <ImageBackground source={{ uri: item.photoUrl }} style={styles.shareCardPhoto} resizeMode="cover">
              <LinearGradient
                colors={['rgba(0,0,0,0.18)', 'transparent', 'transparent', 'rgba(0,0,0,0.82)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.shareWatermark}>
                <Ionicons name="paw" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.shareWatermarkText}>WildDex</Text>
              </View>
              <View style={styles.shareCardBottom}>
                <Text style={styles.shareCardAnimal}>{formatLabel(item.label)}</Text>
                {item.location ? (
                  <View style={styles.shareCardLocationRow}>
                    <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.65)" />
                    <Text style={styles.shareCardLocation}>{item.location}</Text>
                  </View>
                ) : null}
                <Text style={styles.shareCardMeta}>@{item.displayName} · {timeAgo(item.timestamp)}</Text>
              </View>
            </ImageBackground>
          </View>
          <TouchableOpacity style={styles.shareBtn} onPress={doShare} disabled={sharing}>
            {sharing
              ? <ActivityIndicator color="#fff" />
              : <><Ionicons name="share-outline" size={18} color="#fff" /><Text style={styles.shareBtnText}>Share</Text></>
            }
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.shareCancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
});

const AUDIENCE_OPTIONS = [
  { v: 'public' as const, label: 'Everyone', sub: 'Visible to all WildDex users', icon: 'earth-outline' as const },
  { v: 'followers' as const, label: 'Followers Only', sub: 'Only people who follow you', icon: 'people-outline' as const },
  { v: 'private' as const, label: 'Just Me', sub: 'Only visible to you', icon: 'lock-closed-outline' as const },
];

const PostMenuSheet = ({
  item,
  visible,
  onClose,
  onEditCaption,
  onChangeVisibility,
}: {
  item: FeedSighting | null;
  visible: boolean;
  onClose: () => void;
  onEditCaption: () => void;
  onChangeVisibility: (v: 'public' | 'followers' | 'private') => void;
}) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [page, setPage] = useState<'main' | 'audience'>('main');

  useEffect(() => { if (visible) setPage('main'); }, [visible]);

  if (!item) return null;
  const currentAudience = AUDIENCE_OPTIONS.find((o) => o.v === item.visibility) ?? AUDIENCE_OPTIONS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.menuSheet}>
          <View style={styles.modalHandle} />

          {page === 'main' ? (
            <>
              <TouchableOpacity style={styles.menuRow} onPress={() => { onClose(); setTimeout(onEditCaption, 320); }}>
                <Ionicons name="create-outline" size={20} color={COLORS.white} />
                <Text style={styles.menuRowText}>Edit Caption</Text>
              </TouchableOpacity>
              <View style={styles.menuSep} />
              <TouchableOpacity style={styles.menuRow} onPress={() => setPage('audience')}>
                <Ionicons name={currentAudience.icon} size={20} color={COLORS.white} />
                <Text style={styles.menuRowText}>Who can see this</Text>
                <View style={styles.menuRowRight}>
                  <Text style={styles.menuRowValue}>{currentAudience.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
                </View>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.menuAudienceHeader}>
                <TouchableOpacity onPress={() => setPage('main')} style={{ padding: 4 }}>
                  <Ionicons name="chevron-back" size={20} color={COLORS.grey} />
                </TouchableOpacity>
                <Text style={styles.menuAudienceTitle}>Who can see this</Text>
                <View style={{ width: 28 }} />
              </View>
              {AUDIENCE_OPTIONS.map(({ v, label, sub, icon }, i) => {
                const active = item.visibility === v;
                return (
                  <React.Fragment key={v}>
                    {i > 0 && <View style={styles.menuSep} />}
                    <TouchableOpacity style={styles.menuRow} onPress={() => { onChangeVisibility(v); onClose(); }}>
                      <Ionicons name={icon} size={20} color={active ? COLORS.yellow : COLORS.white} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.menuRowText, active && { color: COLORS.yellow }]}>{label}</Text>
                        <Text style={styles.menuRowSub}>{sub}</Text>
                      </View>
                      {active && <Ionicons name="checkmark" size={17} color={COLORS.yellow} />}
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </>
          )}

          <View style={styles.menuSep} />
          <TouchableOpacity style={styles.menuRow} onPress={onClose}>
            <Text style={styles.menuCancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const CaptionEditModal = ({
  item,
  visible,
  onClose,
  onSaved,
}: {
  item: FeedSighting | null;
  visible: boolean;
  onClose: () => void;
  onSaved: (sightingId: string, caption: string) => void;
}) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setText(item?.caption ?? '');
  }, [visible, item]);

  const save = async () => {
    if (!item?.sightingId) return;
    setSaving(true);
    await updateSightingCaption(item.sightingId, text.trim());
    onSaved(item.sightingId, text.trim());
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.captionEditSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Caption</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.grey} />
            </TouchableOpacity>
          </View>
          <View style={styles.captionEditBody}>
            <TextInput
              style={styles.captionEditInput}
              value={text}
              onChangeText={setText}
              placeholder="Add a caption..."
              placeholderTextColor={COLORS.grey}
              multiline
              maxLength={200}
              autoFocus
            />
            <TouchableOpacity style={styles.captionSaveBtn} onPress={save} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <Text style={styles.captionSaveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const LeaderboardRow = ({ entry, rank, myId, onPress }: { entry: LeaderboardEntry; rank: number; myId: string | null; onPress: () => void }) => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  const isMe = entry.userId === myId;
  return (
    <TouchableOpacity style={[styles.leaderRow, isMe && styles.leaderRowMe]} onPress={onPress}>
      <Text style={styles.leaderRank}>{medal ?? `#${rank}`}</Text>
      <Avatar name={entry.displayName} photoUri={entry.avatarUrl} size={40} />
      <View style={styles.leaderInfo}>
        <View style={styles.leaderNameRow}>
          <Text style={styles.leaderName}>{entry.displayName || 'unknown'}</Text>
          {isMe && <View style={styles.youBadge}><Text style={styles.youBadgeText}>YOU</Text></View>}
        </View>
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
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<any>();
  const flatListRef = useRef<FlatList>(null);
  const [activeTab, setActiveTab] = useState<'global' | 'following' | 'mine' | 'top'>('global');
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [feed, setFeed] = useState<FeedSighting[]>([]);
  const [followingFeed, setFollowingFeed] = useState<FeedSighting[]>([]);
  const [myFeed, setMyFeed] = useState<FeedSighting[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentSightingId, setCommentSightingId] = useState<string | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [menuItem, setMenuItem] = useState<FeedSighting | null>(null);
  const [editCaptionItem, setEditCaptionItem] = useState<FeedSighting | null>(null);
  const [shareItem, setShareItem] = useState<FeedSighting | null>(null);

  const updateLikeCounts = (sightingId: string, delta: number) => {
    const update = (items: FeedSighting[]) =>
      items.map((s) => s.sightingId === sightingId ? { ...s, likeCount: s.likeCount + delta } : s);
    setFeed(update);
    setFollowingFeed(update);
    setMyFeed(update);
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    const [feedData, followIds, userId, myData, unread] = await Promise.all([
      getFeedSightings(),
      getFollowingIds(),
      getCurrentUserId_public(),
      getMyFeedSightings(),
      getUnreadNotificationCount(),
    ]);

    const [likedIds, followingFeedData] = await Promise.all([
      feedData.length > 0 ? getLikedSightingIds(feedData.map((s) => s.sightingId).filter(Boolean)) : Promise.resolve(new Set<string>()),
      followIds.length > 0 ? getFollowingFeed() : Promise.resolve([]),
    ]);

    setFeed(feedData);
    setFollowingIds(new Set(followIds));
    setMyId(userId);
    setMyFeed(myData);
    setUnreadCount(unread);
    setLikedIds(likedIds);
    setFollowingFeed(followingFeedData);
    setLoading(false);
    setRefreshing(false);
    setFeedCache(feedData);
  }, []);

  // Hydrate from cache instantly, then refresh in background
  useEffect(() => {
    getFeedCache().then((cached) => {
      if (cached && cached.length > 0) {
        setFeed(cached);
        setLoading(false);
        load(true);
      } else {
        load(false);
      }
    });
  }, []);

  useFocusEffect(useCallback(() => { load(true); }, [load]));

  // Scroll to highlighted sighting when navigating from a notification
  useEffect(() => {
    const highlightId = route.params?.highlightSightingId;
    if (!highlightId || loading) return;
    const idx = feed.findIndex((s) => s.sightingId === highlightId);
    if (idx >= 0) {
      setTimeout(() => flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.1 }), 300);
    }
  }, [route.params?.highlightSightingId, loading]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleFollowChange = useCallback((userId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (following) next.add(userId); else next.delete(userId);
      return next;
    });
  }, []);

  const handleCommentCountChange = useCallback((sightingId: string, delta: number) => {
    setCommentCounts((prev) => {
      const base = prev[sightingId] ?? 0;
      return { ...prev, [sightingId]: Math.max(0, base + delta) };
    });
  }, []);

  const handleLikeChange = useCallback((sightingId: string, liked: boolean, delta: number) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (liked) next.add(sightingId); else next.delete(sightingId);
      return next;
    });
    updateLikeCounts(sightingId, delta);
  }, []);

  const handleCommentPress = useCallback((sightingId: string) => {
    setCommentSightingId(sightingId);
  }, []);

  const handleMenuPress = useCallback((item: FeedSighting) => {
    setMenuItem(item);
  }, []);

  const handleSharePress = useCallback((item: FeedSighting) => {
    setShareItem(item);
  }, []);

  const handleChangeVisibility = useCallback((item: FeedSighting, v: 'public' | 'followers' | 'private') => {
    if (!item.sightingId) return;
    // Update visibility in all feed arrays; remove from global/following if made private
    const updateVis = (items: FeedSighting[]) =>
      items.map((s) => s.sightingId === item.sightingId ? { ...s, visibility: v } : s);
    setMyFeed(updateVis);
    if (v === 'private') {
      const remove = (items: FeedSighting[]) => items.filter((s) => s.sightingId !== item.sightingId);
      setFeed(remove);
      setFollowingFeed(remove);
    } else if (v === 'followers') {
      setFeed((items) => items.filter((s) => s.sightingId !== item.sightingId));
      setFollowingFeed(updateVis);
    } else {
      setFeed(updateVis);
      setFollowingFeed(updateVis);
    }
    updateSightingVisibility(item.sightingId, v).catch(() => {});
  }, []);

  const handleCaptionSaved = useCallback((sightingId: string, caption: string) => {
    const update = (items: FeedSighting[]) =>
      items.map((s) => s.sightingId === sightingId ? { ...s, caption } : s);
    setFeed(update);
    setFollowingFeed(update);
    setMyFeed(update);
  }, []);

  const handleInvite = async () => {
    await Share.share({
      message: `Join me on WildDex 🦁 — identify animals and build your collection! Download it on the App Store.`,
    });
  };

  const goToUser = useCallback((userId: string) => navigation.navigate('UserProfile', { userId }), [navigation]);

  const TAB_ORDER = ['global', 'following', 'mine', 'top'] as const;
  const switchTab = (t: typeof TAB_ORDER[number]) => {
    const idx = TAB_ORDER.indexOf(t);
    Animated.spring(tabAnim, { toValue: idx, useNativeDriver: false, friction: 8, tension: 80 }).start();
    setActiveTab(t);
    // Lazy-load leaderboard only when Top tab is first opened
    if (t === 'top' && leaderboard.length === 0) {
      getLeaderboard().then(setLeaderboard);
    }
  };
  const activeFeed = activeTab === 'following' ? followingFeed : activeTab === 'mine' ? myFeed : feed;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.white} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteBtn} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={16} color={COLORS.white} />
            <Text style={styles.inviteBtnText}>Invite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Unified underline tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'global', label: 'Global' },
          { key: 'following', label: 'Following' },
          { key: 'mine', label: 'Mine' },
          { key: 'top', label: 'Top Spotters' },
        ] as const).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={styles.tabBarItem}
            onPress={() => switchTab(key)}
          >
            <Text style={[styles.tabBarText, activeTab === key && styles.tabBarTextActive]}>{label}</Text>
            {activeTab === key && <View style={styles.tabBarIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : activeTab !== 'top' ? (
        <>
          {activeFeed.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="leaf-outline" size={48} color={COLORS.darkGrey} />
              <Text style={styles.emptyTitle}>
                {activeTab === 'following'
                  ? 'No sightings from people you follow'
                  : activeTab === 'mine'
                  ? 'No sightings yet'
                  : 'No sightings yet'}
              </Text>
              <Text style={styles.emptySub}>
                {activeTab === 'following'
                  ? 'Find people to follow in Top Spotters'
                  : activeTab === 'mine'
                  ? 'Identify an animal to log your first sighting'
                  : 'Be the first to spot something!'}
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={activeFeed}
                keyExtractor={(item) => item.sightingId || String(item.timestamp)}
                renderItem={({ item }) => (
                  <FeedCard
                    item={item}
                    myId={myId}
                    isFollowed={followingIds.has(item.userId)}
                    isLiked={likedIds.has(item.sightingId)}
                    commentCount={commentCounts[item.sightingId] ?? item.commentCount}
                    onFollowChange={handleFollowChange}
                    onLikeChange={handleLikeChange}
                    onUserPress={goToUser}
                    onCommentPress={handleCommentPress}
                    onMenuPress={handleMenuPress}
                    onSharePress={handleSharePress}
                  />
                )}
                contentContainerStyle={styles.feedList}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.yellow} />}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                windowSize={3}
                maxToRenderPerBatch={4}
                initialNumToRender={4}
                removeClippedSubviews
              />
              <CommentsModal
                sightingId={commentSightingId ?? ''}
                myId={myId}
                visible={!!commentSightingId}
                onClose={() => setCommentSightingId(null)}
                onCommentCountChange={(delta) => { if (commentSightingId) handleCommentCountChange(commentSightingId, delta); }}
              />
              <CaptionEditModal
                item={editCaptionItem}
                visible={!!editCaptionItem}
                onClose={() => setEditCaptionItem(null)}
                onSaved={handleCaptionSaved}
              />
              <PostMenuSheet
                item={menuItem}
                visible={!!menuItem}
                onClose={() => setMenuItem(null)}
                onEditCaption={() => setEditCaptionItem(menuItem)}
                onChangeVisibility={(v) => menuItem && handleChangeVisibility(menuItem, v)}
              />
              <ShareModal item={shareItem} onClose={() => setShareItem(null)} />
            </>
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

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
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
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3, textTransform: 'uppercase' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn: { padding: 4, position: 'relative' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: COLORS.primary, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '800' },
  menuBtn: { padding: 4 },
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabBarText: {
    color: COLORS.grey,
    fontWeight: '500',
    fontSize: 13,
  },
  tabBarTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  tabBarIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: COLORS.yellow,
    borderRadius: 1,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, textAlign: 'center', paddingHorizontal: 32 },
  emptySub: { fontSize: 13, color: COLORS.grey },
  feedList: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20, gap: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  photoWrapper: { position: 'relative' },
  cardPhoto: { width: '100%', height: 340 },
  photoTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  photoBottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  cardHeaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: COLORS.white, fontWeight: '700' },
  cardHeaderInfo: { flex: 1 },
  cardUser: { color: '#fff', fontWeight: '700', fontSize: 14 },
  cardTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  cardTime: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  followBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  followBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  followingBtnText: { color: 'rgba(255,255,255,0.7)' },
  menuBtn: { padding: 4 },
  photoLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 2,
  },
  cardAnimal: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  photoLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardLocation: { color: 'rgba(255,255,255,0.6)', fontSize: 12, flexShrink: 1 },
  cardFooter: { padding: 12, paddingTop: 10, gap: 4, backgroundColor: COLORS.card },
  cardCaption: { color: COLORS.grey, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: COLORS.grey, fontSize: 13 },
  // Comments modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: COLORS.cardBorder, maxHeight: '75%', paddingBottom: 32,
  },
  modalDragArea: { paddingBottom: 4 },
  modalHandle: { width: 36, height: 4, backgroundColor: COLORS.cardBorder, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  modalCenter: { paddingVertical: 36, justifyContent: 'center', alignItems: 'center' },
  noComments: { color: COLORS.grey, fontSize: 14 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  commentReplyRow: { marginLeft: 36, marginBottom: 8 },
  commentBubble: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10 },
  commentUser: { color: COLORS.yellow, fontSize: 12, fontWeight: '700', marginBottom: 3 },
  commentText: { color: COLORS.white, fontSize: 14, lineHeight: 20 },
  replyBtn: { marginTop: 6 },
  replyBtnText: { color: COLORS.grey, fontSize: 12, fontWeight: '600' },
  replyingTo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: COLORS.background },
  replyingToText: { color: COLORS.amber, fontSize: 12 },
  deleteBtn: { paddingTop: 10 },
  commentInput: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.cardBorder,
  },
  commentTextInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.cardBorder, color: COLORS.white, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, maxHeight: 100,
  },
  sendBtn: { paddingBottom: 10 },
  captionEditSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  captionEditBody: { paddingHorizontal: 16, paddingBottom: 32, gap: 12 },
  captionEditInput: {
    backgroundColor: COLORS.background, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.cardBorder, color: COLORS.white, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top',
  },
  captionSaveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
  },
  captionSaveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  // Post menu sheet
  menuOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  menuSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: COLORS.cardBorder,
    paddingBottom: 32,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  menuSep: { height: 1, backgroundColor: COLORS.cardBorder, marginHorizontal: 20 },
  menuRowText: { flex: 1, color: COLORS.white, fontSize: 16 },
  menuRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  menuRowValue: { color: COLORS.grey, fontSize: 13 },
  menuRowSub: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  menuAudienceHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
  },
  menuAudienceTitle: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  menuCancelText: { flex: 1, color: COLORS.grey, fontSize: 16, textAlign: 'center' },
  leaderList: { paddingHorizontal: 16, paddingBottom: 20 },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 12,
  },
  leaderRowMe: {
    backgroundColor: 'rgba(255,203,5,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,203,5,0.35)',
  },
  leaderNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  youBadge: {
    backgroundColor: COLORS.yellow,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youBadgeText: { color: COLORS.background, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  leaderRank: { width: 32, height: 40, textAlign: 'center', textAlignVertical: 'center', lineHeight: 40, color: COLORS.grey, fontSize: 14, fontWeight: '700' },
  leaderInfo: { flex: 1 },
  leaderName: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  leaderSub: { color: COLORS.grey, fontSize: 12, marginTop: 2 },
  leaderSpecies: { alignItems: 'center' },
  leaderSpeciesNum: { color: COLORS.yellow, fontSize: 20, fontWeight: '800' },
  leaderSpeciesLabel: { color: COLORS.grey, fontSize: 10 },
  // Share card
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  shareContainer: { width: '100%', alignItems: 'center', gap: 16 },
  shareCard: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareCardPhoto: { flex: 1, justifyContent: 'space-between' },
  shareWatermark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    margin: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  shareWatermarkText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  shareCardBottom: { padding: 20, gap: 4 },
  shareCardAnimal: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: 0.2 },
  shareCardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareCardLocation: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  shareCardMeta: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    justifyContent: 'center',
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  shareCancelText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, paddingVertical: 4 },
});
