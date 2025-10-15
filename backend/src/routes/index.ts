import { Router } from 'express';
import workflowRoutes from './workflows';
import patientRoutes from './patients';
import verificationRoutes from './verifications';
import webhookRoutes from './webhooks';
import * as patientController from '../controllers/patientController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Webhooks - NO AUTH (external services)
router.use('/webhooks', webhookRoutes);

// All other routes - REQUIRE AUTH
router.use(requireAuth);

// Special patient cases route (at top level, not nested)
router.get('/patient-cases-with-workflows', patientController.getPatientCasesWithWorkflows);

// Mount authenticated route modules
router.use('/workflows', workflowRoutes);
router.use('/patient-cases', patientRoutes);
router.use('/verifications', verificationRoutes);

export default router;
