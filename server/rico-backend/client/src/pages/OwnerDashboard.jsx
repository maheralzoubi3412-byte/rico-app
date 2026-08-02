import { useState, useEffect, useCallback } from 'react';
import { createAuthedFetch } from './owner/api';
import BusinessesPanel from './owner/BusinessesPanel';
import BusinessDetail from './owner/BusinessDetail';
import AnalyticsPanel from './owner/AnalyticsPanel';
import CustomersPanel from './owner/CustomersPanel';
import CustomerDetail from './owner/CustomerDetail';
import StaffPanel from './owner/StaffPanel';
import AuditLogPanel from './owner/AuditLogPanel';

const BASE_TABS = [
  { id: 'businesses', label: 'الأنشطة التجارية' },
  { id: 'analytics', label: 'التحليلات' },
  { id: 'customers', label: 'أصحاب الأنشطة' },
  { id: 'auditLog', label: 'سجل النشاطات' },
];
const OWNER_ONLY_TAB = { id: 'staff', label: 'الفريق' };
const ALL_TAB_IDS = [...BASE_TABS, OWNER_ONLY_TAB].map((t) => t.id);

function parseNav(search) {
  const params = new URLSearchParams(search);
  const rawTab = params.get('tab');
  const tab = ALL_TAB_IDS.includes(rawTab) ? rawTab : 'businesses';
  return { tab, businessId: params.get('bid'), accountId: params.get('aid') };
}

function buildNavSearch(nav) {
  const params = new URLSearchParams();
  params.set('tab', nav.tab);
  if (nav.businessId) params.set('bid', nav.businessId);
  if (nav.accountId) params.set('aid', nav.accountId);
  return `?${params.toString()}`;
}

export default function OwnerDashboard() {
  const [me, setMe] = useState(null); // null = checking session, false = unauthenticated, {id,email,role} = logged in
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState(null);
  const [nav, setNav] = useState(() => parseNav(window.location.search));

  useEffect(() => {
    window.history.replaceState(nav, '', buildNavSearch(nav));
    const onPopState = (e) => setNav(e.state || parseNav(window.location.search));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleUnauthorized() {
    setMe(false);
  }

  const authedFetch = createAuthedFetch(handleUnauthorized);

  useEffect(() => {
    (async () => {
      const res = await fetch('/owner/me');
      if (res.status === 401) return setMe(false);
      setMe(await res.json());
    })();
  }, []);

  const pushNav = useCallback((next, replace) => {
    setNav(next);
    if (replace) window.history.replaceState(next, '', buildNavSearch(next));
    else window.history.pushState(next, '', buildNavSearch(next));
  }, []);

  const changeTab = (tab) => pushNav({ tab, businessId: null, accountId: null }, true);
  const selectBusiness = (businessId) => pushNav({ ...nav, businessId, accountId: null }, false);
  const selectAccount = (accountId) => pushNav({ ...nav, accountId, businessId: null }, false);
  const backToList = () => window.history.back();

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setAuthError(null);
    const res = await fetch('/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginForm),
    });
    if (!res.ok) {
      setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      return;
    }
    setMe(await res.json());
    setLoginForm({ email: '', password: '' });
  }

  async function logout() {
    await fetch('/owner/logout', { method: 'POST' });
    setMe(false);
  }

  if (me === null) return <div className="page"><div className="card">جاري التحميل...</div></div>;

  if (me === false) {
    return (
      <div className="page">
        <div className="card">
          <h1>لوحة تحكم المالك</h1>
          <form onSubmit={handleLoginSubmit}>
            <label htmlFor="ownerEmail">البريد الإلكتروني</label>
            <input
              id="ownerEmail"
              type="email"
              required
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
            />
            <label htmlFor="ownerPassword">كلمة المرور</label>
            <input
              id="ownerPassword"
              type="password"
              required
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <button className="full" type="submit">دخول</button>
          </form>
          {authError && <div className="status error">{authError}</div>}
        </div>
      </div>
    );
  }

  const tabs = me.role === 'owner' ? [...BASE_TABS, OWNER_ONLY_TAB] : BASE_TABS;

  return (
    <div className="owner-layout">
      <aside className="owner-sidebar">
        <h2>لوحة المالك</h2>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`owner-nav-item ${nav.tab === t.id && !nav.businessId && !nav.accountId ? 'active' : ''}`}
            onClick={() => changeTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <p style={{ padding: '0 20px', fontSize: 12.5, color: '#888', marginTop: 'auto' }}>
          {me.email} · {me.role === 'owner' ? 'مالك' : 'موظف'}
        </p>
        <button className="owner-nav-item logout" onClick={logout}>تسجيل الخروج</button>
      </aside>

      <main className="owner-main">
        {nav.tab === 'businesses' && !nav.businessId && (
          <BusinessesPanel authedFetch={authedFetch} onSelect={selectBusiness} />
        )}
        {nav.tab === 'businesses' && nav.businessId && (
          <BusinessDetail authedFetch={authedFetch} businessId={nav.businessId} onBack={backToList} />
        )}
        {nav.tab === 'analytics' && <AnalyticsPanel authedFetch={authedFetch} />}
        {nav.tab === 'customers' && !nav.accountId && (
          <CustomersPanel authedFetch={authedFetch} onSelect={selectAccount} />
        )}
        {nav.tab === 'customers' && nav.accountId && (
          <CustomerDetail authedFetch={authedFetch} accountId={nav.accountId} onBack={backToList} />
        )}
        {nav.tab === 'auditLog' && <AuditLogPanel authedFetch={authedFetch} />}
        {nav.tab === 'staff' && me.role === 'owner' && <StaffPanel authedFetch={authedFetch} currentOwnerId={me.id} />}
      </main>
    </div>
  );
}
