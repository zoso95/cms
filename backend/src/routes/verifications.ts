import { Router } from 'express';
import * as verificationController from '../controllers/verificationController';

const router = Router();

// Verification operations
router.get('/:id', verificationController.getVerification);
router.post('/:id/approve', verificationController.approveVerification);
router.post('/:id/reject', verificationController.rejectVerification);

export default router;
