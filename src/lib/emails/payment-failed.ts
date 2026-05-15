import { emailButton, emailLayout, escapeHtml } from './_layout';
import { formatPrice } from '@/lib/utils';

export function paymentFailedEmail(input: {
  name: string | null;
  amountDue: number;
  currency: string;
  billingUrl: string;
  hostedInvoiceUrl: string | null;
}) {
  const name = input.name ?? 'there';
  const amount = formatPrice(input.amountDue, input.currency);
  const link = input.hostedInvoiceUrl ?? input.billingUrl;

  const subject = `Action needed: ShieldVPN payment of ${amount} failed`;
  const text = [
    `Hi ${name},`,
    '',
    `We tried to charge ${amount} for your ShieldVPN subscription, but the payment was declined.`,
    '',
    'Most often this is a card expiration or insufficient funds. Update your payment method and retry from your billing page:',
    '',
    link,
    '',
    "If this isn't resolved within a few days, Stripe will retry automatically. After several failed retries your subscription will be paused and your VPN tunnels disabled.",
    '',
    '— ShieldVPN',
  ].join('\n');

  const html = emailLayout({
    preheader: `We couldn't charge ${amount} — please update your payment method.`,
    heading: 'Your payment failed',
    body: `
      <p>Hi ${escapeHtml(name)},</p>
      <p>We tried to charge <strong>${escapeHtml(amount)}</strong> for your ShieldVPN subscription, but the payment was declined.</p>
      <p>Most often this is a card expiration or insufficient funds. Update your payment method and retry below.</p>
      <p style="margin:24px 0;">${emailButton('Fix payment method', link)}</p>
      <p style="font-size:13px;color:#64748b;">Stripe will automatically retry over the next few days. After several failed retries your subscription will be paused and your VPN tunnels disabled — please act soon.</p>
    `,
  });

  return { subject, html, text };
}
