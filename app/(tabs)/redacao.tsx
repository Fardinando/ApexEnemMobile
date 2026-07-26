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
import { Ionicons } from '@expo/vector-icons';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
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

  function renderScoreCircle() {
    const score = result?.score || 0;
    const getColor = () => {
      if (score >= 800) return colors.success;
      if (score >= 600) return colors.primary;
      if (score >= 400) return colors.warning;
      return colors.danger;
    };

    return (
      <View style={[styles.scoreContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.scoreCircle, { borderColor: getColor(), borderWidth: 4 }]}>
          <Text style={[styles.scoreNumber, { color: getColor() }]}>{score}</Text>
          <Text style={[styles.scoreMax, { color: colors.textSecondary }]}>/1000</Text>
        </View>
        <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Nota Geral</Text>
      </View>
    );
  }

  function renderCompetencies() {
    const competencies = result?.competencies || [];
    if (competencies.length === 0) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="bar-chart" size={20} color={colors.primary} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Competências</Text>
        </View>
        {competencies.map((comp: any, i: number) => {
          const label = comp.name || comp.nome || COMPETENCY_LABELS[`C${i + 1}`] || `Competência ${i + 1}`;
          const score = comp.score || comp.nota || comp.value || 0;
          const maxScore = comp.max || 200;
          const pct = Math.min(score / maxScore, 1);
          const barColor = pct >= 0.8 ? colors.success : pct >= 0.5 ? colors.warning : colors.danger;

          return (
            <View key={i} style={styles.competencyItem}>
              <View style={styles.competencyHeader}>
                <Text style={[styles.competencyName, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.competencyScore, { color: barColor }]}>{score}/{maxScore}</Text>
              </View>
              <View style={[styles.progressBar, { backgroundColor: colors.surfaceAlt }]}>
                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
              </View>
              {comp.feedback && (
                <Text style={[styles.competencyFeedback, { color: colors.textSecondary }]}>{comp.feedback}</Text>
              )}
            </View>
          );
        })}
      </View>
    );
  }

  function renderList(title: string, items: string[], icon: string, iconColor: string) {
    if (!items || items.length === 0) return null;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name={icon as any} size={20} color={iconColor} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {items.map((item, i) => (
          <View key={i} style={styles.listItem}>
            <View style={[styles.bullet, { backgroundColor: iconColor }]} />
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
        <View style={styles.cardHeader}>
          <Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>Feedback Geral</Text>
        </View>
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
          <Ionicons name="document-text" size={28} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Redação</Text>
          <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
            <Ionicons
              name={showHistory ? 'create' : 'time'}
              size={24}
              color={colors.primary}
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
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma redação corrigida ainda.</Text>
                </View>
              ) : (
                history.map((essay) => (
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
                  >
                    <View style={styles.historyItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyTitle, { color: colors.text }]}>{essay.title}</Text>
                        <Text style={[styles.historyDate, { color: colors.textSecondary }]}>
                          {new Date(essay.date || essay.created_at).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                      <View style={[styles.historyScore, { backgroundColor: essay.score >= 600 ? colors.successLight : colors.dangerLight }]}>
                        <Text style={[styles.historyScoreText, { color: essay.score >= 600 ? colors.success : colors.danger }]}>
                          {essay.score}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Nova Correção</Text>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="create" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Título da Redação</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="Ex: Desafios para a educação no Brasil"
                  placeholderTextColor={colors.textSecondary}
                  value={title}
                  onChangeText={setTitle}
                  maxLength={200}
                />
              </View>

              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <Ionicons name="document" size={20} color={colors.primary} />
                  <Text style={[styles.cardTitle, { color: colors.text }]}>Texto da Redação</Text>
                </View>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  placeholder="Escreva sua redação aqui (mínimo 80 caracteres)..."
                  placeholderTextColor={colors.textSecondary}
                  value={essayText}
                  onChangeText={setEssayText}
                  multiline
                  textAlignVertical="top"
                  numberOfLines={10}
                  maxLength={30000}
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
              </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  { backgroundColor: isValid ? colors.primary : colors.surfaceAlt },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleSubmit}
                disabled={loading || !isValid}
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

              {result && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Resultado</Text>
                  {renderScoreCircle()}
                  {renderCompetencies()}
                  {renderList('Pontos Fortes', result.strengths || [], 'thumbs-up', colors.success)}
                  {renderList('Pontos a Melhorar', result.weaknesses || [], 'alert-circle', colors.warning)}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600' },
  input: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
  },
  textArea: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    minHeight: 200,
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  charText: { fontSize: FontSize.xs },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  submitText: { fontSize: FontSize.md, fontWeight: '600' },
  scoreContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  scoreNumber: { fontSize: FontSize.xxxl, fontWeight: '800' },
  scoreMax: { fontSize: FontSize.sm },
  scoreLabel: { fontSize: FontSize.sm, fontWeight: '500' },
  competencyItem: { marginBottom: Spacing.md },
  competencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  competencyName: { fontSize: FontSize.sm, fontWeight: '600', flex: 1 },
  competencyScore: { fontSize: FontSize.sm, fontWeight: '700' },
  competencyFeedback: { fontSize: FontSize.xs, marginTop: Spacing.xs, lineHeight: 18 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  listText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20 },
  feedbackText: { fontSize: FontSize.sm, lineHeight: 22 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  historyTitle: { fontSize: FontSize.md, fontWeight: '600' },
  historyDate: { fontSize: FontSize.xs, marginTop: 2 },
  historyScore: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minWidth: 50,
    alignItems: 'center',
  },
  historyScoreText: { fontSize: FontSize.sm, fontWeight: '700' },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', paddingVertical: Spacing.xl },
});
