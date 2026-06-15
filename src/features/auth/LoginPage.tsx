import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, HelpCircle, Moon, Sun } from 'lucide-react';
import { LeafMark } from '../../components/brand/LeafLogo';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTheme } from '../../hooks/useTheme';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api/errors';
import { useAuth } from '../../lib/auth/use-auth';
import { getAuthErrorMessage } from '../../lib/auth/error-handler';
import { routePaths } from '../../routes/paths';
import { GoogleSignInButton } from '../../components/google-sign-in/GoogleSignInButton';
import { useGoogleAuthUrlMutation, useLoginMutation } from './auth-hooks';
import { loginSchema, type LoginFormValues } from './login-schema';
import './login-page.css';

type LocationState = {
  from?: {
    pathname?: string;
  };
  googleError?: string;
};

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const googleAuthUrlMutation = useGoogleAuthUrlMutation();
  const [showPassword, setShowPassword] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const floatingToggle = document.querySelector<HTMLElement>('.theme-toggle');
    if (floatingToggle) floatingToggle.style.display = 'none';
    return () => {
      if (floatingToggle) floatingToggle.style.display = '';
    };
  }, []);
  const locationState = location.state as LocationState | null;
  const [googleError, setGoogleError] = useState(locationState?.googleError ?? '');

  const redirectTo = useMemo(() => {
    const state = location.state as LocationState | null;
    return state?.from?.pathname ?? routePaths.chats;
  }, [location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to={routePaths.chats} replace />;
  }

  const isLoading = loginMutation.isPending || isSubmitting;
  const errorMessage = getAuthErrorMessage(loginMutation.error);

  async function onSubmit(values: LoginFormValues) {
    try {
      console.log('[Auth] Login attempt:', { email: values.email });
      await loginMutation.mutateAsync(values);
      console.log('[Auth] Login successful');
      navigate(redirectTo, { replace: true });
    } catch (error) {
      console.error('[Auth] Login error:', error);
      if (error instanceof ApiError) {
        console.error('[Auth] API Error Details:', {
          status: error.status,
          message: error.message,
          payload: error.payload,
        });
      }
    }
  }

  async function handleGoogleLogin() {
    setGoogleError('');
    try {
      const redirectUri = `${window.location.origin}${routePaths.googleCallback}`;
      const { url } = await googleAuthUrlMutation.mutateAsync(redirectUri);
      if (!url) {
        setGoogleError('Login com Google indisponível. Verifique a configuração do servidor.');
        return;
      }
      window.location.href = url;
    } catch (error) {
      console.error('[Auth] Google URL error:', error);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setGoogleError(
            'Login com Google indisponível neste servidor (rota ausente). Rode o backend localmente ou publique a versão mais recente.',
          );
          return;
        }
        setGoogleError(
          typeof error.message === 'string' && error.message
            ? error.message
            : `Erro no servidor (${error.status}). Tente novamente.`,
        );
        return;
      }
      setGoogleError(
        'Não foi possível acessar a API. Verifique se o backend está rodando e reinicie o Vite após alterar o .env.',
      );
    }
  }

  return (
    <main className="login-page" aria-labelledby="login-title">
      <header className="login-page__topbar" aria-label="Leaf">
        <Link className="login-page__brand" to={routePaths.login}>
          <LeafMark size={25} strokeWidth={2.5} />
          <span>Leaf</span>
        </Link>

        <div className="login-page__top-actions">
          <button
            className="login-page__icon-button"
            type="button"
            aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
            onClick={toggleTheme}
          >
            {isDark ? <Sun size={21} strokeWidth={2.2} /> : <Moon size={21} strokeWidth={2.2} />}
          </button>
          <a
            className="login-page__icon-button"
            href="https://wa.me/553493388856"
            target="_blank"
            rel="noreferrer"
            aria-label="Ajuda no WhatsApp"
          >
            <HelpCircle size={21} strokeWidth={2.2} />
          </a>
        </div>
      </header>

      <section className="login-page__hero" aria-label="Sobre o Leaf">
        <div className="login-page__hero-content">
          <p className="login-page__eyebrow">Comunicação de nova geração</p>
          <h1>
            Mensagens inteligentes para <span>todos.</span>
          </h1>
          <p className="login-page__intro">
            Bem-vindo ao Leaf. Uma plataforma de mensagens em tempo real e segura, integrada
            com IA para otimizar seu fluxo de trabalho e automatizar suas tarefas do dia a dia.
          </p>
        </div>
      </section>

      <section className="login-page__panel" aria-label="Entrar">
        <form className="login-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="login-card__mark" aria-hidden="true">
            <LeafMark size={40} strokeWidth={2.3} />
          </div>

          <div className="login-card__heading">
            <h2 id="login-title">Bem-vindo de volta</h2>
            <p>Entre para continuar suas conversas.</p>
          </div>

          <div className="login-card__fields">
            <label className="auth-field">
              <span>E-mail</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                aria-invalid={Boolean(errors.email)}
                {...register('email')}
              />
              {errors.email ? (
                <small className="auth-field__error">{errors.email.message}</small>
              ) : null}
            </label>

            <label className="auth-field">
              <span className="auth-field__label-row">
                Senha
                <Link className="auth-field__text-button" to={routePaths.forgotPassword}>
                  Esqueceu a senha?
                </Link>
              </span>
              <span className="auth-field__password-control">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={Boolean(errors.password)}
                  {...register('password')}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <Eye size={20} strokeWidth={2} />
                </button>
              </span>
              {errors.password ? (
                <small className="auth-field__error">{errors.password.message}</small>
              ) : null}
            </label>
          </div>

          {errorMessage ? (
            <p className="login-card__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button className="login-card__submit" type="submit" disabled={isLoading}>
            {isLoading ? 'Entrando…' : 'Entrar →'}
          </button>

          <div className="login-card__divider">
            <span>OU</span>
          </div>

          <div className="login-card__socials">
            <GoogleSignInButton
              onClick={handleGoogleLogin}
              isLoading={googleAuthUrlMutation.isPending}
            />
            {googleError ? (
              <p className="login-card__google-error" role="alert">
                {googleError}
              </p>
            ) : null}
          </div>

          <p className="login-card__signup">
            Novo por aqui? <Link to={routePaths.register}>Criar conta</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
