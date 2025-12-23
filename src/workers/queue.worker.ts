import { Worker, Job } from 'bullmq';
import { connection, QUEUE_NAMES } from '../config/queue';
import { emailService, SendEmailOptions, SendCustomEmailOptions } from '../services/email.service';

// Email Worker
export const emailWorker = new Worker(
    QUEUE_NAMES.EMAIL,
    async (job: Job) => {
        console.log(`📧 Processing email job: ${job.id}`);

        try {
            if (job.name === 'send-email') {
                const options = job.data as SendEmailOptions;
                await emailService.sendEmail(options);
            } else if (job.name === 'send-custom-email') {
                const options = job.data as SendCustomEmailOptions;
                await emailService.sendCustomEmail(options);
            }

            console.log(`✅ Email job ${job.id} completed`);
        } catch (error: any) {
            console.error(`❌ Email job ${job.id} failed:`, error.message);
            throw error; // Re-throw to trigger retry
        }
    },
    {
        connection,
        concurrency: 5, // Process up to 5 emails concurrently
        limiter: {
            max: 10, // Max 10 jobs
            duration: 1000, // Per second
        },
    }
);

// Worker event listeners
emailWorker.on('completed', (job) => {
    console.log(`✅ Email worker completed job ${job.id}`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`❌ Email worker failed job ${job?.id}:`, err.message);
});

emailWorker.on('error', (err) => {
    console.error('❌ Email worker error:', err);
});

console.log('📧 Email worker started');

// Notification Worker (placeholder for push notifications)
export const notificationWorker = new Worker(
    QUEUE_NAMES.NOTIFICATION,
    async (job: Job) => {
        console.log(`🔔 Processing notification job: ${job.id}`);

        try {
            // TODO: Implement push notification logic
            // For now, just log
            console.log('Notification data:', job.data);
            console.log(`✅ Notification job ${job.id} completed`);
        } catch (error: any) {
            console.error(`❌ Notification job ${job.id} failed:`, error.message);
            throw error;
        }
    },
    {
        connection,
        concurrency: 10,
    }
);

notificationWorker.on('completed', (job) => {
    console.log(`✅ Notification worker completed job ${job.id}`);
});

notificationWorker.on('failed', (job, err) => {
    console.error(`❌ Notification worker failed job ${job?.id}:`, err.message);
});

console.log('🔔 Notification worker started');

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing workers...');
    await emailWorker.close();
    await notificationWorker.close();
    process.exit(0);
});
