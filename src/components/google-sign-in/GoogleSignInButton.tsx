import { GoogleIcon } from './GoogleIcon';
import './google-sign-in.css';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
};

export function GoogleSignInButton({ onClick, disabled, isLoading }: Props) {
  return (
    <button
      type="button"
      className="google-sign-in"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-label="Continuar com o Google"
    >
      <GoogleIcon />
      <span className="google-sign-in__label">
        {isLoading ? 'Conectando…' : 'Continuar com o Google'}
      </span>
    </button>
  );
}
