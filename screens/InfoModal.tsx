import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { getAnimalProfile, AnimalInfo } from '../utils/claude';

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.yellow} style={styles.infoIcon} />
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const InfoModal: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { label, photoUri } = route.params;

  const [info, setInfo] = useState<AnimalInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const displayName = label
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  useEffect(() => {
    getAnimalProfile(label)
      .then(setInfo)
      .finally(() => setLoading(false));
  }, [label]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.grey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FIELD NOTES</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {photoUri && (
          <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
        )}

        <Text style={styles.name}>{displayName}</Text>
        {info && <Text style={styles.sciName}>{info.scientificName}</Text>}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.yellow} />
          </View>
        )}

        {info && (
          <View style={styles.card}>
            <Text style={styles.summaryText}>{info.summary}</Text>
            <View style={styles.divider} />
            <InfoRow icon="leaf-outline" label="Habitat" value={info.habitat} />
            <InfoRow icon="restaurant-outline" label="Diet" value={info.diet} />
            <InfoRow icon="shield-checkmark-outline" label="Conservation" value={info.conservationStatus} />
            <View style={styles.funFactBox}>
              <Text style={styles.funFactLabel}>Fun Fact</Text>
              <Text style={styles.funFactText}>{info.funFact}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.nextBtn}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('RegionModal', { label, photoUri })}
      >
        <Text style={styles.nextBtnText}>Native Range</Text>
        <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default InfoModal;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    color: COLORS.yellow,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
  },
  scroll: { padding: 20, alignItems: 'center' },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
    marginBottom: 16,
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.yellow,
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'capitalize',
  },
  sciName: {
    fontSize: 13,
    color: COLORS.grey,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  loadingBox: { paddingVertical: 40 },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginTop: 4,
  },
  summaryText: { color: COLORS.white, fontSize: 14, lineHeight: 22 },
  divider: { height: 1, backgroundColor: COLORS.cardBorder, marginVertical: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  infoIcon: { marginRight: 12, marginTop: 2 },
  infoText: { flex: 1 },
  infoLabel: { color: COLORS.grey, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { color: COLORS.white, fontSize: 14, marginTop: 2, lineHeight: 20 },
  funFactBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.yellow,
  },
  funFactLabel: { color: COLORS.yellow, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  funFactText: { color: COLORS.white, fontSize: 14, lineHeight: 20 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 24,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  nextBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
