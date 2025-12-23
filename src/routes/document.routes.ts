import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const documentController = new DocumentController();

router.use(authenticate);

// CRUD operations
router.post('/', documentController.uploadDocument.bind(documentController));
router.get('/', documentController.getUserDocuments.bind(documentController));
router.get('/stats', documentController.getDocumentStats.bind(documentController));
router.get('/business/:businessId', documentController.getDocumentsByBusiness.bind(documentController));
// router.get('/category/:category', documentController.getDocumentsByCategory.bind(documentController));
// router.get('/status/:status', documentController.getDocumentsByStatus.bind(documentController));
router.get('/:id', documentController.getDocumentById.bind(documentController));
router.put('/:id', documentController.updateDocument.bind(documentController));
router.delete('/:id', documentController.deleteDocument.bind(documentController));

export default router;