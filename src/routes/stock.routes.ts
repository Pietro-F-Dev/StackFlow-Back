import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { validate } from '../middlewares/validate';
import { createMovementSchema } from '../schemas/stock.schema';
import * as stockController from '../controllers/stock.controller';

const router = Router();

router.use(authenticate);

router.post('/movements', requireRole('admin'), validate(createMovementSchema), stockController.createMovement);
router.get('/movements', requireRole('admin'), stockController.listMovements);

export default router;
