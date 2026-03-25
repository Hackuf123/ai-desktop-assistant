const nodemailer = require('nodemailer');

class EmailHandler {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
    }

    async configure(config) {
        // Configure SMTP transporter
        this.transporter = nodemailer.createTransporter({
            host: config.host || 'smtp.gmail.com',
            port: config.port || 587,
            secure: config.secure || false,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });

        // Verify configuration
        try {
            await this.transporter.verify();
            this.isConfigured = true;
            return { success: true, message: 'Email configuration successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async composeEmail(options) {
        const { to, subject, body, attachments = [] } = options;

        if (!this.isConfigured) {
            return { error: 'Email service not configured' };
        }

        const mailOptions = {
            from: this.transporter.options.auth.user,
            to: to,
            subject: subject,
            html: body, // Assuming HTML body
            attachments: attachments
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            return {
                success: true,
                messageId: info.messageId,
                response: info.response
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async generateEmailContent(prompt, context = {}) {
        // This would integrate with OpenAI to generate email content
        // For now, return a template
        return {
            subject: `Generated: ${prompt}`,
            body: `<p>Dear recipient,</p><p>This is an AI-generated email based on: ${prompt}</p><p>Best regards,<br>AI Assistant</p>`
        };
    }
}

module.exports = EmailHandler;