import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { validate } from '../middlewares/validate';
import { createProductSchema, updateProductSchema } from '../schemas/product.schema';
import * as productController from '../controllers/product.controller';

const router = Router();

router.use(authenticate);

// Must be declared before /:id to avoid route conflict
router.get('/low-stock', productController.getLowStock);

router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);
router.post('/', requireRole('admin'), validate(createProductSchema), productController.createProduct);
router.put('/:id', requireRole('admin'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', requireRole('admin'), productController.deleteProduct);

export default router;
