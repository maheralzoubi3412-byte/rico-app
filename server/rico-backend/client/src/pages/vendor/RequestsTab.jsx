import { useCallback, useEffect, useState } from 'react';
import { Phone, User, Tag, Package } from 'lucide-react';
import { REQUEST_ITEM_TYPE_LABELS } from './api';

export default function RequestsTab({ authedFetch }) {
  const [requests, setRequests] = useState(null); // null = loading
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const res = await authedFetch('/vendor/requests');
    if (!res) return;
    const data = await res.json();
    setRequests(data.requests || []);
  }, [authedFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function markHandled(id) {
    setBusyId(id);
    const res = await authedFetch(`/vendor/requests/${id}/handled`, { method: 'PATCH' });
    setBusyId(null);
    if (res && res.ok) load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold">الطلبات</h1>
        <p className="text-on-surface-variant mt-1">عملاء أبدوا اهتماماً بمنتج أو عرض عبر الدردشة — تواصل معهم مباشرة.</p>
      </div>

      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm space-y-3">
        {requests === null && <p className="text-sm text-on-surface-variant">جاري التحميل...</p>}
        {requests && requests.length === 0 && (
          <div className="text-center py-8">
            <Package className="w-8 h-8 mx-auto text-on-surface-variant/40 mb-2" />
            <p className="text-on-surface-variant">لا توجد طلبات بعد.</p>
          </div>
        )}
        {requests?.map((r) => (
          <div
            key={r.id}
            className={`flex items-start justify-between gap-4 bg-surface-container rounded-2xl px-4 py-3 ${
              r.status === 'handled' ? 'opacity-60' : ''
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {r.itemType === 'product' ? (
                  <Package className="w-4 h-4 text-primary" />
                ) : (
                  <Tag className="w-4 h-4" style={{ color: '#C9A24A' }} />
                )}
                <span className="text-sm font-bold">{r.itemLabel}</span>
                <span className="text-xs text-on-surface-variant">
                  ({REQUEST_ITEM_TYPE_LABELS[r.itemType] || r.itemType}
                  {r.itemDetail ? ` · ${r.itemDetail}` : ''})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {r.customerName}
                </span>
                <a href={`tel:${r.customerPhone}`} className="flex items-center gap-1 text-primary font-semibold">
                  <Phone className="w-3.5 h-3.5" /> {r.customerPhone}
                </a>
                <span>{new Date(r.createdAt).toLocaleString('ar-SA')}</span>
              </div>
            </div>
            {r.status === 'new' ? (
              <button
                onClick={() => markHandled(r.id)}
                disabled={busyId === r.id}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary disabled:opacity-60"
              >
                تم التعامل معه
              </button>
            ) : (
              <span className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-surface-container-highest text-on-surface-variant">
                تم التعامل معه
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
