import mongoose, { Schema, Document } from 'mongoose';

interface IFounder {
  name: string;
  phone: string;
  email: string;
  country: string;
  ownershipPercentage?: number;
  role?: string;
  citizenship?: string;
  residencyStatus?: 'US' | 'NON_US';
  itin?: {
    assigned: boolean;
    number?: string;
  };
  visitedUSForBusiness?: boolean;
  compensationMethod?: 'SALARY' | 'DIVIDENDS' | 'BOTH';
  w8Provided?: boolean;
}

interface IRegAgent {
  name: string;
  address: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface IBusinessProduct {
  productId: mongoose.Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  status: 'active' | 'completed' | 'cancelled';
  purchasePrice: number;
  notes?: string;
}

interface IRecommendedProduct {
  productId: mongoose.Types.ObjectId;
}

interface IParentCompany {
  name: string;
  country: string;
}

export interface IBusiness extends Document {
  userId: mongoose.Types.ObjectId;
  legalName?: string;
  businessName: string;
  businessDescription: string;
  entityType: 'LLC' | 'C-Corp' | 'S-Corp' | 'Partnership' | 'Sole Proprietorship';
  compLocation: string;
  founderStructure: 'solo' | 'multi';
  founderInfo: IFounder[];
  regAgentInfo: IRegAgent[];
  products: IBusinessProduct[];
  recommendedProduct: IRecommendedProduct[];
  ein?: string;
  registrationDate?: Date;
  isActive: boolean;
  taxId?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
  website?: string;
  natureOfBusiness?: string;
  boirFiled?: boolean;
  incorporationContext?: 'SUBSIDIARY' | 'STANDALONE' | 'HOLDING';
  parentCompany?: IParentCompany;
  fundraisingEnabled?: boolean;
  alreadyRegistered?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const founderSchema = new Schema<IFounder>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      default: 'USA',
    },
    ownershipPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    role: {
      type: String,
      trim: true,
    },
    citizenship: {
      type: String,
      trim: true,
    },
    residencyStatus: {
      type: String,
      enum: ['US', 'NON_US'],
    },
    itin: {
      assigned: {
        type: Boolean,
        default: false,
      },
      number: {
        type: String,
      },
    },
    visitedUSForBusiness: {
      type: Boolean,
      default: false,
    },
    compensationMethod: {
      type: String,
      enum: ['SALARY', 'DIVIDENDS', 'BOTH'],
    },
    w8Provided: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const regAgentSchema = new Schema<IRegAgent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false, timestamps: true }
);

const businessProductSchema = new Schema<IBusinessProduct>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
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
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
    },
  },
  { _id: true, timestamps: true }
);

const recommendedProductSchema = new Schema<IRecommendedProduct>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
  },
  { _id: false }
);

const parentCompanySchema = new Schema<IParentCompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const businessSchema = new Schema<IBusiness>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    legalName: {
      type: String,
      trim: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
    },
    businessDescription: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: ['LLC', 'C-Corp', 'S-Corp', 'Partnership', 'Sole Proprietorship'],
      required: true,
    },
    compLocation: {
      type: String,
      required: true,
    },
    founderStructure: {
      type: String,
      enum: ['solo', 'multi'],
      required: true,
    },
    founderInfo: {
      type: [founderSchema],
      required: true,
      validate: {
        validator: function (v: IFounder[]) {
          return v && v.length > 0;
        },
        message: 'At least one founder is required',
      },
    },
    regAgentInfo: {
      type: [regAgentSchema],
      default: [],
    },
    products: {
      type: [businessProductSchema],
      default: [],
    },
    recommendedProduct: {
      type: [recommendedProductSchema],
      default: [],
    },
    ein: {
      type: String,
      unique: true,
      sparse: true,
    },
    registrationDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    taxId: {
      type: String,
    },
    businessAddress: {
      type: String,
    },
    businessPhone: {
      type: String,
    },
    businessEmail: {
      type: String,
      lowercase: true,
    },
    website: {
      type: String,
    },
    natureOfBusiness: {
      type: String,
      trim: true,
    },
    boirFiled: {
      type: Boolean,
      default: false,
    },
    incorporationContext: {
      type: String,
      enum: ['SUBSIDIARY', 'STANDALONE', 'HOLDING'],
    },
    parentCompany: {
      type: parentCompanySchema,
    },
    fundraisingEnabled: {
      type: Boolean,
      default: false,
    },
    alreadyRegistered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
businessSchema.index({ userId: 1, isActive: 1 });
businessSchema.index({ businessName: 'text', businessDescription: 'text' });

export const Business = mongoose.model<IBusiness>('Business', businessSchema);