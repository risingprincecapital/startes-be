import { Request, Response, NextFunction } from 'express';
import { UserDocument } from '../models/userDocument.model';
import { Business } from '../models/business.model';
import { Product } from '../models/product.model';
import { BusinessProduct } from '../models/businessProduct.model';
import { uploadToS3, generateSignedUrl } from '../utils/s3';
import mongoose from 'mongoose';

import { NotificationService } from '../services/notification.service';
import { User } from '../models/user.model';

export class DocumentController {
  // Upload a document
  async uploadDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const {
        businessId,
        productId,
        businessProductId,
        docName,
        file,
        docType,
        category,
        description,
        isRequired,
        fileSize,
      } = req.body;

      if (!businessId || !productId || !docName || !file || !docType || !category) {
        return res.status(400).json({
          error: 'businessId, productId, docName, file, docType, and category are required'
        });
      }

      // Verify business belongs to user
      const business = await Business.findOne({ _id: businessId, userId });
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      // Convert base64 to buffer
      let fileBuffer: Buffer;
      let fileName: string;

      try {
        // Extract base64 data (remove data:image/png;base64, prefix if present)
        const base64Data = file.replace(/^data:.*?;base64,/, '');
        fileBuffer = Buffer.from(base64Data, 'base64');

        // Generate file name with proper extension
        const extension = docType.toLowerCase();
        fileName = `${docName.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`;
      } catch (error) {
        return res.status(400).json({ error: 'Invalid file data' });
      }

      // Upload to S3
      let s3Key: string;
      let publicUrl: string;

      try {
        const uploadResult = await uploadToS3(fileBuffer, businessId, productId, fileName);
        s3Key = uploadResult.key;
        publicUrl = uploadResult.publicUrl;
      } catch (error) {
        console.error('S3 upload error:', error);
        return res.status(500).json({ error: 'Failed to upload file to cloud storage' });
      }

      const document = await UserDocument.create({
        userId,
        businessId,
        productId,
        businessProductId,
        docName,
        uploadTime: new Date(),
        file: s3Key, // Store S3 key
        fileUrl: publicUrl, // Store public URL
        docType: docType.toUpperCase(),
        category,
        description: description || '',
        isRequired: isRequired !== undefined ? isRequired : true,
        fileSize: fileSize || fileBuffer.length,
        status: 'uploaded',
      });

      // Notify Admins
      try {
        // Find all admin users (email ends with @startease.com)
        const admins = await User.find({ email: /@startease\.com$/ });
        const adminIds = admins.map(admin => admin._id);

        if (adminIds.length > 0) {
          const user = await User.findById(userId);
          await NotificationService.notifyAdminDocumentUploaded(
            adminIds,
            business.businessName,
            docName,
            user?.email || 'Unknown User',
            business._id
          );
        }
      } catch (notifyError) {
        console.error('Failed to notify admins:', notifyError);
        // Don't fail the request if notification fails
      }

