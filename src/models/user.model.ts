import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  email: string;
  name?: string;
  profileImage?: string;
  authProvider: 'email' | 'google';
  role: 'user' | 'admin' | 'superadmin';
  isVerified: boolean;
  isAdmin: boolean; // Virtual field
  isSuperAdmin: boolean; // Virtual field
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
    },
    authProvider: {
      type: String,
      enum: ['email', 'google'],
      default: 'email',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field for admin check
userSchema.virtual('isAdmin').get(function () {
  return this.role === 'admin' || this.role === 'superadmin' || this.email.endsWith('@startease.com');
});

// Virtual field for super admin check
userSchema.virtual('isSuperAdmin').get(function () {
  return this.role === 'superadmin';
});

export const User = mongoose.model<IUser>('User', userSchema);