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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../utils/supabase';
import { getSightings, getDiscoveredLabels } from '../utils/storage';
import { getNotificationsEnabled, enableDailyNotification, disableDailyNotification } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const REGION_KEY = 'wilddex_region';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'] as const;
type ContinentOption = typeof CONTINENTS[number];

const ProfileScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [sightingCount, setSightingCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [region, setRegion] = useState<ContinentOption | null>(null);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
    });
    getSightings().then((s) => setSightingCount(s.length));
    getDiscoveredLabels().then((d) => setDiscoveredCount(d.size));
    getNotificationsEnabled().then(setNotifsEnabled);
    AsyncStorage.getItem(REGION_KEY).then((v) => { if (v) setRegion(v as ContinentOption); });
  }, []));

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

  const avatarLetter = email.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Avatar */}
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>{avatarLetter}</Text>
        </View>
        <Text style={styles.email}>{email}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{discoveredCount}</Text>
            <Text style={styles.statLabel}>Species{'\n'}Discovered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{sightingCount}</Text>
            <Text style={styles.statLabel}>Total{'\n'}Sightings</Text>
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.settingRow}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.grey} />
            <Text style={styles.settingText}>Daily Reminder</Text>
            <Switch
              value={notifsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
          <TouchableOpacity style={styles.settingRow} onPress={() => setRegionPickerVisible(true)}>
            <Ionicons name="globe-outline" size={20} color={COLORS.grey} />
            <Text style={styles.settingText}>Region</Text>
            <Text style={styles.settingValue}>{region ?? 'Set region'}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
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

        {/* Log out */}
        <TouchableOpacity style={styles.logoutButton} onPress={() => supabase.auth.signOut()}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.primary} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3 },
  scroll: { alignItems: 'center', padding: 24, gap: 20 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: COLORS.white },
  email: { fontSize: 15, color: COLORS.grey, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    width: '100%',
    paddingVertical: 20,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 32, fontWeight: '900', color: COLORS.yellow },
  statLabel: { fontSize: 12, color: COLORS.grey, textAlign: 'center', marginTop: 4 },
  statDivider: { width: 1, backgroundColor: COLORS.cardBorder },
  section: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  sectionTitle: { color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 12,
  },
  settingText: { flex: 1, color: COLORS.white, fontSize: 15 },
  settingSubtext: { color: COLORS.darkGrey, fontSize: 12, marginTop: 1 },
  settingValue: { color: COLORS.darkGrey, fontSize: 13 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  pickerOption: { fontSize: 16, color: COLORS.white },
  pickerOptionSelected: { color: COLORS.yellow, fontWeight: '700' },
});
