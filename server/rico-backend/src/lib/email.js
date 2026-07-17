// Sends magic-link login emails via Resend. If RESEND_API_KEY isn't set
// (local dev), falls back to logging the link to the console instead of
// failing — lets the whole auth flow be tested end-to-end without a real
// email account. Requires a verified sending domain (SPF/DKIM/DMARC) in
// production for links to reliably land in inboxes, not spam.
async function sendMagicLinkEmail({ email, link }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[dev email fallback] Magic link for ${email}: ${link}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'Rico <onboarding@resend.dev>',
      to: [email],
      subject: 'رابط تسجيل الدخول إلى لوحة ريكو',
      html: `<p>مرحباً،</p><p>اضغط الرابط التالي لتسجيل الدخول إلى لوحة إدارة نشاطك التجاري في ريكو (صالح لمدة 15 دقيقة):</p><p><a href="${link}">${link}</a></p><p>إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`resend_error:${response.status}:${text.slice(0, 200)}`);
  }
}

export { sendMagicLinkEmail };
