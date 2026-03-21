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

const LABELS = ['bald_eagle','canada_goose','cat','chameleon','cheetah','chicken','chimpanzee','cow','crocodile','crow','dog','dolphin','elephant','flamingo','giant_panda','giraffe','goat','gorilla','great_horned_owl','grizzly_bear','hippo','horse','hummingbird','kangaroo','koala','komodo_dragon','leopard','lion','mallard_duck','orangutan','parrot','peacock','pelican','penguin','pig','pigeon','polar_bear','rabbit','raccoon','red_fox','rhino','robin','sheep','squirrel','tiger','toucan','turtle','white_tailed_deer','wolf','zebra'];
const MODEL_INPUT_SIZE = 224;
const CONFIDENCE_THRESHOLD = 0.6;

const CameraScreen: React.FC = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [prediction, setPrediction] = useState<{ label: string; confidence: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadTensorflowModel(require('../assets/models/wilddex_model.tflite'))
      .then(setModel)
      .catch((e) => console.error('Failed to load model:', e));
  }, []);

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const runInference = async (photoUri: string) => {
    if (!model) return;
    setIsRunning(true);
    setPrediction(null);
    setSaved(false);

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

      const result = { label: LABELS[maxIdx], confidence: scores[maxIdx] };
      setPrediction(result);

      // Auto-save to WildDex if confidence is high enough
      if (result.confidence >= CONFIDENCE_THRESHOLD) {
        await saveSighting({ ...result, photoUri, timestamp: Date.now() });
        setSaved(true);
      }
    } catch (e) {
      console.error('Inference error:', e);
    } finally {
      setIsRunning(false);
    }
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
      await runInference(uri);
    }
  };

  const retake = () => {
    setCapturedPhoto(null);
    setPrediction(null);
    setSaved(false);
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
});
