import './input.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, helpText, icon, id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="input-wrapper">
      {label && (
        <label htmlFor={inputId} className="input-label">
          {label}
        </label>
      )}
      <div className={`input-container ${icon ? 'input-container--with-icon' : ''}`}>
        {icon && <span className="input-icon">{icon}</span>}
        <input
          id={inputId}
          className={`input ${error ? 'input--error' : ''}`}
          {...props}
        />
      </div>
      {error && <span className="input-error">{error}</span>}
      {helpText && !error && <span className="input-help">{helpText}</span>}
    </div>
  );
}
