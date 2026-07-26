import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { submitEssay, pollCura } from '../../lib/api';
import { saveEssay } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { getProfile, upsertProfile } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const COMPETENCY_LABELS: Record<string, string> = {
  C1: 'Domínio da norma culta',
  C2: 'Compreensão da proposta e aplicação de conceitos',
  C3: 'Seleção e organização de argumentos',
  C4: 'Conhecimento dos mecanismos linguísticos de argumentação',
  C5: 'Proposta de intervenção detalhada',
};

interface CorrectionResult {
  score?: number;
  nota?: number;
  competencies?: any[];
  competencias?: any[];
  strengths?: string[];
  pontosFortes?: string[];
  weaknesses?: string[];
  pontosFracos?: string[];
  generalFeedback?: string;
  feedbackGeral?: string;
}

export default function RedacaoScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const isDark = colorScheme === 'dark';

  const [title, setTitle] = useState('');
  const [essayText, setEssayText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CorrectionResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const charCount = essayText.length;
  const isValid = title.trim().length > 0 && charCount >= 80;

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  async function loadHistory() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { fetchEssays } = await import('../../lib/supabase');
      const essays = await fetchEssays(session.user.id);
      setHistory(essays || []);
    } catch {}
  }

  async function handleSubmit() {
    if (!isValid) {
      Alert.alert('Atenção', 'Preencha o título e escreva pelo menos 80 caracteres.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await submitEssay(essayText, title);

      if (response.cura) {
        const polled = await pollCura(response.cura);
        processResult(polled);
      } else {
        processResult(response);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao corrigir redação.');
    } finally {
      setLoading(false);
    }
  }

  async function processResult(data: any) {
    const correction: CorrectionResult = {
      score: data.score || data.nota || 0,
      competencies: data.competencies || data.competencias || [],
      strengths: data.strengths || data.pontosFortes || [],
      weaknesses: data.weaknesses || data.pontosFracos || [],
      generalFeedback: data.generalFeedback || data.feedbackGeral || data.feedback || '',
    };
    setResult(correction);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const essayId = `essay_${Date.now()}`;
      await saveEssay({
        id: essayId,
        user_id: session.user.id,
        title,
        text: essayText,
        score: correction.score,
        generalFeedback: correction.generalFeedback,
        competencies: correction.competencies,
        strengths: correction.strengths,
        weaknesses: correction.weaknesses,
        date: new Date().toISOString(),
      });

      const profile = await getProfile(session.user.id);
      if (profile) {
        await upsertProfile({
          id: session.user.id,
          totalXp: (profile.totalXp || 0) + 50,
        });
      }

      loadHistory();
    } catch {}
  }

  function renderScoreCard() {
    const score = result?.score || 0;
    const competencies = result?.competencies || [];

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient
          colors={[colors.scoreHeaderFrom, colors.scoreHeaderVia, colors.scoreHeaderTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.scoreGradient}
        >
          <Text style={styles.scoreNumberLarge}>{score}</Text>
          <Text style={styles.scoreMaxLabel}>/1000</Text>
        </LinearGradient>

        {competencies.length > 0 && (
          <View style={styles.competenciesGrid}>
            {competencies.map((comp: any, i: number) => {
              const label = comp.name || comp.nome || COMPETENCY_LABELS[`C${i + 1}`] || `Competência ${i + 1}`;
              const compScore = comp.score || comp.nota || comp.value || 0;
              const maxScore = comp.max || 200;
              const pct = Math.min(compScore / maxScore, 1);
              const barColor = pct >= 0.8 ? colors.success : pct >= 0.5 ? colors.warning : colors.danger;

              return (
                <View key={i} style={styles.competencyItem}>
                  <Text style={[styles.competencyName, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.competencyScore, { color: barColor }]}>{compScore}/{maxScore}</Text>
                  <View style={[styles.progressBar, { backgroundColor: colors.surfaceLow }]}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  function renderBulletList(title: string, items: string[], color: string) {
    if (!items || items.length === 0) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.listTitle, { color: colors.text }]}>{title}</Text>
        {items.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <View style={[styles.bullet, { backgroundColor: color }]} />
            <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  function renderFeedback() {
    const feedback = result?.generalFeedback || '';
    if (!feedback) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.listTitle, { color: colors.text }]}>Feedback Geral</Text>
        <Text style={[styles.feedbackText, { color: colors.text }]}>{feedback}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Ionicons name="pencil" size={24} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Redação</Text>
          <TouchableOpacity
            style={[styles.historyToggle, { backgroundColor: showHistory ? colors.primaryLight : colors.input }]}
            onPress={() => setShowHistory(!showHistory)}
          >
            <Ionicons
              name={showHistory ? 'create-outline' : 'time-outline'}
              size={20}
              color={showHistory ? colors.primary : colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {showHistory ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico</Text>
              {history.length === 0 ? (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', paddingVertical: 40 }]}>
                  <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma redação corrigida ainda.</Text>
                </View>
              ) : (
                history.map((essay) => {
                  const essayScore = essay.score || 0;
                  const isHigh = essayScore >= 600;
                  return (
                    <TouchableOpacity
                      key={essay.id}
                      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => {
                        setTitle(essay.title || '');
                        setEssayText(essay.text || '');
                        setResult({
                          score: essay.score,
                          competencies: essay.competencies || [],
                          strengths: essay.strengths || [],
                          weaknesses: essay.weaknesses || [],
                          generalFeedback: essay.general_feedback || '',
                        });
                        setShowHistory(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.historyItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>{essay.title}</Text>
                          <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                            {new Date(essay.date || essay.created_at).toLocaleDateString('pt-BR')}
                          </Text>
                        </View>
                        <View style={[styles.historyScoreBadge, { backgroundColor: isHigh ? colors.successLight : colors.dangerLight }]}>
                          <Text style={[styles.historyScoreText, { color: isHigh ? colors.success : colors.danger }]}>
                            {essayScore}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Título da Redação</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="Ex: Desafios para a educação no Brasil"
                  placeholderTextColor={colors.textTertiary}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={200}
                />

                <Text style={[styles.inputLabel, { color: colors.text, marginTop: 20 }]}>Texto da Redação</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="Escreva sua redação aqui (mínimo 80 caracteres)..."
                  placeholderTextColor={colors.textTertiary}
                  value={essayText}
                  onChangeText={setEssayText}
                  multiline
                  textAlignVertical="top"
                  numberOfLines={10}
                  maxLength={10000}
                />

                <View style={styles.charCounter}>
                  <Text
                    style={[
                      styles.charText,
                      { color: charCount < 80 ? colors.danger : colors.success },
                    ]}
                  >
                    {charCount}/80 mínimo
                  </Text>
                  <Text style={[styles.charText, { color: colors.textSecondary }]}>
                    {charCount}/10000
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { backgroundColor: isValid ? colors.primary : colors.surfaceDim },
                    loading && { opacity: 0.7 },
                  ]}
                  onPress={handleSubmit}
                  disabled={loading || !isValid}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color={isValid ? '#fff' : colors.textSecondary} />
                      <Text style={[styles.submitText, { color: isValid ? '#fff' : colors.textSecondary }]}>
                        Corrigir Redação
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {result && (
                <>
                  {renderScoreCard()}
                  {renderBulletList('Pontos Fortes', result.strengths || [], colors.success)}
                  {renderBulletList('Pontos a Melhorar', result.weaknesses || [], colors.warning)}
                  {renderFeedback()}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', flex: 1 },
  historyToggle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSize.md,
  },
  textArea: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: FontSize.md,
    minHeight: 200,
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  charText: { fontSize: FontSize.xs },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  submitText: { fontSize: FontSize.md, fontWeight: '600' },
  scoreGradient: {
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreNumberLarge: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 62,
  },
  scoreMaxLabel: {
    fontSize: FontSize.lg,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  competenciesGrid: {
    gap: 16,
  },
  competencyItem: {
    gap: 6,
  },
  competencyName: {
    fontSize: 12,
    fontWeight: '700',
  },
  competencyScore: {
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-end',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  listText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
  feedbackText: { fontSize: FontSize.sm, lineHeight: 22 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyTitle: { fontSize: 14, fontWeight: '700' },
  historyDate: { fontSize: 10, marginTop: 2 },
  historyScoreBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
    minWidth: 56,
    alignItems: 'center',
  },
  historyScoreText: { fontSize: FontSize.sm, fontWeight: '700' },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', marginTop: 12 },
});
