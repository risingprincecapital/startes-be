import { Request, Response, NextFunction } from 'express';
import { Business } from '../models/business.model';
import { BusinessProduct } from '../models/businessProduct.model';
import { Product } from '../models/product.model';
import { UserDocument } from '../models/userDocument.model';
import { User } from '../models/user.model';
import { emailService } from '../services/email.service';
import { NotificationService } from '../services/notification.service';
import mongoose from 'mongoose';

export class BusinessController {
  // Create a new business
  async createBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const {
        businessName,
        businessDescription,
        entityType,
        compLocation,
        founderStructure,
        founderInfo,
        regAgentInfo,
        ein,
        registrationDate,
        taxId,
        businessAddress,
        businessPhone,
        businessEmail,
        website,
        departmentType,
      } = req.body;

      if (!businessName || !businessDescription || !entityType || !compLocation || !founderStructure || !founderInfo) {
        return res.status(400).json({ error: 'All required fields must be provided' });
      }

      // Build filter for recommended products
      const productFilter: any = { category: 'Formation' };

      // Add filters if provided
      productFilter.subCategory = entityType;
      productFilter.departmentType = compLocation;

      // Get products matching the filters (without sorting yet)
      const matchingProducts = await Product.find(productFilter)
        .select('_id');

      // Get products for 'Registered Agent'
      const registeredAgentProducts = await Product.find({
        subCategory: 'Registered Agent',
        departmentType: compLocation,
        isActive: true,
      }).select('_id');


      // Get one product with subCategory = 'EIN' (without sorting yet)
      const einProduct = await Product.findOne({
        subCategory: 'EIN',
        isActive: true
      })
        .select('_id');

      const productMap = new Map<string, boolean>();

      // Add matching products
      matchingProducts.forEach(product => {
        productMap.set(product._id.toString(), true);
      });

      // Add Registered Agent products
      registeredAgentProducts.forEach(product => {
        productMap.set(product._id.toString(), true);
      });

      // Add EIN product if found
      if (einProduct) {
        productMap.set(einProduct._id.toString(), true);
      }

      // Convert to array without sorting
      const recommendedProduct = Array.from(productMap.keys())
        .map(id => ({
          productId: new mongoose.Types.ObjectId(id)
        }));


      const business = await Business.create({
        userId,
        businessName,
        businessDescription,
        entityType,
        compLocation,
        founderStructure,
        founderInfo,
        regAgentInfo: regAgentInfo || [],
        recommendedProduct,
        ein,
        registrationDate,
        taxId,
        businessAddress,
        businessPhone,
        businessEmail,
        website,
        isActive: false, // Business starts inactive, activated on payment success
      });

      // Send business formation email
      const user = await User.findById(userId);
      if (user) {
        await emailService.sendBusinessFormationEmail(
          user.email,
          {
            userName: user.name || user.email,
            businessName,
            entityType,
            state: compLocation,
            actionUrl: `${process.env.FRONTEND_URL}/dashboard/businesses/${business._id}`,
          },
          userId
        );
      }

      // Notify all admins about new business creation
      try {
        // Query by email domain since isAdmin is a virtual field
        const adminUsers = await User.find({
          email: { $regex: /@startease\.com$/i }
        }).select('_id');

        if (adminUsers.length > 0) {
          const adminIds = adminUsers.map(admin => admin._id);
          await NotificationService.notifyAdminBusinessAction(
            adminIds,
            'created',
            businessName,
            user?.email || 'Unknown user',
            business._id
          );
        }
      } catch (notifError) {
        console.error('Failed to send admin notification:', notifError);
      }

