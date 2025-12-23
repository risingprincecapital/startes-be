import mongoose, { Schema, Document } from 'mongoose';

export interface IUserDocument extends Document {
  userId: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  businessProductId?: mongoose.Types.ObjectId; // Link to specific business-product instance
  docName: string;
  uploadTime: Date;
  file: string; // GCS path: businesses/{businessId}/products/{productId}/{fileName}
  fileUrl?: string; // Public or signed URL for file access
  docType: string;
  category: 'requiredDoc' | 'acknowledgement';
  description?: string;
  isRequired: boolean;
  fileSize?: number;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  rejectionReason?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userDocumentSchema = new Schema<IUserDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    businessProductId: {
      type: Schema.Types.ObjectId,
      ref: 'BusinessProduct',
      index: true,
    },
    docName: {
      type: String,
      required: true,
      trim: true,
    },
    uploadTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    file: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
    },
    docType: {
      type: String,
      required: true,
      uppercase: true,
      enum: ['PDF', 'JPEG', 'JPG', 'PNG', 'DOCX', 'DOC', 'XLSX', 'XLS', 'TXT'],
    },
    category: {
      type: String,
      enum: ['requiredDoc', 'acknowledgement'],
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'verified', 'rejected'],
      default: 'uploaded',
      index: true,
    },
    rejectionReason: {
      type: String,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
userDocumentSchema.index({ userId: 1, businessId: 1 });
userDocumentSchema.index({ businessId: 1, productId: 1 });
userDocumentSchema.index({ userId: 1, category: 1 });
userDocumentSchema.index({ userId: 1, status: 1 });

export const UserDocument = mongoose.model<IUserDocument>('UserDocument', userDocumentSchema);