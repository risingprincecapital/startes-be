import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';

// Initialize SQS Client
const sqsClient = new SQSClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

// Queue names
export const QUEUE_NAMES = {
    EMAIL: 'email-queue',
    NOTIFICATION: 'notification-queue',
} as const;

// Queue URLs (to be set from environment variables)
export const QUEUE_URLS = {
    EMAIL: process.env.AWS_SQS_EMAIL_QUEUE_URL || '',
    NOTIFICATION: process.env.AWS_SQS_NOTIFICATION_QUEUE_URL || '',
};

/**
 * Send a message to SQS queue
 */
export async function sendMessage(queueUrl: string, messageBody: any, messageGroupId?: string): Promise<string | undefined> {
    try {
        const command = new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify(messageBody),
            MessageGroupId: messageGroupId, // For FIFO queues
        });

        const response = await sqsClient.send(command);
        console.log(`✅ Message sent to queue: ${queueUrl}, MessageId: ${response.MessageId}`);
        return response.MessageId;
    } catch (error) {
        console.error(`❌ Failed to send message to queue ${queueUrl}:`, error);
        throw error;
    }
}

/**
 * Receive messages from SQS queue (long polling)
 */
export async function receiveMessages(queueUrl: string, maxMessages: number = 1, waitTimeSeconds: number = 20) {
    try {
        const command = new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: maxMessages,
            WaitTimeSeconds: waitTimeSeconds, // Long polling
            VisibilityTimeout: 30, // 30 seconds to process
            MessageAttributeNames: ['All'],
        });

        const response = await sqsClient.send(command);
        return response.Messages || [];
    } catch (error) {
        console.error(`❌ Failed to receive messages from queue ${queueUrl}:`, error);
        throw error;
    }
}

/**
 * Delete a message from SQS queue after processing
 */
export async function deleteMessage(queueUrl: string, receiptHandle: string): Promise<void> {
    try {
        const command = new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: receiptHandle,
        });

        await sqsClient.send(command);
        console.log(`✅ Message deleted from queue: ${queueUrl}`);
    } catch (error) {
        console.error(`❌ Failed to delete message from queue ${queueUrl}:`, error);
        throw error;
    }
}

export { sqsClient };
