import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
  Animated,
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
  { key: 'geral', label: 'Geral', icon: 'layers' as const },
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

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

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

  const dotAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    if (loading) {
      const loops = dotAnims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(i * 150),
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        )
      );
      loops.forEach((l) => l.start());
      return () => loops.forEach((l) => l.stop());
    }
  }, [loading]);

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

  const getOptionState = (optLetter: string, qIndex: number) => {
    const answered = answers[qIndex] !== undefined;
    if (!answered) return 'default';
    const isCorrect = optLetter === questions[qIndex].correctAnswer;
    const isUserChoice = answers[qIndex] === optLetter;
    if (isCorrect) return 'correct';
    if (isUserChoice && !isCorrect) return 'wrong';
    return 'dimmed';
  };

  const renderOptionBadge = (letter: string, state: string) => {
    if (state === 'correct') {
      return (
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#04a753', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={14} color="#fff" />
        </View>
      );
    }
    if (state === 'wrong') {
      return (
        <View style={{ width: 24, height: 24, borderRadius: 8, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={14} color="#fff" />
        </View>
      );
    }
    return null;
  };

  const getOptionBg = (state: string, isSelected: boolean) => {
    if (state === 'correct') return '#f0fdf4';
    if (state === 'wrong') return '#fef2f2';
    if (isSelected && state === 'default') return '#eff6ff';
    return colors.input;
  };

  const getOptionBorder = (state: string, isSelected: boolean) => {
    if (state === 'correct') return '#04a753';
    if (state === 'wrong') return '#ef4444';
    if (isSelected && state === 'default') return '#2563EB';
    return colors.border;
  };

  const getLetterBadgeBg = (state: string, isSelected: boolean) => {
    if (state === 'correct') return '#04a753';
    if (state === 'wrong') return '#ef4444';
    if (isSelected && state === 'default') return '#2563EB';
    return 'transparent';
  };

  const getLetterBadgeText = (state: string, isSelected: boolean) => {
    if (state === 'correct' || state === 'wrong' || (isSelected && state === 'default')) return '#fff';
    return colors.textSecondary;
  };

  const getLetterBadgeBorder = (state: string, isSelected: boolean) => {
    if (state === 'correct') return '#04a753';
    if (state === 'wrong') return '#ef4444';
    if (isSelected && state === 'default') return '#2563EB';
    return colors.border;
  };

  if (showResults) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bgMain }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text }}>
            Questões
          </Text>
          <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, marginTop: 4 }}>
            Pratique com questões geradas por IA
          </Text>
          <View style={{ height: 1, backgroundColor: colors.border, marginTop: 20 }} />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 28 }}>
          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: BorderRadius.xxl,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 24,
              marginBottom: 20,
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: correctCount === questions.length ? '#dcfce7' : '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Ionicons
                  name={correctCount === questions.length ? 'trophy' : 'checkmark-circle'}
                  size={36}
                  color={correctCount === questions.length ? '#04a753' : '#2563EB'}
                />
              </View>
              <Text style={{ fontSize: FontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: 4 }}>
                Resultado
              </Text>
              <Text style={{ fontSize: FontSize.md, color: colors.textSecondary }}>
                Você acertou {correctCount} de {questions.length}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
                <Ionicons name="star" size={16} color="#2563EB" />
                <Text style={{ fontSize: FontSize.lg, fontWeight: 'bold', color: '#2563EB' }}>
                  +{xpEarned} XP
                </Text>
                {savingXp && <ActivityIndicator size="small" color="#2563EB" />}
              </View>
            </View>

            {questions.map((q, i) => {
              const userAnswer = answers[i];
              const isCorrect = userAnswer === q.correctAnswer;

              return (
                <View
                  key={i}
                  style={{
                    backgroundColor: isCorrect ? '#f0fdf4' : '#fef2f2',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: isCorrect ? '#04a753' : '#ef4444',
                    padding: 14,
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {isCorrect ? (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#04a753', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    ) : (
                      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="close" size={12} color="#fff" />
                      </View>
                    )}
                    <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary }}>
                      Questão {i + 1}
                    </Text>
                  </View>
                  <Text style={{ fontSize: FontSize.md, color: colors.text, lineHeight: 22, marginBottom: 8 }}>
                    {q.statement}
                  </Text>
                  <View style={{ gap: 6 }}>
                    {q.options.map((opt) => {
                      const isUserChoice = userAnswer === opt.letter;
                      const isCorrectOpt = opt.letter === q.correctAnswer;
                      let bg = colors.input;
                      let border = colors.border;
                      let letterBg = 'transparent';
                      let letterColor = colors.textSecondary;
                      let letterBorder = colors.border;

                      if (isCorrectOpt) {
                        bg = '#f0fdf4';
                        border = '#04a753';
                        letterBg = '#04a753';
                        letterColor = '#fff';
                        letterBorder = '#04a753';
                      } else if (isUserChoice && !isCorrect) {
                        bg = '#fef2f2';
                        border = '#ef4444';
                        letterBg = '#ef4444';
                        letterColor = '#fff';
                        letterBorder = '#ef4444';
                      }

                      return (
                        <View
                          key={opt.letter}
                          style={{
                            backgroundColor: bg,
                            borderWidth: 1,
                            borderColor: border,
                            borderRadius: 12,
                            padding: 14,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                            opacity: !isCorrectOpt && !isUserChoice ? 0.5 : 1,
                          }}
                        >
                          <View
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 8,
                              backgroundColor: letterBg,
                              borderWidth: 1,
                              borderColor: letterBorder,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isCorrectOpt ? (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            ) : isUserChoice ? (
                              <Ionicons name="close" size={14} color="#fff" />
                            ) : (
                              <Text style={{ fontSize: 10, fontFamily: 'Courier', fontWeight: '600', color: letterColor }}>
                                {opt.letter}
                              </Text>
                            )}
                          </View>
                          <Text style={{ fontSize: FontSize.md, color: isCorrectOpt ? '#04a753' : isUserChoice ? '#ef4444' : colors.text, flex: 1 }}>
                            {opt.letter}) {opt.text}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  <View
                    style={{
                      backgroundColor: '#fafafa',
                      borderRadius: 12,
                      padding: 14,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: '#7c3aed', marginBottom: 4 }}>
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
                backgroundColor: '#2563EB',
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: 'center',
                marginTop: 8,
              }}
              onPress={handleReset}
            >
              <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: '700' }}>
                Nova Prática
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgMain }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text }}>
          Questões
        </Text>
        <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, marginTop: 4 }}>
          Pratique com questões geradas por IA
        </Text>
        <View style={{ height: 1, backgroundColor: colors.border, marginTop: 20 }} />
      </View>

      {questions.length === 0 && !loading && (
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
            Área
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 24 }}
          >
            {SUBJECTS.map((s) => {
              const active = selectedSubject === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => setSelectedSubject(s.key)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: active ? '#2563EB' : '#fff',
                    borderWidth: 1,
                    borderColor: active ? '#2563EB' : '#E2E8F0',
                    borderRadius: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={s.icon}
                    size={14}
                    color={active ? '#fff' : colors.textSecondary}
                  />
                  <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: active ? '#fff' : colors.text }}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: 12 }}>
            Quantidade
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
            {QUESTION_COUNTS.map((count) => {
              const active = questionCount === count;
              return (
                <TouchableOpacity
                  key={count}
                  onPress={() => setQuestionCount(count)}
                  activeOpacity={0.7}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderRadius: 12,
                    borderWidth: 1,
                    backgroundColor: active ? '#2563EB' : '#fff',
                    borderColor: active ? '#2563EB' : '#E2E8F0',
                  }}
                >
                  <Text style={{ fontSize: FontSize.lg, fontWeight: 'bold', color: active ? '#fff' : colors.text }}>
                    {count}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: '#2563EB',
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              opacity: loading || !selectedSubject ? 0.6 : 1,
            }}
            onPress={handleGenerate}
            disabled={loading || !selectedSubject}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: '700' }}>
              Gerar Questões
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={{ paddingHorizontal: 24, paddingTop: 48, alignItems: 'center' }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#dbeafe',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Ionicons name="sparkles" size={36} color="#2563EB" />
          </View>
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
            {dotAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#2563EB',
                  transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: FontSize.lg, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
            Gerando questões...
          </Text>
          <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center' }}>
            A IA está preparando suas questões personalizadas
          </Text>
          <View style={{ width: 120, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', marginTop: 20, overflow: 'hidden' }}>
            <View
              style={{
                height: '100%',
                width: '60%',
                backgroundColor: '#2563EB',
                borderRadius: 2,
              }}
            />
          </View>
        </View>
      )}

      {questions.length > 0 && currentQuestion && !loading && (
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary }}>
              Questão {currentIndex + 1} de {questions.length}
            </Text>
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: '#2563EB' }}>
              {Object.keys(answers).length} respondida{Object.keys(answers).length !== 1 ? 's' : ''}
            </Text>
          </View>

          <View
            style={{
              height: 4,
              backgroundColor: '#E2E8F0',
              borderRadius: 2,
              marginBottom: 20,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
                backgroundColor: '#2563EB',
                borderRadius: 2,
              }}
            />
          </View>

          <View
            style={{
              backgroundColor: '#fff',
              borderRadius: BorderRadius.xxl,
              borderWidth: 1,
              borderColor: '#E2E8F0',
              padding: 24,
              marginBottom: 20,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  backgroundColor: '#dbeafe',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: FontSize.xs, fontWeight: '700', color: '#2563EB', fontFamily: 'Courier' }}>
                  {currentIndex + 1}
                </Text>
              </View>
              <Text style={{ fontSize: FontSize.md, color: colors.text, lineHeight: 24, flex: 1 }}>
                {currentQuestion.statement}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {currentQuestion.options.map((opt) => {
                const answered = answers[currentIndex] !== undefined;
                const selected = answers[currentIndex] === opt.letter;
                const state = getOptionState(opt.letter, currentIndex);
                const isAnswered = answered;

                const bg = getOptionBg(state, selected);
                const border = getOptionBorder(state, selected);
                const letterBg = getLetterBadgeBg(state, selected);
                const letterColor = getLetterBadgeText(state, selected);
                const letterBorder = getLetterBadgeBorder(state, selected);

                return (
                  <TouchableOpacity
                    key={opt.letter}
                    style={{
                      backgroundColor: bg,
                      borderWidth: 1,
                      borderColor: border,
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      opacity: state === 'dimmed' ? 0.6 : 1,
                    }}
                    onPress={() => handleAnswer(currentIndex, opt.letter)}
                    disabled={isAnswered}
                    activeOpacity={0.7}
                  >
                    {renderOptionBadge(opt.letter, state) || (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          backgroundColor: letterBg,
                          borderWidth: 1,
                          borderColor: letterBorder,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10,
                            fontFamily: 'Courier',
                            fontWeight: '600',
                            color: letterColor,
                          }}
                        >
                          {opt.letter}
                        </Text>
                      </View>
                    )}
                    <Text
                      style={{
                        fontSize: FontSize.md,
                        color: state === 'correct' ? '#04a753' : state === 'wrong' ? '#ef4444' : colors.text,
                        flex: 1,
                      }}
                    >
                      {opt.letter}) {opt.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {answers[currentIndex] !== undefined && (
              <View style={{ marginTop: 16 }}>
                <View
                  style={{
                    backgroundColor: '#fafafa',
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 16,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: '#7c3aed', marginBottom: 4 }}>
                    Explicação
                  </Text>
                  <Text style={{ fontSize: FontSize.sm, color: colors.text, lineHeight: 20 }}>
                    {currentQuestion.explanation}
                  </Text>
                </View>

                {currentIndex < questions.length - 1 && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#2563EB',
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={() => setCurrentIndex(currentIndex + 1)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: FontSize.base, fontWeight: '700' }}>
                      Próxima
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}
