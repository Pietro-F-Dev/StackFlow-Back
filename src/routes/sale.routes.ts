import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createSaleSchema } from '../schemas/sale.schema';
import * as saleController from '../controllers/sale.controller';

const router = Router();

router.use(authenticate);

router.post('/', validate(createSaleSchema), saleController.createSale);
router.get('/', saleController.listSales);
router.get('/:id', saleController.getSale);

export default router;
