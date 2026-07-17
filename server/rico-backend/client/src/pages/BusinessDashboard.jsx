import { useState, useEffect, useRef } from 'react';

const DEAL_TYPES = [
  { value: 'percent', label: 'نسبة خصم (٪)' },
  { value: 'fixed', label: 'خصم بمبلغ ثابت (ر.س)' },
  { value: 'bogo', label: 'اشتري واحصل على الثاني مجاناً' },
  { value: 'free_item', label: 'عنصر مجاني' },
  { value: 'bundle', label: 'عرض باقة' },
];

const STATUS_LABELS = {
  active: 'مُفعّل',
  pending_review: 'قيد المراجعة',
  rejected: 'مرفوض',
  suspended: 'معلّق',
  expired: 'منتهي',
};

export default function BusinessDashboard() {
  const [me, setMe] = useState(null); // null = loading, false = unauthenticated
  const [deals, setDeals] = useState([]);
  const [claimQuery, setClaimQuery] = useState('');
  const [claimResults, setClaimResults] = useState([]);
  const [claimStatus, setClaimStatus] = useState(null);
  const [dealForm, setDealForm] = useState({ placeId: '', titleAr: '', descriptionAr: '', dealType: 'percent', value: '', promoCode: '' });
  const [dealStatus, setDealStatus] = useState(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    loadMe();
    loadDeals();
  }, []);

  async function loadMe() {
    const res = await fetch('/business/me');
    if (res.status === 401) return setMe(false);
    setMe(await res.json());
  }

  async function loadDeals() {
    const res = await fetch('/business/deals');
    if (res.ok) setDeals((await res.json()).deals);
  }

  function handleClaimQueryChange(e) {
    const q = e.target.value;
    setClaimQuery(q);
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) return setClaimResults([]);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/places/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setClaimResults(data.places || []);
    }, 350);
  }

  async function claimPlace(place) {
    setClaimResults([]);
    setClaimQuery('');
    const res = await fetch('/business/claim-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: place.id }),
    });
    const body = await res.json();
    if (res.ok) {
      setClaimStatus({ type: 'success', message: `تم إرسال طلب ربط "${place.nameAr || place.name}" — سيتم التحقق منه.` });
      loadMe();
    } else {
      setClaimStatus({ type: 'error', message: body.error === 'already_claimed' ? 'هذا النشاط مربوط بحسابك بالفعل.' : 'تعذر إرسال الطلب.' });
    }
  }

  async function logout() {
    await fetch('/business/logout', { method: 'POST' });
    window.location.href = '/business/login';
  }

  async function submitDeal(e) {
    e.preventDefault();
    const res = await fetch('/business/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...dealForm,
        value: dealForm.value === '' ? null : Number(dealForm.value),
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setDealStatus({ type: 'success', message: 'تمت إضافة العرض ونُشر مباشرة.' });
      setDealForm({ placeId: '', titleAr: '', descriptionAr: '', dealType: 'percent', value: '', promoCode: '' });
      loadDeals();
    } else {
      setDealStatus({ type: 'error', message: body.error === 'place_not_claimed' ? 'هذا النشاط غير مربوط أو لم تتم الموافقة عليه بعد.' : 'تعذر إضافة العرض.' });
    }
  }

  async function expireDeal(id) {
    await fetch(`/business/deals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'expired' }),
    });
    loadDeals();
  }

  if (me === null) return <div className="page"><div className="card">جاري التحميل...</div></div>;

  if (me === false) {
    return (
      <div className="page">
        <div className="card">
          <h1>يجب تسجيل الدخول</h1>
          <p className="subtitle">انتهت الجلسة أو لم تسجّل الدخول بعد.</p>
          <a href="/business/login"><button className="full">تسجيل الدخول</button></a>
        </div>
      </div>
    );
  }

  const activeClaims = me.claims.filter((c) => c.status === 'active');

  return (
    <div className="page">
      <div className="card">
        <div className="row">
          <h1>لوحة إدارة نشاطك</h1>
          <button className="secondary" onClick={logout}>تسجيل الخروج</button>
        </div>
        <p className="subtitle">{me.email}</p>

        <label>الأنشطة التجارية المرتبطة بحسابك</label>
        {me.claims.length === 0 && <p className="note">لا يوجد أي نشاط مرتبط بعد — ابحث عن نشاطك أدناه.</p>}
        {me.claims.map((c) => (
          <div key={c.placeId} className="row" style={{ marginTop: 8 }}>
            <span>{c.placeName}</span>
            <span className={`badge ${c.status}`}>{STATUS_LABELS[c.status] || c.status}</span>
          </div>
        ))}

        <label htmlFor="claimQuery" style={{ marginTop: 20 }}>ربط نشاط تجاري جديد</label>
        <input id="claimQuery" type="text" placeholder="ابحث باسم النشاط" value={claimQuery} onChange={handleClaimQueryChange} />
        {claimResults.map((p) => (
          <div key={p.id} className="place-option" onClick={() => claimPlace(p)}>
            {p.nameAr || p.name}
            {p.city && <small>{p.city}{p.district ? ` — ${p.district}` : ''}</small>}
          </div>
        ))}
        {claimStatus && <div className={`status ${claimStatus.type}`}>{claimStatus.message}</div>}
      </div>

      {activeClaims.length > 0 && (
        <div className="card">
          <h1 style={{ fontSize: 17 }}>إضافة عرض جديد</h1>
          <form onSubmit={submitDeal}>
            <label htmlFor="dealPlace">النشاط</label>
            <select id="dealPlace" required value={dealForm.placeId} onChange={(e) => setDealForm({ ...dealForm, placeId: e.target.value })}>
              <option value="" disabled>اختر نشاطاً مُفعّلاً</option>
              {activeClaims.map((c) => <option key={c.placeId} value={c.placeId}>{c.placeName}</option>)}
            </select>

            <label htmlFor="dealTitle">عنوان العرض</label>
            <input id="dealTitle" required maxLength={120} value={dealForm.titleAr}
              onChange={(e) => setDealForm({ ...dealForm, titleAr: e.target.value })} />

            <label htmlFor="dealDesc">تفاصيل إضافية (اختياري)</label>
            <textarea id="dealDesc" maxLength={300} value={dealForm.descriptionAr}
              onChange={(e) => setDealForm({ ...dealForm, descriptionAr: e.target.value })} />

            <label htmlFor="dealTypeSel">نوع العرض</label>
            <select id="dealTypeSel" value={dealForm.dealType} onChange={(e) => setDealForm({ ...dealForm, dealType: e.target.value })}>
              {DEAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <label htmlFor="dealValue">القيمة (اختياري)</label>
            <input id="dealValue" type="number" min={0} max={100000} value={dealForm.value}
              onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} />

            <button className="full" type="submit">نشر العرض</button>
          </form>
          {dealStatus && <div className={`status ${dealStatus.type}`}>{dealStatus.message}</div>}
        </div>
      )}

      <div className="card">
        <h1 style={{ fontSize: 17 }}>عروضي</h1>
        {deals.length === 0 && <p className="note">لا توجد عروض بعد.</p>}
        {deals.map((d) => (
          <div key={d.id} className="row" style={{ marginTop: 10 }}>
            <div>
              <div>{d.titleAr}</div>
              <span className={`badge ${d.status}`}>{STATUS_LABELS[d.status] || d.status}</span>
            </div>
            {d.status === 'active' && (
              <button className="secondary" onClick={() => expireDeal(d.id)}>إنهاء العرض</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
