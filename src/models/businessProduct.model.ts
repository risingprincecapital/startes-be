import mongoose, { Schema, Document } from 'mongoose';

export interface IBusinessProduct extends Document {
  businessId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId; // For quick user reference
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled' | 'pending';
  purchasePrice: number;
  notes?: string;
  progress: number; // 0-100
  completedSteps?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Schema for Business Product associations
 * 
 * Represents the relationship between a business, product, and user, tracking the lifecycle
 * of a product subscription or service within a business context.
 * 
 * @property {ObjectId} businessId - Reference to the associated Business document
 * @property {ObjectId} productId - Reference to the associated Product document
 * @property {ObjectId} userId - Reference to the User who owns/manages this business product
 * @property {Date} startDate - Service start date (defaults to current date)
 * @property {Date} [endDate] - Optional service end date
 * @property {string} status - Current status of the business product:
 *   - `pending` - Payment not yet completed; subscription not active
 *   - `active` - Payment completed and service is within the active period (startDate <= now <= endDate)
 *   - `completed` - Service period has expired (now > endDate); no longer active
 *   - `cancelled` - Service was cancelled before completion
 * @property {number} purchasePrice - Cost of the product (must be >= 0)
 * @property {string} [notes] - Optional notes about the business product
 * @property {number} progress - Completion progress percentage (0-100, default: 0)
 * @property {string[]} completedSteps - Array of completed step identifiers // [start, payment, documentation, acknowledgement]
 * @param {object} options - Schema options with timestamps enabled (createdAt, updatedAt)
 */
const businessProductSchema = new Schema<IBusinessProduct>(
  {
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'pending'],
      default: 'active',
      index: true,
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    completedSteps: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
businessProductSchema.index({ businessId: 1, productId: 1 });
businessProductSchema.index({ userId: 1, status: 1 });

export const BusinessProduct = mongoose.model<IBusinessProduct>('BusinessProduct', businessProductSchema);