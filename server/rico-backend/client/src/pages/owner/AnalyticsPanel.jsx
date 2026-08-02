import { useState, useEffect } from 'react';
import { CATEGORY_LABELS, CLAIM_STATUS_LABELS, DEAL_STATUS_LABELS, DEAL_TYPE_LABELS } from './api';

export default function AnalyticsPanel({ authedFetch }) {
  const [data, setData] = useState(null); // null = loading
  const [topVendors, setTopVendors] = useState(null); // null = loading
  const [expiringDeals, setExpiringDeals] = useState(null); // null = loading
  const [dealTypePerf, setDealTypePerf] = useState(null); // null = loading
  const [searchGaps, setSearchGaps] = useState(null); // null = loading

  useEffect(() => {
    load();
    loadTopVendors();
    loadExpiringDeals();
    loadDealTypePerf();
    loadSearchGaps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const res = await authedFetch('/owner/analytics');
    if (!res) return;
    setData(await res.json());
  }

  async function loadTopVendors() {
    const res = await authedFetch('/owner/analytics/top-vendors?days=30&limit=10');
    if (!res) return;
    setTopVendors((await res.json()).items);
  }

  async function loadExpiringDeals() {
    const res = await authedFetch('/owner/analytics/expiring-deals?days=7');
    if (!res) return;
    setExpiringDeals((await res.json()).items);
  }

  async function loadDealTypePerf() {
    const res = await authedFetch('/owner/analytics/deal-type-performance?days=30');
    if (!res) return;
    setDealTypePerf((await res.json()).items);
  }

  async function loadSearchGaps() {
    const res = await authedFetch('/owner/analytics/search-gaps?days=30');
    if (!res) return;
    setSearchGaps((await res.json()).items);
  }

  if (!data) return <div className="owner-wide-card"><p className="note">جاري التحميل...</p></div>;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{data.businesses.total}</div>
          <div className="stat-label">إجمالي الأنشطة التجارية</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.businesses.active}</div>
          <div className="stat-label">أنشطة فعّالة</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.accounts.total}</div>
          <div className="stat-label">حسابات أصحاب الأنشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.products.active}</div>
          <div className="stat-label">منتجات نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.discounts.active}</div>
          <div className="stat-label">خصومات نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.usage.googlePlaces.count}/{data.usage.googlePlaces.cap}</div>
          <div className="stat-label">استخدام Google Places ({data.usage.googlePlaces.period})</div>
        </div>
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>الأنشطة حسب الفئة</h1>
        {data.businesses.byCategory.length === 0 && <p className="note">لا توجد بيانات.</p>}
        {data.businesses.byCategory.length > 0 && (
          <table>
            <thead><tr><th>الفئة</th><th>العدد</th></tr></thead>
            <tbody>
              {data.businesses.byCategory.map((r) => (
                <tr key={r.categorySlug}>
                  <td>{CATEGORY_LABELS[r.categorySlug] || r.categorySlug}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>العروض حسب الحالة</h1>
        <table>
          <thead><tr><th>الحالة</th><th>العدد</th></tr></thead>
          <tbody>
            {Object.entries(data.deals.byStatus).map(([status, count]) => (
              <tr key={status}>
                <td>{DEAL_STATUS_LABELS[status] || status}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>طلبات الربط حسب الحالة</h1>
        <table>
          <thead><tr><th>الحالة</th><th>العدد</th></tr></thead>
          <tbody>
            {Object.entries(data.claims.byStatus).map(([status, count]) => (
              <tr key={status}>
                <td>{CLAIM_STATUS_LABELS[status] || status}</td>
                <td>{count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>الأكثر ظهوراً (آخر 30 يوم)</h1>
        {topVendors === null && <p className="note">جاري التحميل...</p>}
        {topVendors && topVendors.length === 0 && <p className="note">لا توجد بيانات ظهور بعد.</p>}
        {topVendors && topVendors.length > 0 && (
          <table>
            <thead><tr><th>#</th><th>النشاط</th><th>الفئة</th><th>مرات الظهور</th></tr></thead>
            <tbody>
              {topVendors.map((v, i) => (
                <tr key={v.businessId}>
                  <td>{i + 1}</td>
                  <td>{v.name}</td>
                  <td>{CATEGORY_LABELS[v.categorySlug] || v.categorySlug || '—'}</td>
                  <td>{v.impressions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>عروض تنتهي قريباً (خلال 7 أيام)</h1>
        {expiringDeals === null && <p className="note">جاري التحميل...</p>}
        {expiringDeals && expiringDeals.length === 0 && <p className="note">لا توجد عروض ستنتهي قريباً.</p>}
        {expiringDeals && expiringDeals.length > 0 && (
          <table>
            <thead><tr><th>النشاط</th><th>العرض</th><th>ينتهي في</th></tr></thead>
            <tbody>
              {expiringDeals.map((d) => (
                <tr key={d.dealId}>
                  <td>{d.businessName || '—'}</td>
                  <td>{d.titleAr}</td>
                  <td>{new Date(d.endsAt).toLocaleDateString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>أداء أنواع العروض حسب الظهور (آخر 30 يوم)</h1>
        {dealTypePerf === null && <p className="note">جاري التحميل...</p>}
        {dealTypePerf && dealTypePerf.length === 0 && <p className="note">لا توجد ظهورات مرتبطة بعروض محددة بعد.</p>}
        {dealTypePerf && dealTypePerf.length > 0 && (
          <table>
            <thead><tr><th>نوع العرض</th><th>مرات الظهور</th></tr></thead>
            <tbody>
              {dealTypePerf.map((r) => (
                <tr key={r.dealType}>
                  <td>{DEAL_TYPE_LABELS[r.dealType] || r.dealType}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="owner-wide-card">
        <h1 style={{ fontSize: 17 }}>فجوات الطلب (بحث بلا نتائج، آخر 30 يوم)</h1>
        <p className="subtitle">فئات طلبها المستخدمون ولم نجد نشاطاً تجارياً قريباً — مرشّحة للاستقطاب.</p>
        {searchGaps === null && <p className="note">جاري التحميل...</p>}
        {searchGaps && searchGaps.length === 0 && <p className="note">لا توجد فجوات طلب مسجّلة بعد.</p>}
        {searchGaps && searchGaps.length > 0 && (
          <table>
            <thead><tr><th>الفئة</th><th>عدد مرات البحث بلا نتائج</th></tr></thead>
            <tbody>
              {searchGaps.map((g) => (
                <tr key={g.categorySlug}>
                  <td>{CATEGORY_LABELS[g.categorySlug] || g.categorySlug}</td>
                  <td>{g.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
