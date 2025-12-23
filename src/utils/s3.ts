import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';

// Initialize AWS S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
});

const bucketName = process.env.AWS_BUCKET_NAME || 'startease-documents';

/**
 * Upload a file to AWS S3
 * @param buffer - File buffer
 * @param businessId - Business ID for folder structure
 * @param productId - Product ID for folder structure
 * @param fileName - Original file name
 * @returns Object containing S3 key and public URL
 */
export async function uploadToS3(
    buffer: Buffer,
    businessId: string,
    productId: string,
    fileName: string
): Promise<{ key: string; publicUrl: string }> {
    try {
        // Create folder structure: businesses/{businessId}/products/{productId}/{timestamp}_{fileName}
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `businesses/${businessId}/products/${productId}/${timestamp}_${sanitizedFileName}`;

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: buffer,
            ContentType: getContentType(fileName),
            // Try to make it public-read, but this might fail if Block Public Access is on
            // ACL: ObjectCannedACL.public_read, 
            Metadata: {
                businessId,
                productId,
                uploadedAt: new Date().toISOString(),
            },
        });

        await s3Client.send(command);

        // Generate public URL
        const publicUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

        return {
            key,
            publicUrl,
        };
    } catch (error) {
        console.error('Error uploading to S3:', error);
        throw new Error('Failed to upload file to cloud storage');
    }
}

/**
 * Generate a signed URL for private file access
 * @param key - S3 object key
 * @param expiresInMinutes - URL expiration time in minutes (default: 60)
 * @returns Signed URL
 */
export async function generateSignedUrl(
    key: string,
    expiresInMinutes: number = 60
): Promise<string> {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: expiresInMinutes * 60 });
        return url;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw new Error('Failed to generate file access URL');
    }
}

/**
 * Delete a file from S3
 * @param key - S3 object key
 */
export async function deleteFromS3(key: string): Promise<void> {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        await s3Client.send(command);
    } catch (error) {
        console.error('Error deleting from S3:', error);
        throw new Error('Failed to delete file from cloud storage');
    }
}

/**
 * Get content type based on file extension
 * @param fileName - File name
 * @returns Content type
 */
function getContentType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();

    const contentTypes: { [key: string]: string } = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.txt': 'text/plain',
    };

    return contentTypes[ext] || 'application/octet-stream';
}
