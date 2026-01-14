import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/admin.middleware';
import { AdminBusinessController } from '../controllers/admin/adminBusiness.controller';
import { AdminDocumentController } from '../controllers/admin/adminDocument.controller';
import { RequiredDocumentController } from '../controllers/admin/requiredDocument.controller';
import { AdminProductController } from '../controllers/admin/product.controller';

const router = Router();
const adminBusinessController = new AdminBusinessController();
const adminDocumentController = new AdminDocumentController();
const requiredDocumentController = new RequiredDocumentController();
const adminProductController = new AdminProductController();

// Apply authentication and admin check to all routes
router.use(authenticate);
router.use(requireAdmin);

// Business Management Routes
router.get('/businesses', adminBusinessController.getAllBusinesses.bind(adminBusinessController));
router.get('/businesses/:id', adminBusinessController.getBusinessById.bind(adminBusinessController));
router.get('/businesses/:id/missing-fields', adminBusinessController.getBusinessMissingFields.bind(adminBusinessController));
router.put('/businesses/:id', adminBusinessController.updateBusiness.bind(adminBusinessController));
router.post('/businesses/:id/recommended-products', adminBusinessController.addRecommendedProduct.bind(adminBusinessController));
router.delete('/businesses/:id/recommended-products/:productId', adminBusinessController.removeRecommendedProduct.bind(adminBusinessController));

// Document Management Routes
router.get('/documents/business/:businessId', adminDocumentController.getBusinessDocuments.bind(adminDocumentController));
router.put('/documents/:id/verify', adminDocumentController.verifyDocument.bind(adminDocumentController));
router.put('/documents/:id/reject', adminDocumentController.rejectDocument.bind(adminDocumentController));
router.post('/documents/acknowledgement', adminDocumentController.uploadAcknowledgement.bind(adminDocumentController));
router.delete('/documents/:id', adminDocumentController.deleteDocument.bind(adminDocumentController));

// Super Admin Routes (Protected by requireSuperAdmin)
// Required Documents CRUD
router.post('/required-documents', requireSuperAdmin, requiredDocumentController.createRequiredDocument.bind(requiredDocumentController));
router.get('/required-documents', requireSuperAdmin, requiredDocumentController.getAllRequiredDocuments.bind(requiredDocumentController));
router.get('/required-documents/:id', requireSuperAdmin, requiredDocumentController.getRequiredDocumentById.bind(requiredDocumentController));
router.put('/required-documents/:id', requireSuperAdmin, requiredDocumentController.updateRequiredDocument.bind(requiredDocumentController));
router.delete('/required-documents/:id', requireSuperAdmin, requiredDocumentController.deleteRequiredDocument.bind(requiredDocumentController));

// Products CRUD
router.post('/products', requireSuperAdmin, adminProductController.createProduct.bind(adminProductController));
router.get('/products', requireSuperAdmin, adminProductController.getAllProducts.bind(adminProductController));
router.get('/products/:id', requireSuperAdmin, adminProductController.getProductById.bind(adminProductController));
router.put('/products/:id', requireSuperAdmin, adminProductController.updateProduct.bind(adminProductController));
router.delete('/products/:id', requireSuperAdmin, adminProductController.deleteProduct.bind(adminProductController));

export default router;
