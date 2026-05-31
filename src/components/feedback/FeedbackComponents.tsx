import { Loader } from 'lucide-react';
import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

export function LoadingSpinner({ message = 'Loading...', size = 24 }: LoadingSpinnerProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '20px' }}>
      <Loader size={size} className="animate-spin" />
      {message && <p>{message}</p>}
    </div>
  );
}

interface ErrorMessageProps {
  error: string | null;
  role?: string;
  className?: string;
}

export function ErrorMessage({ error, role = 'alert', className = '' }: ErrorMessageProps) {
  if (!error) return null;

  return (
    <div style={{ padding: '12px', color: 'red', border: '1px solid red', borderRadius: '4px' }} className={className} role={role}>
      {error}
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#999' }}>
      {icon && <div style={{ marginBottom: '12px' }}>{icon}</div>}
      <p>{message}</p>
    </div>
  );
}
