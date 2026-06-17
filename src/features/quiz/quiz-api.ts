import { env } from '../../config/env';

export interface QuizQuestion {
  id: number;
  pergunta: string;
  opcoes: string[];
}

export interface QuizResult {
  name: string;
  score: number;
  total: number;
  duration_ms: number;
  position: number;
  created_at?: string | null;
}

export interface RankingEntry {
  name: string;
  score: number;
  total: number;
  duration_ms: number;
  created_at: string | null;
  position: number;
}

const base = env.apiBaseUrl;

export async function fetchQuestions(): Promise<{ questions: QuizQuestion[]; total: number }> {
  const r = await fetch(`${base}/quiz/questions`);
  if (!r.ok) throw new Error('Falha ao carregar as perguntas');
  return r.json();
}

export async function submitQuiz(payload: {
  name: string;
  responses: { id: number; answer: number }[];
  duration_ms: number;
}): Promise<QuizResult> {
  const r = await fetch(`${base}/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || 'Não foi possível enviar suas respostas.');
  }
  return r.json();
}

export async function fetchRanking(
  limit = 50,
): Promise<{ ranking: RankingEntry[]; participants: number }> {
  const r = await fetch(`${base}/quiz/ranking?limit=${limit}`);
  if (!r.ok) throw new Error('Falha ao carregar o ranking');
  return r.json();
}

/** "1m 23s" a partir de ms — usado no ranking e no resultado. */
export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return m > 0 ? `${m}m ${rest.toString().padStart(2, '0')}s` : `${rest}s`;
}
