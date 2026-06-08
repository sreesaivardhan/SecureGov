'use strict';

/**
 * emailService.js
 *
 * Nodemailer wrapper for family invitations.
 *
 * Graceful fallback: if EMAIL_USER / EMAIL_APP_PASSWORD are not set,
 * invitation links are printed to the console instead of crashing.
 * This means Day 3 works in local dev even without a Gmail App Password.
 *
 * Gmail App Password setup:
 *   Google Account → Security → 2-Step Verification → App Passwords
 *   Generate a password for "Mail" → paste as EMAIL_APP_PASSWORD in .env
 */

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;

  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    return null; // signal fallback to caller
  }

  _transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_APP_PASSWORD,
    },
  });

  return _transporter;
}

/**
 * Send a family group invitation email.
 *
 * @param {{
 *   to:          string,   // invitee email
 *   inviterName: string,   // display name of person sending the invite
 *   groupName:   string,   // family group name
 *   acceptUrl:   string,   // full URL to accept page
 *   rejectUrl:   string,   // full URL to reject page
 * }} opts
 * @returns {{ sent: boolean, fallback?: boolean }}
 */
async function sendFamilyInvitationEmail({ to, inviterName, groupName, acceptUrl, rejectUrl }) {
  const transport = getTransporter();

  if (!transport) {
    // ── Console fallback ──────────────────────────────────────────────────────
    console.log('\n' + '─'.repeat(60));
    console.log('📧  [EMAIL FALLBACK] — set EMAIL_USER + EMAIL_APP_PASSWORD to send real emails');
    console.log(`    To:          ${to}`);
    console.log(`    Inviter:     ${inviterName}`);
    console.log(`    Group:       ${groupName}`);
    console.log(`    Accept URL:  ${acceptUrl}`);
    console.log(`    Reject URL:  ${rejectUrl}`);
    console.log('─'.repeat(60) + '\n');
    return { sent: false, fallback: true };
  }

  const fromAddress = process.env.EMAIL_FROM || `SecureGov <${process.env.EMAIL_USER}>`;

  await transport.sendMail({
    from:    fromAddress,
    to,
    subject: `${inviterName} invited you to "${groupName}" on SecureGov`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
        <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <div style="background:linear-gradient(135deg,#1a56db,#1e40af);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">🛡️ SecureGov</h1>
          </div>
          <div style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">You've been invited!</h2>
            <p style="color:#374151;line-height:1.6;margin:0 0 12px;">
              <strong>${inviterName}</strong> has invited you to join the family group
              <strong>"${groupName}"</strong> on SecureGov.
            </p>
            <p style="color:#6b7280;line-height:1.6;margin:0 0 32px;font-size:14px;">
              SecureGov lets families securely store and share important documents
              like Aadhaar cards, PAN cards, passports, and more.
            </p>
            <div style="display:flex;gap:12px;margin-bottom:32px;">
              <a href="${acceptUrl}"
                 style="display:inline-block;background:#1a56db;color:#ffffff;padding:14px 28px;
                        text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                Accept Invitation
              </a>
              <a href="${rejectUrl}"
                 style="display:inline-block;background:#f3f4f6;color:#374151;padding:14px 28px;
                        text-decoration:none;border-radius:8px;font-size:15px;margin-left:12px;">
                Decline
              </a>
            </div>
            <p style="color:#9ca3af;font-size:13px;margin:0;">
              This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  });

  return { sent: true };
}

module.exports = { sendFamilyInvitationEmail };
