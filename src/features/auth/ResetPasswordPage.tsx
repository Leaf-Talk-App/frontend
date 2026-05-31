import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/button/Button';
import { Input } from '../../components/input/Input';
import { routePaths } from '../../routes/paths';
import { useResetPasswordMutation } from './auth-hooks';
import './password-recovery-page.css';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState('');
  const mutation = useResetPasswordMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await mutation.mutateAsync({ token, password });
    setSuccess('Senha redefinida com sucesso.');
  }

  return (
    <main className="password-page">
      <form className="password-card" onSubmit={handleSubmit}>
        <h1>Redefinir senha</h1>
        <p>Defina uma nova senha para a sua conta.</p>
        <Input
          label="Nova senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
        />
        {success ? <p className="password-card__success">{success}</p> : null}
        <Button type="submit" fullWidth isLoading={mutation.isPending} disabled={!token}>
          Redefinir senha
        </Button>
        <p className="password-card__back">
          <Link to={routePaths.login}>Voltar para o login</Link>
        </p>
      </form>
    </main>
  );
}
