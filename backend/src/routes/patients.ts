import { Router } from 'express';
import * as patientController from '../controllers/patientController';

const router = Router();

// Patient cases
router.post('/', patientController.createPatientCase);
router.get('/', patientController.getAllPatientCases);
// Note: /patient-cases-with-workflows is registered in routes/index.ts (top level)
router.get('/:id', patientController.getPatientCase);
router.patch('/:id/details', patientController.updatePatientDetails);

// Patient-related data
router.get('/:id/workflows', patientController.getPatientWorkflows);
router.get('/:id/communications', patientController.getPatientCommunications);
router.get('/:id/providers', patientController.getPatientProviders);
router.get('/:id/transcripts', patientController.getPatientTranscripts);
router.get('/:id/analysis', patientController.getPatientAnalysis);
router.get('/:id/verifications', patientController.getPatientVerifications);
router.get('/:id/tasks', patientController.getPatientTasks);
router.post('/:id/tasks/initialize', patientController.initializePatientTasks);
router.patch('/tasks/:taskId/status', patientController.updateTaskStatus);

export default router;
