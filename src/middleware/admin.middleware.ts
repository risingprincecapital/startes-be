import { Request, Response, NextFunction } from 'express';
import { User } from '../models/user.model';

/**
 * Middleware to check if authenticated user is an admin
 * Must be used after authenticate middleware
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Fetch user to check admin status
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is admin (email ends with @startease.com)
        if (!user.isAdmin) {
            return res.status(403).json({
                error: 'Access denied. Admin privileges required.',
                message: 'Only @startease.com users can access admin features'
            });
        }

        // User is admin, proceed
        next();
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Middleware to check if authenticated user is a super admin
 * Must be used after authenticate middleware
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).userId;

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Fetch user to check super admin status
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Check if user is super admin
        if (!user.isSuperAdmin) {
            return res.status(403).json({
                error: 'Access denied. Super Admin privileges required.',
                message: 'Only super admins can access this feature'
            });
        }

        // User is super admin, proceed
        next();
    } catch (error) {
        console.error('Super Admin middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
