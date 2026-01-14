import { Request, Response, NextFunction } from 'express';
import { UserDocument } from '../../models/userDocument.model';
import { Business } from '../../models/business.model';
import { BusinessProduct } from '../../models/businessProduct.model';
import { Product } from '../../models/product.model';
import { uploadToS3, generateSignedUrl } from '../../utils/s3';
import { NotificationService } from '../../services/notification.service';
import { emailService } from '../../services/email.service';
import { User } from '../../models/user.model';

export class AdminDocumentController {
    // Get all documents for a business (only for purchased products)
    async getBusinessDocuments(req: Request, res: Response, next: NextFunction) {
        try {
            const { businessId } = req.params;

            // Get all products associated with this business
            const purchaseData = await BusinessProduct.find({ businessId })
                .populate('productId')
                .sort({ startDate: -1 });

            // Get purchased product IDs
            const purchasedProductIds = purchaseData.map(p => p.productId._id.toString());

            // Get documents only for purchased products
            const documents = await UserDocument.find({
                businessId,
                productId: { $in: purchasedProductIds }
            })
                .populate('productId', 'productName')
                .populate('businessProductId', 'progress status completedSteps')
                .populate('verifiedBy', 'email name')
                .sort({ uploadTime: -1 });

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

            // Group by product
            const groupedDocs = documentsWithSignedUrls.reduce((acc: any, doc: any) => {
                const productId = doc.productId._id.toString();
                if (!acc[productId]) {
                    acc[productId] = {
                        product: doc.productId,
                        businessProduct: doc.businessProductId,
                        documents: []
                    };
                }
                acc[productId].documents.push(doc);
                return acc;
            }, {});

            res.status(200).json({
                success: true,
                // business: {
                //     _id: purchaseData?.businessId,
                //     businessName: purchaseData.businessName,
                //     entityType: business.entityType
                // },
                documentsByProduct: Object.values(groupedDocs)
            });
        } catch (error) {
            next(error);
        }
    }

    // Verify a document
    async verifyDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const adminId = (req as any).userId;

            const document = await UserDocument.findById(id);
            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Update document status
            document.status = 'verified';
            document.verifiedBy = adminId;
            document.verifiedAt = new Date();
            await document.save();

            // Update BusinessProduct if this is a required document
            if (document.businessProductId && document.category === 'requiredDoc') {
                const businessProduct = await BusinessProduct.findById(document.businessProductId);

                if (businessProduct) {
                    // Fetch the product to get the list of required documents
                    const product = await Product.findById(businessProduct.productId);

                    if (product) {
                        // Get all required document names from the product
                        const requiredDocNames = product.requiredDocs
                            .filter(doc => doc.category === 'requiredDoc' && doc.isRequired)
                            .map(doc => doc.docName);

                        // Get all verified documents for this business product
                        const verifiedDocs = await UserDocument.find({
                            businessProductId: document.businessProductId,
                            status: 'verified',
                            category: 'requiredDoc'
                        });

                        const verifiedDocNames = verifiedDocs.map(doc => doc.docName);

                        // Check if all required documents are verified
                        const allVerified = requiredDocNames.every(name => verifiedDocNames.includes(name));

                        if (allVerified) {
                            // Initialize completedSteps if undefined
                            if (!businessProduct.completedSteps) {
                                businessProduct.completedSteps = [];
                            }

                            // Add 'documentation' to completedSteps if not already there
                            if (!businessProduct.completedSteps.includes('documentation')) {
                                businessProduct.completedSteps.push('documentation');
                            }

                            // Set progress to 75% and keep status as 'active'
                            businessProduct.progress = 75;
                            businessProduct.status = 'active';

                            await businessProduct.save();
                        }
                    }
                }
            }

            // Send notification and email to user
            try {
                const business = await Business.findById(document.businessId);
                if (business) {
                    // Send push notification
                    await NotificationService.notifyDocumentVerified(
                        business.userId,
                        business.businessName,
                        document.docName,
                        business._id
                    );

                    // Send email notification
                    const user = await User.findById(business.userId);
                    if (user) {
                        await emailService.sendDocumentApprovedEmail(
                            user.email,
                            {
                                userName: user.name || user.email,
                                documentName: document.docName,
                                businessName: business.businessName,
                                actionUrl: `${process.env.FRONTEND_URL}`,
                            },
                            user._id.toString()
                        );
                    }
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            const updatedDocument = await UserDocument.findById(id)
                .populate('verifiedBy', 'email name');

            res.status(200).json({
                success: true,
                message: 'Document verified successfully',
                document: updatedDocument
            });
        } catch (error) {
            next(error);
        }
    }

