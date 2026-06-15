import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { LeafMark } from '../../components/brand/LeafLogo';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { GoogleSignInButton } from '../../components/google-sign-in/GoogleSignInButton';
import { ApiError } from '../../lib/api/errors';
import { getAuthErrorMessage } from '../../lib/auth/error-handler';
import { useAuth } from '../../lib/auth/use-auth';
import { routePaths } from '../../routes/paths';
import { useGoogleAuthUrlMutation, useRegisterMutation } from './auth-hooks';
import { registerSchema, type RegisterFormValues } from './register-schema';
import './register-page.css';

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();
  const googleAuthUrlMutation = useGoogleAuthUrlMutation();
  const [showPassword, setShowPassword] = useState(false);
  const [googleError, setGoogleError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  if (isAuthenticated) {
    return <Navigate to={routePaths.chats} replace />;
  }

  const isLoading = registerMutation.isPending || isSubmitting;
  const errorMessage = getAuthErrorMessage(registerMutation.error);

  async function onSubmit(values: RegisterFormValues) {
    try {
      await registerMutation.mutateAsync({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      localStorage.setItem('pending_email', values.email);
      navigate(routePaths.verifyEmail, { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('[Auth] API Error Details:', {
          status: error.status,
          message: error.message,
          payload: error.payload,
        });
      }
    }
  }

  async function handleGoogleSignup() {
    setGoogleError('');
    try {
      const redirectUri = `${window.location.origin}${routePaths.googleCallback}`;
      const { url } = await googleAuthUrlMutation.mutateAsync(redirectUri);
      if (!url) {
        setGoogleError('O cadastro com Google está indisponível no momento.');
        return;
      }
      window.location.href = url;
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setGoogleError('A rota de cadastro com Google não está disponível no servidor.');
          return;
        }
        setGoogleError(
          typeof error.message === 'string' && error.message
            ? error.message
            : `Erro no servidor (${error.status}). Tente novamente.`,
        );
        return;
      }
      setGoogleError('Não foi possível contatar a API. Verifique o status do backend.');
    }
  }

  return (
    <main className="register-page" aria-labelledby="register-title">
      <Link className="register-page__brand register-page__brand--floating" to={routePaths.login}>
        <LeafMark size={24} strokeWidth={2.4} />
        <span>Leaf</span>
      </Link>

      <div className="register-page__content">
        <section className="register-page__hero" aria-label="Apresentação do Leaf">
          <div className="register-page__hero-content">
            <p className="register-page__eyebrow">Faça parte do Leaf</p>
            <h1>
              Conecte seu <span>Fluxo.</span>
            </h1>
            <p className="register-page__intro">
              Junte-se a uma comunidade crescente de profissionais. O Leaf dá ao seu time as
              ferramentas para transformar conversas em resultados concretos.
            </p>
          </div>
        </section>

        <section className="register-page__panel" aria-label="Criar conta">
          <form className="register-card" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="register-card__mark" aria-hidden="true">
              <LeafMark size={40} strokeWidth={2.3} />
            </div>

            <div className="register-card__heading">
              <h2 id="register-title">Crie sua conta</h2>
              <p>Entre na conversa com o Leaf.</p>
            </div>

            <div className="register-card__fields">
              <label className="auth-field">
                <span>Nome completo</span>
                <span className="auth-field__icon-control">
                  <User size={18} strokeWidth={2} className="auth-field__icon" aria-hidden="true" />
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Seu nome"
                    aria-invalid={Boolean(errors.name)}
                    {...register('name')}
                  />
                </span>
                {errors.name ? <small className="auth-field__error">{errors.name.message}</small> : null}
              </label>

              <label className="auth-field">
                <span>E-mail</span>
                <span className="auth-field__icon-control">
                  <Mail size={18} strokeWidth={2} className="auth-field__icon" aria-hidden="true" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="nome@exemplo.com"
                    aria-invalid={Boolean(errors.email)}
                    {...register('email')}
                  />
                </span>
                {errors.email ? <small className="auth-field__error">{errors.email.message}</small> : null}
              </label>

              <label className="auth-field">
                <span>Senha</span>
                <span className="auth-field__icon-control">
                  <Lock size={18} strokeWidth={2} className="auth-field__icon" aria-hidden="true" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="********"
                    aria-invalid={Boolean(errors.password)}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    className="auth-field__icon-toggle"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                {errors.password ? <small className="auth-field__error">{errors.password.message}</small> : null}
              </label>
            </div>

            {errorMessage ? (
              <p className="register-card__error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button className="register-card__submit" type="submit" disabled={isLoading}>
              {isLoading ? 'Criando conta…' : 'Criar conta'}
              {!isLoading && <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />}
            </button>

            <p className="register-card__login">
              Já tem uma conta? <Link to={routePaths.login}>Entrar</Link>
            </p>

            <div className="register-card__divider">
              <span>Ou cadastre-se com</span>
            </div>

            <div className="register-card__socials">
              <GoogleSignInButton onClick={handleGoogleSignup} isLoading={googleAuthUrlMutation.isPending} />
              {googleError ? (
                <p className="register-card__google-error" role="alert">
                  {googleError}
                </p>
              ) : null}
            </div>

            <p className="register-card__terms">
              Ao se cadastrar, você concorda com os <Link to={routePaths.login}>Termos de Serviço</Link> e a{' '}
              <Link to={routePaths.login}>Política de Privacidade</Link> do Leaf.
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
