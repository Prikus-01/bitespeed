import { Router } from 'express';
import { identify } from '../controllers/identityController.js';

const router = Router();

/**
 * POST /identify
 * Body: { email?: string, phoneNumber?: string }
 */
router.post('/identify', identify);

export default router;
