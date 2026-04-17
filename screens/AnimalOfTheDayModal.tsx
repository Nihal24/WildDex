import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator, Animated, Pressable, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../utils/ThemeContext';
import { getDailyAnimal, DAILY_ANIMALS } from '../utils/dailyAnimal';
import { formatLabel } from '../utils/format';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  animalLabel?: string; // override from notification tap — shows the exact animal the notif mentioned
}

const AnimalOfTheDayModal: React.FC<Props> = ({ visible, onDismiss, animalLabel }) => {
  const { colors: C } = useTheme();
  const baseAnimal = getDailyAnimal();
  const animal = animalLabel
    ? (DAILY_ANIMALS.find(a => a.label === animalLabel) ?? baseAnimal)
    : baseAnimal;
  const [funFact, setFunFact] = useState<string | null>(null);
  const [sciName, setSciName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const handleShare = () => {
    const name = formatLabel(animal.label);
    const fact = funFact ? ` Did you know? ${funFact}` : '';
    Share.share({
      message: `Today's Animal of the Day on WildDex: ${animal.emoji} ${name}!${fact}\n\nDownload WildDex on the App Store.`,
    });
  };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(60)).current;

  useEffect(() => {
    if (visible) {
      setFunFact(null);
      setSciName(null);
      setLoading(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      ]).start();

      import('../utils/claude').then(({ getAnimalProfile }) => {
        getAnimalProfile(animal.label)
          .then((info) => {
            setFunFact(info.funFact);
            setSciName(info.scientificName);
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      });
    } else {
      fadeAnim.setValue(0);
      slideAnim.setValue(60);
    }
  }, [visible, animal.label]);

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}
        onPress={onDismiss}
      >
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <Pressable onPress={() => {}} style={{
            backgroundColor: C.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: C.cardBorder,
            padding: 28,
            paddingBottom: 44,
          }}>
            {/* Handle bar */}
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: C.cardBorder, alignSelf: 'center', marginBottom: 24,
            }} />

            {/* Header label */}
            <Text style={{
              color: C.yellow, fontSize: 11, fontWeight: '700',
              letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20, textAlign: 'center',
            }}>
              🌿 Animal of the Day
            </Text>

            {/* Animal hero */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: C.background,
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 2.5, borderColor: C.yellow,
                marginBottom: 14,
                shadowColor: C.yellow, shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
              }}>
                <Text style={{ fontSize: 52 }}>{animal.emoji}</Text>
              </View>
              <Text style={{ color: C.white, fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
                {formatLabel(animal.label)}
              </Text>
              {sciName && (
                <Text style={{ color: C.grey, fontSize: 14, fontStyle: 'italic', marginTop: 4, textAlign: 'center' }}>
                  {sciName}
                </Text>
              )}
            </View>

            {/* Fun fact */}
            {loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <ActivityIndicator color={C.yellow} />
              </View>
            ) : funFact ? (
              <View style={{
                backgroundColor: C.background,
                borderRadius: 14, padding: 16,
                borderLeftWidth: 3, borderLeftColor: C.yellow,
                marginBottom: 28,
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
              <View style={{ marginBottom: 28 }} />
            )}

            {/* Action buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={handleShare}
                style={{
                  backgroundColor: C.card,
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: C.cardBorder,
                }}
              >
                <Ionicons name="share-outline" size={20} color={C.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDismiss}
                style={{
                  flex: 1,
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
