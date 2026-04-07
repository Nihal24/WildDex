import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, StatusBar,
  FlatList, Image, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getFollowers, getFollowing, FollowUser } from '../utils/storage';
import { RootStackParamList } from '../navigation/RootNavigator';

type RouteParams = { userId: string; type: 'followers' | 'following' };

const FollowListScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, type } = route.params;

  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = type === 'followers' ? await getFollowers(userId) : await getFollowing(userId);
      setUsers(data);
      setLoading(false);
    };
    load();
  }, [userId, type]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.navHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.yellow} size="large" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={COLORS.darkGrey} />
          <Text style={styles.emptyText}>
            {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.userId}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
            >
              <View style={styles.avatar}>
                {item.avatarUrl
                  ? <Image source={{ uri: item.avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
                  : <Text style={styles.avatarLetter}>{item.displayName.charAt(0).toUpperCase()}</Text>
                }
              </View>
              <Text style={styles.username}>{item.displayName || 'unknown'}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.grey} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default FollowListScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 4 },
  navTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  emptyText: { color: COLORS.grey, fontSize: 14 },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  username: { flex: 1, color: COLORS.white, fontSize: 15, fontWeight: '600' },
});
