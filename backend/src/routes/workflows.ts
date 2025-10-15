import { Router } from 'express';
import * as workflowController from '../controllers/workflowController';

const router = Router();

// Workflow catalog and source
router.get('/catalog', workflowController.getWorkflowCatalog);
router.get('/:workflowName/source', workflowController.getWorkflowSource);

// Workflow operations
router.post('/start', workflowController.startWorkflow);
router.get('/:workflowId', workflowController.getWorkflowStatus);
router.get('/:workflowId/children', workflowController.getChildWorkflows);

// Workflow control
router.post('/:workflowId/signal', workflowController.sendWorkflowSignal);
router.post('/:workflowId/pause', workflowController.pauseWorkflow);
router.post('/:workflowId/resume', workflowController.resumeWorkflow);
router.post('/:workflowId/stop', workflowController.stopWorkflow);
router.delete('/:executionId', workflowController.deleteWorkflow);

export default router;
