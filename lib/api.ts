const API_BASE = 'https://apexenem.vercel.app';

async function getToken(): Promise<string | null> {
  try {
    const { supabase } = await import('./supabase');
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function apiPost(endpoint: string, body: any): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(endpoint: string): Promise<any> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

export async function pollCura(curaId: string, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 2500));
    try {
      const data = await apiGet(`/api/ai-task/${curaId}`);
      if (data.status === 'completed') return data.result;
      if (data.status === 'failed') throw new Error(data.error || 'Task failed');
    } catch (e: any) {
      if (i === maxAttempts - 1) throw e;
    }
  }
  throw new Error('Timeout');
}

export async function submitEssay(text: string, title: string): Promise<any> {
  const data = await apiPost('/api/correct', { text, title });
  if (data.cura) return { cura: data.cura };
  if (data.result) return data.result;
  if (data.error) throw new Error(data.error);
  return data;
}

export async function generateLesson(subject: string, topic?: string): Promise<any> {
  const data = await apiPost('/api/lesson', {
    subject,
    topic,
    cycleCount: 3,
    blocksPerCycle: 6,
  });
  if (data.cura) return { cura: data.cura };
  if (data.result) return data.result;
  if (data.error) throw new Error(data.error);
  return data;
}

export async function generateQuestions(subject: string, count = 5): Promise<any> {
  const data = await apiPost('/api/questoes-ai', {
    subject,
    count,
    cycleCount: 3,
    blocksPerCycle: 6,
  });
  if (data.cura) return { cura: data.cura };
  if (data.result) return data.result;
  if (data.error) throw new Error(data.error);
  return data;
}

export async function fetchEnemQuestions(year: number, limit = 50, offset = 0): Promise<any> {
  return apiGet(`/api/enem-questions?year=${year}&limit=${limit}&offset=${offset}`);
}

export async function getSimuladoExplanation(questions: any[]): Promise<any> {
  const data = await apiPost('/api/simulado-explanation', { questions });
  if (data.cura) return { cura: data.cura };
  if (data.result) return data.result;
  if (data.error) throw new Error(data.error);
  return data;
}

export async function openRouterChat(messages: any[], model?: string): Promise<any> {
  const data = await apiPost('/api/openrouter-chat', { messages, model });
  if (data.cura) return { cura: data.cura };
  if (data.result) return data.result;
  if (data.error) throw new Error(data.error);
  return data;
}
