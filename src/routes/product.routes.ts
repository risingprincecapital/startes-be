import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const productController = new ProductController();

// All product routes require authentication
// router.use(authenticate);

// CRUD operations
router.post('/', productController.createProduct.bind(productController));
router.get('/', productController.getAllProducts.bind(productController));
router.get('/department/:department', productController.getProductsByDepartment.bind(productController));
router.get('/process-type/:processType', productController.getProductsByProcessType.bind(productController));
router.get('/product-type/:productType', productController.getProductsByProductType.bind(productController));
router.get('/category/:category/subcategory/:subcategory', productController.getProductsByCategoryAndSubcategory.bind(productController));
router.get('/:id', productController.getProductById.bind(productController));
router.put('/:id', productController.updateProduct.bind(productController));
router.delete('/:id', productController.deleteProduct.bind(productController));
router.delete('/:id/permanent', productController.permanentDeleteProduct.bind(productController));

export default router;