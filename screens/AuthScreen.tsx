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
import { supabase } from '../utils/supabase';
import { COLORS } from '../constants/theme';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        <Text style={styles.logo}>WILD<Text style={styles.logoAccent}>DEX</Text></Text>
        <Text style={styles.subtitle}>Pokédex for the real world</Text>

        <View style={styles.form}>
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

          <TouchableOpacity onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); setMessage(null); }}>
            <Text style={styles.toggle}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleAccent}>{mode === 'login' ? 'Sign Up' : 'Log In'}</Text>
            </Text>
          </TouchableOpacity>
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
  toggle: { color: COLORS.grey, textAlign: 'center', marginTop: 8, fontSize: 13 },
  toggleAccent: { color: COLORS.yellow, fontWeight: '700' },
});
