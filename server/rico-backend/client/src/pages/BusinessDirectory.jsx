import { useState, useEffect } from 'react';

export default function BusinessDirectory() {
  const [items, setItems] = useState(null); // null = loading
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [category]);

  async function load() {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (category) params.set('categorySlug', category);
      const res = await fetch(`/businesses?${params}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch {
      setError('تعذر تحميل الأنشطة التجارية.');
      setItems([]);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 720 }}>
        <div className="row">
          <h1>الأنشطة التجارية ({total})</h1>
        </div>
        <p className="subtitle">كل الأنشطة المسجّلة في ريكو حالياً.</p>

        <label htmlFor="categoryFilter">تصفية حسب الفئة</label>
        <select id="categoryFilter" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">كل الفئات</option>
          <option value="restaurant">مطاعم</option>
          <option value="cafe">كافيهات</option>
          <option value="pharmacy">صيدليات</option>
          <option value="supermarket">سوبرماركت</option>
          <option value="fuel">محطات وقود</option>
          <option value="mall">مولات</option>
          <option value="atm">صرافات آلية</option>
          <option value="bank">بنوك</option>
          <option value="hospital">مستشفيات</option>
          <option value="clinic">عيادات</option>
          <option value="fitness_centre">نوادي رياضية</option>
        </select>

        {error && <div className="status error">{error}</div>}

        {items === null && <p className="note">جاري التحميل...</p>}
        {items && items.length === 0 && !error && <p className="note">لا توجد أنشطة تجارية مطابقة.</p>}

        {items && items.length > 0 && (
          <table style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الفئة</th>
                <th>المدينة</th>
                <th>مستوى السعر</th>
                <th>التقييم</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b._id}>
                  <td>{b.nameAr || b.name}</td>
                  <td>{b.categorySlug}</td>
                  <td>{b.city || '—'}</td>
                  <td>{b.priceLevel ? '﷼'.repeat(b.priceLevel) : '—'}</td>
                  <td>{b.rating ? `${b.rating} ★ (${b.ratingCount ?? 0})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
