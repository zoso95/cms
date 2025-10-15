import { apiRequest } from '../api/client';

/**
 * Open Temporal UI link with authentication
 *
 * This function:
 * 1. Makes an authenticated API call to initialize the session cookie
 * 2. Opens the Temporal UI link in a new tab
 *
 * This ensures the session cookie is set before the browser navigates
 * to the Temporal UI, so authenticated requests work properly.
 */
export async function openTemporalUILink(workflowId: string, runId: string) {
  // Open window immediately (before async call) to avoid pop-up blocker
  const win = window.open('about:blank', '_blank', 'noopener,noreferrer');

  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site.');
    return;
  }

  try {
    // Show loading message in the new window
    win.document.write('<html><body><h2>Loading Temporal UI...</h2></body></html>');

    // Initialize session cookie
    await apiRequest('/temporal-ui-session/init', {
      method: 'POST',
    });

    // Build Temporal UI URL
    const baseUrl = import.meta.env.VITE_TEMPORAL_UI_URL || 'http://localhost:3001/api/temporal-ui';
    const url = `${baseUrl}/namespaces/default/workflows/${workflowId}/${runId}`;

    // Navigate the already-open window
    win.location.href = url;

    // Log for debugging
    console.log('[Temporal UI] Opening:', url);
  } catch (error) {
    console.error('Failed to open Temporal UI:', error);
    win.document.write(`<html><body><h2>Error loading Temporal UI</h2><p>${error}</p></body></html>`);
  }
}

/**
 * Initialize Temporal UI session (for hover pre-loading)
 */
export async function initTemporalUISession() {
  try {
    await apiRequest('/temporal-ui-session/init', {
      method: 'POST',
    });
  } catch (error) {
    console.error('Failed to initialize Temporal UI session:', error);
  }
}

/**
 * Open Temporal UI homepage
 */
export async function openTemporalUIHome() {
  try {
    // Initialize session cookie
    await apiRequest('/temporal-ui-session/init', {
      method: 'POST',
    });

    // Build Temporal UI URL
    const baseUrl = import.meta.env.VITE_TEMPORAL_UI_URL || 'http://localhost:3001/api/temporal-ui';
    const url = `${baseUrl}/namespaces/default/workflows`;

    // Open in new tab
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Failed to open Temporal UI:', error);
    alert('Failed to open Temporal UI. Please try again.');
  }
}
