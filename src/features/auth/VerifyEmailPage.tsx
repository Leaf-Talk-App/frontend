import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../../components/button/Button';
import { useAuth } from '../../lib/auth/use-auth';
import { useVerifyEmailMutation, useResendCodeMutation } from './auth-hooks';
import { routePaths } from '../../routes/paths';
import './verify-email-page.css';
import { CheckCircle2, Leaf, LockKeyhole, Loader2, Sprout } from 'lucide-react';

const REDIRECT_DELAY_MS = 2200;

export function VerifyEmailPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const verifyMutation = useVerifyEmailMutation();
  const resendMutation = useResendCodeMutation();

  // After a successful verification, hold the success screen, then redirect.
  useEffect(() => {
    if (!verified) return;
    const timer = window.setTimeout(() => {
      navigate(routePaths.login, { replace: true });
    }, REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [verified, navigate]);

  if (isAuthenticated) {
    return <Navigate to={routePaths.chats} replace />;
  }

  const focusInput = (index: number) => {
    const clamped = Math.max(0, Math.min(index, 5));
    inputsRef.current[clamped]?.focus();
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    setError('');
    if (value && index < 5) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  // Paste support: distribute digits across the inputs and auto-submit when full.
  const handlePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '').split('');
    if (digits.length === 0) return;

    const next = [...code];
    for (let i = 0; i < digits.length && index + i < 6; i += 1) {
      next[index + i] = digits[i];
    }
    setCode(next);
    setError('');

    const lastFilled = Math.min(index + digits.length, 6) - 1;
    focusInput(lastFilled + 1);

    if (next.every((digit) => digit !== '')) {
      void submitCode(next.join(''));
    }
  };

  async function submitCode(fullCode: string) {
    const email = localStorage.getItem('pending_email') || undefined;

    if (fullCode.length !== 6) {
      setError('Digite o código completo de 6 dígitos.');
      return;
    }

    try {
      await verifyMutation.mutateAsync({ code: fullCode, email });
      localStorage.removeItem('pending_email');
      setVerified(true); // triggers success screen + delayed redirect
    } catch {
      setError('Código inválido. Tente novamente.');
    }
  }

  function handleSubmit() {
    void submitCode(code.join(''));
  }

  function handleResendCode() {
    const email = localStorage.getItem('pending_email');
    if (!email) {
      setError('E-mail não encontrado. Faça o cadastro novamente.');
      return;
    }
    resendMutation.mutate(email);
  }

  return (
    <main className="verify-email-page" aria-labelledby="verify-title">
      <header className="verify-email-page__topbar" aria-label="Leaf">
        <Link className="verify-email-page__brand" to={routePaths.login}>
          <Sprout size={25} strokeWidth={2.5} aria-hidden="true" />
          <span>Leaf</span>
        </Link>
      </header>

      <div className="verify-email-page__content">
        {verified ? (
          <div className="verify-email-card verify-email-card--success" role="status" aria-live="polite">
            <div className="verify-success__check" aria-hidden="true">
              <CheckCircle2 size={56} strokeWidth={2} />
            </div>
            <div className="verify-email-card__heading">
              <h1 id="verify-title">E-mail verificado com sucesso</h1>
              <p>Redirecionando para o login…</p>
            </div>
            <div className="verify-success__redirect">
              <Loader2 size={16} className="verify-success__spinner" aria-hidden="true" />
              <span>Aguarde um instante</span>
            </div>
            <div className="verify-success__progress" aria-hidden="true">
              <span className="verify-success__progress-fill" />
            </div>
          </div>
        ) : (
          <div className="verify-email-card">
            <div className="verify-email-card__mark" aria-hidden="true">
              <Leaf size={40} strokeWidth={2.3} />
            </div>

            <div className="verify-email-card__heading">
              <h1 id="verify-title">Verifique seu e-mail</h1>
              <p>Enviamos um código de 6 dígitos para o seu e-mail.</p>
            </div>

            <div className="verify-email-card__code-inputs">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputsRef.current[index] = el;
                  }}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  autoFocus={index === 0}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => handlePaste(index, e)}
                  className="verify-email-card__code-input"
                  aria-label={`Dígito ${index + 1}`}
                  disabled={verifyMutation.isPending}
                />
              ))}
            </div>

            {error ? (
              <p className="verify-email-card__error" role="alert">
                {error}
              </p>
            ) : null}

            <Button
              type="button"
              fullWidth
              isLoading={verifyMutation.isPending}
              disabled={verifyMutation.isPending || code.join('').length !== 6}
              onClick={handleSubmit}
            >
              {verifyMutation.isPending ? 'Verificando…' : 'Verificar e-mail'}
            </Button>

            <div className="verify-email-card__actions">
              <p>
                Não recebeu o código?{' '}
                <button
                  type="button"
                  className="verify-email-card__link"
                  onClick={handleResendCode}
                  disabled={resendMutation.isPending}
                >
                  Reenviar
                </button>
              </p>
            </div>

            <p className="verify-email-card__back">
              <Link to={routePaths.login}>Voltar para o login</Link>
            </p>
          </div>
        )}
      </div>

      <footer className="verify-email-page__footer">
        <LockKeyhole size={14} aria-hidden="true" />
        <span>Criptografado para sua privacidade digital.</span>
      </footer>
    </main>
  );
}
