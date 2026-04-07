import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getNotifications, markAllNotificationsRead, AppNotification } from '../utils/storage';

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const notifText = (n: AppNotification): string => {
  const name = n.actorName || 'Someone';
  switch (n.type) {
    case 'like': return `${name} liked your sighting`;
    case 'comment': return `${name} commented on your sighting`;
    case 'follow': return `${name} started following you`;
    default: return `${name} interacted with you`;
  }
};

const NotificationsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      const data = await getNotifications();
      setNotifications(data);
      setLoading(false);
      markAllNotificationsRead();
    };
    load();
  }, []));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color={COLORS.darkGrey} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, !item.read && styles.rowUnread]}
              onPress={() => item.actorId && navigation.navigate('UserProfile', { userId: item.actorId })}
              activeOpacity={item.actorId ? 0.7 : 1}
            >
              <View style={styles.avatar}>
                {item.actorAvatarUrl
                  ? <Image source={{ uri: item.actorAvatarUrl }} style={styles.avatarImg} />
                  : <Text style={styles.avatarLetter}>{(item.actorName || '?').charAt(0).toUpperCase()}</Text>
                }
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.notifText}>{notifText(item)}</Text>
                <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
              </View>
              {item.sightingPhotoUrl ? (
                <Image source={{ uri: item.sightingPhotoUrl }} style={styles.thumb} />
              ) : null}
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { color: COLORS.grey, fontSize: 14 },
  list: { paddingBottom: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  rowUnread: { backgroundColor: 'rgba(168, 50, 32, 0.1)' },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: { fontSize: 18, fontWeight: '800', color: COLORS.white },
  textBlock: { flex: 1, gap: 3 },
  notifText: { color: COLORS.white, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  notifTime: { color: COLORS.grey, fontSize: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder, flexShrink: 0 },
});
