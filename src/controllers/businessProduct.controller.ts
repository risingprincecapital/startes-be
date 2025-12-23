import { Request, Response, NextFunction } from 'express';
import { BusinessProduct } from '../models/businessProduct.model';
import { Business } from '../models/business.model';
import { UserDocument } from '../models/userDocument.model';

export class BusinessProductController {
  // Get product with full details (business, user, documents)
  async getProductDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const businessProduct = await BusinessProduct.findOne({ _id: id, userId })
        .populate('productId')
        .populate('businessId')
        .populate('userId', 'email isVerified');

      if (!businessProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get related documents
      const documents = await UserDocument.find({
        businessProductId: id,
      });

      res.status(200).json({
        success: true,
        product: {
          ...businessProduct.toObject(),
          documents,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update product status
  async updateProductStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { status, endDate, progress, notes, completedSteps } = req.body;

      const updateData: any = {};
      if (status) updateData.status = status;
      if (endDate) updateData.endDate = endDate;
      if (progress !== undefined) updateData.progress = progress;
      if (notes) updateData.notes = notes;
      if (completedSteps) updateData.completedSteps = completedSteps;

      const businessProduct = await BusinessProduct.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      ).populate('productId').populate('businessId');

      if (!businessProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        businessProduct,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Verify and complete product (add acknowledgement, set to 100%)
  async verifyAndCompleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const { notes } = req.body;

      const businessProduct = await BusinessProduct.findById(id);

      if (!businessProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Add 'acknowledgement' to completedSteps if not already present
      const completedSteps = businessProduct.completedSteps || [];
      if (!completedSteps.includes('acknowledgement')) {
        completedSteps.push('acknowledgement');
      }

      // Update to 100% progress and completed status
      const updatedProduct = await BusinessProduct.findByIdAndUpdate(
        id,
        {
          progress: 100,
          status: 'completed',
          completedSteps,
          endDate: new Date(),
          notes: notes || businessProduct.notes,
        },
        { new: true, runValidators: true }
      ).populate('productId').populate('businessId');

      res.status(200).json({
        success: true,
        message: 'Product verified and marked as completed',
        businessProduct: updatedProduct,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all products for a user (across all businesses)
  async getUserProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { status, businessId, limit = 50, page = 1 } = req.query;

      const filter: any = { userId };
      if (status) filter.status = status;
      if (businessId) filter.businessId = businessId;

      const skip = (Number(page) - 1) * Number(limit);

      const products = await BusinessProduct.find(filter)
        .populate('productId')
        .populate('businessId', 'businessName entityType')
        .limit(Number(limit))
        .skip(skip)
        .sort({ startDate: -1 });

      const total = await BusinessProduct.countDocuments(filter);

      res.status(200).json({
        success: true,
        count: products.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete business product
  async deleteBusinessProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const businessProduct = await BusinessProduct.findOneAndUpdate(
        { _id: id, userId },
        { status: 'cancelled' },
        { new: true }
      );

      if (!businessProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Product cancelled successfully',
        businessProduct,
      });
    } catch (error) {
      next(error);
    }
  }

  // Permanently delete business product
  async permanentDeleteBusinessProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const businessProduct = await BusinessProduct.findOneAndDelete({ _id: id, userId });

      if (!businessProduct) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Delete related documents
      await UserDocument.deleteMany({ businessProductId: id });

      res.status(200).json({
        success: true,
        message: 'Product and related documents permanently deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get products by status
  async getProductsByStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { status } = req.params;

      const validStatuses = ['active', 'completed', 'cancelled', 'pending'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const products = await BusinessProduct.find({ userId, status })
        .populate('productId')
        .populate('businessId', 'businessName')
        .sort({ startDate: -1 });

      res.status(200).json({
        success: true,
        count: products.length,
        status,
        products,
      });
    } catch (error) {
      next(error);
    }
  }
}