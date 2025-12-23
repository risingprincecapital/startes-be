import { Router } from 'express';
import { BusinessProductController } from '../controllers/businessProduct.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const businessProductController = new BusinessProductController();

router.use(authenticate);

// CRUD operations
router.get('/', businessProductController.getUserProducts.bind(businessProductController));
router.get('/status/:status', businessProductController.getProductsByStatus.bind(businessProductController));
router.get('/:id', businessProductController.getProductDetails.bind(businessProductController));
router.put('/:id', businessProductController.updateProductStatus.bind(businessProductController));
router.post('/:id/verify-complete', businessProductController.verifyAndCompleteProduct.bind(businessProductController));
router.delete('/:id', businessProductController.deleteBusinessProduct.bind(businessProductController));
router.delete('/:id/permanent', businessProductController.permanentDeleteBusinessProduct.bind(businessProductController));

export default router;