      // Check if all required documents are uploaded for this BusinessProduct
      if (businessProductId && category === 'requiredDoc') {
        const product = await Product.findById(productId);
        const businessProduct = await BusinessProduct.findById(businessProductId);

        if (product && businessProduct) {
          const requiredDocsCount = product.requiredDocs.filter(doc => doc.isRequired).length;
          const uploadedDocsCount = await UserDocument.countDocuments({
            businessProductId,
            category: 'requiredDoc',
            status: { $in: ['uploaded', 'verified'] }
          });

          // If all required documents are uploaded, update progress to 75%
          // Admin will add acknowledgement and mark as verified to reach 100%
          // if (uploadedDocsCount >= requiredDocsCount) {
          //   const completedSteps = businessProduct.completedSteps || [];
          //   if (!completedSteps.includes('documentation')) {
          //     completedSteps.push('documentation');
          //   }

          //   await BusinessProduct.findByIdAndUpdate(businessProductId, {
          //     progress: 75,
          //     completedSteps,
          //     // Status remains 'active' - admin will mark as 'completed' later
          //   });
          // }
        }
      }

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        document,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all documents for authenticated user
  async getUserDocuments(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const {
        category,
        status,
        businessId,
        productId,
        docType
      } = req.query;

      const filter: any = { userId };

      if (category) filter.category = category;
      if (status) filter.status = status;
      if (businessId) filter.businessId = businessId;
      if (productId) filter.productId = productId;
      if (docType) filter.docType = docType;

      const documents = await UserDocument.find(filter)
        .populate('businessId', 'businessName entityType')
        .populate('productId', 'productName price')
        .populate('userId', 'email')
        .sort({ uploadTime: -1 });

      // Generate signed URLs for all documents
      const documentsWithSignedUrls = await Promise.all(documents.map(async (doc) => {
        const docObj = doc.toObject();
        if (doc.file) {
          try {
            docObj.fileUrl = await generateSignedUrl(doc.file);
          } catch (error) {
            console.error(`Failed to generate signed URL for document ${doc._id}:`, error);
          }
        }
        return docObj;
      }));

      res.status(200).json({
        success: true,
        count: documentsWithSignedUrls.length,
        documents: documentsWithSignedUrls,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get documents by business
  async getDocumentsByBusiness(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { businessId } = req.params;

      // Verify business belongs to user
      const business = await Business.findOne({ _id: businessId, userId });
      if (!business) {
        return res.status(404).json({ error: 'Business not found' });
      }

      const documents = await UserDocument.find({ businessId })
        .populate('productId', 'productName')
        .sort({ category: 1, uploadTime: -1 });

      // Generate signed URLs
      const documentsWithSignedUrls = await Promise.all(documents.map(async (doc) => {
        const docObj = doc.toObject();
        if (doc.file) {
          try {
            docObj.fileUrl = await generateSignedUrl(doc.file);
          } catch (error) {
            console.error(`Failed to generate signed URL for document ${doc._id}:`, error);
          }
        }
        return docObj;
      }));

      const grouped = {
        requiredDocs: documentsWithSignedUrls.filter((doc: any) => doc.category === 'requiredDoc'),
        acknowledgements: documentsWithSignedUrls.filter((doc: any) => doc.category === 'acknowledgement'),
      };

      res.status(200).json({
        success: true,
        businessId,
        business: {
          businessName: business.businessName,
          entityType: business.entityType,
        },
        total: documentsWithSignedUrls.length,
        requiredDocsCount: grouped.requiredDocs.length,
        acknowledgementsCount: grouped.acknowledgements.length,
        documents: grouped,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get single document with full details
  async getDocumentById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const document = await UserDocument.findOne({ _id: id, userId })
        .populate('businessId', 'businessName entityType compLocation')
        .populate('productId', 'productName price departmentType')
        .populate('userId', 'email')
        .populate('verifiedBy', 'email');

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const docObj = document.toObject();
      if (document.file) {
        try {
          docObj.fileUrl = await generateSignedUrl(document.file);
        } catch (error) {
          console.error(`Failed to generate signed URL for document ${document._id}:`, error);
        }
      }

      res.status(200).json({
        success: true,
        document: docObj,
      });
    } catch (error) {
      next(error);
    }
  }

  // Update document
  async updateDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;
      const updateData = req.body;

      delete updateData.userId;
      delete updateData.businessId;
      delete updateData.productId;

      const document = await UserDocument.findOneAndUpdate(
        { _id: id, userId },
        updateData,
        { new: true, runValidators: true }
      );

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Document updated successfully',
        document,
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete document
  async deleteDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;
      const { id } = req.params;

      const document = await UserDocument.findOneAndDelete({ _id: id, userId });

      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  // Get document statistics
  async getDocumentStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId;

      const stats = await UserDocument.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            requiredDocs: {
              $sum: { $cond: [{ $eq: ['$category', 'requiredDoc'] }, 1, 0] }
            },
            acknowledgements: {
              $sum: { $cond: [{ $eq: ['$category', 'acknowledgement'] }, 1, 0] }
            },
            pending: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
            },
            uploaded: {
              $sum: { $cond: [{ $eq: ['$status', 'uploaded'] }, 1, 0] }
            },
            verified: {
              $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
            },
            totalSize: { $sum: '$fileSize' },
          }
        }
      ]);

      res.status(200).json({
        success: true,
        stats: stats[0] || {
          total: 0,
          requiredDocs: 0,
          acknowledgements: 0,
          pending: 0,
          uploaded: 0,
          verified: 0,
          rejected: 0,
          totalSize: 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}