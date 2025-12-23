import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';
import { Business } from '../models/business.model';
import { BusinessProduct } from '../models/businessProduct.model';
import { UserDocument } from '../models/userDocument.model';

export class UserController {
  // Get current user profile
  async getProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      
      const user = await User.findById(userId).select('-__v');
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user statistics
      const businessCount = await Business.countDocuments({ userId, isActive: true });
      const productCount = await BusinessProduct.countDocuments({ userId });
      const documentCount = await UserDocument.countDocuments({ userId });

      res.status(200).json({
        success: true,
        user: {
          id: user._id,
          email: user.email,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
          stats: {
            businesses: businessCount,
            products: productCount,
            documents: documentCount,
          }
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update user profile
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { email } = req.body;

      const updateData: any = {};
      if (email) updateData.email = email.toLowerCase();

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-__v');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete user account (soft delete - deactivate)
  async deleteAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      // Deactivate all user's businesses
      await Business.updateMany({ userId }, { isActive: false });

      const user = await User.findByIdAndUpdate(
        userId,
        { isVerified: false },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Account deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all users (admin only - you can add role checking later)
  async getAllUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { isVerified, limit = 50, page = 1 } = req.query;

      const filter: any = {};
      if (isVerified !== undefined) filter.isVerified = isVerified === 'true';

      const skip = (Number(page) - 1) * Number(limit);

      const users = await User.find(filter)
        .select('-__v')
        .limit(Number(limit))
        .skip(skip)
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(filter);

      res.status(200).json({
        success: true,
        count: users.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        users,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user by ID (admin only)
  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-__v');

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const businessCount = await Business.countDocuments({ userId: id, isActive: true });
      const productCount = await BusinessProduct.countDocuments({ userId: id });
      const documentCount = await UserDocument.countDocuments({ userId: id });

      res.status(200).json({
        success: true,
        user: {
          ...user.toObject(),
          stats: {
            businesses: businessCount,
            products: productCount,
            documents: documentCount,
          }
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
