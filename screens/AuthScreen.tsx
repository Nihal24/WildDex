import React, { useState } from 'react';
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
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../utils/supabase';
import { COLORS } from '../constants/theme';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (mode === 'signup') {
      if (!cleanUsername) { setError('Please choose a username.'); return; }
      if (!/^[a-z0-9_]{2,20}$/.test(cleanUsername)) {
        setError('Username must be 2–20 characters: letters, numbers, underscores only.');
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Check uniqueness first
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', cleanUsername).maybeSingle();
        if (existing) { setError('That username is already taken.'); setLoading(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, username: cleanUsername });
        }
        setMessage('Check your email to confirm your account.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
      // Apple doesn't give username — profile will be incomplete until they set one
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(e.message);
      }
    } finally {
      setAppleLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.logo}>WILD<Text style={styles.logoAccent}>DEX</Text></Text>
        <Text style={styles.subtitle}>Pokédex for the real world</Text>

        <View style={styles.form}>
          {mode === 'signup' && (
            <View style={styles.usernameRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.usernameInput}
                placeholder="username"
                placeholderTextColor={COLORS.darkGrey}
                value={username}
                onChangeText={(t) => setUsername(t.replace(/^@/, '').toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={COLORS.darkGrey}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={COLORS.darkGrey}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}
          {message && <Text style={styles.messageText}>{message}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'login' ? 'Log In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); setUsername(''); }}>
            <Text style={styles.toggle}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleAccent}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
          {appleLoading && <ActivityIndicator color={COLORS.white} style={{ marginTop: 8 }} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AuthScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  logo: { fontSize: 48, fontWeight: '900', color: COLORS.white, textAlign: 'center', letterSpacing: 4 },
  logoAccent: { color: COLORS.yellow },
  subtitle: { color: COLORS.grey, textAlign: 'center', marginTop: 8, marginBottom: 48, fontSize: 14 },
  form: { gap: 12 },
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
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },
  error: { color: COLORS.primary, fontSize: 13, textAlign: 'center' },
  messageText: { color: COLORS.yellow, fontSize: 13, textAlign: 'center' },
  toggle: { color: COLORS.grey, textAlign: 'center', marginTop: 4, fontSize: 13 },
  toggleAccent: { color: COLORS.yellow, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.cardBorder },
  dividerText: { color: COLORS.grey, fontSize: 13 },
  appleButton: { width: '100%', height: 50 },
  usernameRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.cardBorder, borderRadius: 12,
  },
  atSign: { paddingLeft: 16, fontSize: 16, color: COLORS.grey, fontWeight: '700' },
  usernameInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 14, color: COLORS.white, fontSize: 15 },
});
