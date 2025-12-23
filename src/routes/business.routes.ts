import { Router } from 'express';
import { BusinessController } from '../controllers/business.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const businessController = new BusinessController();

router.use(authenticate);

// CRUD operations
router.post('/', businessController.createBusiness.bind(businessController));
router.get('/', businessController.getUserBusinesses.bind(businessController));
router.get('/stats', businessController.getBusinessStats.bind(businessController));
router.get('/entity/:entityType', businessController.getBusinessesByEntityType.bind(businessController));
router.get('/location/:location', businessController.getBusinessesByLocation.bind(businessController));
router.get('/:id', businessController.getBusinessById.bind(businessController));
router.put('/:id', businessController.updateBusiness.bind(businessController));
router.delete('/:id', businessController.deleteBusiness.bind(businessController));
router.delete('/:id/permanent', businessController.permanentDeleteBusiness.bind(businessController));

// Product management
router.post('/:businessId/products', businessController.addProductToBusiness.bind(businessController));
router.get('/:businessId/recommended-products', businessController.getRecommendedProducts.bind(businessController));

// Business field operations
router.get('/:id/missing-fields/:productId', businessController.getMissingBusinessFields.bind(businessController));
router.patch('/:id/update-info', businessController.updateBusinessInfo.bind(businessController));

export default router;

