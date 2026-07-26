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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';

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

  const [userName, setUserName] = useState('');
  const [editName, setEditName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmEmail, setResetConfirmEmail] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadEmail = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', session.user.id)
            .maybeSingle();
          if (profile?.name) {
            setUserName(profile.name);
            setEditName(profile.name);
          } else {
            const fallback = session.user.email?.split('@')[0] || '';
            setUserName(fallback);
            setEditName(fallback);
          }
        }
      };
      loadEmail();
    }, [])
  );

  const handleSaveName = async () => {
    if (!editName.trim()) {
      Alert.alert('Erro', 'Por favor, informe seu nome.');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, name: editName.trim() }, { onConflict: 'id' });
      if (error) {
        Alert.alert('Erro', 'Não foi possível salvar.');
      } else {
        setUserName(editName.trim());
        setIsEditingName(false);
        Alert.alert('Sucesso', 'Nome atualizado!');
      }
    } catch {
      Alert.alert('Erro', 'Falha ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetProgress = async () => {
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
        setShowResetModal(false);
        setResetConfirmEmail('');
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

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
        <View style={styles.pageHeader}>
          <View style={[styles.headerIconBg, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.pageTitle, { color: colors.text }]}>Configuracoes</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              Gerencie suas preferencias e conta.
            </Text>
          </View>
        </View>

        <View style={cardStyle}>
          <View style={styles.cardSectionHeader}>
            <Ionicons name="person-outline" size={16} color={colors.primary} />
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Perfil</Text>
          </View>
          <View style={[styles.profileTop, { borderBottomColor: colors.border }]}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.profileAvatarText}>{initials || '?'}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {userName || 'Carregando...'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          {isEditingName ? (
            <View style={styles.editSection}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nome Completo</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.inputBorder }]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Seu nome"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.editBtnCancel, { borderColor: colors.border }]}
                  onPress={() => { setEditName(userName); setIsEditingName(false); }}
                >
                  <Text style={[styles.editBtnCancelText, { color: colors.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editBtnSave, { opacity: loading ? 0.5 : 1 }]}
                  onPress={handleSaveName}
                  disabled={loading}
                >
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  <Text style={styles.editBtnSaveText}>
                    {loading ? 'Salvando...' : 'Salvar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editToggleBtn}
              onPress={() => setIsEditingName(true)}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.primary} />
              <Text style={[styles.editToggleText, { color: colors.primary }]}>Editar Nome</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={cardStyle}>
          <View style={styles.cardSectionHeader}>
            <Ionicons name={darkMode ? 'moon' : 'sunny-outline'} size={16} color="#F59E0B" />
            <Text style={[styles.cardSectionTitle, { color: colors.text }]}>Aparencia</Text>
          </View>
          <View style={styles.appearanceRow}>
            <View style={styles.appearanceInfo}>
              <Text style={[styles.appearanceLabel, { color: colors.text }]}>Modo Escuro</Text>
              <Text style={[styles.appearanceDesc, { color: colors.textSecondary }]}>
                Inverta a iluminacao da interface.
              </Text>
            </View>
            <View style={styles.toggleRow}>
              <Ionicons
                name={darkMode ? 'sunny-outline' : 'moon-outline'}
                size={16}
                color={darkMode ? '#F59E0B' : colors.primary}
              />
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={darkMode ? colors.primary : colors.textSecondary}
              />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.25)' : '#FECACA' }]}>
          <View style={styles.cardSectionHeader}>
            <Ionicons name="shield-half-outline" size={16} color="#EF4444" />
            <Text style={[styles.cardSectionTitle, { color: '#EF4444' }]}>Zona de Perigo</Text>
          </View>
          <Text style={[styles.dangerDesc, { color: colors.textSecondary }]}>
            As seguintes acoes sao destrutivas e irreversiveis.
          </Text>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.dangerBtnOutline, { borderColor: colors.border }]}
            onPress={() => { setShowResetModal(true); setResetConfirmEmail(''); }}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={16} color="#EF4444" />
            <Text style={styles.dangerBtnOutlineText}>Redefinir Dados</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.dangerBtnOutline, { borderColor: colors.border }]}
            onPress={handleSignOut}
            disabled={loading}
          >
            <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.dangerBtnOutlineText, { color: colors.textSecondary }]}>Sair da Conta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerBtn, styles.dangerBtnFilled]}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.dangerBtnFilledText}>Excluir Conta</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.textTertiary }]}>ApexEnem v1.0.0</Text>
      </ScrollView>

      <Modal visible={showResetModal} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setShowResetModal(false)}
            />
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalIconRow}>
                <View style={[styles.modalIconBg, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="warning" size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Redefinir Conta</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Todos os seus dados serao apagados
                  </Text>
                </View>
              </View>

              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                Esta acao ira apagar todas as suas redacoes, historico de simulados e progresso.
              </Text>

              <View style={styles.modalField}>
                <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                  Seu e-mail cadastrado
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.inputBorder }]}
                  placeholder={userEmail}
                  placeholderTextColor={colors.textTertiary}
                  value={resetConfirmEmail}
                  onChangeText={setResetConfirmEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.input }]}
                  onPress={() => setShowResetModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#F59E0B', opacity: loading ? 0.5 : 1 }]}
                  onPress={async () => {
                    if (!resetConfirmEmail.trim()) {
                      Alert.alert('Erro', 'Digite seu e-mail.');
                      return;
                    }
                    if (resetConfirmEmail.trim().toLowerCase() !== userEmail.toLowerCase()) {
                      Alert.alert('Erro', 'E-mail incorreto.');
                      return;
                    }
                    handleResetProgress();
                  }}
                  disabled={loading}
                >
                  <Text style={styles.modalBtnTextWhite}>
                    {loading ? 'Verificando...' : 'Reiniciar Conta'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={deleteStep > 0} transparent animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setDeleteStep(0)}
            />
            <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalIconRow}>
                <View style={[styles.modalIconBg, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="trash" size={20} color="#EF4444" />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Excluir Conta</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Passo {deleteStep} de 3
                  </Text>
                </View>
              </View>

              <View style={styles.progressRow}>
                {[1, 2, 3].map((step) => (
                  <View
                    key={step}
                    style={[
                      styles.progressSegment,
                      {
                        backgroundColor: deleteStep >= step ? '#EF4444' : (colorScheme === 'dark' ? '#334155' : '#E2E8F0'),
                      },
                    ]}
                  />
                ))}
              </View>

              {deleteStep === 1 && (
                <View style={styles.modalField}>
                  <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                    Confirme seu e-mail para iniciar o processo de exclusao.
                  </Text>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                    Seu e-mail cadastrado
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.inputBorder }]}
                    placeholder={userEmail}
                    placeholderTextColor={colors.textTertiary}
                    value={deleteEmail}
                    onChangeText={setDeleteEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {deleteStep === 2 && (
                <View style={styles.modalField}>
                  <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                    Confirme seu e-mail mais uma vez.
                  </Text>
                  <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                    Seu e-mail cadastrado
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.inputBorder }]}
                    placeholder={userEmail}
                    placeholderTextColor={colors.textTertiary}
                    value={deleteEmailConfirm}
                    onChangeText={setDeleteEmailConfirm}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {deleteStep === 3 && (
                <View style={styles.modalField}>
                  <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                    Ultima chance. Digite EXCLUIR para confirmar a exclusao permanente.
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: '#EF4444' }]}
                    placeholder="EXCLUIR"
                    placeholderTextColor={colors.textTertiary}
                    value={deleteConfirmText}
                    onChangeText={setDeleteConfirmText}
                    autoCapitalize="characters"
                  />
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.input }]}
                  onPress={() => setDeleteStep(0)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: '#EF4444', opacity: loading ? 0.5 : 1 }]}
                  onPress={() => {
                    if (deleteStep === 1) handleDeleteStep1();
                    else if (deleteStep === 2) handleDeleteStep2();
                    else handleDeleteStep3();
                  }}
                  disabled={loading}
                >
                  <Text style={styles.modalBtnTextWhite}>
                    {loading ? 'Verificando...' : deleteStep === 3 ? 'Excluir Permanentemente' : 'Proximo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  headerIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: '800' },
  pageSubtitle: { fontSize: FontSize.sm, marginTop: 2 },
  card: { borderRadius: BorderRadius.card, borderWidth: 1, padding: 24, marginBottom: Spacing.lg },
  cardSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md, paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  cardSectionTitle: { fontSize: FontSize.md, fontWeight: '800' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.md, marginBottom: Spacing.md, borderBottomWidth: 1 },
  profileAvatar: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: '700' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: FontSize.md, fontWeight: '700' },
  profileEmail: { fontSize: FontSize.xs, marginTop: 2 },
  editSection: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  textInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.sm },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  editBtnCancel: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  editBtnCancelText: { fontSize: FontSize.sm, fontWeight: '600' },
  editBtnSave: { backgroundColor: '#2563EB', borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editBtnSaveText: { color: '#FFFFFF', fontSize: FontSize.sm, fontWeight: '700' },
  editToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm },
  editToggleText: { fontSize: FontSize.sm, fontWeight: '600' },
  appearanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appearanceInfo: { flex: 1, gap: 2 },
  appearanceLabel: { fontSize: FontSize.md, fontWeight: '700' },
  appearanceDesc: { fontSize: FontSize.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dangerDesc: { fontSize: FontSize.xs, marginBottom: Spacing.md, lineHeight: 18 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.md, gap: Spacing.sm, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  dangerBtnOutline: { borderWidth: 1 },
  dangerBtnOutlineText: { fontSize: FontSize.sm, fontWeight: '700', color: '#EF4444' },
  dangerBtnFilled: { backgroundColor: '#EF4444' },
  dangerBtnFilledText: { fontSize: FontSize.sm, fontWeight: '700', color: '#FFFFFF' },
  version: { textAlign: 'center', fontSize: FontSize.sm, marginTop: Spacing.xxl },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalKeyboard: { width: '100%', alignItems: 'center' },
  modalBackdrop: { ...StyleSheet.absoluteFill },
  modalContent: { width: '100%', borderRadius: BorderRadius.xl, padding: 24, borderWidth: 1, gap: Spacing.md },
  modalIconRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  modalTitle: { fontSize: FontSize.md, fontWeight: '700' },
  modalSubtitle: { fontSize: FontSize.xs, marginTop: 1 },
  modalDesc: { fontSize: FontSize.sm, lineHeight: 20 },
  modalField: { gap: Spacing.xs },
  modalFieldLabel: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase' as const },
  modalInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.sm },
  progressRow: { flexDirection: 'row', gap: Spacing.sm },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  modalBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  modalBtnText: { fontSize: FontSize.sm, fontWeight: '600' },
  modalBtnTextWhite: { fontSize: FontSize.sm, fontWeight: '700', color: '#FFFFFF' },
});
