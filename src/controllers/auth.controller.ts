import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { OTP } from '../models/otp.model';
import { Session } from '../models/session.model';
import { generateOTP, generateToken } from '../utils/auth.utils';
import { sendOTPEmail } from '../utils/email.utils';
import { verifyGoogleToken } from '../utils/googleAuth';

export class AuthController {
  // Send OTP to email
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Create or get user
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({ email });
      }

      // Generate OTP
      const otp = generateOTP();

      // Delete old OTPs for this email
      await OTP.deleteMany({ email });

      // Save new OTP
      await OTP.create({ email, otp });

      // Send OTP via email
      await sendOTPEmail(email, otp);

      res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
      });
    } catch (error) {
      next(error);
    }
  }

  // Google OAuth Login
  async googleLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const { credential } = req.body;

      if (!credential) {
        return res.status(400).json({
          success: false,
          error: 'Google credential is required',
        });
      }

      // Verify Google token
      const googleUser = await verifyGoogleToken(credential);

      // Check if user exists
      let user = await User.findOne({ email: googleUser.email });

      if (user) {
        // Update existing user with Google info if not already set
        if (!user.name) {
          user.name = googleUser.name;
        }
        if (!user.profileImage) {
          user.profileImage = googleUser.picture;
        }
        if (!user.isVerified && googleUser.emailVerified) {
          user.isVerified = true;
        }
        await user.save();
      } else {
        // Create new user
        user = await User.create({
          email: googleUser.email,
          name: googleUser.name,
          profileImage: googleUser.picture,
          authProvider: 'google',
          googleId: googleUser.googleId,
          isVerified: googleUser.emailVerified,
        });
      }

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Delete old sessions for this user
      await Session.deleteMany({ userId: user._id });

      // Create new session
      await Session.create({
        userId: user._id,
        token,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          authProvider: user.authProvider,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error: any) {
      console.error('Google login error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Google login failed',
      });
    }
  }

  // Generate/Refresh token for authenticated user
  async generateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Generate new JWT token
      const token = generateToken(user._id.toString());

      // Delete old sessions for this user
      await Session.deleteMany({ userId: user._id });

      // Create new session
      await Session.create({
        userId: user._id,
        token,
      });

      res.status(200).json({
        success: true,
        message: 'Token generated successfully',
        token,
        expiresIn: '24h',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Verify OTP and create session
  async verifyOTP(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
      }

      // Find OTP record
      const otpRecord = await OTP.findOne({ email, otp });

      if (!otpRecord) {
        return res.status(400).json({ error: 'Invalid OTP' });
      }

      // Check if OTP is expired
      if (otpRecord.expiresAt < new Date()) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return res.status(400).json({ error: 'OTP has expired' });
      }

      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Mark user as verified
      user.isVerified = true;
      await user.save();

      // Delete used OTP
      await OTP.deleteOne({ _id: otpRecord._id });

      // Generate JWT token
      const token = generateToken(user._id.toString());

      // Delete old sessions for this user
      await Session.deleteMany({ userId: user._id });

      // Create new session
      await Session.create({
        userId: user._id,
        token,
      });

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Logout
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (token) {
        await Session.deleteOne({ token });
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current user
  async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await User.findById(userId).select('-__v');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          authProvider: user.authProvider,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user profile
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const user = await User.findById(userId).select('-__v');

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          authProvider: user.authProvider,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
          createdAt: user.createdAt,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get profile',
      });
    }
  }

  // Update user profile
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { name, profileImage } = req.body;

      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Update allowed fields
      if (name !== undefined) {
        user.name = name;
      }
      if (profileImage !== undefined) {
        user.profileImage = profileImage;
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          profileImage: user.profileImage,
          authProvider: user.authProvider,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update profile',
      });
    }
  }
}