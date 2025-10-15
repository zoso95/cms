import { Request, Response, NextFunction } from 'express';
import { supabase } from '../db';

/**
 * Authentication middleware that validates Supabase JWT tokens
 *
 * Expects Authorization header: Bearer <jwt_token>
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user to request for use in controllers
    (req as any).user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
