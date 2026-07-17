// Plain HTML+vanilla-JS page (no build step) served directly by the Worker
// at GET /submit-deal. Restaurant owners open this link directly — no app
// install needed. Deliberately dependency-free to avoid adding a frontend
// build pipeline to this repo for one small form.

const SUBMIT_DEAL_HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>أضف عرضك في ريكو</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Tahoma, sans-serif;
    background: #F7F8FA;
    margin: 0;
    padding: 20px 16px 60px;
    color: #1a1a1a;
  }
  .card {
    background: #fff;
    border-radius: 14px;
    padding: 20px;
    max-width: 480px;
    margin: 0 auto;
    box-shadow: 0 1px 8px rgba(0,0,0,0.06);
  }
  h1 { font-size: 20px; color: #0F9D58; margin: 0 0 4px; }
  p.subtitle { color: #666; font-size: 13.5px; margin: 0 0 20px; }
  label { display: block; font-size: 13.5px; font-weight: 600; margin: 14px 0 6px; }
  input, select, textarea {
    width: 100%; padding: 10px 12px; border: 1px solid #E0E0E0;
    border-radius: 8px; font-size: 15px; font-family: inherit;
  }
  textarea { resize: vertical; min-height: 60px; }
  #placeResults { margin-top: 6px; }
  .place-option {
    padding: 10px 12px; border: 1px solid #E0E0E0; border-radius: 8px;
    margin-top: 6px; cursor: pointer; font-size: 14px;
  }
  .place-option:hover { background: #F3F4F6; }
  .place-option small { color: #888; display: block; margin-top: 2px; }
  #selectedPlace {
    display: none; margin-top: 8px; padding: 10px 12px; background: #EAFBF0;
    border: 1px solid #0F9D58; border-radius: 8px; font-size: 14px;
  }
  #dealFields { display: none; margin-top: 8px; }
  button {
    width: 100%; padding: 13px; margin-top: 22px; background: #0F9D58;
    color: #fff; border: none; border-radius: 8px; font-size: 15.5px;
    font-weight: 600; cursor: pointer;
  }
  button:disabled { background: #A9D9BE; cursor: not-allowed; }
  #status { margin-top: 14px; font-size: 14px; text-align: center; }
  #status.success { color: #0F9D58; }
  #status.error { color: #D32F2F; }
  #notFoundNote {
    display: none; margin-top: 8px; font-size: 13px; color: #888;
    background: #F3F4F6; padding: 10px 12px; border-radius: 8px;
  }
</style>
</head>
<body>
<div class="card">
  <h1>أضف عرضك في ريكو</h1>
  <p class="subtitle">عرّف عن عرضك أو خصمك — سيتم مراجعته قبل ظهوره للمستخدمين.</p>

  <label for="placeQuery">١. ابحث عن اسم نشاطك التجاري</label>
  <input id="placeQuery" type="text" placeholder="مثال: مطعم بيت المندي" autocomplete="off">
  <div id="placeResults"></div>
  <div id="notFoundNote">لم نجد نشاطك التجاري ضمن قاعدة بياناتنا حالياً. جرّب اسماً مختصراً أو بلا كلمة "مطعم/كافيه".</div>
  <div id="selectedPlace"></div>

  <div id="dealFields">
    <label for="titleAr">٢. عنوان العرض</label>
    <input id="titleAr" type="text" placeholder="مثال: خصم ٢٥٪ على المندي" maxlength="120">

    <label for="descriptionAr">تفاصيل إضافية (اختياري)</label>
    <textarea id="descriptionAr" maxlength="300" placeholder="مثال: على جميع الأطباق عند الطلب من التطبيق"></textarea>

    <label for="dealType">نوع العرض</label>
    <select id="dealType">
      <option value="percent">نسبة خصم (٪)</option>
      <option value="fixed">خصم بمبلغ ثابت (ر.س)</option>
      <option value="bogo">اشتري واحصل على الثاني مجاناً</option>
      <option value="free_item">عنصر مجاني</option>
      <option value="bundle">عرض باقة</option>
    </select>

    <label for="value">القيمة (اتركه فارغاً إذا لا ينطبق)</label>
    <input id="value" type="number" min="0" max="100000" placeholder="مثال: 25">

    <label for="promoCode">كود خصم (اختياري)</label>
    <input id="promoCode" type="text" maxlength="30">

    <button id="submitBtn">إرسال العرض للمراجعة</button>
  </div>

  <div id="status"></div>
</div>

<script>
  var API_BASE = '';
  var selectedPlaceId = null;
  var debounceTimer = null;

  var placeQuery = document.getElementById('placeQuery');
  var placeResults = document.getElementById('placeResults');
  var notFoundNote = document.getElementById('notFoundNote');
  var selectedPlaceEl = document.getElementById('selectedPlace');
  var dealFields = document.getElementById('dealFields');
  var statusEl = document.getElementById('status');
  var submitBtn = document.getElementById('submitBtn');

  placeQuery.addEventListener('input', function () {
    var q = placeQuery.value.trim();
    clearTimeout(debounceTimer);
    placeResults.innerHTML = '';
    notFoundNote.style.display = 'none';
    if (q.length < 2) return;
    debounceTimer = setTimeout(function () { searchPlaces(q); }, 350);
  });

  function searchPlaces(q) {
    fetch(API_BASE + '/places/search?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var places = data.places || [];
        placeResults.innerHTML = '';
        if (places.length === 0) {
          notFoundNote.style.display = 'block';
          return;
        }
        notFoundNote.style.display = 'none';
        places.forEach(function (p) {
          var el = document.createElement('div');
          el.className = 'place-option';
          el.innerHTML = (p.nameAr || p.name) + (p.city ? '<small>' + p.city + (p.district ? ' — ' + p.district : '') + '</small>' : '');
          el.addEventListener('click', function () { selectPlace(p); });
          placeResults.appendChild(el);
        });
      })
      .catch(function () { notFoundNote.style.display = 'block'; });
  }

  function selectPlace(p) {
    selectedPlaceId = p.id;
    placeResults.innerHTML = '';
    placeQuery.value = '';
    selectedPlaceEl.style.display = 'block';
    selectedPlaceEl.textContent = '✓ ' + (p.nameAr || p.name);
    dealFields.style.display = 'block';
  }

  submitBtn.addEventListener('click', function () {
    var titleAr = document.getElementById('titleAr').value.trim();
    if (!selectedPlaceId) {
      showStatus('اختر نشاطك التجاري أولاً.', 'error');
      return;
    }
    if (!titleAr) {
      showStatus('اكتب عنوان العرض.', 'error');
      return;
    }

    submitBtn.disabled = true;
    var valueRaw = document.getElementById('value').value;

    fetch(API_BASE + '/submit-deal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeId: selectedPlaceId,
        titleAr: titleAr,
        descriptionAr: document.getElementById('descriptionAr').value.trim() || null,
        dealType: document.getElementById('dealType').value,
        value: valueRaw === '' ? null : Number(valueRaw),
        promoCode: document.getElementById('promoCode').value.trim() || null,
      }),
    })
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
      .then(function (res) {
        submitBtn.disabled = false;
        if (res.ok) {
          showStatus('تم استلام عرضك ✅ سيتم مراجعته والتأكد منه قبل نشره للمستخدمين.', 'success');
          dealFields.style.display = 'none';
          selectedPlaceEl.style.display = 'none';
          selectedPlaceId = null;
        } else {
          showStatus('تعذر إرسال العرض (' + (res.body.error || 'خطأ غير معروف') + ')', 'error');
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        showStatus('تعذر الاتصال بالخادم، حاول مرة أخرى.', 'error');
      });
  });

  function showStatus(msg, type) {
    statusEl.textContent = msg;
    statusEl.className = type;
  }
</script>
</body>
</html>`;

function submitDealPageResponse() {
  return new Response(SUBMIT_DEAL_HTML, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export { submitDealPageResponse };
