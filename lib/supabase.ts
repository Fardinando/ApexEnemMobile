import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = 'https://gdgpklevmomeozojaige.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkZ3BrbGV2bW9tZW96b2phaWdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2NTU1NDcsImV4cCI6MjA5ODIzMTU0N30.t2zZgly59s-bS8Ms3M-3ovCHjiqF_MH1JW7UI7L73-E';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function getProfile(userId: string) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

export async function upsertProfile(profile: any) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert(profile, { onConflict: 'id' })
      .select()
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchEssays(userId: string) {
  try {
    const { data } = await supabase
      .from('essay_corrections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}

export async function saveEssay(essay: any) {
  try {
    const mapped = {
      id: essay.id,
      user_id: essay.user_id,
      title: essay.title,
      text: essay.text,
      score: essay.score,
      general_feedback: essay.generalFeedback || essay.general_feedback || '',
      competencies: essay.competencies || [],
      strengths: essay.strengths || [],
      weaknesses: essay.weaknesses || [],
      date: essay.date,
    };
    const { error } = await supabase
      .from('essay_corrections')
      .upsert(mapped, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteEssaysByUser(userId: string) {
  try {
    const { error } = await supabase.from('essay_corrections').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchSimulados(userId: string) {
  try {
    const { data } = await supabase
      .from('simulado_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}

export async function saveSimulado(sim: any) {
  try {
    const { error } = await supabase
      .from('simulado_history')
      .insert(sim);
    return !error;
  } catch {
    return false;
  }
}

export async function deleteSimuladosByUser(userId: string) {
  try {
    const { error } = await supabase.from('simulado_history').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function fetchLogs(userId: string) {
  try {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return data || [];
  } catch {
    return [];
  }
}

export async function saveLog(log: any) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .upsert(log, { onConflict: 'id' });
    return !error;
  } catch {
    return false;
  }
}

export async function deleteLogsByUser(userId: string) {
  try {
    const { error } = await supabase.from('activity_logs').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}
