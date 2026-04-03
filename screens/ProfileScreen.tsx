import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  Share,
  TextInput,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../utils/supabase';
import { getSightings, getDiscoveredLabels, getMyDisplayName, updateUsername, updateAvatarUrl, getMyAvatarUrl } from '../utils/storage';
import { getNotificationsEnabled, enableDailyNotification, disableDailyNotification } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BADGES, getEarnedBadges, getNextBadge } from '../utils/badges';

const REGION_KEY = 'wilddex_region';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'] as const;
type ContinentOption = typeof CONTINENTS[number];

const ProfileScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [sightingCount, setSightingCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [region, setRegion] = useState<ContinentOption | null>(null);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
    });
    getMyDisplayName().then(setUsername);
    getMyAvatarUrl().then(setAvatarUrl);
    getSightings().then((s) => setSightingCount(s.length));
    getDiscoveredLabels().then((d) => setDiscoveredCount(d.size));
    getNotificationsEnabled().then(setNotifsEnabled);
    AsyncStorage.getItem(REGION_KEY).then((v) => { if (v) setRegion(v as ContinentOption); });
  }, []));

  const saveName = async () => {
    const clean = nameInput.trim().replace(/^@/, '');
    if (!clean) return;
    try {
      await updateUsername(clean);
      setUsername(clean);
      setEditingName(false);
    } catch (e: any) {
      Alert.alert('Failed to save', e.message);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Allow photo access to set a profile picture.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) return;
      const filename = `avatars/${userId}.jpg`;
      const formData = new FormData();
      formData.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as any);
      const { error } = await supabase.storage.from('sighting-photos').upload(filename, formData, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('sighting-photos').getPublicUrl(filename);
      await updateAvatarUrl(data.publicUrl);
      setAvatarUrl(data.publicUrl);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    }
  };

  const selectRegion = async (continent: ContinentOption) => {
    setRegion(continent);
    await AsyncStorage.setItem(REGION_KEY, continent);
    setRegionPickerVisible(false);
  };

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await enableDailyNotification();
      if (!granted) {
        Alert.alert('Permission required', 'Enable notifications in Settings to get daily reminders.');
        return;
      }
    } else {
      await disableDailyNotification();
    }
    setNotifsEnabled(value);
  };

  const avatarLetter = (username || email).charAt(0).toUpperCase();
  const earnedBadges = getEarnedBadges(discoveredCount);
  const nextBadge = getNextBadge(discoveredCount);

  const handleInvite = async () => {
    await Share.share({
      message: `Join me on WildDex 🦁 — identify animals and build your collection! Download it on the App Store.`,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <TouchableOpacity onPress={pickAvatar} style={styles.avatarWrapper}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={styles.avatarCircle} />
              : <View style={styles.avatarCircle}><Text style={styles.avatarLetter}>{avatarLetter}</Text></View>
            }
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={12} color={COLORS.white} />
            </View>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                placeholder="username"
                placeholderTextColor={COLORS.darkGrey}
                onSubmitEditing={saveName}
              />
              <TouchableOpacity onPress={saveName} style={styles.nameSaveBtn}>
                <Text style={styles.nameSaveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => { setNameInput(username); setEditingName(true); }} style={styles.nameRow}>
              <Text style={styles.displayName}>{username ? `@${username}` : 'Set a username'}</Text>
              <Ionicons name="pencil-outline" size={13} color={COLORS.darkGrey} />
            </TouchableOpacity>
          )}
          <Text style={styles.email}>{email}</Text>

          <View style={styles.statsDivider} />

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{discoveredCount}</Text>
              <Text style={styles.statLabel}>Species</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{sightingCount}</Text>
              <Text style={styles.statLabel}>Sightings</Text>
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

        {/* Settings + actions */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>SETTINGS</Text>
          <View style={styles.settingRow}>
            <Ionicons name="notifications-outline" size={19} color={COLORS.grey} />
            <Text style={styles.settingText}>Daily Reminder</Text>
            <Switch
              value={notifsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
          <TouchableOpacity style={styles.settingRow} onPress={() => setRegionPickerVisible(true)}>
            <Ionicons name="globe-outline" size={19} color={COLORS.grey} />
            <Text style={styles.settingText}>Region</Text>
            <Text style={styles.settingValue}>{region ?? 'Set region'}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={19} color={COLORS.grey} />
            <Text style={styles.settingText}>Invite Friends</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingRow, styles.logoutRow]} onPress={() => supabase.auth.signOut()}>
            <Ionicons name="log-out-outline" size={19} color={COLORS.primary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Region picker modal */}
        <Modal visible={regionPickerVisible} animationType="slide" transparent presentationStyle="overFullScreen">
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setRegionPickerVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
              <Text style={styles.pickerTitle}>Select Your Region</Text>
              {CONTINENTS.map((c) => (
                <TouchableOpacity key={c} style={styles.pickerRow} onPress={() => selectRegion(c)}>
                  <Text style={[styles.pickerOption, region === c && styles.pickerOptionSelected]}>{c}</Text>
                  {region === c && <Ionicons name="checkmark" size={18} color={COLORS.yellow} />}
                </TouchableOpacity>
              ))}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.white, letterSpacing: 0.5 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  heroCard: {
    backgroundColor: COLORS.card, borderRadius: 20, borderWidth: 1,
    borderColor: COLORS.cardBorder, alignItems: 'center', padding: 24, gap: 8,
  },
  avatarWrapper: { position: 'relative' },
  avatarCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.primary, borderRadius: 11,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.card,
  },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  displayName: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
  nameInput: {
    flex: 1, backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.white, fontSize: 16,
  },
  nameSaveBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  nameSaveBtnText: { color: COLORS.white, fontWeight: '700' },
  email: { fontSize: 13, color: COLORS.darkGrey },
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

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: COLORS.cardBorder, gap: 12,
  },
  settingText: { flex: 1, color: COLORS.white, fontSize: 15 },
  settingValue: { color: COLORS.darkGrey, fontSize: 13 },
  logoutRow: {},
  logoutText: { flex: 1, color: COLORS.primary, fontSize: 15, fontWeight: '600' },

  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  pickerOption: { fontSize: 16, color: COLORS.white },
  pickerOptionSelected: { color: COLORS.yellow, fontWeight: '700' },
});
