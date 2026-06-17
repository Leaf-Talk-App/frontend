import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { routePaths } from '../../routes/paths';
import { fetchRanking, formatDuration, type RankingEntry } from './quiz-api';
import { Confetti } from './Confetti';
import './quiz.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export function QuizRankingPage() {
  const navigate = useNavigate();
  const [confetti, setConfetti] = useState(false);
  const prevLeaderRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ['quiz', 'ranking'],
    queryFn: () => fetchRanking(50),
    refetchInterval: 3000, // ranking ao vivo, sem recarregar a página
    refetchOnWindowFocus: true,
  });

  const ranking: RankingEntry[] = data?.ranking ?? [];
  const participants = data?.participants ?? 0;
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  // Confete quando o líder muda (novo #1) — efeito "evento ao vivo".
  useEffect(() => {
    const leader = ranking[0]?.name ?? null;
    if (leader && prevLeaderRef.current && leader !== prevLeaderRef.current) {
      setConfetti(true);
      const t = window.setTimeout(() => setConfetti(false), 4300);
      return () => window.clearTimeout(t);
    }
    prevLeaderRef.current = leader;
  }, [ranking]);

  const quizUrl = `${window.location.origin}${routePaths.quiz}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(quizUrl)}`;

  return (
    <div className="quiz quiz--ranking">
      <Confetti fire={confetti} />

      <header className="quiz-rank__head">
        <div>
          <h1 className="quiz-rank__title">🏆 Ranking ao vivo</h1>
          <p className="quiz-rank__sub">
            {participants > 0
              ? `${participants} ${participants === 1 ? 'aluno já participou' : 'alunos já participaram'}. Você consegue assumir a liderança?`
              : 'Seja o primeiro a entrar no ranking!'}
          </p>
        </div>
        <div className="quiz-rank__qr">
          <img src={qrSrc} alt="QR Code do quiz" width={110} height={110} />
          <span>Aponte a câmera e participe</span>
        </div>
      </header>

      {top3.length > 0 ? (
        <div className="quiz-rank__podium">
          {top3.map((e, i) => (
            <div key={`${e.name}-${i}`} className={`quiz-podium quiz-podium--${i + 1}`}>
              <div className="quiz-podium__medal">{MEDALS[i]}</div>
              <div className="quiz-podium__name">{e.name}</div>
              <div className="quiz-podium__score">{e.score}/{e.total}</div>
              <div className="quiz-podium__time">⏱ {formatDuration(e.duration_ms)}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="quiz-rank__empty">Aguardando os primeiros participantes…</p>
      )}

      {rest.length > 0 ? (
        <div className="quiz-rank__table">
          <div className="quiz-rank__row quiz-rank__row--head">
            <span>#</span>
            <span>Nome</span>
            <span>Acertos</span>
            <span>Tempo</span>
            <span className="quiz-rank__when">Horário</span>
          </div>
          {rest.map((e) => (
            <div key={`${e.position}-${e.name}`} className="quiz-rank__row">
              <span className="quiz-rank__pos">{e.position}</span>
              <span className="quiz-rank__name">{e.name}</span>
              <span>{e.score}/{e.total}</span>
              <span>{formatDuration(e.duration_ms)}</span>
              <span className="quiz-rank__when">
                {e.created_at
                  ? new Date(e.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <button className="quiz__link quiz-rank__back" type="button" onClick={() => navigate(routePaths.quiz)}>
        ← Jogar o quiz
      </button>
    </div>
  );
}
