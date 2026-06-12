import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { authenticate } from '../middlewares/auth';
import { requireRole } from '../middlewares/requireRole';
import { authRateLimiter } from '../middlewares/rateLimiter';
import { loginSchema, registerSchema, refreshSchema, updateProfileSchema } from '../schemas/auth.schema';
import * as authController from '../controllers/auth.controller';

const router = Router();

router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', validate(refreshSchema), authController.logout);
router.post('/register', authenticate, requireRole('admin'), validate(registerSchema), authController.register);
router.patch('/me', authenticate, validate(updateProfileSchema), authController.updateProfile);

export default router;
