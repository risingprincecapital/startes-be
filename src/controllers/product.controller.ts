import { Request, Response, NextFunction } from 'express';
import { Product } from '../models/product.model';
import { BusinessProduct } from '../models/businessProduct.model';

export class ProductController {
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
        recommendedProduct,
        whatsIncluded,
        requiredDocs,
        acknowledgements,
        category,
        subCategory,
      } = req.body;

      // Validation
      if (!productName || !description || !price || !processType || !departmentType || !timeToComplete || !productType || !priceBreakup) {
        return res.status(400).json({ error: 'All required fields must be provided' });
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
        recommendedProduct: recommendedProduct || [],
        whatsIncluded: whatsIncluded || [],
        requiredDocs: requiredDocs || [],
        acknowledgements: acknowledgements || [],
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
      const {
        processType,
        departmentType,
        productType,
        isActive,
        category,
        search,
        limit = 50,
        page = 1,
      } = req.query;

      const filter: any = {};

      if (processType) filter.processType = processType;
      if (departmentType) filter.departmentType = departmentType;
      if (productType) filter.productType = productType;
      if (category) filter.category = category;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      if (search) {
        filter.$text = { $search: search as string };
      }

      const skip = (Number(page) - 1) * Number(limit);

      const products = await Product.find(filter)
        .limit(Number(limit))
        .skip(skip)
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments(filter);

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

  // Get single product by ID
  async getProductById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const product = await Product.findById(id);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Get usage statistics
      const usageCount = await BusinessProduct.countDocuments({ productId: id });
      const activeCount = await BusinessProduct.countDocuments({ productId: id, status: 'active' });

      res.status(200).json({
        success: true,
        product: {
          ...product.toObject(),
          statistics: {
            totalUsage: usageCount,
            activeUsage: activeCount,
          }
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // Update product
  async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const product = await Product.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        product,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete product (soft delete)
  async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const product = await Product.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      );

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Product deactivated successfully',
        product,
      });
    } catch (error) {
      next(error);
    }
  }

  // Permanently delete product
  async permanentDeleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Check if product is being used
      const usageCount = await BusinessProduct.countDocuments({ productId: id });
      if (usageCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete product that is assigned to businesses',
          usageCount
        });
      }

      const product = await Product.findByIdAndDelete(id);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Product permanently deleted',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get products by department
  async getProductsByDepartment(req: Request, res: Response, next: NextFunction) {
    try {
      const { department } = req.params;

      if (!department) {
        return res.status(400).json({ error: 'Invalid department type' });
      }

      const products = await Product.find({
        departmentType: department,
        isActive: true
      });

      res.status(200).json({
        success: true,
        count: products.length,
        department,
        products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get products by process type
  async getProductsByProcessType(req: Request, res: Response, next: NextFunction) {
    try {
      const { processType } = req.params;

      if (!['expedite', 'standard'].includes(processType)) {
        return res.status(400).json({ error: 'Invalid process type' });
      }

      const products = await Product.find({
        processType,
        isActive: true
      });

      res.status(200).json({
        success: true,
        count: products.length,
        processType,
        products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get products by product type (recurring/onetime)
  async getProductsByProductType(req: Request, res: Response, next: NextFunction) {
    try {
      const { productType } = req.params;

      if (!['recurring', 'onetime'].includes(productType)) {
        return res.status(400).json({ error: 'Invalid product type' });
      }

      const products = await Product.find({
        productType,
        isActive: true
      });

      res.status(200).json({
        success: true,
        count: products.length,
        productType,
        products,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get products by category and subcategory
  async getProductsByCategoryAndSubcategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, subcategory } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const skip = (Number(page) - 1) * Number(limit);

      const query: any = {
        isActive: true,
        category: category,
        subCategory: subcategory,
      };

      const products = await Product.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 });

      const total = await Product.countDocuments(query);

      res.status(200).json({
        success: true,
        count: products.length,
        total,
        category,
        subcategory,
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}