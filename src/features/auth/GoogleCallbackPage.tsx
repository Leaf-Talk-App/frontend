import { useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { routePaths } from '../../routes/paths';
import { useGoogleExchangeMutation } from './auth-hooks';
import { useAuth } from '../../lib/auth/use-auth';
import { claimGoogleOAuthCode, getGoogleOAuthStatus, setGoogleOAuthStatus } from './google-oauth-guard';

export function GoogleCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { mutateAsync } = useGoogleExchangeMutation();

  const code = params.get('code');
  const oauthError = params.get('error');

  useEffect(() => {
    if (isAuthenticated) {
      navigate(routePaths.chats, { replace: true });
      return;
    }

    if (oauthError) {
      navigate(routePaths.login, { replace: true, state: { googleError: 'Login com Google cancelado.' } });
      return;
    }

    if (!code) {
      navigate(routePaths.login, { replace: true });
      return;
    }

    const existing = getGoogleOAuthStatus(code);
    if (existing === 'success') {
      navigate(routePaths.chats, { replace: true });
      return;
    }
    if (existing === 'failed') {
      navigate(routePaths.login, {
        replace: true,
        state: { googleError: 'Não foi possível concluir o login com Google.' },
      });
      return;
    }
    if (existing === 'pending') {
      return;
    }

    if (!claimGoogleOAuthCode(code)) {
      return;
    }

    window.history.replaceState({}, document.title, routePaths.googleCallback);

    const redirectUri = `${window.location.origin}${routePaths.googleCallback}`;

    void mutateAsync({ code, redirectUri })
      .then(() => {
        setGoogleOAuthStatus(code, 'success');
        navigate(routePaths.chats, { replace: true });
      })
      .catch((err: unknown) => {
        setGoogleOAuthStatus(code, 'failed');
        // Surfacea o detalhe real do backend (ex: redirect_uri_mismatch) p/ diagnóstico.
        const detail =
          err && typeof err === 'object' && 'payload' in err
            ? (err as { payload?: { detail?: string } }).payload?.detail
            : undefined;
        navigate(routePaths.login, {
          replace: true,
          state: {
            googleError:
              detail ||
              'Não foi possível concluir o login com Google. Tente novamente (use um único clique no botão).',
          },
        });
      });
    // mutateAsync intentionally omitted — unstable reference would re-fire the effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, oauthError, isAuthenticated, navigate]);

  if (isAuthenticated) {
    return <Navigate to={routePaths.chats} replace />;
  }

  return (
    <main className="verify-email-page">
      <div className="verify-email-page__content">
        <div className="verify-email-card">
          <div className="verify-email-card__heading">
            <h1>Conectando com o Google…</h1>
            <p>Aguarde enquanto verificamos sua autenticação.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
