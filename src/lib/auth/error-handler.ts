import { ApiError } from '../api/errors';

export function getAuthErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof ApiError) {
    return translateAuthError(error.message);
  }

  return 'Não foi possível processar a solicitação. Tente novamente em instantes.';
}

function translateAuthError(message: string): string {
  const normalized = message.trim().toLowerCase();

  const errorMap: Record<string, string> = {
    'invalid credentials': 'E-mail ou senha inválidos.',
    'email_not_verified': 'Confirme seu e-mail para continuar. Verifique sua caixa de entrada.',
    'email already exists': 'Este e-mail já está registrado.',
    'invalid email': 'E-mail inválido.',
    'password too weak': 'Senha muito fraca. Use pelo menos 8 caracteres com maiúsculas, minúsculas e números.',
    'network error': 'Erro de conexão. Verifique sua internet.',
    'server error': 'Erro no servidor. Tente novamente mais tarde.',
  };

  return errorMap[normalized] || message;
}
