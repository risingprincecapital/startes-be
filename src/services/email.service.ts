import nodemailer from 'nodemailer';
import { emailQueue } from '../config/queue';
import { emailTemplateEngine, EmailTemplateData } from './emailTemplate.service';
import { Notification } from '../models/notification.model';

export interface SendEmailOptions {
    to: string;
    subject: string;
    template: string;
    data: EmailTemplateData;
    userId?: string;
    category?: 'business' | 'document' | 'payment' | 'system' | 'custom';
}

export interface SendCustomEmailOptions {
    to: string;
    subject: string;
    htmlContent: string;
    data: EmailTemplateData;
    userId?: string;
}

export class EmailService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }

    /**
     * Queue an email to be sent
     */
    async queueEmail(options: SendEmailOptions): Promise<void> {
        await emailQueue.add('send-email', options, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });

        // Create notification record
        if (options.userId) {
            await Notification.create({
                userId: options.userId,
                type: 'email',
                category: options.category || 'system',
                title: options.subject,
                message: `Email sent to ${options.to}`,
                data: options.data,
                status: 'pending',
            });
        }
    }

    /**
     * Queue a custom email (for admin panel)
     */
    async queueCustomEmail(options: SendCustomEmailOptions): Promise<void> {
        await emailQueue.add('send-custom-email', options, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000,
            },
        });

        // Create notification record
        if (options.userId) {
            await Notification.create({
                userId: options.userId,
                type: 'email',
                category: 'custom',
                title: options.subject,
                message: `Custom email sent to ${options.to}`,
                status: 'pending',
            });
        }
    }

    /**
     * Actually send the email (called by worker)
     */
    async sendEmail(options: SendEmailOptions): Promise<void> {
        try {
            // Render template
            const html = emailTemplateEngine.render(options.template, {
                ...options.data,
                frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
                year: new Date().getFullYear(),
                subject: options.subject,
            });

            // Send email
            const info = await this.transporter.sendMail({
                from: `"StartEase" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: options.to,
                subject: options.subject,
                html,
            });

            console.log(`✅ Email sent: ${info.messageId}`);

            // Update notification status
            if (options.userId) {
                await Notification.findOneAndUpdate(
                    {
                        userId: options.userId,
                        title: options.subject,
                        status: 'pending',
                    },
                    {
                        status: 'sent',
                        sentAt: new Date(),
                    },
                    { sort: { createdAt: -1 } }
                );
            }
        } catch (error: any) {
            console.error('❌ Email send failed:', error);

            // Update notification status
            if (options.userId) {
                await Notification.findOneAndUpdate(
                    {
                        userId: options.userId,
                        title: options.subject,
                        status: 'pending',
                    },
                    {
                        status: 'failed',
                        failureReason: error.message,
                    },
                    { sort: { createdAt: -1 } }
                );
            }

            throw error;
        }
    }

    /**
     * Send custom email (called by worker)
     */
    async sendCustomEmail(options: SendCustomEmailOptions): Promise<void> {
        try {
            // Render custom content with base template
            const html = emailTemplateEngine.renderCustom(options.htmlContent, {
                ...options.data,
                frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
                year: new Date().getFullYear(),
                subject: options.subject,
            });

            // Send email
            const info = await this.transporter.sendMail({
                from: `"StartEase" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: options.to,
                subject: options.subject,
                html,
            });

            console.log(`✅ Custom email sent: ${info.messageId}`);

            // Update notification status
            if (options.userId) {
                await Notification.findOneAndUpdate(
                    {
                        userId: options.userId,
                        title: options.subject,
                        status: 'pending',
                    },
                    {
                        status: 'sent',
                        sentAt: new Date(),
                    },
                    { sort: { createdAt: -1 } }
                );
            }
        } catch (error: any) {
            console.error('❌ Custom email send failed:', error);

            // Update notification status
            if (options.userId) {
                await Notification.findOneAndUpdate(
                    {
                        userId: options.userId,
                        title: options.subject,
                        status: 'pending',
                    },
                    {
                        status: 'failed',
                        failureReason: error.message,
                    },
                    { sort: { createdAt: -1 } }
                );
            }

            throw error;
        }
    }

    /**
     * Send business formation email
     */
    async sendBusinessFormationEmail(to: string, data: EmailTemplateData, userId?: string): Promise<void> {
        await this.queueEmail({
            to,
            subject: `Welcome to StartEase - ${data.businessName} Formation Started`,
            template: 'business-formation',
            data,
            userId,
            category: 'business',
        });
    }

    /**
     * Send document approved email
     */
    async sendDocumentApprovedEmail(to: string, data: EmailTemplateData, userId?: string): Promise<void> {
        await this.queueEmail({
            to,
            subject: `Document Approved - ${data.documentName}`,
            template: 'document-approved',
            data,
            userId,
            category: 'document',
        });
    }

    /**
     * Send document rejected email
     */
    async sendDocumentRejectedEmail(to: string, data: EmailTemplateData, userId?: string): Promise<void> {
        await this.queueEmail({
            to,
            subject: `Document Needs Attention - ${data.documentName}`,
            template: 'document-rejected',
            data,
            userId,
            category: 'document',
        });
    }

    /**
     * Send payment success email
     */
    async sendPaymentSuccessEmail(to: string, data: EmailTemplateData, userId?: string): Promise<void> {
        await this.queueEmail({
            to,
            subject: 'Payment Successful - Thank You!',
            template: 'payment-success',
            data,
            userId,
            category: 'payment',
        });
    }

    /**
     * Send payment failed email
     */
    async sendPaymentFailedEmail(to: string, data: EmailTemplateData, userId?: string): Promise<void> {
        await this.queueEmail({
            to,
            subject: 'Payment Failed - Action Required',
            template: 'payment-failed',
            data,
            userId,
            category: 'payment',
        });
    }
}

export const emailService = new EmailService();
