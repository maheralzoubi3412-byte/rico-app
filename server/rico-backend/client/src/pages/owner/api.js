// Session-cookie based — the browser sends the cookie automatically for
// same-origin requests, no Authorization header needed.
export function createAuthedFetch(onUnauthorized) {
  return async function authedFetch(path, options = {}) {
    const res = await fetch(path, options);
    if (res.status === 401) {
      onUnauthorized();
      return null;
    }
    return res;
  };
}

export const CATEGORY_LABELS = {
  restaurant: 'مطاعم',
  cafe: 'كافيهات',
  pharmacy: 'صيدليات',
  supermarket: 'سوبرماركت',
  fuel: 'محطات وقود',
  mall: 'مولات',
  atm: 'صرافات آلية',
  bank: 'بنوك',
  hospital: 'مستشفيات',
  clinic: 'عيادات',
  fitness_centre: 'نوادي رياضية',
};

export const CLAIM_STATUS_LABELS = {
  active: 'مُفعّل',
  pending_review: 'قيد المراجعة',
  rejected: 'مرفوض',
  suspended: 'معلّق',
};

export const DEAL_STATUS_LABELS = {
  active: 'مُفعّل',
  pending_review: 'قيد المراجعة',
  rejected: 'مرفوض',
  expired: 'منتهي',
};

export const DEAL_TYPE_LABELS = {
  percent: 'نسبة خصم',
  fixed: 'خصم بمبلغ ثابت',
  bogo: 'اشتري واحصل على الثاني',
  free_item: 'عنصر مجاني',
  bundle: 'عرض باقة',
};

export const DEAL_TYPES = Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
