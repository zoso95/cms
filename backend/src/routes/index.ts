import { Router } from 'express';
import workflowRoutes from './workflows';
import patientRoutes from './patients';
import verificationRoutes from './verifications';
import webhookRoutes from './webhooks';
import temporalUIRoutes from './temporalUI';
import temporalUISessionRoutes from './temporalUISession';
import * as patientController from '../controllers/patientController';
import { requireAuth } from '../middleware/auth';
import { requireTemporalUIAuth } from '../middleware/temporalUIAuth';

const router = Router();

// Webhooks - NO AUTH (external services)
router.use('/webhooks', webhookRoutes);

// Temporal UI session init - JWT AUTH (sets session cookie)
router.use('/temporal-ui-session', requireAuth, temporalUISessionRoutes);

// Temporal UI - SESSION-BASED AUTH (for AJAX requests)
router.use('/temporal-ui', requireTemporalUIAuth, temporalUIRoutes);

// All other routes - REQUIRE JWT AUTH
router.use(requireAuth);

// Special patient cases route (at top level, not nested)
router.get('/patient-cases-with-workflows', patientController.getPatientCasesWithWorkflows);

// Mount authenticated route modules
router.use('/workflows', workflowRoutes);
router.use('/patient-cases', patientRoutes);
router.use('/verifications', verificationRoutes);

export default router;
