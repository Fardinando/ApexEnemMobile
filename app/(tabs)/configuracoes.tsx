import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Switch,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const API_BASE = 'https://apexenem.vercel.app';

async function getToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

export default function ConfiguracoesScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const colors = getColors(colorScheme);
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');
  const [loading, setLoading] = useState(false);

  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadEmail = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
      };
      loadEmail();
    }, [])
  );

  const handleResetProgress = () => {
    Alert.alert(
      'Reiniciar Conta',
      'Isso irá apagar todo o seu progresso (redações, simulados, conquistas). Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const token = await getToken();
              const res = await fetch(`${API_BASE}/api/auth/reset-progress`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              });
              if (res.ok) {
                Alert.alert('Sucesso', 'Seu progresso foi reiniciado.');
              } else {
                const data = await res.json();
                Alert.alert('Erro', data.error || 'Não foi possível reiniciar.');
              }
            } catch {
              Alert.alert('Erro', 'Falha ao conectar com o servidor.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setDeleteStep(1);
    setDeleteEmail('');
    setDeleteEmailConfirm('');
    setDeleteConfirmText('');
  };

  const handleDeleteStep1 = () => {
    if (deleteEmail !== userEmail) {
      Alert.alert('Erro', 'O e-mail não corresponde ao sua conta.');
      return;
    }
    setDeleteStep(2);
  };

  const handleDeleteStep2 = () => {
    if (deleteEmailConfirm !== userEmail) {
      Alert.alert('Erro', 'O e-mail não corresponde.');
      return;
    }
    setDeleteStep(3);
  };

  const handleDeleteStep3 = async () => {
    if (deleteConfirmText !== 'EXCLUIR') {
      Alert.alert('Erro', 'Digite EXCLUIR para confirmar.');
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (res.ok) {
        await supabase.auth.signOut();
        setDeleteStep(0);
        Alert.alert('Conta excluída', 'Sua conta foi excluída permanentemente.');
        router.replace('/(auth)/login');
      } else {
        const data = await res.json();
        Alert.alert('Erro', data.error || 'Não foi possível excluir.');
      }
    } catch {
      Alert.alert('Erro', 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
      setDeleteStep(0);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Configurações</Text>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Ionicons name={darkMode ? 'moon' : 'sunny-outline'} size={20} color={colors.primary} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Modo Escuro</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={darkMode ? colors.primary : colors.textSecondary}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.button, { borderColor: colors.warning }]}
          onPress={handleResetProgress}
          disabled={loading}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.warning} />
          <Text style={[styles.buttonText, { color: colors.warning }]}>Reiniciar Conta</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={[styles.button, { borderColor: colors.danger }]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <Text style={[styles.buttonText, { color: colors.danger }]}>Excluir Conta</Text>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <TouchableOpacity
          style={[styles.button, { borderColor: colors.danger }]}
          onPress={handleSignOut}
          disabled={loading}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={[styles.buttonText, { color: colors.danger }]}>Sair</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.version, { color: colors.textSecondary }]}>ApexEnem v1.0.0</Text>

      <Modal visible={deleteStep > 0} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            {deleteStep === 1 && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Passo 1/3 - Confirme seu e-mail
                </Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                  Digite seu e-mail para confirmar que deseja excluir sua conta.
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textSecondary}
                  value={deleteEmail}
                  onChangeText={setDeleteEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.input }]}
                    onPress={() => setDeleteStep(0)}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                    onPress={handleDeleteStep1}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Próximo</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {deleteStep === 2 && (
              <>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Passo 2/3 - Confirme novamente
                </Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                  Digite seu e-mail mais uma vez.
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="seu@email.com"
                  placeholderTextColor={colors.textSecondary}
                  value={deleteEmailConfirm}
                  onChangeText={setDeleteEmailConfirm}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.input }]}
                    onPress={() => setDeleteStep(1)}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                    onPress={handleDeleteStep2}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>Próximo</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {deleteStep === 3 && (
              <>
                <Text style={[styles.modalTitle, { color: colors.danger }]}>
                  Passo 3/3 - Confirmação Final
                </Text>
                <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                  Digite "EXCLUIR" para confirmar a exclusão permanente da sua conta e todos os dados.
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.danger }]}
                  placeholder="EXCLUIR"
                  placeholderTextColor={colors.textSecondary}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  autoCapitalize="characters"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.input }]}
                    onPress={() => setDeleteStep(2)}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.text }]}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: colors.danger }]}
                    onPress={handleDeleteStep3}
                    disabled={loading}
                  >
                    <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                      {loading ? 'Excluindo...' : 'Excluir Conta'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.xl,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  version: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginTop: Spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  modalDesc: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  modalBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
