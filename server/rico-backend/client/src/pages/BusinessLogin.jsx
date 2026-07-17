import { useState } from 'react';

export default function BusinessLogin() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch('/business/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      // Deliberately the same message regardless of outcome (rate-limited,
      // unknown email, etc.) — anti account-enumeration, matches the
      // backend's own generic response.
      setStatus({ type: 'success', message: body.message || 'إذا كان هذا البريد مسجلاً، سنرسل رابط تسجيل الدخول إليه.' });
    } catch {
      setStatus({ type: 'error', message: 'تعذر الاتصال بالخادم، حاول مرة أخرى.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <div className="card">
        <h1>لوحة إدارة نشاطك التجاري</h1>
        <p className="subtitle">أدخل بريدك الإلكتروني وسنرسل لك رابط تسجيل دخول (صالح لمدة ١٥ دقيقة).</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">البريد الإلكتروني</label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button className="full" type="submit" disabled={submitting}>إرسال رابط تسجيل الدخول</button>
        </form>
        {status && <div className={`status ${status.type}`}>{status.message}</div>}
      </div>
    </div>
  );
}
