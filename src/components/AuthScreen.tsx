import { useState, type FormEvent } from 'react';
import { ArrowRight, LoaderCircle, Radar } from 'lucide-react';
import type { User } from '../types';
import { api } from '../services/api';
import { clearCache } from '../services/dashboard';

export default function AuthScreen({ setup, onSignedIn }: { setup: boolean; onSignedIn: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get('password') ?? '');
    if (setup && password !== values.get('confirm')) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    setError(null);
    try {
      const user = setup ? await api.setup(password) : await api.login(String(values.get('username') ?? '').trim(), password);
      clearCache(user.id);
      onSignedIn(user);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><Radar size={28} /><span>watchboard</span></div>
    <h1>{setup ? 'Configura tu acceso' : 'Iniciar sesión'}</h1>
    {setup && <p>Tu usuario inicial es <strong>admin</strong>. Elige su contraseña para acceder a tus seguimientos.</p>}
    <form onSubmit={submit} className="auth-form">
      <label>Usuario<input name="username" autoComplete="username" autoCapitalize="off" defaultValue={setup ? 'admin' : ''} readOnly={setup} required maxLength={40} autoFocus={!setup} /></label>
      <label>Contraseña<input name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 12 : undefined} maxLength={128} required autoFocus={setup} /></label>
      {setup && <><label>Repetir contraseña<input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label><small>Al menos 12 caracteres. Puedes usar una frase.</small></>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <button className="button primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spinning" /> : <ArrowRight size={18} />}{setup ? 'Crear acceso admin' : 'Entrar'}</button>
    </form>
  </section></main>;
}
