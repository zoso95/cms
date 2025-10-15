import { Router, Request, Response } from 'express';
import { supabase } from '../db';

const router = Router();

/**
 * Initialize Temporal UI session
 *
 * This endpoint is called by the frontend before opening Temporal UI links.
 * It validates the JWT and sets a session cookie so that subsequent
 * requests to /api/temporal-ui/* don't need the Authorization header.
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Set session
    (req.session as any).authenticated = true;
    (req.session as any).userId = user.id;
    (req.session as any).userEmail = user.email;

    console.log('[Temporal UI Session] ✓ Session initialized for user:', user.email);

    res.json({ success: true });
  } catch (error) {
    console.error('[Temporal UI Session] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
