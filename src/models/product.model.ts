import mongoose, { Schema, Document } from 'mongoose';

interface IDocument {
  docName: string;
  uploadTime: Date;
  file: string;
  docType: string;
  category: 'requiredDoc' | 'acknowledgement';
  description?: string;
  isRequired: boolean;
  fileSize?: number;
  uploadedBy?: mongoose.Types.ObjectId;
  status?: 'pending' | 'uploaded' | 'verified' | 'rejected';
}

interface IPriceBreakup {
  starteaseFee: number;
  stdFee: number;
}

interface IWhatsIncluded {
  title: string;
  description: string;
}

interface IRequiredBusinessField {
  fieldName: string;
  label: string;
  fieldType: 'text' | 'email' | 'phone' | 'date' | 'select';
  isRequired: boolean;
  options?: string[];
  description?: string;
}

export interface IProduct extends Document {
  productName: string;
  description: string;
  price: number;
  processType: 'expedite' | 'standard';
  departmentType: string;
  timeToComplete: number; // in days
  productType: 'recurring' | 'onetime';
  priceBreakup: IPriceBreakup;
  whatsIncluded: IWhatsIncluded[];
  requiredDocs: IDocument[];
  requiredBusinessFields: IRequiredBusinessField[];
  acknowledgements: IDocument[];
  isActive: boolean;
  category?: string;
  subCategory?: string;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    docName: {
      type: String,
      required: true,
      trim: true,
    },
    // uploadTime: {
    //   type: Date,
    //   required: true,
    // },
    // file: {
    //   type: String,
    //   required: true,
    // },
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'uploaded', 'verified', 'rejected'],
      default: 'pending',
    },
  },
  { _id: true, timestamps: true }
);

const priceBreakupSchema = new Schema<IPriceBreakup>(
  {
    starteaseFee: {
      type: Number,
      required: true,
      min: 0,
    },
    stdFee: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const whatsIncludedSchema = new Schema<IWhatsIncluded>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const requiredBusinessFieldSchema = new Schema<IRequiredBusinessField>(
  {
    fieldName: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    fieldType: {
      type: String,
      enum: ['text', 'email', 'phone', 'date', 'select'],
      required: true,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    options: {
      type: [String],
      default: undefined,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    processType: {
      type: String,
      enum: ['expedite', 'standard'],
      required: true,
    },
    departmentType: {
      type: String,
      required: true,
    },
    timeToComplete: {
      type: Number,
      required: true,
      min: 1,
    },
    productType: {
      type: String,
      enum: ['recurring', 'onetime'],
      required: true,
    },
    priceBreakup: {
      type: priceBreakupSchema,
      required: true,
    },
    whatsIncluded: {
      type: [whatsIncludedSchema],
      default: [],
    },
    requiredDocs: {
      type: [documentSchema],
      default: [],
    },
    requiredBusinessFields: {
      type: [requiredBusinessFieldSchema],
      default: [],
    },
    acknowledgements: {
      type: [documentSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      trim: true,
    },
    subCategory: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ productName: 'text', description: 'text' });

export const Product = mongoose.model<IProduct>('Product', productSchema);