import { Request, Response, NextFunction } from 'express';
import { Product } from '../../models/product.model';
import { RequiredDocument } from '../../models/requiredDocument.model';

export class AdminProductController {
    // Create a new product
    async createProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const {
                productName,
                description,
                price,
                processType,
                departmentType,
                timeToComplete,
                productType,
                priceBreakup,
                whatsIncluded,
                requiredDocumentIds, // Array of RequiredDocument IDs
                requiredBusinessFields, // Array of required business fields
                category,
                subCategory,
            } = req.body;

            // Basic validation
            if (!productName || !description || !price || !processType || !departmentType || !timeToComplete || !productType || !priceBreakup) {
                return res.status(400).json({
                    error: 'Missing required fields',
                });
            }

            // Fetch required documents details
            let requiredDocs: any[] = [];
            if (requiredDocumentIds && Array.isArray(requiredDocumentIds) && requiredDocumentIds.length > 0) {
                const docs = await RequiredDocument.find({ _id: { $in: requiredDocumentIds } });

                // Map to the structure expected by Product model
                requiredDocs = docs.map(doc => ({
                    docName: doc.docName,
                    description: doc.description,
                    docType: doc.docType,
                    category: 'requiredDoc',
                    isRequired: doc.isRequired,
                    status: 'pending'
                }));
            }

            const product = await Product.create({
                productName,
                description,
                price,
                processType,
                departmentType,
                timeToComplete,
                productType,
                priceBreakup,
                whatsIncluded: whatsIncluded || [],
                requiredDocs,
                requiredBusinessFields: requiredBusinessFields || [],
                category,
                subCategory,
            });

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                product,
            });
        } catch (error) {
            next(error);
        }
    }

    // Get all products
    async getAllProducts(req: Request, res: Response, next: NextFunction) {
        try {
            const products = await Product.find().sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: products.length,
                products,
            });
        } catch (error) {
            next(error);
        }
    }

    // Get product by ID
    async getProductById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const product = await Product.findById(id);

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found',
                });
            }

            res.status(200).json({
                success: true,
                product,
            });
        } catch (error) {
            next(error);
        }
    }

    // Update product
    async updateProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const {
                productName,
                description,
                price,
                processType,
                departmentType,
                timeToComplete,
                productType,
                priceBreakup,
                whatsIncluded,
                requiredDocumentIds,
                requiredBusinessFields,
                category,
                subCategory,
                isActive,
            } = req.body;

            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({
                    error: 'Product not found',
                });
            }

            // Fetch required documents if IDs provided
            let requiredDocs: any[] = product.requiredDocs;
            if (requiredDocumentIds && Array.isArray(requiredDocumentIds)) {
                const docs = await RequiredDocument.find({ _id: { $in: requiredDocumentIds } });
                requiredDocs = docs.map(doc => ({
                    docName: doc.docName,
                    description: doc.description,
                    docType: doc.docType,
                    category: 'requiredDoc',
                    isRequired: doc.isRequired,
                    status: 'pending',
                    _id: doc._id
                }));
            }

            // Update fields
            if (productName) product.productName = productName;
            if (description) product.description = description;
            if (price !== undefined) product.price = price;
            if (processType) product.processType = processType;
            if (departmentType) product.departmentType = departmentType;
            if (timeToComplete !== undefined) product.timeToComplete = timeToComplete;
            if (productType) product.productType = productType;
            if (priceBreakup) product.priceBreakup = priceBreakup;
            if (whatsIncluded) product.whatsIncluded = whatsIncluded;
            if (requiredDocumentIds) product.requiredDocs = requiredDocs;
            if (requiredBusinessFields !== undefined) product.requiredBusinessFields = requiredBusinessFields;
            if (category !== undefined) product.category = category;
            if (subCategory !== undefined) product.subCategory = subCategory;
            if (isActive !== undefined) product.isActive = isActive;


            await product.save();

            res.status(200).json({
                success: true,
                message: 'Product updated successfully',
                product,
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete product
    async deleteProduct(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const product = await Product.findByIdAndDelete(id);

            if (!product) {
                return res.status(404).json({
                    error: 'Product not found',
                });
            }

            res.status(200).json({
                success: true,
                message: 'Product deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }
}
