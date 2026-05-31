import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/button/Button';
import { Input } from '../../components/input/Input';
import { routePaths } from '../../routes/paths';
import { useForgotPasswordMutation } from './auth-hooks';
import './password-recovery-page.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const mutation = useForgotPasswordMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await mutation.mutateAsync(email);
    setSuccess('Se este e-mail existir, você receberá as instruções de redefinição em instantes.');
  }

  return (
    <main className="password-page">
      <form className="password-card" onSubmit={handleSubmit}>
        <h1>Esqueceu a senha</h1>
        <p>Digite seu e-mail para receber um link de redefinição de senha.</p>
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          required
        />
        {success ? <p className="password-card__success">{success}</p> : null}
        <Button type="submit" fullWidth isLoading={mutation.isPending}>
          Enviar link de redefinição
        </Button>
        <p className="password-card__back">
          <Link to={routePaths.login}>Voltar para o login</Link>
        </p>
      </form>
    </main>
  );
}
