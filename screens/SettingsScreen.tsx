import React, { useState, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { supabase } from '../utils/supabase';
import { getMyDisplayName, updateUsername, getDefaultVisibility, updateDefaultVisibility } from '../utils/storage';

import { getNotificationsEnabled, enableDailyNotification, disableDailyNotification } from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const REGION_KEY = 'wilddex_region';
const CONTINENTS = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania', 'Antarctica'] as const;
type ContinentOption = typeof CONTINENTS[number];

const SettingsScreen: React.FC = () => {
  const { colors: COLORS, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation();

  const [username, setUsername] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameLoading, setUsernameLoading] = useState(false);

  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [region, setRegion] = useState<ContinentOption | null>(null);
  const [regionPickerVisible, setRegionPickerVisible] = useState(false);
  const [defaultVisibility, setDefaultVisibility] = useState('public');
  const [visibilityPickerVisible, setVisibilityPickerVisible] = useState(false);

  useEffect(() => {
    getMyDisplayName().then((name) => { setUsername(name); setUsernameInput(name); });
    getNotificationsEnabled().then(setNotifsEnabled);
    AsyncStorage.getItem(REGION_KEY).then((v) => { if (v) setRegion(v as ContinentOption); });
    getDefaultVisibility().then(setDefaultVisibility);
  }, []);

  const saveUsername = async () => {
    const clean = usernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!clean) return;
    setUsernameLoading(true);
    try {
      await updateUsername(clean);
      setUsername(clean);
      setEditingUsername(false);
    } catch (e: any) {
      Alert.alert('Failed to save', e.message);
    } finally {
      setUsernameLoading(false);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await enableDailyNotification();
      if (!granted) { Alert.alert('Permission required', 'Enable notifications in Settings to get daily reminders.'); return; }
    } else {
      await disableDailyNotification();
    }
    setNotifsEnabled(value);
  };

  const selectRegion = async (continent: ContinentOption) => {
    setRegion(continent);
    await AsyncStorage.setItem(REGION_KEY, continent);
    setRegionPickerVisible(false);
  };

  const handleInvite = async () => {
    await Share.share({ message: `Join me on WildDex 🦁 — identify animals and build your collection! Download it on the App Store.` });
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => { setUsernameInput(username); setEditingUsername(true); }}>
            <Ionicons name="person-outline" size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Username</Text>
            <Text style={styles.rowValue}>{username || 'Not set'}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>

          {editingUsername && (
            <View style={styles.editBlock}>
              <TextInput
                style={styles.input}
                value={usernameInput}
                onChangeText={(t) => setUsernameInput(t.replace(/^@/, '').toLowerCase())}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="new username"
                placeholderTextColor={COLORS.grey}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingUsername(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveUsername} disabled={usernameLoading}>
                  {usernameLoading ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name={isDark ? 'moon-outline' : 'sunny-outline'} size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Dark Mode</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
          <View style={[styles.row, styles.rowBorder]}>
            <Ionicons name="notifications-outline" size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Daily Reminder</Text>
            <Switch
              value={notifsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: COLORS.cardBorder, true: COLORS.primary }}
              thumbColor={COLORS.white}
            />
          </View>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => setRegionPickerVisible(true)}>
            <Ionicons name="globe-outline" size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Region</Text>
            <Text style={styles.rowValue}>{region ?? 'Not set'}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => setVisibilityPickerVisible(true)}>
            <Ionicons name="eye-outline" size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Default Post Visibility</Text>
            <Text style={styles.rowValue}>{defaultVisibility.charAt(0).toUpperCase() + defaultVisibility.slice(1)}</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>
        </View>

        {/* More */}
        <Text style={styles.sectionLabel}>MORE</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={handleInvite}>
            <Ionicons name="person-add-outline" size={19} color={COLORS.grey} />
            <Text style={styles.rowText}>Invite Friends</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.darkGrey} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={19} color={COLORS.primary} />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Visibility picker */}
      <Modal visible={visibilityPickerVisible} animationType="slide" transparent presentationStyle="overFullScreen">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setVisibilityPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Default Post Visibility</Text>
            {(['public', 'followers', 'private'] as const).map((v) => (
              <TouchableOpacity key={v} style={styles.pickerRow} onPress={async () => {
                setDefaultVisibility(v);
                await updateDefaultVisibility(v);
                setVisibilityPickerVisible(false);
              }}>
                <View>
                  <Text style={[styles.pickerOption, defaultVisibility === v && styles.pickerOptionSelected]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                  <Text style={styles.pickerOptionSub}>
                    {v === 'public' ? 'Anyone can see your sightings'
                      : v === 'followers' ? 'Only followers can see'
                      : 'Only you can see'}
                  </Text>
                </View>
                {defaultVisibility === v && <Ionicons name="checkmark" size={18} color={COLORS.yellow} />}
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Region picker */}
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
    </SafeAreaView>
  );
};

export default SettingsScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.yellow, letterSpacing: 3, textTransform: 'uppercase' },
  scroll: { padding: 16, gap: 6, paddingBottom: 40 },
  sectionLabel: { color: COLORS.grey, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 10, marginBottom: 4, marginLeft: 4 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.cardBorder, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  rowText: { flex: 1, color: COLORS.white, fontSize: 15 },
  rowValue: { color: COLORS.grey, fontSize: 13 },
  logoutText: { flex: 1, color: COLORS.primary, fontSize: 15, fontWeight: '600' },
  editBlock: { paddingHorizontal: 16, paddingBottom: 14, gap: 10, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  input: {
    backgroundColor: COLORS.background, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.cardBorder, paddingHorizontal: 14, paddingVertical: 10,
    color: COLORS.white, fontSize: 15, marginTop: 10,
  },
  forgotBtn: { alignSelf: 'flex-start' },
  forgotText: { color: COLORS.amber, fontSize: 13, fontWeight: '500' },
  editActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: COLORS.cardBorder, alignItems: 'center' },
  cancelBtnText: { color: COLORS.grey, fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveBtnText: { color: COLORS.white, fontWeight: '700' },
  pickerOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  pickerSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 4 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white, textAlign: 'center', marginBottom: 12 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  pickerOption: { fontSize: 16, color: COLORS.white },
  pickerOptionSelected: { color: COLORS.yellow, fontWeight: '700' },
  pickerOptionSub: { fontSize: 12, color: COLORS.grey, marginTop: 2 },
});
