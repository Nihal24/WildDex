import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  FlatList,
  Image,
  Animated,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

const COUNTRY_CODES = [
  { label: '🇺🇸 United States', code: '+1' },
  { label: '🇨🇦 Canada', code: '+1' },
  { label: '🇬🇧 United Kingdom', code: '+44' },
  { label: '🇦🇺 Australia', code: '+61' },
  { label: '🇮🇳 India', code: '+91' },
  { label: '🇩🇪 Germany', code: '+49' },
  { label: '🇫🇷 France', code: '+33' },
  { label: '🇧🇷 Brazil', code: '+55' },
  { label: '🇲🇽 Mexico', code: '+52' },
  { label: '🇯🇵 Japan', code: '+81' },
  { label: '🇰🇷 South Korea', code: '+82' },
  { label: '🇳🇬 Nigeria', code: '+234' },
  { label: '🇿🇦 South Africa', code: '+27' },
];
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';

// 'landing'  → logo, Get Started / Log In / Apple
// 'phone'    → enter phone number
// 'otp'      → enter 6-digit SMS code
// 'username' → pick @username (new users only)
type Screen = 'landing' | 'phone' | 'otp' | 'username';

interface AuthScreenProps {
  startAtUsername?: boolean;
  onUsernameSet?: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ startAtUsername, onUsernameSet }) => {
  const [screen, setScreen] = useState<Screen>(startAtUsername ? 'username' : 'landing');
  const [isNewUser, setIsNewUser] = useState(true);
  const [countryCode, setCountryCode] = useState('+1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pulse animation for landing logo glow
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const clearErrors = () => setError(null);
  const goTo = (s: Screen) => { clearErrors(); setScreen(s); };

  const fullPhone = `${countryCode}${phone.trim().replace(/\D/g, '')}`;

  const handleSendOtp = async () => {
    clearErrors();
    const digits = phone.trim().replace(/\D/g, '');
    if (!digits) { setError('Enter your phone number.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      goTo('otp');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    clearErrors();
    const code = otp.trim();
    if (code.length !== 6) { setError('Enter the 6-digit code.'); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: fullPhone,
        token: code,
        type: 'sms',
      });
      if (error) throw error;

      // Check if this user already has a username
      const userId = data.user?.id;
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', userId)
          .maybeSingle();
        if (!profile?.username) {
          if (!isNewUser) {
            setError("No account found for this number. Try 'Get Started' to create one.");
            return;
          }
          goTo('username');
          return;
        }
      }
      // Existing user with username — auth state listener in RootNavigator handles navigation
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetUsername = async () => {
    clearErrors();
    const clean = username.trim().replace(/^@/, '').toLowerCase();
    if (!clean) { setError('Choose a username to continue.'); return; }
    if (!/^[a-z0-9_]{2,20}$/.test(clean)) {
      setError('2–20 characters: letters, numbers, underscores only.');
      return;
    }
    setLoading(true);
    try {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', clean).maybeSingle();
      if (existing) { setError('That username is taken — try another.'); return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles').upsert({ id: user.id, username: clean });
      if (onUsernameSet) onUsernameSet();
      // Otherwise auth state change triggers navigation
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>

        {/* Back button */}
        {screen !== 'landing' && (
          <TouchableOpacity style={styles.backBtn} onPress={() => goTo(screen === 'otp' ? 'phone' : screen === 'username' ? 'otp' : 'landing')}>
            <Ionicons name="arrow-back" size={22} color={COLORS.grey} />
          </TouchableOpacity>
        )}

        {/* ── LANDING ── */}
        {screen === 'landing' ? (
          <View style={styles.landingContainer}>
            {/* Hero section */}
            <View style={styles.heroSection}>
              {/* Glow rings behind icon */}
              <Animated.View style={[styles.glowRingOuter, { opacity: glowAnim }]} />
              <Animated.View style={[styles.glowRingInner, { opacity: glowAnim }]} />
              <Image source={require('../assets/icon.png')} style={styles.heroIcon} />
            </View>

            {/* Title */}
            <Text style={styles.logo}>WILD<Text style={styles.logoAccent}>DEX</Text></Text>
            <Text style={styles.tagline}>Pokédex for the real world</Text>

            {/* Animal row */}
            <Text style={styles.animalRow}>🦁  🐘  🦅  🐍  🦈</Text>

            {/* CTA buttons */}
            <View style={styles.ctaSection}>
              <TouchableOpacity style={styles.button} onPress={() => { setIsNewUser(true); goTo('phone'); }}>
                <Text style={styles.buttonText}>Get Started →</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsNewUser(false); goTo('phone'); }}>
                <Text style={styles.loginLink}>Already have an account? <Text style={styles.loginLinkAccent}>Log In</Text></Text>
              </TouchableOpacity>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        ) : (
          <>
            {/* Non-landing screens keep compact logo */}
            <Text style={styles.logoSmall}>WILD<Text style={styles.logoAccent}>DEX</Text></Text>
            <Text style={styles.subtitle}>Pokédex for the real world</Text>
          </>
        )}

        {/* ── PHONE ── */}
        {screen === 'phone' && (
          <View style={styles.form}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>{isNewUser ? "Let's get you set up!" : 'Welcome back!'}</Text>
              <Text style={styles.stepSub}>We'll send you a code to sign in.</Text>
            </View>

            <View style={styles.phoneRow}>
              <TouchableOpacity style={styles.countryBtn} onPress={() => setShowCountryPicker(true)}>
                <Text style={styles.countryCode}>{countryCode}</Text>
                <Ionicons name="chevron-down" size={14} color={COLORS.grey} />
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder="(202) 555-1234"
                placeholderTextColor={COLORS.darkGrey}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                autoFocus
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── COUNTRY PICKER MODAL ── */}
        <Modal visible={showCountryPicker} transparent animationType="slide">
          <TouchableWithoutFeedback onPress={() => setShowCountryPicker(false)}>
            <View style={styles.modalOverlay} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => { setCountryCode(item.code); setShowCountryPicker(false); }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  <Text style={styles.modalItemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>

        {/* ── OTP ── */}
        {screen === 'otp' && (
          <View style={styles.form}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Check your texts!</Text>
              <Text style={styles.stepSub}>Enter the 6-digit code we sent to{'\n'}
                <Text style={{ color: COLORS.white, fontWeight: '700' }}>{fullPhone}</Text>
              </Text>
            </View>

            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="123456"
              placeholderTextColor={COLORS.darkGrey}
              value={otp}
              onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.buttonText}>Verify →</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendOtp} disabled={loading}>
              <Text style={styles.toggle}>Didn't get it? <Text style={styles.toggleAccent}>Resend code</Text></Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── USERNAME ── */}
        {screen === 'username' && (
          <View style={styles.form}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepTitle}>Pick your username!</Text>
              <Text style={styles.stepSub}>This is how the WildDex community will know you.</Text>
            </View>

            <View style={styles.usernameRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="yourname"
                placeholderTextColor={COLORS.darkGrey}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/^@/, '').toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSetUsername} disabled={loading}>
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.buttonText}>Let's Go!</Text>}
            </TouchableOpacity>

            {startAtUsername && (
              <TouchableOpacity onPress={async () => {
                await supabase.auth.signOut();
                await AsyncStorage.clear();
              }}>
                <Text style={[styles.toggle, { marginTop: 8 }]}>
                  Wrong account? <Text style={styles.toggleAccent}>Sign out</Text>
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
    </TouchableWithoutFeedback>
  );
};

export default AuthScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  backBtn: { position: 'absolute', top: 8, left: 0, padding: 8 },

  // Landing hero layout
  landingContainer: { alignItems: 'center', gap: 0 },
  heroSection: { alignItems: 'center', justifyContent: 'center', marginBottom: 24, width: 160, height: 160 },
  glowRingOuter: {
    position: 'absolute',
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: COLORS.amber,
    opacity: 0.15,
  },
  glowRingInner: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.amber,
    opacity: 0.2,
  },
  heroIcon: { width: 96, height: 96, borderRadius: 22 },
  logo: { fontSize: 56, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: 6 },
  logoSmall: { fontSize: 42, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: 4 },
  logoAccent: { color: COLORS.yellow },
  tagline: { color: COLORS.grey, textAlign: 'center', marginTop: 8, fontSize: 15, letterSpacing: 1 },
  animalRow: { fontSize: 26, textAlign: 'center', marginTop: 20, marginBottom: 8, letterSpacing: 4 },
  ctaSection: { width: '100%', gap: 16, marginTop: 32 },
  loginLink: { color: COLORS.grey, textAlign: 'center', fontSize: 14 },
  loginLinkAccent: { color: COLORS.yellow, fontWeight: '700' },

  subtitle: { color: COLORS.grey, textAlign: 'center', marginTop: 8, marginBottom: 48, fontSize: 14 },
  form: { gap: 12 },
  stepHeader: { gap: 4, marginBottom: 4 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  stepSub: { fontSize: 13, color: COLORS.grey, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.white,
    fontSize: 15,
  },
  otpInput: { textAlign: 'center', fontSize: 24, fontWeight: '700', letterSpacing: 8 },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  secondaryButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  error: { color: COLORS.primary, fontSize: 13, textAlign: 'center' },
  toggle: { color: COLORS.grey, textAlign: 'center', marginTop: 4, fontSize: 13 },
  toggleAccent: { color: COLORS.yellow, fontWeight: '700' },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 12,
    overflow: 'hidden',
  },
  countryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: COLORS.cardBorder,
  },
  countryCode: { color: COLORS.white, fontSize: 15, fontWeight: '600' },
  phoneInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, color: COLORS.white, fontSize: 15, letterSpacing: 0 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingBottom: 32,
  },
  modalTitle: { color: COLORS.white, fontWeight: '800', fontSize: 16, textAlign: 'center', paddingVertical: 16 },
  modalItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  modalItemText: { color: COLORS.white, fontSize: 15 },
  modalItemCode: { color: COLORS.grey, fontSize: 14 },
  usernameRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 12,
  },
  atSign: { paddingLeft: 16, fontSize: 16, color: COLORS.grey, fontWeight: '700' },
  usernameInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 14, color: COLORS.white, fontSize: 15, letterSpacing: 0 },
});
