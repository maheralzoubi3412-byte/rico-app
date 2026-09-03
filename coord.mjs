const ARABIC_INDIC_ZERO = 0x0660;

function normalizeNumeric(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u066B,\u060C]/g, '.')
    .replace(/\u066C/g, ''); // فاصل الآلاف العربي
}

function parseCoordinate(raw, { min, max }) {
  const text = normalizeNumeric(raw);
  // Number('') === 0، وصفر إحداثية صالحة تماماً — فلو مرّرنا الفراغ لـNumber
  // لصار الحقل الفارغ نشاطاً على خط الاستواء بدل رسالة خطأ.
  if (text === '') return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}


const expect = [
  ['358862959', -180, 180, null], ['35.8862959', -180, 180, 35.8862959],
  ['35\u066B8862959', -180, 180, 35.8862959], ['35,8862959', -180, 180, 35.8862959],
  ['\u0663\u0665\u066B\u0668\u0668\u0666', -180, 180, 35.886],
  ['', -90, 90, null], ['   ', -90, 90, null], ['abc', -90, 90, null],
  ['91', -90, 90, null], ['0', -90, 90, 0], ['-46.6753', -180, 180, -46.6753],
];
let fail = 0;
for (const [raw, min, max, want] of expect) {
  const got = parseCoordinate(raw, { min, max });
  const ok = got === want;
  if (!ok) fail++;
  console.log(ok ? 'PASS' : 'FAIL', JSON.stringify(raw).padEnd(22), 'got', String(got).padEnd(12), 'want', String(want));
}
console.log(fail === 0 ? '\nall passed' : `\n${fail} FAILED`);
process.exit(fail ? 1 : 0);
