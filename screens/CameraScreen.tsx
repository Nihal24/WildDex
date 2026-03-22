import React, { useRef, useState, useEffect } from 'react';
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
} from 'react-native';
import {
  CameraView,
  CameraType,
  useCameraPermissions,
  CameraCapturedPicture,
} from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';
import jpeg from 'jpeg-js';
import { COLORS } from '../constants/theme';
import { saveSighting } from '../utils/storage';
import * as Location from 'expo-location';

const LABELS = ['bald_eagle','canada_goose','cat','chameleon','cheetah','chicken','chimpanzee','cow','crocodile','crow','dog','dolphin','elephant','flamingo','giant_panda','giraffe','goat','gorilla','great_horned_owl','grizzly_bear','hippo','horse','hummingbird','kangaroo','koala','komodo_dragon','leopard','lion','mallard_duck','orangutan','parrot','peacock','pelican','penguin','pig','pigeon','polar_bear','rabbit','raccoon','red_fox','rhino','robin','sheep','squirrel','tiger','toucan','turtle','white_tailed_deer','wolf','zebra'];
const MODEL_INPUT_SIZE = 224;
const CONFIDENCE_THRESHOLD = 0.6;
const INAT_CONFIDENCE_THRESHOLD = 0.3;
const INAT_API_URL = 'https://api.inaturalist.org/v1/computervision/score_image';

const scoreWithInat = async (
  photoUri: string,
  latitude?: number,
  longitude?: number,
): Promise<{ label: string; confidence: number } | null> => {
  try {
    const formData = new FormData();
    formData.append('image', { uri: photoUri, type: 'image/jpeg', name: 'photo.jpg' } as any);
    if (latitude != null) formData.append('lat', String(latitude));
    if (longitude != null) formData.append('lng', String(longitude));

    const response = await fetch(INAT_API_URL, { method: 'POST', body: formData });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    const top = data.results[0];
    const commonName = top.taxon?.preferred_common_name || top.taxon?.name;
    if (!commonName) return null;

    return {
      label: commonName.toLowerCase().replace(/[\s-]+/g, '_'),
      confidence: top.score ?? 0,
    };
  } catch (e) {
    console.error('iNaturalist API error:', e);
    return null;
  }
};

