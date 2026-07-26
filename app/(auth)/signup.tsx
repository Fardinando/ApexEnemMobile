import { useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { getColors } from '../../lib/theme';

const WEB_URL = 'https://apexenem.vercel.app';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
      },
    });

    setLoading(false);

    if (error) {
      if (error.message.includes('captcha') || error.message.includes('hcaptcha')) {
        handleBrowserSignup();
        return;
      }
      Alert.alert('Erro ao criar conta', error.message);
      return;
    }

    if (data.session) {
      router.replace('/(tabs)');
    } else {
      Alert.alert(
        'Conta criada',
        'Verifique seu email para confirmar sua conta.'
      );
      router.replace('/(auth)/login');
    }
  };

  const handleBrowserSignup = async () => {
    setBrowserLoading(true);
    try {
      await WebBrowser.openBrowserAsync(`${WEB_URL}/signup`);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível abrir o navegador.');
    } finally {
      setBrowserLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#F1F5F9' as const,
    borderWidth: 1,
    borderColor: '#E2E8F0' as const,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: colors.surface,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 32,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 25,
            elevation: 5,
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                backgroundColor: colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Ionicons name="school" size={28} color="#fff" />
            </View>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.text }}>
              Criar Conta
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
              Comece sua jornada de estudos
            </Text>
          </View>

          <View style={{ gap: 14 }}>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                Nome completo
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="Seu nome"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoComplete="name"
              />
            </View>

            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                Email
              </Text>
              <TextInput
                style={inputStyle}
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
                  style={{ ...inputStyle, paddingRight: 48 }}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
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

            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 }}>
                Confirmar senha
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="Repita a senha"
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: '#2563EB',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 8,
                opacity: loading ? 0.7 : 1,
              }}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  Criar Conta
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: '#E2E8F0',
                borderRadius: 12,
                paddingVertical: 16,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              }}
              onPress={handleBrowserSignup}
              disabled={browserLoading}
            >
              {browserLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="globe-outline" size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
                    Criar pelo navegador
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              Já tem uma conta?{' '}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={{ color: '#2563EB', fontSize: 14, fontWeight: '700' }}>
                  Entrar
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
