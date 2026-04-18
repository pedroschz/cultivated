import { defineSecret } from 'firebase-functions/params';
import nodemailer from 'nodemailer';

export const GMAIL_USER = defineSecret('GMAIL_USER'); // e.g. notifications@example.com
export const GMAIL_PASS = defineSecret('GMAIL_PASS'); // Gmail App Password only

// Optional human-friendly From line, e.g. `Acme Team <notifications@example.com>`.
// Falls back to the raw GMAIL_USER address if unset.
export const EMAIL_FROM = defineSecret('EMAIL_FROM');

export const EMAIL_SECRETS = [GMAIL_USER, GMAIL_PASS, EMAIL_FROM] as const;

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

/**
 * Optional safety net for staging / dev environments. When the
 * `TEST_EMAIL_OVERRIDE` env var is set on the Functions runtime, every
 * outgoing email is rerouted to that address instead of the real
 * recipient(s) and the original recipient list is prefixed into the
 * subject so it's easy to verify routing without spamming users.
 *
 * Set with: `firebase functions:config:set` is not used (we read straight
 * from `process.env`); add to `.env` / Functions env config:
 *
 *   TEST_EMAIL_OVERRIDE=qa@example.com
 *
 * Leave unset in production.
 */
function resolveTestOverride(): string | null {
  const v = (process.env.TEST_EMAIL_OVERRIDE || '').trim();
  return v.length > 0 ? v : null;
}

export async function sendEmailViaGmail(input: SendEmailInput): Promise<{ ok: true; id: string }>
{
  const user = GMAIL_USER.value();
  const pass = GMAIL_PASS.value();
  if (!user || !pass) {
    throw new Error('Missing Gmail credentials (GMAIL_USER/GMAIL_PASS)');
  }
  const from = (() => {
    try { return EMAIL_FROM.value() || user; } catch { return user; }
  })();

  const override = resolveTestOverride();
  const originalTo = Array.isArray(input.to) ? input.to.join(',') : input.to;
  const finalTo = override ?? originalTo;
  const finalSubject = override ? `[TEST → ${originalTo}] ${input.subject}` : input.subject;
  const finalCc = override ? undefined : (input.cc ? (Array.isArray(input.cc) ? input.cc.join(',') : input.cc) : undefined);
  const finalBcc = override ? undefined : (input.bcc ? (Array.isArray(input.bcc) ? input.bcc.join(',') : input.bcc) : undefined);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  const info = await transporter.sendMail({
    from,
    to: finalTo,
    subject: finalSubject,
    text: input.text,
    html: input.html,
    cc: finalCc,
    bcc: finalBcc,
    replyTo: input.replyTo,
  });

  return { ok: true, id: info.messageId };
}

export const Email = {
  send: sendEmailViaGmail,
};