const CameraScreen: React.FC = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [prediction, setPrediction] = useState<{ label: string; confidence: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [inatFallback, setInatFallback] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pendingSighting, setPendingSighting] = useState<{ label: string; confidence: number; photoUri: string } | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    loadTensorflowModel(require('../assets/models/wilddex_model.tflite'))
      .then(setModel)
      .catch((e) => console.error('Failed to load model:', e));
  }, []);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const runInference = async (photoUri: string, fromGallery = false) => {
    if (!model) return;
    setIsRunning(true);
    setPrediction(null);
    setSaved(false);
    setInatFallback(false);
    setPendingSighting(null);

    try {
      const resized = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { data: pixels } = jpeg.decode(rawBytes, { useTArray: true });

      const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
      const input = new Float32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        input[i * 3 + 0] = pixels[i * 4 + 0];
        input[i * 3 + 1] = pixels[i * 4 + 1];
        input[i * 3 + 2] = pixels[i * 4 + 2];
      }

      const output = await model.run([input]);
      const scores = output[0] as Float32Array;

      let maxIdx = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[maxIdx]) maxIdx = i;
      }

      let finalResult = { label: LABELS[maxIdx], confidence: scores[maxIdx] };
      let usedFallback = false;

      if (finalResult.confidence < CONFIDENCE_THRESHOLD) {
        const inatResult = await scoreWithInat(photoUri);
        if (inatResult && inatResult.confidence >= INAT_CONFIDENCE_THRESHOLD) {
          finalResult = inatResult;
          usedFallback = true;
        }
      }

      setPrediction(finalResult);
      setInatFallback(usedFallback);

      const shouldSave = finalResult.confidence >= CONFIDENCE_THRESHOLD || usedFallback;
      if (shouldSave) {
        if (fromGallery) {
          setPendingSighting({ ...finalResult, photoUri });
        } else {
          // Camera shot — auto-capture location
          let latitude: number | undefined;
          let longitude: number | undefined;
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
          }
          await saveSighting({ ...finalResult, photoUri, timestamp: Date.now(), latitude, longitude });
          setSaved(true);
        }
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
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;
    }
    await saveSighting({ ...pendingSighting, timestamp: Date.now(), latitude, longitude });
    setPendingSighting(null);
    setLocationSearch('');
    setLocationLoading(false);
    setSaved(true);
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
      await saveSighting({ ...pendingSighting, timestamp: Date.now(), latitude, longitude });
      setPendingSighting(null);
      setLocationSearch('');
      setSaved(true);
    } catch {
      Alert.alert('Error', 'Could not geocode location.');
    } finally {
      setLocationLoading(false);
    }
  };

  const saveWithNoLocation = async () => {
    if (!pendingSighting) return;
    await saveSighting({ ...pendingSighting, timestamp: Date.now() });
    setPendingSighting(null);
    setLocationSearch('');
    setSaved(true);
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
    setInatFallback(false);
  };

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.message}>Camera permission required</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {capturedPhoto ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} />

          {isRunning && (
            <View style={styles.resultBox}>
              <ActivityIndicator color={COLORS.yellow} />
              <Text style={styles.resultText}>Identifying...</Text>
            </View>
          )}

          {!isRunning && prediction && (
            <View style={styles.resultBox}>
              <View>
                <Text style={styles.resultLabel}>
                  {prediction.label.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </Text>
                <Text style={styles.resultConfidence}>
                  {(prediction.confidence * 100).toFixed(1)}% confidence
                </Text>
              </View>
              {inatFallback && (
                <View style={styles.inatBadge}>
                  <Ionicons name="leaf-outline" size={14} color={COLORS.yellow} />
                  <Text style={styles.inatBadgeText}>via iNaturalist</Text>
                </View>
              )}
              {saved && (
                <View style={styles.savedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.yellow} />
                  <Text style={styles.savedText}>Added to WildDex</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.retakeButton} onPress={retake}>
            <Ionicons name="arrow-back" size={18} color={COLORS.white} />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
            <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
              <Ionicons name="camera-reverse" size={26} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.captureButton}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
            <TouchableOpacity onPress={pickFromLibrary} style={styles.libraryButton}>
              <Ionicons name="images-outline" size={26} color="white" />
            </TouchableOpacity>
          </CameraView>

          {!model && (
            <View style={styles.modelLoading}>
              <ActivityIndicator color={COLORS.yellow} size="small" />
              <Text style={styles.modelLoadingText}>Loading model...</Text>
            </View>
          )}
        </View>
      )}
      {/* Location prompt for gallery uploads */}
      <Modal visible={!!pendingSighting} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.locationOverlay}>
          <View style={styles.locationSheet}>
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

            <TextInput
              style={styles.locationInput}
              placeholder="City, park, or address..."
              placeholderTextColor={COLORS.darkGrey}
              value={locationSearch}
              onChangeText={setLocationSearch}
            />
            <TouchableOpacity
              style={[styles.locationOptionButton, { backgroundColor: COLORS.primary, opacity: locationSearch.trim() ? 1 : 0.4 }]}
              onPress={saveWithSearchedLocation}
              disabled={!locationSearch.trim() || locationLoading}
            >
              {locationLoading ? <ActivityIndicator color={COLORS.white} size="small" /> : <Ionicons name="search" size={20} color={COLORS.white} />}
              <Text style={[styles.locationOptionText, { color: COLORS.white }]}>Search & save</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={saveWithNoLocation} style={styles.locationSkip}>
              <Text style={styles.locationSkipText}>Skip — save without location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default CameraScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  camera: { flex: 1 },
  cameraContainer: { flex: 1 },
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
  previewContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewImage: {
    width: '100%',
    height: '60%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.cardBorder,
  },
  resultBox: {
    marginTop: 20,
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 16,
    gap: 8,
  },
  resultLabel: {
    color: COLORS.yellow,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 1,
  },
  resultConfidence: {
    color: COLORS.grey,
    fontSize: 14,
  },
  resultText: {
    color: COLORS.white,
    fontSize: 16,
    marginLeft: 10,
  },
  inatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  inatBadgeText: {
    color: COLORS.yellow,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  savedText: {
    color: COLORS.yellow,
    fontSize: 13,
    fontWeight: '600',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 30,
  },
  retakeText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  message: { color: COLORS.white, textAlign: 'center', marginBottom: 16 },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  permissionButtonText: { color: COLORS.white, fontWeight: '700' },
  modelLoading: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modelLoadingText: {
    color: COLORS.white,
    marginLeft: 8,
    fontSize: 13,
  },
  locationOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  locationSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  locationTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  locationSub: { fontSize: 13, color: COLORS.grey, textAlign: 'center', marginBottom: 4 },
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
  locationInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    color: COLORS.white,
    fontSize: 15,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  locationSkip: { alignItems: 'center', paddingVertical: 8 },
  locationSkipText: { color: COLORS.darkGrey, fontSize: 13 },
});
