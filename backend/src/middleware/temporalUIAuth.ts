import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';

/**
 * Session-based authentication for Temporal UI proxy
 *
 * This middleware handles authentication for the Temporal UI proxy route.
 * Since Temporal UI makes many AJAX requests without auth headers,
 * we use a session cookie to maintain authentication state.
 *
 * Flow:
 * 1. First request includes Authorization header (from frontend)
 * 2. Validate JWT and set session cookie
 * 3. Subsequent requests use session cookie
 */
export async function requireTemporalUIAuth(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('[Temporal UI Auth] Request:', req.method, req.path);
    console.log('[Temporal UI Auth] Session authenticated:', (req.session as any)?.authenticated);
    console.log('[Temporal UI Auth] Has auth header:', !!req.headers.authorization);

    // Check if already authenticated via session
    if ((req.session as any)?.authenticated) {
      console.log('[Temporal UI Auth] ✓ Authenticated via session');
      return next();
    }

    // Check for Authorization header (first-time auth)
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Temporal UI Auth] ✗ No valid authorization header');
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

    next();
  } catch (error) {
    console.error('Temporal UI auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
