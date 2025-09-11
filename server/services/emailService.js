const nodemailer = require('nodemailer');
const path = require('path');

class EmailService {
    constructor() {
        this.transporter = null;
        this.init();
    }

    async init() {
        try {
            // For development, create test account with Ethereal
            const testAccount = await nodemailer.createTestAccount();
            
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass
                }
            });
            
            console.log('✅ Email service initialized with test account');
        } catch (error) {
            console.error('❌ Email service initialization failed:', error);
            // Fallback to basic configuration
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: 'ethereal.user@ethereal.email',
                    pass: 'ethereal.pass'
                }
            });
        }

        // For Gmail (uncomment and configure for production):
        /*
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_APP_PASSWORD
            }
        });
        */
    }

    async sendFamilyInvitation(invitationData) {
        const {
            recipientEmail,
            recipientName,
            familyGroupName,
            familyGroupDescription,
            inviterName,
            inviterEmail,
            role,
            invitationToken,
            expiresAt
        } = invitationData;

        const invitationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invitation?token=${invitationToken}`;
        
        const htmlContent = this.generateInvitationEmailHTML({
            recipientName,
            familyGroupName,
            familyGroupDescription,
            inviterName,
            role,
            invitationUrl,
            expiresAt
        });

        const mailOptions = {
            from: `"SecureGov Family" <${process.env.EMAIL_FROM || 'noreply@securegov.com'}>`,
            to: recipientEmail,
            subject: `Family Group Invitation: ${familyGroupName}`,
            html: htmlContent,
            text: this.generateInvitationEmailText({
                recipientName,
                familyGroupName,
                inviterName,
                role,
                invitationUrl,
                expiresAt
            })
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Family invitation email sent:', info.messageId);
            
            // For development with Ethereal, log the preview URL
            if (process.env.NODE_ENV !== 'production') {
                console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
            }
            
            return {
                success: true,
                messageId: info.messageId,
                previewUrl: nodemailer.getTestMessageUrl(info)
            };
        } catch (error) {
            console.error('Failed to send family invitation email:', error);
            throw new Error('Failed to send invitation email');
        }
    }

    generateInvitationEmailHTML(data) {
        const { recipientName, familyGroupName, familyGroupDescription, inviterName, role, invitationUrl, expiresAt } = data;
        
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Family Group Invitation</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #f4f4f4;
                }
                .email-container {
                    background: white;
                    border-radius: 10px;
                    padding: 30px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #2563eb;
                    margin-bottom: 10px;
                }
                .title {
                    color: #1f2937;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                .subtitle {
                    color: #6b7280;
                    font-size: 16px;
                }
                .content {
                    margin: 30px 0;
                }
                .family-info {
                    background: #f8fafc;
                    border-left: 4px solid #2563eb;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 0 8px 8px 0;
                }
                .family-name {
                    font-size: 20px;
                    font-weight: bold;
                    color: #1f2937;
                    margin-bottom: 8px;
                }
                .family-description {
                    color: #6b7280;
                    margin-bottom: 10px;
                }
                .role-badge {
                    display: inline-block;
                    background: #dbeafe;
                    color: #1e40af;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                }
                .cta-button {
                    display: inline-block;
                    background: #2563eb;
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                    margin: 20px 0;
                    text-align: center;
                }
                .cta-button:hover {
                    background: #1d4ed8;
                }
                .expiry-info {
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                    text-align: center;
                    color: #6b7280;
                    font-size: 14px;
                }
                .security-note {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    font-size: 14px;
                    color: #4b5563;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <div class="logo">🛡️ SecureGov</div>
                    <h1 class="title">Family Group Invitation</h1>
                    <p class="subtitle">You've been invited to join a family group</p>
                </div>

                <div class="content">
                    <p>Hello ${recipientName || 'there'},</p>
                    
                    <p><strong>${inviterName}</strong> has invited you to join their family group on SecureGov.</p>

                    <div class="family-info">
                        <div class="family-name">${familyGroupName}</div>
                        ${familyGroupDescription ? `<div class="family-description">${familyGroupDescription}</div>` : ''}
                        <div>Your role: <span class="role-badge">${role}</span></div>
                    </div>

                    <p>As a member of this family group, you'll be able to:</p>
                    <ul>
                        <li>Share important documents securely</li>
                        <li>Access family members' shared documents</li>
                        <li>Collaborate on family-related paperwork</li>
                        <li>Maintain organized family records</li>
                    </ul>

                    <div style="text-align: center;">
                        <a href="${invitationUrl}" class="cta-button">Accept Invitation</a>
                    </div>

                    <div class="expiry-info">
                        <strong>⏰ Important:</strong> This invitation expires on ${new Date(expiresAt).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}.
                    </div>

                    <div class="security-note">
                        <strong>🔒 Security Note:</strong> This invitation is personal and secure. Only you can accept it using your registered email address.
                    </div>

                    <p>If you don't want to join this family group, you can safely ignore this email.</p>
                </div>

                <div class="footer">
                    <p>This email was sent by SecureGov Family Groups</p>
                    <p>If you have any questions, please contact our support team.</p>
                    <p style="margin-top: 20px;">
                        <small>This is an automated message. Please do not reply to this email.</small>
                    </p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateInvitationEmailText(data) {
        const { recipientName, familyGroupName, inviterName, role, invitationUrl, expiresAt } = data;
        
        return `
SecureGov Family Group Invitation

Hello ${recipientName || 'there'},

${inviterName} has invited you to join their family group "${familyGroupName}" on SecureGov.

Your role: ${role}

As a member of this family group, you'll be able to:
- Share important documents securely
- Access family members' shared documents  
- Collaborate on family-related paperwork
- Maintain organized family records

To accept this invitation, click the link below:
${invitationUrl}

IMPORTANT: This invitation expires on ${new Date(expiresAt).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
})}.

Security Note: This invitation is personal and secure. Only you can accept it using your registered email address.

If you don't want to join this family group, you can safely ignore this email.

---
This email was sent by SecureGov Family Groups
This is an automated message. Please do not reply to this email.
        `;
    }

    async sendWelcomeEmail(memberData) {
        const { email, name, familyGroupName, role } = memberData;

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
                .footer { background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🛡️ Welcome to SecureGov</h1>
                </div>
                <div class="content">
                    <h2>Welcome to ${familyGroupName}!</h2>
                    <p>Hello ${name},</p>
                    <p>You have successfully joined the family group <strong>${familyGroupName}</strong> as a <strong>${role}</strong>.</p>
                    <p>You can now start sharing and accessing family documents securely.</p>
                    <p>Visit your dashboard to get started!</p>
                </div>
                <div class="footer">
                    <p>SecureGov Family Groups</p>
                </div>
            </div>
        </body>
        </html>
        `;

        const mailOptions = {
            from: `"SecureGov Family" <${process.env.EMAIL_FROM || 'noreply@securegov.com'}>`,
            to: email,
            subject: `Welcome to ${familyGroupName}!`,
            html: htmlContent
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent:', info.messageId);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            // Don't throw error for welcome email failure
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();
