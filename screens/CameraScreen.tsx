import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  Animated,
  Linking,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  CameraCapturedPicture,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { COLORS, ColorScheme } from '../constants/theme';
import { useTheme } from '../utils/ThemeContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { saveSighting, getDefaultVisibility } from '../utils/storage';
import { prefetchAnimalProfile } from '../utils/claude';
import * as Location from 'expo-location';
const CONFIDENCE_THRESHOLD = 0.5;

const identifyAnimal = async (
  photoUri: string,
): Promise<{ label: string; confidence: number; source?: string; error?: string } | null> => {
  try {
    const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl;
    const supabaseKey = Constants.expoConfig?.extra?.supabasePublishableKey;
    if (!supabaseUrl || !supabaseKey) return { label: '', confidence: 0, error: 'missing config' };

    const formData = new FormData();
    formData.append('image', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as any);

    const res = await fetch(`${supabaseUrl}/functions/v1/identify-animal`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      body: formData,
    });

    const data = await res.json();
    if (data.error) return { label: '', confidence: 0, error: data.error };
    return { label: data.label, confidence: data.confidence, source: data.source };
  } catch (e: any) {
    return { label: '', confidence: 0, error: String(e?.message ?? e) };
  }
};

const CameraScreen: React.FC = () => {
  const { colors: COLORS } = useTheme();
  const styles = makeStyles(COLORS);
  const navigation = useNavigation<any>();
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [prediction, setPrediction] = useState<{ label: string; confidence: number; source?: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isNotAnimal, setIsNotAnimal] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingSighting, setPendingSighting] = useState<{ label: string; confidence: number; photoUri: string } | null>(null);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<{ city: string; region: string; country: string }[]>([]);
  const [suggestionCoords, setSuggestionCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastY = useRef(new Animated.Value(-80)).current;
  const [toastLabel, setToastLabel] = useState('');
  const locationToastOpacity = useRef(new Animated.Value(0)).current;
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  const lastPinchDistance = useRef<number | null>(null);
  const zoomIndicatorOpacity = useRef(new Animated.Value(0)).current;
  const zoomFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Maps 0-1 zoom to a display value of 1x-10x
  const zoomDisplay = (1 + zoomRef.current * 9).toFixed(1) + 'x';

  const showZoomIndicator = () => {
    if (zoomFadeTimer.current) clearTimeout(zoomFadeTimer.current);
    zoomIndicatorOpacity.setValue(1);
    zoomFadeTimer.current = setTimeout(() => {
      Animated.timing(zoomIndicatorOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 1000);
  };

  const getPinchDistance = (touches: any[]) => {
    const dx = touches[0].pageX - touches[1].pageX;
    const dy = touches[0].pageY - touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: any) => {
    if (e.nativeEvent.touches.length === 2) {
      lastPinchDistance.current = getPinchDistance(e.nativeEvent.touches);
    }
  };

  const handleTouchMove = (e: any) => {
    if (e.nativeEvent.touches.length === 2 && lastPinchDistance.current !== null) {
      const newDistance = getPinchDistance(e.nativeEvent.touches);
      const delta = (newDistance - lastPinchDistance.current) / 400;
      zoomRef.current = Math.min(1, Math.max(0, zoomRef.current + delta));
      setZoom(zoomRef.current);
      lastPinchDistance.current = newDistance;
      showZoomIndicator();
    }
  };

  const handleTouchEnd = (e: any) => {
    if (e.nativeEvent.touches.length < 2) lastPinchDistance.current = null;
  };

  const showSaveToast = (label: string, onShown?: () => void) => {
    setToastLabel(label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    Animated.sequence([
      Animated.spring(toastY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
      Animated.delay(1800),
      Animated.timing(toastY, { toValue: -80, duration: 250, useNativeDriver: true }),
    ]).start();
    if (onShown) setTimeout(onShown, 600);
  };

  const showLocationToast = () => {
    locationToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(locationToastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(locationToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  React.useEffect(() => { getDefaultVisibility().then(setVisibility); }, []);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const runInference = async (photoUri: string, fromGallery = false) => {
    setIsRunning(true);
    setPrediction(null);
    setSaved(false);
    setIsNotAnimal(false);
    setPendingSighting(null);

    try {
      const resized = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      const compressedUri = resized.uri;

      const result = await identifyAnimal(compressedUri);

      if (result?.error === 'not_animal') {
        setIsNotAnimal(true);
        setPrediction({ label: 'not_animal', confidence: 0 });
        return;
      }

      if (!result || result.error || !result.label) {
        setPrediction({ label: result?.error ?? 'unknown error', confidence: -1 });
        return;
      }

      const finalResult = result;

      if (finalResult.confidence < CONFIDENCE_THRESHOLD) {
        setIsNotAnimal(true);
        setPrediction({ label: 'not_animal', confidence: 0 });
        return;
      }

      setPrediction(finalResult);
      // Start fetching animal profile immediately — will be cached by the time user opens WildDex modal
      prefetchAnimalProfile(finalResult.label);

      if (fromGallery) {
        setPendingSighting({ ...finalResult, photoUri: compressedUri });
      } else {
        // Camera shot — navigate immediately, fetch location in background
        const timestamp = Date.now();
        retake();
        navigation.navigate('Catch', { label: finalResult.label, photoUri: compressedUri });
        setSaved(true);
        (async () => {
          let latitude: number | undefined;
          let longitude: number | undefined;
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              latitude = loc.coords.latitude;
              longitude = loc.coords.longitude;
            }
          } catch {}
          await saveSighting({ ...finalResult, photoUri: compressedUri, timestamp, latitude, longitude, visibility });
        })();
      }
    } catch (e) {
      console.error('Inference error:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const saveWithCurrentLocation = async () => {
    if (!pendingSighting) return;
    setLocationLoading(true);
    let latitude: number | undefined;
    let longitude: number | undefined;
    let location: string | undefined;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;
      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (place) {
          const city = place.city || place.subregion || place.region || '';
          const country = place.country || '';
          location = [city, country].filter(Boolean).join(', ');
          if (location) setLocationSearch(location);
        }
      } catch {}
    }
    const ps = pendingSighting;
    await saveSighting({ ...ps, timestamp: Date.now(), latitude, longitude, location, caption: caption.trim() || undefined, visibility });
    setPendingSighting(null);
    setCaption('');
    setLocationLoading(false);
    setSaved(true);
    showLocationToast();
    setTimeout(() => {
      retake();
      navigation.navigate('Catch', { label: ps.label, photoUri: ps.photoUri });
    }, 800);
  };

  const saveWithSearchedLocation = async () => {
    if (!pendingSighting || !locationSearch.trim()) return;
    setLocationLoading(true);
    try {
      const results = await Location.geocodeAsync(locationSearch.trim());
      if (results.length === 0) {
        Alert.alert('Location not found', 'Try a different search term.');
        setLocationLoading(false);
        return;
      }
      const { latitude, longitude } = results[0];
      const ps = pendingSighting;
      await saveSighting({ ...ps, timestamp: Date.now(), latitude, longitude, caption: caption.trim() || undefined, visibility });
      setPendingSighting(null);
      setLocationSearch('');
      setCaption('');
      setSaved(true);
      retake();
      navigation.navigate('Catch', { label: ps.label, photoUri: ps.photoUri });
    } catch {
      Alert.alert('Error', 'Could not geocode location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const onLocationSearchChange = (text: string) => {
    setLocationSearch(text);
    setLocationSuggestions([]);
    setSuggestionCoords([]);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!text.trim()) return;
    searchTimeout.current = setTimeout(async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(text.trim())}&limit=5&lang=en`;
        const res = await fetch(url);
        const data = await res.json();
        const features = data.features ?? [];
        const addresses = features.map((f: any) => {
          const p = f.properties;
          const name = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
          const city = p.city || p.town || p.village || '';
          const region = [city, p.state || p.county].filter(Boolean).join(', ');
          const country = p.country || '';
          return { city: name || city, region: name ? region : [p.state || p.county, country].filter(Boolean).join(', '), country: name ? country : '' };
        });
        const coords = features.map((f: any) => ({
          latitude: f.geometry.coordinates[1],
          longitude: f.geometry.coordinates[0],
        }));
        setLocationSuggestions(addresses);
        setSuggestionCoords(coords);
      } catch {}
    }, 400);
  };

  const saveWithSuggestion = async (index: number) => {
    if (!pendingSighting) return;
    const { latitude, longitude } = suggestionCoords[index];
    const s = locationSuggestions[index];
    const location = [s.city, s.region, s.country].filter(Boolean).join(', ');
    setLocationSuggestions([]);
    setLocationSearch(location); // show chosen location in the input
    const ps = pendingSighting;
    await saveSighting({ ...ps, timestamp: Date.now(), latitude, longitude, location, caption: caption.trim() || undefined, visibility });
    setPendingSighting(null);
    setCaption('');
    setSaved(true);
    showLocationToast();
    setTimeout(() => {
      retake();
      navigation.navigate('Catch', { label: ps.label, photoUri: ps.photoUri });
    }, 800);
  };

  const saveWithNoLocation = async () => {
    if (!pendingSighting) return;
    const ps = pendingSighting;
    await saveSighting({ ...ps, timestamp: Date.now(), caption: caption.trim() || undefined, visibility });
    setPendingSighting(null);
    setCaption('');
    setLocationSearch('');
    setSaved(true);
    retake();
    navigation.navigate('Catch', { label: ps.label, photoUri: ps.photoUri });
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setCapturedPhoto(photo);
      await runInference(photo.uri);
    }
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setCapturedPhoto({ uri } as CameraCapturedPicture);
      await runInference(uri, true);
    }
  };

  const retake = () => {
    setCapturedPhoto(null);
    setPrediction(null);
    setSaved(false);
    setIsNotAnimal(false);
    setCaption('');
    setLocationSearch('');
    setLocationSuggestions([]);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <View style={styles.permissionIconCircle}>
          <Ionicons name="camera-outline" size={56} color={COLORS.yellow} />
        </View>
        <Text style={styles.permissionTitle}>Let's spot some animals!</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={async () => {
            const { granted, canAskAgain } = await requestPermission();
            if (!granted && !canAskAgain) Linking.openSettings();
          }}
        >
          <Text style={styles.permissionButtonText}>Enable Camera Access</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {capturedPhoto ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Full-screen photo */}
          <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} resizeMode="cover" />

          {/* Top scrim + retake */}
          <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={styles.previewTopScrim} pointerEvents="none" />
          <TouchableOpacity style={styles.retakeButton} onPress={retake}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          {/* Bottom glass result panel */}
          <View style={styles.resultPanelWrapper}>
            <BlurView intensity={80} tint="dark" style={styles.resultPanel}>
              {isRunning && (
                <View style={styles.resultRow}>
                  <ActivityIndicator color={COLORS.yellow} />
                  <Text style={styles.resultText}>Identifying...</Text>
                </View>
              )}

              {!isRunning && prediction && (() => {
                if (isNotAnimal) {
                  return (
                    <View style={styles.unrecognizedContent}>
                      <Ionicons name="paw-outline" size={24} color="rgba(255,255,255,0.4)" />
                      <View>
                        <Text style={styles.unrecognizedLabel}>No animal detected</Text>
                        <Text style={styles.unrecognizedSub}>Try a photo with a clear animal subject</Text>
                      </View>
                    </View>
                  );
                }
                const recognized = prediction.confidence >= 0 && prediction.label !== '';
                return (
                  <>
                    {recognized ? (
                      <Text style={styles.resultLabel}>
                        {prediction.label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </Text>
                    ) : (
                      <View style={styles.unrecognizedContent}>
                        <Ionicons name="help-circle-outline" size={24} color="rgba(255,255,255,0.4)" />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.unrecognizedLabel}>API Error</Text>
                          <Text style={styles.unrecognizedSub} numberOfLines={2}>{prediction.label}</Text>
                        </View>
                      </View>
                    )}
                    {pendingSighting && !saved && (
                      <>
                        <TextInput
                          style={styles.captionInput}
                          placeholder="Add a caption..."
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={caption}
                          onChangeText={setCaption}
                          maxLength={200}
                          returnKeyType="done"
                          blurOnSubmit
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={() => setPendingSighting({ ...pendingSighting, _showSheet: true } as any)}>
                          <Text style={styles.saveButtonText}>Save to WildDex →</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                );
              })()}
            </BlurView>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <View
          style={styles.cameraContainer}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <CameraView style={styles.camera} facing={facing} ref={cameraRef} zoom={zoom}>
            <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
              <Ionicons name="camera-reverse" size={26} color="white" />
            </TouchableOpacity>
            <Animated.View style={[styles.zoomIndicator, { opacity: zoomIndicatorOpacity }]} pointerEvents="none">
              <Text style={styles.zoomIndicatorText}>{zoomDisplay}</Text>
            </Animated.View>
            <TouchableOpacity onPress={takePhoto} style={styles.captureButton}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromLibrary} style={styles.libraryButton}>
              <Ionicons name="images-outline" size={26} color="white" />
            </TouchableOpacity>
          </CameraView>

        </View>
      )}
      {/* Location prompt for gallery uploads */}
      <Modal visible={!!(pendingSighting as any)?._showSheet} animationType="slide" transparent presentationStyle="overFullScreen">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.locationOverlay}>
          <View style={styles.locationSheet}>
            <View style={styles.locationHandle} />
            <Text style={styles.locationTitle}>Where was this taken?</Text>
            <Text style={styles.locationSub}>Add a location to pin it on the Explore map</Text>

            <TouchableOpacity style={styles.locationOptionButton} onPress={saveWithCurrentLocation} disabled={locationLoading}>
              <Ionicons name="locate" size={20} color={COLORS.yellow} />
              <Text style={styles.locationOptionText}>Use my current location</Text>
            </TouchableOpacity>

            <View style={styles.locationDivider}>
              <View style={styles.locationLine} />
              <Text style={styles.locationOr}>or search</Text>
              <View style={styles.locationLine} />
            </View>

            <View>
              <View style={styles.locationInputRow}>
                <Ionicons name="search" size={16} color={COLORS.darkGrey} style={{ marginLeft: 12 }} />
                <TextInput
                  style={styles.locationInput}
                  placeholder="City, park, or address..."
                  placeholderTextColor={COLORS.darkGrey}
                  value={locationSearch}
                  onChangeText={onLocationSearchChange}
                  autoCorrect={false}
                />
                {locationSearch.length > 0 && (
                  <TouchableOpacity onPress={() => { setLocationSearch(''); setLocationSuggestions([]); }} style={{ marginRight: 12 }}>
                    <Ionicons name="close-circle" size={18} color={COLORS.darkGrey} />
                  </TouchableOpacity>
                )}
              </View>
              {locationSuggestions.length > 0 && (
                <ScrollView style={styles.dropdown} keyboardShouldPersistTaps="handled">
                  {locationSuggestions.map((s, i) => {
                    const sub = [s.region, s.country].filter(Boolean).join(', ');
                    return (
                      <TouchableOpacity key={i} style={[styles.dropdownItem, i > 0 && styles.dropdownDivider]} onPress={() => saveWithSuggestion(i)}>
                        <Ionicons name="location-outline" size={16} color={COLORS.yellow} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dropdownLine1}>{s.city}</Text>
                          {sub ? <Text style={styles.dropdownLine2}>{sub}</Text> : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <Animated.View style={[styles.locationToast, { opacity: locationToastOpacity }]} pointerEvents="none">
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.locationToastText}>Location saved!</Text>
            </Animated.View>

          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

export default CameraScreen;

const makeStyles = (COLORS: ColorScheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  toast: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#4CAF50' + '55',
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  toastText: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  camera: { flex: 1 },
  cameraContainer: { flex: 1 },
  zoomIndicator: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  zoomIndicatorText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 10,
    borderRadius: 25,
  },
  captureButton: {
    position: 'absolute',
    bottom: 36,
    alignSelf: 'center',
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
  },
  libraryButton: {
    position: 'absolute',
    bottom: 48,
    right: 44,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 10,
    borderRadius: 25,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewTopScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  retakeButton: {
    position: 'absolute',
    top: 56,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 22,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultPanelWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  resultPanel: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resultLabel: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'capitalize',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  unrecognizedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unrecognizedLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '700',
  },
  unrecognizedSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedText: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionIconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.card,
    borderWidth: 2,
    borderColor: COLORS.yellow + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  permissionTitle: {
    fontSize: 24, fontWeight: '900', color: COLORS.white,
    textAlign: 'center', letterSpacing: 0.3,
  },
  permissionSub: {
    fontSize: 14, color: COLORS.grey,
    textAlign: 'center', lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 8,
  },
  permissionButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  locationOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingTop: 60,
  },
  locationSheet: {
    backgroundColor: COLORS.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    gap: 12,
    flex: 1,
  },
  locationHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.cardBorder,
    alignSelf: 'center',
    marginBottom: 8,
  },
  locationTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  locationSub: { fontSize: 13, color: COLORS.grey, textAlign: 'center', marginBottom: 4 },
  locationToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a2e1a',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#4CAF5040',
  },
  locationToastText: { color: '#4CAF50', fontSize: 13, fontWeight: '600' },
  locationOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
  },
  locationOptionText: { fontSize: 15, fontWeight: '600', color: COLORS.yellow },
  locationDivider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  locationOr: { color: COLORS.grey, fontSize: 12 },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  locationInput: {
    flex: 1,
    padding: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  dropdown: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownDivider: { borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  dropdownLine1: { color: COLORS.white, fontSize: 14, fontWeight: '600' },
  dropdownLine2: { color: COLORS.grey, fontSize: 12, marginTop: 1 },
  locationSkip: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingVertical: 14,
  },
  locationSkipText: { color: COLORS.grey, fontSize: 15, fontWeight: '600' },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 36,
    textAlignVertical: 'top',
  },
});
