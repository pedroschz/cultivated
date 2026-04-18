import { defineString } from 'firebase-functions/params';

const APP_BASE_URL = defineString('APP_BASE_URL');

function getBaseUrl(): string {
  try {
    const v = APP_BASE_URL.value();
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) return s;
  } catch {
    // Param may be unset or invalid at runtime; fall back to production URL
  }
  return 'http://localhost:3000';
}

function shellHtml({ title, bodyHtml, preheader }: { title: string; bodyHtml: string; preheader?: string }): string {
  const previewText = preheader ? `
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(preheader)}
      &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
  ` : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <!--[if mso]>
    <style type="text/css">
      body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
    </style>
    <![endif]-->
  </head>
  <body style="margin:0;padding:0;background-color:#F7F7F7;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#4B4B4B;line-height:1.6;">
    ${previewText}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F7F7;width:100%;table-layout:fixed;">
      <tr>
        <td align="center" style="padding:40px 0;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
            
            <!-- Header -->
            <tr>
              <td style="padding:32px 40px;background:#FFFFFF;border-bottom:1px solid #E5E5E5;">
                <a href="${getBaseUrl()}" style="text-decoration:none;display:inline-block;">
                  <img src="${getBaseUrl()}/text-logo.png" alt="CultivatED" height="28" style="display:block;border:0;outline:none;text-decoration:none;" />
                </a>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px 40px;background:#FFFFFF;">
                ${bodyHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:32px 40px;background:#F7F7F7;border-top:1px solid #E5E5E5;text-align:center;">
                <p style="margin:0 0 12px 0;color:#AFAFAF;font-size:12px;line-height:1.5;">
                  You received this email because you signed up for CultivatED.
                  <br />
                  To stop receiving these emails, you can <a href="${getBaseUrl()}/settings?tab=notifications" style="color:#1CB0F6;text-decoration:none;">update your notification settings</a>.
                </p>
                <p style="margin:0;color:#AFAFAF;font-size:12px;">
                  &copy; ${new Date().getFullYear()} CultivatED
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function ctaButton(label: string, url: string, primary = true): string {
  // Primary: Mask Green (#89E219) with dark green bottom border (#6EB514)
  // Secondary: Muted/White with border
  const bg = primary ? '#89E219' : '#FFFFFF';
  const color = primary ? '#FFFFFF' : '#4B4B4B';
  const borderBottom = primary ? '4px solid #6EB514' : '2px solid #E5E5E5';
  // Add a slight top border for 3D effect on secondary buttons if needed, but primary relies on bottom border.
  const extraStyles = primary 
    ? '' 
    : 'border:2px solid #E5E5E5;border-bottom:4px solid #E5E5E5;';

  return `<a href="${url}" target="_blank" style="display:inline-block;background:${bg};color:${color};text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:16px;line-height:1.5;text-align:center;mso-padding-alt:0;border-bottom:${borderBottom};${extraStyles}">
    <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%; mso-text-raise: 30pt">&nbsp;</i><![endif]-->
    <span style="mso-text-raise: 15pt;">${escapeHtml(label)}</span>
    <!--[if mso]><i style="letter-spacing: 25px; mso-font-width: -100%">&nbsp;</i><![endif]-->
  </a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function registrationEmailTemplate(params: { name?: string | null }): { subject: string; html: string; text: string } {
  const subject = 'Welcome to CultivatED!';
  const greetName = params.name?.trim() || 'friend';
  const preheader = 'You’re in. Let’s start your mastery journey.';
  
  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#4B4B4B;letter-spacing:-0.025em;">Welcome, ${escapeHtml(greetName)}!</h1>
    <p style="margin:0 0 24px 0;color:#777777;font-size:16px;line-height:1.6;">
      Thanks for joining CultivatED. You’ve taken the first step towards mastering your subjects through consistent, deliberate practice.
    </p>
    <div style="background:#F7F7F7;border:2px solid #E5E5E5;border-radius:16px;padding:24px;margin-bottom:32px;">
      <h2 style="margin:0 0 12px 0;font-size:18px;color:#4B4B4B;font-weight:700;">Here is how to get started:</h2>
      <ul style="margin:0;padding:0 0 0 20px;color:#777777;font-size:16px;">
        <li style="margin-bottom:8px;">Start a quick practice session to set your baseline.</li>
        <li style="margin-bottom:8px;">Invite a friend to challenge each other.</li>
        <li style="margin-bottom:0;">Track your progress on your dashboard.</li>
      </ul>
    </div>
    <div style="margin-bottom:32px;text-align:center;">
      ${ctaButton('Start Practicing Now', `${getBaseUrl()}/practice`)}
    </div>
    <p style="margin:0;color:#AFAFAF;font-size:14px;text-align:center;">
      Looking for study buddies? <a href="${getBaseUrl()}/friends" style="color:#1CB0F6;text-decoration:none;">Find friends here</a>.
    </p>
  `;
  
  const html = shellHtml({ title: subject, bodyHtml, preheader });
  const text = `Welcome, ${greetName}!

Thanks for joining CultivatED.

Here is how to get started:
1. Start a quick practice session.
2. Invite a friend.
3. Track your progress.

Start Practicing: ${getBaseUrl()}/practice
Find Friends: ${getBaseUrl()}/friends`;

  return { subject, html, text };
}

export function customAdminEmailTemplate(params: { subject: string; bodyHtml: string; text?: string }): { subject: string; html: string; text: string } {
  const subject = params.subject || 'CultivatED Update';
  const bodyHtml = `
    <div style="font-size:16px;line-height:1.6;color:#4B4B4B;">${params.bodyHtml}</div>
  `;
  const html = shellHtml({ title: subject, bodyHtml });
  const text = params.text || 'Open this message in an HTML-capable email client.';
  return { subject, html, text };
}

export function friendRequestEmailTemplate(params: {
  toName?: string | null;
  fromName?: string | null;
  fromUsername?: string | null;
}): { subject: string; html: string; text: string } {
  const fromDisplay = params.fromName?.trim() || 'A CultivatED user';
  const subject = `${fromDisplay} sent you a friend request`;
  const preheader = `${fromDisplay} wants to connect with you.`;

  const bodyHtml = `
    <div style="text-align:center;">
      <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#4B4B4B;">New Friend Request</h1>
      <p style="margin:0 0 32px 0;color:#777777;font-size:16px;line-height:1.6;">
        <strong style="color:#4B4B4B;">${escapeHtml(fromDisplay)}</strong>${params.fromUsername ? ` (@${escapeHtml(params.fromUsername)})` : ''} wants to be friends on CultivatED.
      </p>
      <div style="margin-bottom:32px;">
        ${ctaButton('View Request', `${getBaseUrl()}/friends`)}
      </div>
      <p style="margin:0;color:#AFAFAF;font-size:14px;">
        Connecting with friends helps keep you motivated!
      </p>
    </div>
  `;
  const html = shellHtml({ title: subject, bodyHtml, preheader });
  const text = `Friend request from ${fromDisplay}${params.fromUsername ? ` (@${params.fromUsername})` : ''}

View Request: ${getBaseUrl()}/friends`;

  return { subject, html, text };
}

export function reminderEmailTemplate(params: {
  name?: string | null;
  reason: 'inactivity' | 'calendar';
  daysInactive?: number;
}): { subject: string; html: string; text: string } {
  const greetName = params.name?.trim() || 'Friend';
  
  let subject = '';
  let headline = '';
  let copy = '';
  let preheader = '';
  
  if (params.reason === 'calendar') {
    subject = 'It’s time to practice!';
    preheader = 'Your scheduled session starts now.';
    headline = 'Time for your session';
    copy = 'You scheduled this time to practice. Consistency is key to mastery. Let’s get to it!';
  } else {
    // Inactivity logic
    const days = params.daysInactive || 3;
    if (days >= 7) {
      subject = 'We miss you!';
      preheader = `It’s been ${days} days. Come back and keep learning.`;
      headline = 'We miss you!';
      copy = `It’s been ${days} days since your last session. Don’t let your progress fade away. A quick 10-minute session is all it takes to get back on track.`;
    } else {
      subject = 'Keep your streak alive';
      preheader = 'Don’t break the chain. Practice today.';
      headline = 'Keep the momentum going';
      copy = `You haven’t practiced in ${days} days. Consistency builds mastery. Jump back in for a quick session today.`;
    }
  }

  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#4B4B4B;">${escapeHtml(headline)}</h1>
    <p style="margin:0 0 32px 0;color:#777777;font-size:16px;line-height:1.6;">
      Hi ${escapeHtml(greetName)},
      <br/><br/>
      ${escapeHtml(copy)}
    </p>
    
    <div style="margin-bottom:32px;">
      <p style="margin:0 0 16px 0;font-size:14px;color:#AFAFAF;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Pick a session:</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;">
        <div style="flex:1;min-width:140px;">
          ${ctaButton('Math (10m)', `${getBaseUrl()}/practice?start=10&subject=math`)}
        </div>
        <div style="flex:1;min-width:140px;">
          ${ctaButton('R&W (10m)', `${getBaseUrl()}/practice?start=10&subject=rw`)}
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;">
        <div style="flex:1;min-width:140px;">
          ${ctaButton('Math (20m)', `${getBaseUrl()}/practice?start=20&subject=math`, false)}
        </div>
        <div style="flex:1;min-width:140px;">
          ${ctaButton('R&W (20m)', `${getBaseUrl()}/practice?start=20&subject=rw`, false)}
        </div>
      </div>
    </div>
  `;

  const html = shellHtml({ title: subject, bodyHtml, preheader });
  const text = `${headline}

Hi ${greetName},

${copy}

Pick a session:
Math (10m): ${getBaseUrl()}/practice?start=10&subject=math
R&W (10m): ${getBaseUrl()}/practice?start=10&subject=rw
Math (20m): ${getBaseUrl()}/practice?start=20&subject=math
R&W (20m): ${getBaseUrl()}/practice?start=20&subject=rw`;

  return { subject, html, text };
}

export function friendProgressEmailTemplate(params: {
  name?: string | null;
  starterName: string;
  starterUsername?: string | null;
}): { subject: string; html: string; text: string } {
  const who = params.starterName || 'Your friend';
  const subject = `${who} is practicing now!`;
  const preheader = `Don’t fall behind. Join ${who} for a session.`;
  
  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#4B4B4B;">${escapeHtml(who)} is practicing!</h1>
    <p style="margin:0 0 32px 0;color:#777777;font-size:16px;line-height:1.6;">
      Your friend just started a practice session. This is the perfect time to join in and keep each other accountable.
    </p>
    <div style="margin-bottom:32px;text-align:center;">
      ${ctaButton('Join Now', `${getBaseUrl()}/practice`)}
    </div>
  `;
  
  const html = shellHtml({ title: subject, bodyHtml, preheader });
  const text = `${who} is practicing!

Your friend just started a practice session. Join now: ${getBaseUrl()}/practice`;

  return { subject, html, text };
}

export function assignmentEmailTemplate(params: {
  title: string;
  dueDate?: string | null;
}): { subject: string; html: string; text: string } {
  const subject = `New Assignment: ${params.title}`;
  const preheader = `You have a new assignment${params.dueDate ? ` due ${params.dueDate}` : ''}.`;
  
  const bodyHtml = `
    <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#4B4B4B;">New Assignment</h1>
    <p style="margin:0 0 24px 0;color:#777777;font-size:16px;line-height:1.6;">
      You have been assigned <strong>${escapeHtml(params.title)}</strong>.
      ${params.dueDate ? `<br><strong>Due:</strong> ${escapeHtml(params.dueDate)}` : ''}
    </p>
    <div style="margin-bottom:32px;text-align:center;">
      ${ctaButton('View Assignment', `${getBaseUrl()}/school`)}
    </div>
  `;

  const html = shellHtml({ title: subject, bodyHtml, preheader });
  const text = `New Assignment: ${params.title}
${params.dueDate ? `Due: ${params.dueDate}` : ''}View it here: ${getBaseUrl()}/school`;  return { subject, html, text };
}