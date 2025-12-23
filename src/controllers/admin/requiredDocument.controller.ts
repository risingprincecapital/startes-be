import { Request, Response, NextFunction } from 'express';
import { RequiredDocument } from '../../models/requiredDocument.model';

export class RequiredDocumentController {
    // Create a new required document template
    async createRequiredDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { docName, description, docType, isRequired } = req.body;

            if (!docName || !description || !docType) {
                return res.status(400).json({
                    error: 'docName, description, and docType are required',
                });
            }

            const existingDoc = await RequiredDocument.findOne({ docName });
            if (existingDoc) {
                return res.status(400).json({
                    error: 'Document with this name already exists',
                });
            }

            const document = await RequiredDocument.create({
                docName,
                description,
                docType,
                isRequired: isRequired !== undefined ? isRequired : true,
            });

            res.status(201).json({
                success: true,
                message: 'Required document template created successfully',
                document,
            });
        } catch (error) {
            next(error);
        }
    }

    // Get all required document templates
    async getAllRequiredDocuments(req: Request, res: Response, next: NextFunction) {
        try {
            const documents = await RequiredDocument.find().sort({ createdAt: -1 });

            res.status(200).json({
                success: true,
                count: documents.length,
                documents,
            });
        } catch (error) {
            next(error);
        }
    }

    // Get required document by ID
    async getRequiredDocumentById(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const document = await RequiredDocument.findById(id);

            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                });
            }

            res.status(200).json({
                success: true,
                document,
            });
        } catch (error) {
            next(error);
        }
    }

    // Update required document
    async updateRequiredDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const { docName, description, docType, isRequired } = req.body;

            const document = await RequiredDocument.findById(id);
            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                });
            }

            // Check if new name conflicts with existing document
            if (docName && docName !== document.docName) {
                const existingDoc = await RequiredDocument.findOne({ docName });
                if (existingDoc) {
                    return res.status(400).json({
                        error: 'Document with this name already exists',
                    });
                }
            }

            // Update fields
            if (docName) document.docName = docName;
            if (description) document.description = description;
            if (docType) document.docType = docType;
            if (isRequired !== undefined) document.isRequired = isRequired;

            await document.save();

            res.status(200).json({
                success: true,
                message: 'Document updated successfully',
                document,
            });
        } catch (error) {
            next(error);
        }
    }

    // Delete required document
    async deleteRequiredDocument(req: Request, res: Response, next: NextFunction) {
        try {
            const { id } = req.params;
            const document = await RequiredDocument.findByIdAndDelete(id);

            if (!document) {
                return res.status(404).json({
                    error: 'Document not found',
                });
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
