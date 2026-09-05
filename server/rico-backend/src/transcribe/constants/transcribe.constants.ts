// Speech-to-text constants. Sibling of classify/compose: same Groq key, a
// different Groq endpoint (audio/transcriptions rather than chat/completions).

export const STT_MODEL = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';

// Whisper accepts an optional `prompt` that biases decoding toward an
// expected vocabulary. Rico's whole input space is "find me a nearby X" in
// Saudi dialect, so seeding the category words and the brand names users
// actually say turns a lot of near-misses ("أقرب سيدلية") into exact
// category matches the classifier can resolve.
export const STT_VOCAB_HINT =
  'ريكو، أقرب مطعم، كافيه، قهوة، صيدلية، بقالة، سوبرماركت، محطة بنزين، فندق، ' +
  'صراف آلي، بنك، مستشفى، عيادة، نادي رياضي، مول، حلاق، مغسلة، ورشة سيارات، ' +
  'عروض، خصومات، أرخص، أقرب، مفتوح الحين، أفضل تقييم، ' +
  'ستاربكس، دانكن، البيك، كودو، هرفي، بنده، الدانوب، النهدي، الدواء';

// Hard ceiling on the uploaded clip. The client caps recording at 30s of
// 24kbps mono AAC (~90KB), so anything near this is not a Rico recording.
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

// Whisper is trained on subtitle corpora and, given silence or pure noise,
// reliably emits leftovers from that training set rather than nothing at
// all. Blanking these is what keeps an accidental mic tap from turning
// into a confident search for "اشتركوا في القناة".
const SILENCE_HALLUCINATIONS = [
  'اشتركوا في القناة',
  'اشترك في القناة',
  'ترجمة نانسي قنقر',
  'ترجمة',
  'شكرا لمشاهدتكم',
  'شكراً لمشاهدتكم',
  'الحمد لله',
  'المزيد من الفيديوهات',
  'أراكم في الفيديو القادم',
  'thank you',
  'thanks for watching',
];

// Punctuation-insensitive match: Whisper varies the trailing ./!/؟ and the
// hamza/alef spelling between runs, so compare on a stripped form.
function normalizeForCompare(text: string): string {
  return text
    .replace(/[.،,!?؟:؛"'؟۔]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isLikelySilence(text: string): boolean {
  const normalized = normalizeForCompare(text);
  if (!normalized) return true;
  return SILENCE_HALLUCINATIONS.some((phrase) => normalized === normalizeForCompare(phrase));
}
