import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { supabase } from '../utils/supabase';
import { getSightings, getDiscoveredLabels, purgeBrokenPhotoSightings } from '../utils/storage';

const ProfileScreen: React.FC = () => {
  const [email, setEmail] = useState<string>('');
  const [sightingCount, setSightingCount] = useState(0);
  const [discoveredCount, setDiscoveredCount] = useState(0);
  const [purging, setPurging] = useState(false);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const deleted = await purgeBrokenPhotoSightings();
      const s = await getSightings();
      setSightingCount(s.length);
      Alert.alert('Done', `Removed ${deleted} broken sightings. ${s.length} remaining.`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? '');
    });
    getSightings().then((s) => setSightingCount(s.length));
    getDiscoveredLabels().then((d) => setDiscoveredCount(d.size));
  }, []);

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

        {/* Settings placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.settingRow}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.grey} />
            <Text style={styles.settingText}>Notifications</Text>
            <Text style={styles.settingValue}>Coming soon</Text>
          </View>
          <View style={styles.settingRow}>
            <Ionicons name="globe-outline" size={20} color={COLORS.grey} />
            <Text style={styles.settingText}>Region</Text>
            <Text style={styles.settingValue}>Coming soon</Text>
          </View>
        </View>

        {/* Clean up */}
        <TouchableOpacity style={styles.purgeButton} onPress={handlePurge} disabled={purging}>
          {purging
            ? <ActivityIndicator color={COLORS.grey} size="small" />
            : <Ionicons name="trash-outline" size={20} color={COLORS.grey} />}
          <Text style={styles.purgeText}>Remove sightings with missing photos</Text>
        </TouchableOpacity>

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
  purgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    width: '100%',
    justifyContent: 'center',
    marginTop: 8,
  },
  purgeText: { color: COLORS.grey, fontSize: 14, fontWeight: '600' },
});
