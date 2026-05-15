import { emailButton, emailLayout, escapeHtml } from './_layout';

export function passwordResetEmail(input: { name: string | null; resetUrl: string }) {
  const name = input.name ?? 'there';
  const subject = 'Reset your ShieldVPN password';
  const text = [
    `Hi ${name},`,
    '',
    "We got a request to reset your ShieldVPN password.",
    'Click the link below to choose a new one — it expires in 1 hour:',
    '',
    input.resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email — your password won't change.",
    '',
    '— ShieldVPN',
  ].join('\n');

  const html = emailLayout({
    preheader: 'Click to reset your password — expires in 1 hour.',
    heading: 'Reset your password',
    body: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>We got a request to reset your ShieldVPN password. Click the button below to choose a new one. The link expires in 1 hour.</p>
      <p style="margin:24px 0;">${emailButton('Reset password', input.resetUrl)}</p>
      <p style="font-size:13px;color:#64748b;">Or copy this URL into your browser:</p>
      <p style="font-size:13px;color:#64748b;word-break:break-all;"><a href="${escapeHtml(input.resetUrl)}" style="color:#1f5af5;">${escapeHtml(input.resetUrl)}</a></p>
      <p style="font-size:13px;color:#64748b;margin-top:24px;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    `,
  });

  return { subject, html, text };
}
