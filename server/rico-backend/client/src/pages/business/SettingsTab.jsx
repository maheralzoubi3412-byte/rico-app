import { useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { CLAIM_STATUS_LABELS } from './api';

export default function SettingsTab({ authedFetch, me, onClaimed }) {
  const [claimQuery, setClaimQuery] = useState('');
  const [claimResults, setClaimResults] = useState([]);
  const [claimStatus, setClaimStatus] = useState(null);
  const debounceRef = useRef(null);

  function handleQueryChange(e) {
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
    const res = await authedFetch('/business/claim-place', {
      method: 'POST',
      body: JSON.stringify({ businessId: place.id }),
    });
    if (!res) return;
    const body = await res.json();
    if (res.ok) {
      setClaimStatus({ type: 'success', message: `تم ربط "${place.nameAr || place.name}" بحسابك — يمكنك الآن إضافة المنتجات والعروض له.` });
      onClaimed();
    } else {
      setClaimStatus({ type: 'error', message: body.error === 'already_claimed' ? 'هذا النشاط مربوط بحسابك بالفعل.' : 'تعذر إرسال الطلب.' });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">الإعدادات</h1>
        <p className="text-on-surface-variant mt-1">{me.email}</p>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm space-y-4">
        <h2 className="font-bold">الأنشطة التجارية المرتبطة</h2>
        {me.claims.length === 0 && <p className="text-sm text-on-surface-variant">لا يوجد أي نشاط مرتبط بعد.</p>}
        {me.claims.map((c) => (
          <div key={c.placeId} className="flex items-center justify-between">
            <span className="text-sm font-semibold">{c.placeName}</span>
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                c.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {CLAIM_STATUS_LABELS[c.status] || c.status}
            </span>
          </div>
        ))}

        <div className="pt-4 border-t border-outline-variant space-y-2">
          <label className="text-xs font-bold uppercase text-on-surface-variant">ربط نشاط تجاري جديد</label>
          <div className="relative">
            <Search className="absolute end-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input
              type="text"
              placeholder="ابحث باسم النشاط"
              value={claimQuery}
              onChange={handleQueryChange}
              className="w-full bg-surface-container border-none rounded-xl px-4 py-3 pe-11 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          {claimResults.map((p) => (
            <div
              key={p.id}
              onClick={() => claimPlace(p)}
              className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high cursor-pointer text-sm"
            >
              {p.nameAr || p.name}
              {p.city && <small className="block text-on-surface-variant">{p.city}{p.district ? ` — ${p.district}` : ''}</small>}
            </div>
          ))}
          {claimStatus && (
            <div className={`text-sm ${claimStatus.type === 'error' ? 'text-error' : 'text-primary'}`}>{claimStatus.message}</div>
          )}
        </div>
      </div>
    </div>
  );
}
