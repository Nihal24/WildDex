import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { getAnimalProfile, AnimalInfo } from '../utils/claude';
import { getLatestPhotoForLabel } from '../utils/storage';

interface Props {
  route: { params: { label: string; id?: string; photoUri?: string } };
  navigation: any;
}

const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon as any} size={18} color={COLORS.yellow} style={styles.infoIcon} />
    <View style={styles.infoText}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const AnimalDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { label, id, photoUri: passedPhotoUri, fromCatch } = route.params;
  const [photoUri, setPhotoUri] = useState<string | null>(passedPhotoUri ?? null);
  const [info, setInfo] = useState<AnimalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [photo, profile] = await Promise.all([
          passedPhotoUri ? Promise.resolve(passedPhotoUri) : getLatestPhotoForLabel(label),
          getAnimalProfile(label),
        ]);
        setPhotoUri(photo);
        setInfo(profile);
      } catch (e: any) {
        setError('Failed to load animal info. Check your connection.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [label]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        {id ? <Text style={styles.headerNumber}>#{id}</Text> : <View />}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo */}
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="image-outline" size={48} color={COLORS.darkGrey} />
          </View>
        )}

        {/* Name */}
        <Text style={styles.name}>{label.charAt(0).toUpperCase() + label.slice(1)}</Text>
        {info && <Text style={styles.sciName}>{info.scientificName}</Text>}

        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.yellow} />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

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
      </ScrollView>

      {fromCatch && (
        <TouchableOpacity
          style={styles.wilddexBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Main', { screen: 'WildDex' })}
        >
          <Ionicons name="paw" size={18} color={COLORS.white} />
          <Text style={styles.wilddexBtnText}>View in my WildDex</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

export default AnimalDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  backButton: { padding: 4 },
  headerNumber: { color: COLORS.grey, fontSize: 16, fontWeight: '600' },
  scroll: { padding: 20, alignItems: 'center' },
  photo: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.yellow,
  },
  photoPlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.yellow,
    marginTop: 16,
    letterSpacing: 1,
    textTransform: 'capitalize',
  },
  sciName: {
    fontSize: 14,
    color: COLORS.grey,
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  loadingText: { color: COLORS.grey, fontSize: 14 },
  errorText: { color: COLORS.primary, marginTop: 20, textAlign: 'center' },
  card: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    marginTop: 8,
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
  wilddexBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  wilddexBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
});
