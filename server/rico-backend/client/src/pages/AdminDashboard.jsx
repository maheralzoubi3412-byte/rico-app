import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [token, setToken] = useState(sessionStorage.getItem('rico_admin_token') || '');
  const [tokenInput, setTokenInput] = useState('');
  const [pendingDeals, setPendingDeals] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) loadAll();
  }, [token]);

  async function authedFetch(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      setError('رمز الدخول غير صحيح.');
      sessionStorage.removeItem('rico_admin_token');
      setToken('');
      return null;
    }
    return res;
  }

  async function loadAll() {
    setError(null);
    const [dealsRes, claimsRes, usageRes] = await Promise.all([
      authedFetch('/admin/deals/pending'),
      authedFetch('/admin/claims/pending'),
      authedFetch('/admin/usage'),
    ]);
    if (dealsRes) setPendingDeals((await dealsRes.json()).deals);
    if (claimsRes) setPendingClaims((await claimsRes.json()).claims);
    if (usageRes) setUsage(await usageRes.json());
  }

  function handleTokenSubmit(e) {
    e.preventDefault();
    sessionStorage.setItem('rico_admin_token', tokenInput);
    setToken(tokenInput);
  }

  async function reviewDeal(id, status) {
    await authedFetch(`/admin/deals/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  }

  async function reviewClaim(id, status) {
    if (status === 'active' && !window.confirm('تأكيد: هل تواصلت مع رقم الهاتف المسجّل للنشاط للتحقق من ملكيته قبل الموافقة؟')) {
      return;
    }
    await authedFetch(`/admin/claims/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  }

  if (!token) {
    return (
      <div className="page">
        <div className="card">
          <h1>لوحة الإدارة</h1>
          <form onSubmit={handleTokenSubmit}>
            <label htmlFor="adminToken">رمز الدخول (ADMIN_TOKEN)</label>
            <input id="adminToken" type="password" required value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
            <button className="full" type="submit">دخول</button>
          </form>
          {error && <div className="status error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {usage && (
        <div className="card">
          <h1 style={{ fontSize: 17 }}>استخدام Google Places هذا الشهر</h1>
          <p className="subtitle">{usage.googlePlaces.count} / {usage.googlePlaces.cap} ({usage.googlePlaces.period})</p>
        </div>
      )}

      <div className="card">
        <h1 style={{ fontSize: 17 }}>عروض قيد المراجعة ({pendingDeals.length})</h1>
        {pendingDeals.length === 0 && <p className="note">لا توجد عروض قيد المراجعة.</p>}
        {pendingDeals.map((d) => (
          <div key={d.id} className="row" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <div>
              <div><strong>{d.placeName}</strong> — {d.titleAr}</div>
              <small style={{ color: '#888' }}>{d.descriptionAr} · {d.source}</small>
            </div>
            <div className="actions" style={{ width: 'auto' }}>
              <button onClick={() => reviewDeal(d.id, 'active')}>قبول</button>
              <button className="secondary" onClick={() => reviewDeal(d.id, 'rejected')}>رفض</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h1 style={{ fontSize: 17 }}>طلبات ربط نشاط تجاري ({pendingClaims.length})</h1>
        <p className="subtitle">تحقق برقم الهاتف المسجّل للنشاط قبل الموافقة — ليس مجرد قبول تلقائي.</p>
        {pendingClaims.length === 0 && <p className="note">لا توجد طلبات قيد المراجعة.</p>}
        {pendingClaims.map((c) => (
          <div key={c.id} className="row" style={{ marginTop: 10, alignItems: 'flex-start' }}>
            <div>
              <div><strong>{c.placeName}</strong></div>
              <small style={{ color: '#888' }}>{c.businessEmail} · هاتف النشاط: {c.placePhone || 'غير مسجّل'}</small>
            </div>
            <div className="actions" style={{ width: 'auto' }}>
              <button onClick={() => reviewClaim(c.id, 'active')}>قبول</button>
              <button className="secondary" onClick={() => reviewClaim(c.id, 'rejected')}>رفض</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
