import { Request, Response, NextFunction } from 'express';
import { Business } from '../../models/business.model';
import { Product } from '../../models/product.model';
import { User } from '../../models/user.model';
import { BusinessProduct } from '../../models/businessProduct.model';
import { NotificationService } from '../../services/notification.service';
import mongoose from 'mongoose';

export class AdminBusinessController {
    // Get all businesses with user information
    async getAllBusinesses(req: Request, res: Response, next: NextFunction) {
        try {
            const { search, page = 1, limit = 20 } = req.query;

            const query: any = {};

            // Search by business name or user email
            if (search) {
                const users = await User.find({
                    email: { $regex: search, $options: 'i' }
                }).select('_id');

                const userIds = users.map(u => u._id);

                query.$or = [
                    { businessName: { $regex: search, $options: 'i' } },
                    { userId: { $in: userIds } }
                ];
            }

            const businesses = await Business.find(query)
                .populate('userId', 'email name profileImage')
                .populate('products.productId', 'productName price')
                .sort({ createdAt: -1 })
                .limit(Number(limit))
                .skip((Number(page) - 1) * Number(limit));

            const total = await Business.countDocuments(query);

            res.status(200).json({
                success: true,
                businesses,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    pages: Math.ceil(total / Number(limit))
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Get business details by ID
    async getBusinessById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const business = await Business.findById(id)
                .populate('userId', 'email name profileImage')
                .populate('products.productId', 'productName price requiredDocs')
                .populate('recommendedProduct.productId', 'productName price description');

            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Fetch purchased products from BusinessProduct collection
            const purchasedProducts = await BusinessProduct.find({ businessId: id })
                .populate('productId', 'productName price requiredDocs')
                .sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                business: {
                    ...business.toObject(),
                    products: purchasedProducts
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // Update business details
    async updateBusiness(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Remove fields that shouldn't be updated
            delete updateData.userId;
            delete updateData.products;
            delete updateData.recommendedProduct;
            delete updateData._id;

            const business = await Business.findByIdAndUpdate(
                id,
                updateData,
                { new: true, runValidators: true }
            ).populate('userId', 'email name');

            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Send notification to user
            try {
                const updatedFields = Object.keys(updateData);
                await NotificationService.notifyBusinessUpdated(
                    business.userId,
                    business.businessName,
                    updatedFields,
                    business._id
                );
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.status(200).json({
                success: true,
                message: 'Business updated successfully',
                business
            });
        } catch (error) {
            next(error);
        }
    }

    // Add recommended product
    async addRecommendedProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { productId } = req.body;

            if (!productId) {
                return res.status(400).json({ error: 'Product ID is required' });
            }

            // Verify product exists
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            const business = await Business.findById(id);
            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Check if product is already recommended
            const alreadyRecommended = business.recommendedProduct?.some(
                rp => rp.productId.toString() === productId
            );

            if (alreadyRecommended) {
                return res.status(400).json({ error: 'Product already recommended' });
            }

            // Check if product is already purchased
            const alreadyPurchased = await BusinessProduct.exists({
                businessId: id,
                productId: productId
            });

            if (alreadyPurchased) {
                return res.status(400).json({ error: 'Product already purchased' });
            }

            // Add to recommended products
            business.recommendedProduct = business.recommendedProduct || [];
            business.recommendedProduct.push({
                productId: new mongoose.Types.ObjectId(productId)
            });

            await business.save();

            const updatedBusiness = await Business.findById(id)
                .populate('recommendedProduct.productId', 'productName price description');

            // Send notification to user
            try {
                await NotificationService.notifyRecommendedProductAdded(
                    business.userId,
                    business.businessName,
                    product.productName,
                    business._id
                );
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.status(200).json({
                success: true,
                message: 'Recommended product added successfully',
                business: updatedBusiness
            });
        } catch (error) {
            next(error);
        }
    }

    // Remove recommended product
    async removeRecommendedProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id, productId } = req.params;

            const business = await Business.findById(id);
            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Remove from recommended products
            business.recommendedProduct = business.recommendedProduct?.filter(
                rp => rp.productId.toString() !== productId
            ) || [];

            await business.save();

            const updatedBusiness = await Business.findById(id)
                .populate('recommendedProduct.productId', 'productName price description');

            res.status(200).json({
                success: true,
                message: 'Recommended product removed successfully',
                business: updatedBusiness
            });
        } catch (error) {
            next(error);
        }
    }

    // Get missing business fields for a business
    async getBusinessMissingFields(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const business = await Business.findById(id);
            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            // Fetch all purchased products with their requiredBusinessFields
            const purchasedProducts = await BusinessProduct.find({ businessId: id })
                .populate({
                    path: 'productId',
                    select: 'productName requiredBusinessFields'
                });

            // Check missing fields for each product
            const productsWithMissingFields = [];
            let totalMissingCount = 0;

            for (const bp of purchasedProducts) {
                const product = bp.productId as any;

                if (!product.requiredBusinessFields || product.requiredBusinessFields.length === 0) {
                    continue;
                }

                const missingFields = product.requiredBusinessFields.filter((field: any) => {
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

                if (missingFields.length > 0) {
                    productsWithMissingFields.push({
                        productId: product._id,
                        productName: product.productName,
                        missingFields,
                        totalRequired: product.requiredBusinessFields.length,
                        missingCount: missingFields.length
                    });
                    totalMissingCount += missingFields.length;
                }
            }

            res.status(200).json({
                success: true,
                businessId: business._id,
                businessName: business.businessName,
                hasMissingFields: productsWithMissingFields.length > 0,
                productsWithMissingFields,
                totalMissingCount,
                totalProducts: purchasedProducts.length
            });
        } catch (error) {
            next(error);
        }
    }
}