    // Reject a document
    async rejectDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { rejectionReason } = req.body;

            if (!rejectionReason) {
                return res.status(400).json({ error: 'Rejection reason is required' });
            }

            const document = await UserDocument.findById(id);
            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // Update document status
            document.status = 'rejected';
            document.rejectionReason = rejectionReason;
            await document.save();

            // Send notification and email to user
            try {
                const business = await Business.findById(document.businessId);
                if (business) {
                    // Send push notification
                    await NotificationService.notifyDocumentRejected(
                        business.userId,
                        business.businessName,
                        document.docName,
                        rejectionReason,
                        business._id
                    );

                    // Send email notification
                    const user = await User.findById(business.userId);
                    if (user) {
                        await emailService.sendDocumentRejectedEmail(
                            user.email,
                            {
                                userName: user.name || user.email,
                                documentName: document.docName,
                                businessName: business.businessName,
                                rejectionReason: rejectionReason,
                                actionUrl: `${process.env.FRONTEND_URL}`,
                            },
                            user._id.toString()
                        );
                    }
                }
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.status(200).json({
                success: true,
                message: 'Document rejected',
                document
            });
        } catch (error) {
            next(error);
        }
    }

    // Upload acknowledgement document
    async uploadAcknowledgement(req: Request, res: Response, next: NextFunction) {
        try {
            const adminId = (req as any).userId;
            const {
                businessId,
                productId,
                businessProductId,
                docName,
                file,
                description
            } = req.body;

            if (!businessId || !productId || !businessProductId || !docName || !file) {
                return res.status(400).json({
                    error: 'businessId, productId, businessProductId, docName, and file are required'
                });
            }

            // Verify business and product exist
            const business = await Business.findById(businessId);
            if (!business) {
                return res.status(404).json({ error: 'Business not found' });
            }

            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            const businessProduct = await BusinessProduct.findById(businessProductId);
            if (!businessProduct) {
                return res.status(404).json({ error: 'Business product not found' });
            }

            // Convert base64 to buffer
            let fileBuffer: Buffer;
            let fileName: string;

            try {
                const base64Data = file.replace(/^data:.*?;base64,/, '');
                fileBuffer = Buffer.from(base64Data, 'base64');
                fileName = `${docName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
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

            // Create acknowledgement document
            const document = await UserDocument.create({
                userId: business.userId,
                businessId,
                productId,
                businessProductId,
                docName,
                uploadTime: new Date(),
                file: s3Key,
                fileUrl: publicUrl,
                docType: 'PDF',
                category: 'acknowledgement',
                description: description || 'Acknowledgement document uploaded by admin',
                isRequired: false,
                fileSize: fileBuffer.length,
                status: 'verified',
                verifiedBy: adminId,
                verifiedAt: new Date()
            });

            // Update BusinessProduct to 100% completion
            if (!businessProduct.completedSteps) {
                businessProduct.completedSteps = [];
            }
            if (!businessProduct.completedSteps.includes('acknowledgement')) {
                businessProduct.completedSteps.push('acknowledgement');
            }
            businessProduct.progress = 100;
            businessProduct.status = 'completed';
            await businessProduct.save();

            // Send notification to user
            try {
                await NotificationService.notifyAcknowledgementUploaded(
                    business.userId,
                    business.businessName,
                    product.productName,
                    business._id
                );
            } catch (notifError) {
                console.error('Failed to send notification:', notifError);
            }

            res.status(201).json({
                success: true,
                message: 'Acknowledgement uploaded successfully',
                document,
                businessProduct
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete document
    async deleteDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;

            const document = await UserDocument.findByIdAndDelete(id);

            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            // If an acknowledgement is deleted, check if any others remain
            if (document.category === 'acknowledgement' && document.businessProductId) {
                const remainingAcks = await UserDocument.countDocuments({
                    businessProductId: document.businessProductId,
                    category: 'acknowledgement'
                });

                // If no acknowledgements left, roll back business product state
                if (remainingAcks === 0) {
                    const businessProduct = await BusinessProduct.findById(document.businessProductId);
                    if (businessProduct) {
                        businessProduct.status = 'active';
                        businessProduct.progress = 75;
                        if (businessProduct.completedSteps) {
                            businessProduct.completedSteps = businessProduct.completedSteps.filter(
                                step => step !== 'acknowledgement'
                            );
                        }
                        await businessProduct.save();
                    }
                }
            }

            res.status(200).json({
                success: true,
                message: 'Document deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }
}
