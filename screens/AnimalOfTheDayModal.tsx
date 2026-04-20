import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator, Animated, Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../utils/ThemeContext';
import { loadDailyAnimals, getDailyAnimalFromList, DailyAnimal } from '../utils/dailyAnimal';
import { formatLabel } from '../utils/format';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  animalLabel?: string;
}

const AnimalOfTheDayModal: React.FC<Props> = ({ visible, onDismiss, animalLabel }) => {
  const { colors: C } = useTheme();
  const [animal, setAnimal] = useState<DailyAnimal | null>(null);
  const [funFact, setFunFact] = useState<string | null>(null);
  const [sciName, setSciName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      setFunFact(null);
      setSciName(null);
      setLoading(true);

      loadDailyAnimals().then((animals) => {
        const selected = animalLabel
          ? (animals.find(a => a.label === animalLabel) ?? getDailyAnimalFromList(animals))
          : getDailyAnimalFromList(animals);
        setAnimal(selected);

        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        ]).start();

        import('../utils/claude').then(({ getAnimalProfile }) => {
          getAnimalProfile(selected.label)
            .then((info) => {
              setFunFact(info.funFact);
              setSciName(info.scientificName);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        });
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
      setAnimal(null);
    }
  }, [visible, animalLabel]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}
        onPress={onDismiss}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <Pressable onPress={() => {}} style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: C.cardBorder,
            paddingBottom: 44,
            overflow: 'hidden',
          }}>
            {/* Hero photo */}
            {animal?.photo_url ? (
              <View style={{ width: '100%', height: 240 }}>
                <Image
                  source={{ uri: animal.photo_url }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
                {/* Gradient overlay for text legibility */}
                <View style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
                  background: 'transparent',
                }} pointerEvents="none" />
                {/* AOTD label over photo */}
                <View style={{ position: 'absolute', top: 16, left: 0, right: 0, alignItems: 'center' }}>
                  <View style={{
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
                    borderWidth: 1, borderColor: C.yellow,
                  }}>
                    <Text style={{
                      color: C.yellow, fontSize: 11, fontWeight: '700',
                      letterSpacing: 1.5, textTransform: 'uppercase',
                    }}>
                      🌿 Animal of the Day
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background }}>
                <ActivityIndicator color={C.yellow} />
              </View>
            )}

            {/* Content */}
            <View style={{ padding: 24, paddingTop: 20 }}>
              {/* Handle bar */}
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: C.cardBorder, alignSelf: 'center', marginBottom: 16,
              }} />

              {/* Animal name */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ color: C.white, fontSize: 26, fontWeight: '900', textAlign: 'center' }}>
                  {animal ? formatLabel(animal.label) : ''}
                </Text>
                {sciName && (
                  <Text style={{ color: C.grey, fontSize: 14, fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>
                    {sciName}
                  </Text>
                )}
              </View>

              {/* Fun fact */}
              {loading ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <ActivityIndicator color={C.yellow} />
                </View>
              ) : funFact ? (
                <View style={{
                  backgroundColor: C.background,
                  borderRadius: 14, padding: 16,
                  borderLeftWidth: 3, borderLeftColor: C.yellow,
                  marginBottom: 24,
                }}>
                  <Text style={{
                    color: C.yellow, fontSize: 10, fontWeight: '700',
                    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6,
                  }}>
                    Did you know?
                  </Text>
                  <Text style={{ color: C.white, fontSize: 15, lineHeight: 22 }}>
                    {funFact}
                  </Text>
                </View>
              ) : (
                <View style={{ marginBottom: 24 }} />
              )}

              {/* Dismiss button */}
              <TouchableOpacity
                onPress={onDismiss}
                style={{
                  backgroundColor: C.primary,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: C.white, fontSize: 16, fontWeight: '800' }}>
                  Let's go explore!
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

export default AnimalOfTheDayModal;
