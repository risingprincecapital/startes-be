import { Message } from '@aws-sdk/client-sqs';
import { receiveMessages, deleteMessage, QUEUE_URLS } from '../config/sqs';
import { emailService, SendEmailOptions, SendCustomEmailOptions } from '../services/email.service';

// Email Worker - Polls SQS for email messages
async function processEmailQueue() {
    console.log('📧 Email worker started, polling SQS...');

    while (true) {
        try {
            // Receive messages from SQS (long polling)
            const messages = await receiveMessages(QUEUE_URLS.EMAIL, 5, 20);

            if (messages.length === 0) {
                continue; // No messages, continue polling
            }

            console.log(`📧 Received ${messages.length} email message(s)`);

            // Process messages concurrently
            await Promise.all(
                messages.map(async (message: Message) => {
                    try {
                        if (!message.Body || !message.ReceiptHandle) {
                            console.error('❌ Invalid message format');
                            return;
                        }

                        const messageBody = JSON.parse(message.Body);
                        const { type, data } = messageBody;

                        console.log(`📧 Processing email job: ${message.MessageId}, type: ${type}`);

                        // Process based on message type
                        if (type === 'send-email') {
                            const options = data as SendEmailOptions;
                            await emailService.sendEmail(options);
                        } else if (type === 'send-custom-email') {
                            const options = data as SendCustomEmailOptions;
                            await emailService.sendCustomEmail(options);
                        } else {
                            console.error(`❌ Unknown message type: ${type}`);
                        }

                        // Delete message after successful processing
                        await deleteMessage(QUEUE_URLS.EMAIL, message.ReceiptHandle);
                        console.log(`✅ Email job ${message.MessageId} completed and deleted`);
                    } catch (error: any) {
                        console.error(`❌ Email job ${message.MessageId} failed:`, error.message);
                        // Message will become visible again after visibility timeout
                        // SQS will retry automatically (up to maxReceiveCount before moving to DLQ)
                    }
                })
            );
        } catch (error: any) {
            console.error('❌ Email worker error:', error.message);
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

// Notification Worker - Polls SQS for notification messages
async function processNotificationQueue() {
    console.log('🔔 Notification worker started, polling SQS...');

    while (true) {
        try {
            // Receive messages from SQS (long polling)
            const messages = await receiveMessages(QUEUE_URLS.NOTIFICATION, 10, 20);

            if (messages.length === 0) {
                continue; // No messages, continue polling
            }

            console.log(`🔔 Received ${messages.length} notification message(s)`);

            // Process messages concurrently
            await Promise.all(
                messages.map(async (message: Message) => {
                    try {
                        if (!message.Body || !message.ReceiptHandle) {
                            console.error('❌ Invalid message format');
                            return;
                        }

                        const messageBody = JSON.parse(message.Body);
                        console.log(`🔔 Processing notification job: ${message.MessageId}`);

                        // TODO: Implement push notification logic
                        console.log('Notification data:', messageBody);

                        // Delete message after successful processing
                        await deleteMessage(QUEUE_URLS.NOTIFICATION, message.ReceiptHandle);
                        console.log(`✅ Notification job ${message.MessageId} completed and deleted`);
                    } catch (error: any) {
                        console.error(`❌ Notification job ${message.MessageId} failed:`, error.message);
                        // Message will become visible again after visibility timeout
                    }
                })
            );
        } catch (error: any) {
            console.error('❌ Notification worker error:', error.message);
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
}

// Start both workers
processEmailQueue().catch((error) => {
    console.error('❌ Email worker crashed:', error);
    process.exit(1);
});

processNotificationQueue().catch((error) => {
    console.error('❌ Notification worker crashed:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down workers...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down workers...');
    process.exit(0);
});
