import { Router } from 'express';
import workflowRoutes from './workflows';
import patientRoutes from './patients';
import verificationRoutes from './verifications';
import webhookRoutes from './webhooks';
import * as patientController from '../controllers/patientController';

const router = Router();

// Special patient cases route (at top level, not nested)
router.get('/patient-cases-with-workflows', patientController.getPatientCasesWithWorkflows);

// Mount all route modules
router.use('/workflows', workflowRoutes);
router.use('/patient-cases', patientRoutes);
router.use('/verifications', verificationRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
