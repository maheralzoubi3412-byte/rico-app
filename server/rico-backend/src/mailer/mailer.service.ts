import { Injectable } from '@nestjs/common';

const SUBJECT_BY_PURPOSE: Record<'invite' | 'reset', string> = {
  invite: 'دعوة لإدارة نشاطك التجاري في ريكو',
  reset: 'إعادة تعيين كلمة المرور - لوحة ريكو',
};

const INTRO_BY_PURPOSE: Record<'invite' | 'reset', string> = {
  invite: 'تمت دعوتك لإدارة نشاطك التجاري على ريكو. اضغط الرابط التالي لتعيين كلمة مرورك (صالح لمدة 24 ساعة):',
  reset: 'اضغط الرابط التالي لإعادة تعيين كلمة مرورك (صالح لمدة 24 ساعة):',
};

// Sends invite/password-reset emails via Resend. If RESEND_API_KEY isn't set
// (local dev), falls back to logging the link to the console instead of
// failing — lets the whole auth flow be tested end-to-end without a real
// email account. Requires a verified sending domain (SPF/DKIM/DMARC) in
// production for links to reliably land in inboxes, not spam.
@Injectable()
export class MailerService {
  async sendPasswordSetupEmail({
    email,
    link,
    purpose,
  }: {
    email: string;
    link: string;
    purpose: 'invite' | 'reset';
  }): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.log(`[dev email fallback] ${purpose} link for ${email}: ${link}`);
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
        subject: SUBJECT_BY_PURPOSE[purpose],
        html: `<p>مرحباً،</p><p>${INTRO_BY_PURPOSE[purpose]}</p><p><a href="${link}">${link}</a></p><p>إذا لم تطلب هذا، تجاهل هذه الرسالة.</p>`,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`resend_error:${response.status}:${text.slice(0, 200)}`);
    }
  }
}
