import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateQuestions, pollCura } from '../../lib/api';
import { supabase, upsertProfile, getProfile } from '../../lib/supabase';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { XP_REWARDS } from '../../lib/gamification';

const SUBJECTS = [
  { key: 'matematica', label: 'Matemática', icon: 'calculator' as const },
  { key: 'humanas', label: 'Humanas', icon: 'earth' as const },
  { key: 'natureza', label: 'Natureza', icon: 'leaf' as const },
  { key: 'linguagens', label: 'Linguagens', icon: 'book' as const },
];

const QUESTION_COUNTS = [3, 5, 10];

interface QuestionOption {
  letter: string;
  text: string;
}

interface Question {
  statement: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation: string;
}

export default function PerguntasScreen() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [savingXp, setSavingXp] = useState(false);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const handleGenerate = async () => {
    if (!selectedSubject) {
      Alert.alert('Selecione uma matéria', 'Escolha uma matéria antes de gerar as questões.');
      return;
    }

    setLoading(true);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);

    try {
      const data = await generateQuestions(selectedSubject, questionCount);
      if (data.cura) {
        const result = await pollCura(data.cura);
        setQuestions(Array.isArray(result) ? result : result.questions || []);
      } else {
        setQuestions(Array.isArray(data) ? data : data.questions || []);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível gerar as questões.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (questionIndex: number, letter: string) => {
    if (answers[questionIndex] !== undefined) return;
    const newAnswers = { ...answers, [questionIndex]: letter };
    setAnswers(newAnswers);

    if (questionIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex(questionIndex + 1), 400);
    } else {
      const correct = questions.filter((q, i) => newAnswers[i] === q.correctAnswer).length;
      const xp = correct * XP_REWARDS.QUESTION_CORRECT;
      setXpEarned(xp);
      setShowResults(true);

      (async () => {
        setSavingXp(true);
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const profile = await getProfile(session.user.id);
            if (profile) {
              await upsertProfile({
                id: session.user.id,
                total_xp: (profile.total_xp || 0) + xp,
              });
            }
          }
        } catch {}
        setSavingXp(false);
      })();
    }
  };

  const correctCount = questions.filter((q, i) => answers[i] === q.correctAnswer).length;

  const handleReset = () => {
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);
  };

  if (showResults) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 40 }}
      >
        <View style={{ alignItems: 'center', marginTop: 48, marginBottom: Spacing.xxl }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: correctCount === questions.length ? colors.successLight : colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.lg,
            }}
          >
            <Ionicons
              name={correctCount === questions.length ? 'trophy' : 'checkmark-circle'}
              size={40}
              color={correctCount === questions.length ? colors.success : colors.primary}
            />
          </View>
          <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text, marginBottom: Spacing.xs }}>
            Resultado
          </Text>
          <Text style={{ fontSize: FontSize.lg, color: colors.textSecondary, marginBottom: Spacing.md }}>
            Você acertou {correctCount} de {questions.length}
          </Text>
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.lg,
              padding: Spacing.lg,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary }}>XP Ganho</Text>
            <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.accent }}>
              +{xpEarned} XP
            </Text>
            {savingXp && <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: Spacing.xs }} />}
          </View>
        </View>

        {questions.map((q, i) => {
          const userAnswer = answers[i];
          const isCorrect = userAnswer === q.correctAnswer;

          return (
            <View
              key={i}
              style={{
                backgroundColor: colors.surface,
                borderRadius: BorderRadius.lg,
                padding: Spacing.lg,
                marginBottom: Spacing.md,
                borderWidth: 1,
                borderColor: isCorrect ? colors.success : colors.danger,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isCorrect ? colors.successLight : colors.dangerLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={isCorrect ? 'checkmark' : 'close'}
                    size={16}
                    color={isCorrect ? colors.success : colors.danger}
                  />
                </View>
                <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary }}>
                  Questão {i + 1}
                </Text>
              </View>

              <Text style={{ fontSize: FontSize.md, color: colors.text, marginBottom: Spacing.md, lineHeight: 22 }}>
                {q.statement}
              </Text>

              {q.options.map((opt) => {
                const isUserChoice = userAnswer === opt.letter;
                const isCorrectOpt = opt.letter === q.correctAnswer;
                let bgColor = colors.surfaceAlt;
                let borderColor = colors.border;
                let textColor = colors.text;

                if (isCorrectOpt) {
                  bgColor = colors.successLight;
                  borderColor = colors.success;
                  textColor = colors.success;
                } else if (isUserChoice && !isCorrect) {
                  bgColor = colors.dangerLight;
                  borderColor = colors.danger;
                  textColor = colors.danger;
                }

                return (
                  <View
                    key={opt.letter}
                    style={{
                      backgroundColor: bgColor,
                      borderWidth: 1,
                      borderColor,
                      borderRadius: BorderRadius.md,
                      padding: Spacing.md,
                      marginBottom: Spacing.xs,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: Spacing.sm,
                      opacity: !isCorrectOpt && !isUserChoice ? 0.5 : 1,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        borderWidth: 1.5,
                        borderColor: isCorrectOpt ? colors.success : isUserChoice ? colors.danger : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isCorrectOpt ? (
                        <Ionicons name="checkmark" size={14} color={colors.success} />
                      ) : isUserChoice ? (
                        <Ionicons name="close" size={14} color={colors.danger} />
                      ) : (
                        <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>
                          {opt.letter}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: FontSize.sm, color: textColor, flex: 1 }}>
                      {opt.letter}) {opt.text}
                    </Text>
                  </View>
                );
              })}

              <View
                style={{
                  backgroundColor: colors.accentLight,
                  borderRadius: BorderRadius.md,
                  padding: Spacing.md,
                  marginTop: Spacing.sm,
                }}
              >
                <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: colors.accent, marginBottom: Spacing.xs }}>
                  Explicação
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: colors.text, lineHeight: 20 }}>
                  {q.explanation}
                </Text>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={{
            backgroundColor: colors.primary,
            borderRadius: BorderRadius.md,
            padding: Spacing.lg,
            alignItems: 'center',
            marginTop: Spacing.md,
          }}
          onPress={handleReset}
        >
          <Text style={{ color: '#fff', fontSize: FontSize.lg, fontWeight: '700' }}>
            Gerar Novas Questões
          </Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text, marginTop: 48, marginBottom: Spacing.xs }}>
        Questões IA
      </Text>
      <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, marginBottom: Spacing.xl }}>
        Pratique com questões geradas por inteligência artificial
      </Text>

      {questions.length === 0 && (
        <>
          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
            Matéria
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl }}>
            {SUBJECTS.map((s) => {
              const active = selectedSubject === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSelectedSubject(s.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: BorderRadius.full,
                    paddingVertical: Spacing.sm,
                    paddingHorizontal: Spacing.lg,
                    gap: Spacing.xs,
                  }}
                >
                  <Ionicons
                    name={s.icon}
                    size={16}
                    color={active ? '#fff' : colors.textSecondary}
                  />
                  <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: active ? '#fff' : colors.text }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
            Quantidade
          </Text>
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl }}>
            {QUESTION_COUNTS.map((count) => {
              const active = questionCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  onPress={() => setQuestionCount(count)}
                  style={{
                    flex: 1,
                    paddingVertical: Spacing.md,
                    alignItems: 'center',
                    borderRadius: BorderRadius.md,
                    borderWidth: 1.5,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xl, fontWeight: 'bold', color: active ? '#fff' : colors.text }}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: selectedSubject ? colors.primary : colors.surfaceAlt,
              borderRadius: BorderRadius.md,
              padding: Spacing.lg,
              alignItems: 'center',
              opacity: loading ? 0.7 : 1,
              borderWidth: 1,
              borderColor: selectedSubject ? colors.primary : colors.border,
            }}
            onPress={handleGenerate}
            disabled={loading || !selectedSubject}
          >
            {loading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <ActivityIndicator color="#fff" />
                <Text style={{ color: '#fff', fontSize: FontSize.lg, fontWeight: '700' }}>
                  Gerando questões...
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                <Ionicons name="sparkles" size={20} color={selectedSubject ? '#fff' : colors.textSecondary} />
                <Text style={{ color: selectedSubject ? '#fff' : colors.textSecondary, fontSize: FontSize.lg, fontWeight: '700' }}>
                  Gerar Questões
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </>
      )}

      {questions.length > 0 && currentQuestion && (
        <View style={{ marginTop: Spacing.md }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: Spacing.lg,
            }}
          >
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary }}>
              Questão {currentIndex + 1} de {questions.length}
            </Text>
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.accent }}>
              {Object.keys(answers).length} respondida{Object.keys(answers).length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View
            style={{
              height: 4,
              backgroundColor: colors.surfaceAlt,
              borderRadius: 2,
              marginBottom: Spacing.xl,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
                backgroundColor: colors.primary,
                borderRadius: 2,
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.lg,
              padding: Spacing.xl,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: Spacing.xl,
            }}
          >
            <Text style={{ fontSize: FontSize.lg, color: colors.text, lineHeight: 26 }}>
              {currentQuestion.statement}
            </Text>
          </View>

          <View style={{ gap: Spacing.sm }}>
            {currentQuestion.options.map((opt) => {
              const answered = answers[currentIndex] !== undefined;
              const selected = answers[currentIndex] === opt.letter;

              return (
                <TouchableOpacity
                  key={opt.letter}
                  style={{
                    backgroundColor: selected ? colors.primaryLight : colors.surface,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.primary : colors.border,
                    borderRadius: BorderRadius.md,
                    padding: Spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: Spacing.md,
                  }}
                  onPress={() => handleAnswer(currentIndex, opt.letter)}
                  disabled={answered}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: selected ? colors.primary : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: FontSize.md,
                        fontWeight: 'bold',
                        color: selected ? '#fff' : colors.textSecondary,
                      }}
                    >
                      {opt.letter}
                    </Text>
                  </View>
                  <Text style={{ fontSize: FontSize.md, color: colors.text, flex: 1 }}>
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
