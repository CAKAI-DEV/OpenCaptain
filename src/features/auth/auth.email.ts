import { Resend } from 'resend';
import { env } from '../../shared/lib/env';
import { logger } from '../../shared/lib/logger';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendMagicLink(email: string, token: string): Promise<boolean> {
  const magicLinkUrl = `${env.APP_URL}/api/v1/auth/magic-link/verify?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: 'BlockBot <noreply@resend.dev>',
      to: email,
      subject: 'Sign in to BlockBot',
      html: `
        <h1>Sign in to BlockBot</h1>
        <p>Click the link below to sign in. This link expires in 15 minutes.</p>
        <a href="${magicLinkUrl}">Sign in to BlockBot</a>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    if (error) {
      logger.error({ error, email }, 'Failed to send magic link email');
      return false;
    }

    logger.info({ email }, 'Magic link email sent');
    return true;
  } catch (err) {
    logger.error({ err, email }, 'Exception sending magic link email');
    return false;
  }
}
