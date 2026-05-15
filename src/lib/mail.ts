import { Resend } from 'resend';
import { env } from './env';
import { logger } from './logger';

const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * Dispatch a transactional email. If RESEND_API_KEY is not configured,
 * the email is logged at info level instead of being sent — keeps local
 * dev runs working without surprising the operator with hard failures,
 * but is a misconfiguration in production (the env validator only warns
 * about it indirectly via .optional()).
 *
 * Errors during send are caught and logged, NEVER re-thrown — a failing
 * SMTP provider must not take down user-facing flows like registration.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!client) {
    logger.info(
      { to: input.to, subject: input.subject, dev: true },
      'Email not sent — RESEND_API_KEY missing; payload logged below at debug level',
    );
    logger.debug({ text: input.text }, 'Email body (text)');
    return;
  }

  try {
    await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
    });
    logger.info({ to: input.to, subject: input.subject }, 'Email sent');
  } catch (err) {
    logger.error(
      { err, to: input.to, subject: input.subject },
      'Email send failed; user flow continues',
    );
  }
}
