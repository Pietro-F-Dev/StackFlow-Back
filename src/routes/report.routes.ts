import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import * as reportController from '../controllers/report.controller';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/monthly', reportController.getMonthlyReport);
router.get('/monthly/export', reportController.exportReport);

export default router;
