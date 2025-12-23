import mongoose, { Schema, Document } from 'mongoose';

export interface IRequiredDocument extends Document {
    docName: string;
    description: string;
    docType: 'PDF' | 'JPEG' | 'JPG' | 'PNG' | 'DOCX' | 'DOC' | 'XLSX' | 'XLS' | 'TXT';
    isRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const requiredDocumentSchema = new Schema<IRequiredDocument>(
    {
        docName: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
        docType: {
            type: String,
            required: true,
            uppercase: true,
            enum: ['PDF', 'JPEG', 'JPG', 'PNG', 'DOCX', 'DOC', 'XLSX', 'XLS', 'TXT'],
        },
        isRequired: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

export const RequiredDocument = mongoose.model<IRequiredDocument>('RequiredDocument', requiredDocumentSchema);
