import { defineSignal, setHandler, condition, log } from '@temporalio/workflow';

/**
 * Shared pause/resume signals for all workflows
 *
 * Usage:
 * 1. Call setupPauseHandlers() at the start of your workflow
 * 2. Call checkPaused() before each major step to wait while paused
 * 3. For parent workflows, call pauseChildren() when receiving pause signal
 */

export const pauseSignal = defineSignal('pause');
export const resumeSignal = defineSignal('resume');

let isPaused = false;

/**
 * Sets up pause/resume signal handlers
 * Call this once at the start of your workflow
 */
export function setupPauseHandlers(): void {
  setHandler(pauseSignal, () => {
    log.info('Workflow paused');
    isPaused = true;
  });

  setHandler(resumeSignal, () => {
    log.info('Workflow resumed');
    isPaused = false;
  });
}

/**
 * Checks if workflow is paused and waits until resumed
 * Call this before each major step in your workflow
 */
export async function checkPaused(): Promise<void> {
  if (isPaused) {
    log.info('Workflow is paused, waiting for resume...');
    await condition(() => !isPaused);
    log.info('Workflow resumed, continuing execution');
  }
}

/**
 * Gets the current pause state
 */
export function getPauseState(): boolean {
  return isPaused;
}
