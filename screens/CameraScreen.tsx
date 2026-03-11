import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Button,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  ActivityIndicator,
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

const LABELS = ['chicken', 'goose', 'pigeon'];
const MODEL_INPUT_SIZE = 224;

const CameraScreen: React.FC = () => {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<CameraCapturedPicture | null>(null);
  const [model, setModel] = useState<TensorflowModel | null>(null);
  const [prediction, setPrediction] = useState<{ label: string; confidence: number } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

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

    try {
      // 1. Resize to 180x180
      const resized = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      // 2. Read as base64 and decode to raw pixels
      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const rawBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { data: pixels } = jpeg.decode(rawBytes, { useTArray: true });

      // 3. Build Float32Array with RGB values (drop alpha channel)
      const numPixels = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
      const input = new Float32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        input[i * 3 + 0] = pixels[i * 4 + 0]; // R
        input[i * 3 + 1] = pixels[i * 4 + 1]; // G
        input[i * 3 + 2] = pixels[i * 4 + 2]; // B
      }

      // 4. Run model
      const output = await model.run([input]);
      const scores = output[0] as Float32Array;

      // 5. Pick top class
      let maxIdx = 0;
      for (let i = 1; i < scores.length; i++) {
        if (scores[i] > scores[maxIdx]) maxIdx = i;
      }
      setPrediction({ label: LABELS[maxIdx], confidence: scores[maxIdx] });
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

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant Permission" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {capturedPhoto ? (
        <View style={styles.previewContainer}>
          <Image source={{ uri: capturedPhoto.uri }} style={styles.previewImage} />

          {isRunning && (
            <View style={styles.resultBox}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.resultText}>Identifying...</Text>
            </View>
          )}

          {!isRunning && prediction && (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>{prediction.label}</Text>
              <Text style={styles.resultConfidence}>
                {(prediction.confidence * 100).toFixed(1)}% confidence
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.retakeButton}
            onPress={() => { setCapturedPhoto(null); setPrediction(null); }}
          >
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
            <TouchableOpacity onPress={toggleCameraFacing} style={styles.flipButton}>
              <Ionicons name="camera-reverse" size={28} color="white" />
            </TouchableOpacity>
            <TouchableOpacity onPress={takePhoto} style={styles.captureButton} />
            <TouchableOpacity onPress={pickFromLibrary} style={styles.libraryButton}>
              <Ionicons name="images-outline" size={26} color="white" />
            </TouchableOpacity>
          </CameraView>

          {!model && (
            <View style={styles.modelLoading}>
              <ActivityIndicator color="#fff" size="small" />
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
  container: { flex: 1 },
  message: { textAlign: 'center', paddingBottom: 10 },
  camera: { flex: 1 },
  flipButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 25,
  },
  captureButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '90%',
    height: '65%',
    borderRadius: 10,
  },
  resultBox: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
  },
  resultLabel: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  resultConfidence: {
    color: '#aaa',
    fontSize: 16,
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 8,
  },
  retakeButton: {
    marginTop: 20,
    backgroundColor: '#fff',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  libraryButton: {
    position: 'absolute',
    bottom: 38,
    right: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 25,
  },
  cameraContainer: { flex: 1, position: 'relative' },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  modelLoading: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modelLoadingText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 13,
  },
});
