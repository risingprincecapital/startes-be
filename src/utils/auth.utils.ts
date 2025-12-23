import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../lib/env';

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const generateToken = (userId: string): string => {
  const payload = { userId };
  const secret: Secret = env.JWT_SECRET;
  const options: SignOptions = { expiresIn: '24h' };
  return jwt.sign(payload, secret, options);
};