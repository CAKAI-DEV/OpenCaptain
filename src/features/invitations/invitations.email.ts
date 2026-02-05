import { Resend } from 'resend';
import { env } from '../../shared/lib/env';
import { logger } from '../../shared/lib/logger';

const resend = new Resend(env.RESEND_API_KEY);

export async function sendInvitationEmail(
  email: string,
  token: string,
  orgName: string,
  inviterEmail?: string
): Promise<boolean> {
  const joinUrl = `${env.APP_URL}/join?token=${token}`;

  try {
    const { error } = await resend.emails.send({
      from: 'BlockBot <noreply@resend.dev>',
      to: email,
      subject: `You've been invited to join ${orgName} on BlockBot`,
      html: `
        <h1>You're invited to join ${orgName}</h1>
        ${inviterEmail ? `<p>${inviterEmail} has invited you to join their organization on BlockBot.</p>` : '<p>You have been invited to join an organization on BlockBot.</p>'}
        <p>Click the link below to accept the invitation. This link expires in 7 days.</p>
        <a href="${joinUrl}">Accept Invitation</a>
        <p>If you didn't expect this invitation, you can safely ignore this email.</p>
      `,
    });

    if (error) {
      logger.error({ error, email }, 'Failed to send invitation email');
      return false;
    }

    logger.info({ email, orgName }, 'Invitation email sent');
    return true;
  } catch (err) {
    logger.error({ err, email }, 'Exception sending invitation email');
    return false;
  }
}

export async function sendAddedToOrgEmail(
  email: string,
  orgName: string,
  addedByEmail: string
): Promise<boolean> {
  try {
    const { error } = await resend.emails.send({
      from: 'BlockBot <noreply@resend.dev>',
      to: email,
      subject: `You've been added to ${orgName} on BlockBot`,
      html: `
        <h1>You've been added to ${orgName}</h1>
        <p>${addedByEmail} has added you to their organization on BlockBot.</p>
        <p>You can now access the organization and its projects by logging in to your account.</p>
        <a href="${env.APP_URL}/login">Log in to BlockBot</a>
      `,
    });

    if (error) {
      logger.error({ error, email }, 'Failed to send added-to-org email');
      return false;
    }

    logger.info({ email, orgName }, 'Added-to-org email sent');
    return true;
  } catch (err) {
    logger.error({ err, email }, 'Exception sending added-to-org email');
    return false;
  }
}
