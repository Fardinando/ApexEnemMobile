import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../../lib/supabase';
import { Colors, getColors } from '../../lib/theme';

const WEB_URL = 'https://apexenem.vercel.app';
const REDIRECT_URL = Linking.createURL('auth-callback');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      if (url.includes('auth-callback')) {
        const params = new URL(url.replace('apexenem://', 'https://placeholder.com/'));
        const access_token = params.searchParams.get('access_token');
        const refresh_token = params.searchParams.get('refresh_token');

        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
          router.replace('/(tabs)');
        }
      }
    });
    return () => sub.remove();
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('captcha') || error.message.includes('hcaptcha')) {
        handleBrowserLogin();
        return;
      }
      Alert.alert('Erro ao entrar', error.message);
      return;
    }

    router.replace('/(tabs)');
  };

  const handleBrowserLogin = async () => {
    setBrowserLoading(true);
    try {
      const redirect = encodeURIComponent(REDIRECT_URL);
      await WebBrowser.openBrowserAsync(`${WEB_URL}/login?redirect_to=${redirect}`);
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir o navegador.');
    } finally {
      setBrowserLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 48 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 20,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="school" size={40} color="#fff" />
          </View>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>
            ApexEnem
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
            Entre na sua conta para continuar
          </Text>
        </View>

        <View style={{ gap: 16 }}>
          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
              Email
            </Text>
            <TextInput
              style={{
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: colors.text,
              }}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
              Senha
            </Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={{
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  padding: 14,
                  paddingRight: 48,
                  fontSize: 16,
                  color: colors.text,
                }}
                placeholder="Sua senha"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="password"
              />
              <TouchableOpacity
                style={{ position: 'absolute', right: 12, top: 14 }}
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 8,
              opacity: loading ? 0.7 : 1,
            }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                Entrar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
            }}
            onPress={handleBrowserLogin}
            disabled={browserLoading}
          >
            {browserLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="globe-outline" size={20} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                  Entrar pelo navegador
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
            Não tem uma conta?{' '}
          </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '700' }}>
                Criar conta
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
