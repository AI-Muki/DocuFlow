import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../../lib/auth.ts';
import { ForbiddenError, TenantViolationError, UnauthorizedError, formatErrorResponse } from '../../lib/errors.ts';
import { store } from '../../database/store.ts';
import { rbacService } from '../rbac/rbac.service.ts';
import type { PermissionKey, User } from '../../types/index.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
  tenantContext?: {
    organizationId: string;
  };
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.cookies && req.cookies['docuflow_token']) {
    return req.cookies['docuflow_token'];
  }
  return null;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedError('Authentication token is required');
    }

    const payload = verifyToken(token);
    const user = store.findUserById(payload.userId);
    if (!user) {
      throw new UnauthorizedError('User account not found or deactivated');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedError('Account is suspended');
    }

    req.user = user;
    if (user.organizationId) {
      req.tenantContext = {
        organizationId: user.organizationId,
      };
    }

    next();
  } catch (err: unknown) {
    res.status(401).json(formatErrorResponse(err));
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  authenticate(req, res, next);
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(formatErrorResponse(new UnauthorizedError()));
      return;
    }

    const hasPerm = rbacService.hasPermission(req.user, permission);
    if (!hasPerm) {
      res.status(403).json(
        formatErrorResponse(
          new ForbiddenError(`Missing required permission: ${permission}`)
        )
      );
      return;
    }

    next();
  };
}

export function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.organizationId) {
    res.status(403).json(
      formatErrorResponse(
        new ForbiddenError('User does not belong to an active organization')
      )
    );
    return;
  }

  // If a route parameter :organizationId exists, strictly verify it matches the user's organization
  const requestedOrgId = req.params.organizationId || req.query.organizationId;
  if (requestedOrgId && requestedOrgId !== req.user.organizationId) {
    const isSuperAdmin = req.user.roles.some((r) => r.name === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      res.status(403).json(formatErrorResponse(new TenantViolationError()));
      return;
    }
  }

  next();
}
