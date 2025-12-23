import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
    EMAIL: 'email-queue',
    NOTIFICATION: 'notification-queue',
} as const;

// Email Queue
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000,
        },
        removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
        },
    },
});

// Notification Queue
export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
        removeOnComplete: {
            age: 24 * 3600,
            count: 1000,
        },
        removeOnFail: {
            age: 7 * 24 * 3600,
        },
    },
});

// Queue Events for monitoring
export const emailQueueEvents = new QueueEvents(QUEUE_NAMES.EMAIL, { connection });
export const notificationQueueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATION, { connection });

// Event listeners for logging
emailQueueEvents.on('completed', ({ jobId }) => {
    console.log(`✅ Email job ${jobId} completed`);
});

emailQueueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`❌ Email job ${jobId} failed:`, failedReason);
});

notificationQueueEvents.on('completed', ({ jobId }) => {
    console.log(`✅ Notification job ${jobId} completed`);
});

notificationQueueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`❌ Notification job ${jobId} failed:`, failedReason);
});

export { connection };