      res.status(201).json({
        success: true,
        message: 'Business created successfully',
        business,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all businesses for authenticated user
  async getUserBusinesses(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { isActive, entityType, search, limit = 50, page = 1 } = req.query;

      const filter: any = { userId };
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (entityType) filter.entityType = entityType;
      if (search) {
        filter.$text = { $search: search as string };
      }

      const skip = (Number(page) - 1) * Number(limit);

      const businesses = await Business.find(filter)
        .populate('userId', 'email isVerified')
        .limit(Number(limit))
        .skip(skip)
        .sort({ createdAt: -1 });

      const total = await Business.countDocuments(filter);

      // Get product details for each business
      const businessesWithProducts = await Promise.all(
        businesses.map(async (business) => {
          const businessObj = business.toObject();

          const productDetails = await BusinessProduct.find({
            businessId: business._id
          }).populate('productId', 'productName price departmentType processType timeToComplete');

          const documentCount = await UserDocument.countDocuments({ businessId: business._id });

          return {
            ...businessObj,
            productDetails,
            documentCount,
          };
        })
      );

      res.status(200).json({
        success: true,
        count: businesses.length,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        businesses: businessesWithProducts,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single business by ID with full details
  async getBusinessById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const business = await Business.findOne({ _id: id, userId })
        .populate('userId', 'email isVerified createdAt')
        .populate('recommendedProduct.productId');

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Get all products associated with this business
      const products = await BusinessProduct.find({ businessId: id })
        .populate('productId')
        .sort({ startDate: -1 });

      // Get all documents for this business
      const documents = await UserDocument.find({ businessId: id })
        .populate('productId', 'productName')
        .sort({ uploadTime: -1 });

      // Filter recommendedProduct to exclude already purchased products
      const purchasedProductIds = products.map(p => p.productId._id.toString());
      const filteredRecommendedProducts = business.recommendedProduct.filter(
        (rp: any) => !purchasedProductIds.includes(rp.productId._id.toString())
      );

      res.status(200).json({
        success: true,
        business: {
          ...business.toObject(),
          recommendedProduct: filteredRecommendedProducts,
          productDetails: products,
          documents,
          productCount: products.length,
          documentCount: documents.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get recommended products for a business
  async getRecommendedProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { businessId } = req.params;

      // Verify business belongs to user
      const business = await Business.findOne({ _id: businessId, userId })
        .populate('recommendedProduct.productId');

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Extract the populated product details
      const recommendedProducts = business.recommendedProduct
        .map((rp: any) => rp.productId)
        .filter((product: any) => product !== null && product !== undefined);

      res.status(200).json({
        success: true,
        count: recommendedProducts.length,
        recommendedProducts,
      });
    } catch (error) {
      next(error);
    }
  }

  // Add product to business
  async addProductToBusiness(req: Request, res: Response, next: NextFunction) {
    // manually adding a product to a business
    try {
      const userId = (req as any).userId;
      const { businessId } = req.params;
      const { productId, startDate, endDate, purchasePrice, notes } = req.body;

      if (!productId || !purchasePrice) {
        return res.status(400).json({ error: 'productId and purchasePrice are required' });
      }

      // Verify business belongs to user
      const business = await Business.findOne({ _id: businessId, userId });
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Verify product exists
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Create BusinessProduct entry
      const businessProduct = await BusinessProduct.create({
        businessId,
        productId,
        userId,
        startDate: startDate || new Date(),
        endDate,
        purchasePrice,
        notes,
        status: 'pending',
        progress: 0,
        completedSteps: ['start'],
      });

      res.status(201).json({
        success: true,
        message: 'Product added to business successfully',
        businessProduct,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update business
  async updateBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updateData = req.body;

      delete updateData.userId; // Prevent userId change

      const business = await Business.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Business updated successfully',
        business,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete business (soft delete)
  async deleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const business = await Business.findOneAndUpdate(
        { _id: id, userId },
        { isActive: false },
        { new: true }
      );

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Deactivate all products for this business
      await BusinessProduct.updateMany(
        { businessId: id },
        { status: 'cancelled' }
      );

      res.status(200).json({
        success: true,
        message: 'Business deactivated successfully',
        business,
      });
    } catch (error) {
      next(error);
    }
  }

  // Permanently delete business
  async permanentDeleteBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const business = await Business.findOneAndDelete({ _id: id, userId });

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Delete all related business products
      await BusinessProduct.deleteMany({ businessId: id });

      // Delete all related documents
      await UserDocument.deleteMany({ businessId: id });

      res.status(200).json({
        success: true,
        message: 'Business and all related data permanently deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get business statistics
  async getBusinessStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      const stats = await Business.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalBusinesses: { $sum: 1 },
            activeBusinesses: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            llcCount: {
              $sum: { $cond: [{ $eq: ['$entityType', 'LLC'] }, 1, 0] }
            },
            cCorpCount: {
              $sum: { $cond: [{ $eq: ['$entityType', 'C-Corp'] }, 1, 0] }
            },
          }
        }
      ]);

      const productStats = await BusinessProduct.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedProducts: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            totalSpent: { $sum: '$purchasePrice' },
          }
        }
      ]);

      res.status(200).json({
        success: true,
        stats: {
          businesses: stats[0] || { totalBusinesses: 0, activeBusinesses: 0, llcCount: 0, cCorpCount: 0 },
          products: productStats[0] || { totalProducts: 0, activeProducts: 0, completedProducts: 0, totalSpent: 0 },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Get businesses by entity type
  async getBusinessesByEntityType(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { entityType } = req.params;

      const validTypes = ['LLC', 'C-Corp', 'S-Corp', 'Partnership', 'Sole Proprietorship'];
      if (!validTypes.includes(entityType)) {
        return res.status(400).json({ error: 'Invalid entity type' });
      }

      const businesses = await Business.find({ userId, entityType, isActive: true })
        .sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: businesses.length,
        entityType,
        businesses,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get businesses by location
  async getBusinessesByLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { location } = req.params;

      const businesses = await Business.find({
        userId,
        compLocation: location,
        isActive: true
      }).sort({ createdAt: -1 });

      res.status(200).json({
        success: true,
        count: businesses.length,
        location,
        businesses,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get missing business fields for a specific product
   * GET /api/businesses/:id/missing-fields/:productId
   */
  async getMissingBusinessFields(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id, productId } = req.params;

      // Verify business belongs to user
      const business = await Business.findOne({ _id: id, userId });
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Get product with required business fields
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Check which fields are missing
      const missingFields = product.requiredBusinessFields.filter(field => {
        // Handle array-indexed nested fields like founderInfo[0].citizenship
        if (field.fieldName.includes('[')) {
          const match = field.fieldName.match(/^(\w+)\[(\d+)\]\.(.+)$/);
          if (match) {
            const [, arrayName, index, nestedField] = match;
            const idx = parseInt(index);
            const array = (business as any)[arrayName];
            if (!array || !Array.isArray(array) || !array[idx]) return true;

            // Handle deeply nested like itin.number
            if (nestedField.includes('.')) {
              const [parent, child] = nestedField.split('.');
              const parentValue = array[idx][parent];
              if (!parentValue || typeof parentValue !== 'object') return true;
              const childValue = parentValue[child];
              return !childValue || childValue === '' || childValue === null || childValue === undefined;
            }

            const fieldValue = array[idx][nestedField];
            return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
          }
        }

        // Handle nested fields like parentCompany.name
        if (field.fieldName.includes('.')) {
          const [parent, child] = field.fieldName.split('.');
          const parentValue = (business as any)[parent];
          if (!parentValue || typeof parentValue !== 'object') return true;
          const childValue = parentValue[child];
          return !childValue || childValue === '' || childValue === null || childValue === undefined;
        }

        // Handle regular fields
        const fieldValue = (business as any)[field.fieldName];
        return !fieldValue || fieldValue === '' || fieldValue === null || fieldValue === undefined;
      });

      res.status(200).json({
        success: true,
        missingFields,
        totalRequired: product.requiredBusinessFields.length,
        missingCount: missingFields.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update business information
   * PATCH /api/businesses/:id/update-info
   */
  async updateBusinessInfo(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updateData = req.body;

      // Remove protected fields
      delete updateData.userId;
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const business = await Business.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      ).populate('userId', 'email name');

      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Notify all admins about the business info update
      try {
        const admins = await this.getAllAdminUsers();
        const updatedFields = Object.keys(updateData);
        const user = business.userId as any;

        for (const admin of admins) {
          await NotificationService.createNotification({
            userId: admin._id,
            category: 'business',
            title: 'Business Information Updated',
            message: `${user.email} has submitted additional information for ${business.businessName}. Fields updated: ${updatedFields.join(', ')}`,
            data: {
              businessId: business._id,
              businessName: business.businessName,
              userEmail: user.email,
              updatedFields
            }
          });
        }
      } catch (notifError) {
        console.error('Failed to send admin notifications:', notifError);
      }

      res.status(200).json({
        success: true,
        message: 'Business information updated successfully',
        business,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Get all admin users
   */
  private async getAllAdminUsers() {
    return await User.find({
      $or: [
        { role: 'admin' },
        { role: 'superadmin' }
      ]
    }).select('_id email name');
  }
}