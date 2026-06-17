import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '../../routes/paths';
import {
  fetchQuestions,
  submitQuiz,
  formatDuration,
  type QuizQuestion,
  type QuizResult,
} from './quiz-api';
import { Confetti } from './Confetti';
import './quiz.css';

type Status = 'intro' | 'loading' | 'playing' | 'submitting' | 'done' | 'error';

export function QuizPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('intro');
  const [name, setName] = useState('');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(0);
  const advancingRef = useRef(false);

  useEffect(() => {
    if (status !== 'playing') return;
    const id = window.setInterval(() => setElapsed(Date.now() - startRef.current), 200);
    return () => window.clearInterval(id);
  }, [status]);

  const start = async () => {
    const n = name.trim();
    if (!n) {
      setError('Digite seu nome para começar.');
      return;
    }
    setError('');
    setStatus('loading');
    try {
      const data = await fetchQuestions();
      setQuestions(data.questions);
      setAnswers(new Array(data.questions.length).fill(-1));
      setCurrent(0);
      setSelected(null);
      startRef.current = Date.now();
      setStatus('playing');
    } catch {
      setError('Não foi possível carregar o quiz. Tente de novo.');
      setStatus('intro');
    }
  };

  const choose = (optIdx: number) => {
    if (advancingRef.current || selected !== null) return;
    advancingRef.current = true;
    setSelected(optIdx);
    const next = [...answers];
    next[current] = optIdx;
    setAnswers(next);
    window.setTimeout(() => {
      advancingRef.current = false;
      setSelected(null);
      if (current + 1 < questions.length) {
        setCurrent((c) => c + 1);
      } else {
        void finish(next);
      }
    }, 300);
  };

  const finish = async (finalAnswers: number[]) => {
    setStatus('submitting');
    const duration = Date.now() - startRef.current;
    // monta as respostas por id (cada device recebeu um sorteio diferente)
    const responses = questions.map((q, i) => ({ id: q.id, answer: finalAnswers[i] ?? -1 }));
    try {
      const res = await submitQuiz({
        name: name.trim(),
        responses,
        duration_ms: duration,
      });
      setResult(res);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao enviar suas respostas.');
      setStatus('error');
    }
  };

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (status === 'intro' || status === 'loading') {
    return (
      <div className="quiz">
        <div className="quiz__card quiz__card--intro">
          <div className="quiz__brand">🌿 Leaf Quiz</div>
          <p className="quiz__tagline">Você domina as tecnologias que conectam o mundo?</p>

          <div className="quiz__info">
            <p>Responda o mais <b>rápido</b> e <b>correto</b> possível.</p>
            <p className="quiz__prize">🏆 Os melhores colocados ganham um <b>chaveiro 3D exclusivo do Leaf!</b></p>
            <p className="quiz__hype">Será que você consegue entrar no Top 3?</p>
          </div>

          <input
            className="quiz__input"
            placeholder="Digite seu nome"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && start()}
            disabled={status === 'loading'}
            autoFocus
          />
          {error ? <p className="quiz__error">{error}</p> : null}
          <button className="quiz__btn" onClick={start} disabled={status === 'loading'}>
            {status === 'loading' ? 'Carregando…' : '🚀 Iniciar desafio'}
          </button>
          <button
            className="quiz__link"
            type="button"
            onClick={() => navigate(routePaths.quizRanking)}
          >
            Ver ranking ao vivo
          </button>
        </div>
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (status === 'playing' || status === 'submitting') {
    const q = questions[current];
    const progress = ((current + (status === 'submitting' ? 1 : 0)) / questions.length) * 100;
    return (
      <div className="quiz">
        <div className="quiz__card">
          <div className="quiz__topbar">
            <span className="quiz__counter">
              Pergunta {Math.min(current + 1, questions.length)} de {questions.length}
            </span>
            <span className="quiz__timer">⏱ {formatDuration(elapsed)}</span>
          </div>
          <div className="quiz__progress">
            <div className="quiz__progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {status === 'submitting' ? (
            <p className="quiz__loading">Calculando seu resultado…</p>
          ) : (
            <div key={q.id} className="quiz__question-block">
              <h2 className="quiz__question">{q.pergunta}</h2>
              <div className="quiz__options">
                {q.opcoes.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`quiz__option${selected === i ? ' quiz__option--selected' : ''}`}
                    onClick={() => choose(i)}
                    disabled={selected !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ERROR (falha no envio) ──────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="quiz">
        <div className="quiz__card quiz__card--intro">
          <div className="quiz__brand">🌿 Leaf Quiz</div>
          <p className="quiz__error">{error}</p>
          <button className="quiz__btn" onClick={() => finish(answers)}>
            Tentar enviar de novo
          </button>
        </div>
      </div>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  const top3 = result ? result.position <= 3 : false;
  return (
    <div className="quiz">
      <Confetti fire={top3} />
      <div className="quiz__card quiz__card--result">
        <div className="quiz__brand">🌿 Leaf Quiz</div>
        {result ? (
          <>
            <p className="quiz__result-name">Mandou bem, {result.name}!</p>
            <div className="quiz__score">
              {result.score}<span>/{result.total}</span>
            </div>
            <div className="quiz__result-meta">
              <span>⏱ {formatDuration(result.duration_ms)}</span>
              <span className={`quiz__pos${top3 ? ' quiz__pos--top' : ''}`}>
                {top3 ? '🏆 ' : ''}#{result.position} no ranking
              </span>
            </div>
            {top3 ? (
              <p className="quiz__prize">🥳 Você está no Top 3 — chaveiro 3D garantido (por enquanto)!</p>
            ) : (
              <p className="quiz__hype">Dá pra subir! Veja o ranking e desafie a galera.</p>
            )}
            <button className="quiz__btn" onClick={() => navigate(routePaths.quizRanking)}>
              Ver ranking ao vivo →
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
