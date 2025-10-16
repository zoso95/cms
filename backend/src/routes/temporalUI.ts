import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = Router();

/**
 * Proxy Temporal UI through authenticated backend
 *
 * This allows users to access Temporal UI at /api/temporal-ui/*
 * after logging in, without exposing port 8233 to the internet.
 *
 * The proxy forwards all requests to the temporal-ui Docker container.
 */
router.use('/', createProxyMiddleware({
  target: process.env.TEMPORAL_UI_URL || 'http://localhost:8233',
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying for real-time updates
  onError: (err, req, res) => {
    console.error('[Temporal UI Proxy] Error:', err);
    console.error('[Temporal UI Proxy] Target:', process.env.TEMPORAL_UI_URL || 'http://localhost:8233');
    (res as any).status(503).json({
      error: 'Failed to connect to Temporal UI',
      details: err.message
    });
  },
  onProxyReq: (proxyReq, req, res) => {
    // Log proxied requests for debugging
    console.log(`[Temporal UI Proxy] ${req.method} ${req.path} -> ${proxyReq.path}`);
  },
}));

export default router;
