import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Wordmark } from '@/components/ui/LogoMark';

/**
 * Вход по ссылке из письма. Страница живёт вне Shell, поэтому провайдера toast
 * рядом нет — ошибки и подсказки показываем прямо под формой.
 */
export function LoginPage({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address || sending) return;
    setSending(true);
    setError(null);
    try {
      const { error: err } = await client.auth.signInWithOtp({
        email: address,
        options: { emailRedirectTo: location.origin },
      });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-canvas px-4 py-16">
      {/* Простая колонка по центру: знак и слово, заголовок, одно поле и одна главная кнопка. */}
      <div className="flex w-full max-w-sm flex-col items-center">
        <Wordmark size={24} />
        <h1 className="mt-10 text-h1 font-semibold text-text">Вход</h1>
        <p className="mt-1 text-center text-body text-muted">Мечты, цели и дела на сегодня</p>

        <form className="mt-8 w-full" onSubmit={e => void onSubmit(e)}>
          <Input
            id="login-email"
            label="Почта"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => {
              setEmail(e.target.value);
              setSent(false);
              setError(null);
            }}
          />
          <Button type="submit" variant="primary" size="lg" className="mt-4 w-full" disabled={sending || !email.trim()}>
            Получить ссылку для входа
          </Button>
        </form>

        {sent ? (
          <p role="status" className="mt-4 text-center text-small text-muted-strong">
            Ссылка отправлена. Проверь почту и перейди по ней
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 text-center text-small text-danger-strong">
            {error}
          </p>
        ) : null}

        <p className="mt-8 text-center text-small text-muted">Пароль не нужен: ссылка из письма откроет вход на этом устройстве</p>
      </div>
    </div>
  );
}
