import { Router, type Response } from 'express';
import { authService } from '../modules/auth/auth.service.ts';
import {
  type AuthenticatedRequest,
  extractToken,
  requireAuth,
  requirePermission,
  requireTenant,
} from '../modules/auth/auth.middleware.ts';
import { organizationService } from '../modules/organization/organization.service.ts';
import { departmentService } from '../modules/department/department.service.ts';
import { userService } from '../modules/users/user.service.ts';
import { documentRouter } from '../modules/documents/document.routes.ts';
import { store } from '../database/store.ts';
import { formatErrorResponse, ValidationError } from '../lib/errors.ts';
import {
  loginSchema,
  onboardingOrgSchema,
  registerSchema,
} from '../validation/auth.schema.ts';
import {
  createDepartmentSchema,
  createUserSchema,
  updateOrganizationSchema,
} from '../validation/organization.schema.ts';

export const apiRouter = Router();

// Health Check
apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'DocuFlow AI API',
    phase: 'Phase 2A: Document & Folder Foundation',
    timestamp: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------
// Authentication & Onboarding Routes
// ----------------------------------------------------------------------

apiRouter.post('/auth/register', async (req, res) => {
  try {
    const parseResult = registerSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const session = await authService.register(parseResult.data);
    res.cookie('docuflow_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ success: true, data: session });
  } catch (err: unknown) {
    const formatted = formatErrorResponse(err);
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatted);
  }
});

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const session = await authService.login(parseResult.data, clientIp);

    res.cookie('docuflow_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: session });
  } catch (err: unknown) {
    const formatted = formatErrorResponse(err);
    const status = (err as { statusCode?: number }).statusCode || 401;
    res.status(status).json(formatted);
  }
});

apiRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('docuflow_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const session = await authService.getSession(req.user!.id);
    res.json({ success: true, data: session });
  } catch (err: unknown) {
    res.status(401).json(formatErrorResponse(err));
  }
});

apiRouter.post('/auth/onboarding/organization', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = onboardingOrgSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Validation failed', parseResult.error.issues);
    }

    const session = await authService.createOrganizationForUser(req.user!.id, parseResult.data);
    res.status(201).json({ success: true, data: session });
  } catch (err: unknown) {
    const formatted = formatErrorResponse(err);
    const status = (err as { statusCode?: number }).statusCode || 400;
    res.status(status).json(formatted);
  }
});

// ----------------------------------------------------------------------
// Dashboard & Analytics Overview (Real Data Only)
// ----------------------------------------------------------------------

apiRouter.get('/dashboard/overview', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.user!.organizationId!;
    const overview = organizationService.getDashboardOverview(orgId);
    res.json({ success: true, data: overview });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Organization & Settings Routes
// ----------------------------------------------------------------------

apiRouter.get('/organization', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const org = organizationService.getById(req.user!.organizationId!);
    res.json({ success: true, data: org });
  } catch (err: unknown) {
    res.status(404).json(formatErrorResponse(err));
  }
});

apiRouter.patch(
  '/organization',
  requireAuth,
  requireTenant,
  requirePermission('organization.manage'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const parseResult = updateOrganizationSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Validation failed', parseResult.error.issues);
      }

      const updated = organizationService.update(req.user!.organizationId!, parseResult.data, req.user!.id);
      res.json({ success: true, data: updated });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode || 400;
      res.status(status).json(formatErrorResponse(err));
    }
  }
);

// ----------------------------------------------------------------------
// Departments (Multi-Tenant Scoped)
// ----------------------------------------------------------------------

apiRouter.get('/departments', requireAuth, requireTenant, (req: AuthenticatedRequest, res: Response) => {
  try {
    const depts = departmentService.listByOrganization(req.user!.organizationId!);
    res.json({ success: true, data: depts });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

apiRouter.post(
  '/departments',
  requireAuth,
  requireTenant,
  requirePermission('departments.manage'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const parseResult = createDepartmentSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Validation failed', parseResult.error.issues);
      }

      const dept = departmentService.create(req.user!.organizationId!, parseResult.data, req.user!.id);
      res.status(201).json({ success: true, data: dept });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode || 400;
      res.status(status).json(formatErrorResponse(err));
    }
  }
);

// ----------------------------------------------------------------------
// Users & Member Directory (Multi-Tenant Scoped)
// ----------------------------------------------------------------------

apiRouter.get(
  '/users',
  requireAuth,
  requireTenant,
  requirePermission('users.read'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = userService.listByOrganization(req.user!.organizationId!);
      res.json({ success: true, data: users });
    } catch (err: unknown) {
      res.status(500).json(formatErrorResponse(err));
    }
  }
);

apiRouter.post(
  '/users',
  requireAuth,
  requireTenant,
  requirePermission('users.manage'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const parseResult = createUserSchema.safeParse(req.body);
      if (!parseResult.success) {
        throw new ValidationError('Validation failed', parseResult.error.issues);
      }

      const user = await userService.createInOrganization(req.user!.organizationId!, parseResult.data, req.user!.id);
      res.status(201).json({ success: true, data: user });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode || 400;
      res.status(status).json(formatErrorResponse(err));
    }
  }
);

// ----------------------------------------------------------------------
// Roles & Permissions Infrastructure
// ----------------------------------------------------------------------

apiRouter.get('/roles', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = store.getRoles(req.user?.organizationId);
    const systemPermissions = store.getSystemPermissions();
    res.json({
      success: true,
      data: {
        roles,
        permissions: systemPermissions,
      },
    });
  } catch (err: unknown) {
    res.status(500).json(formatErrorResponse(err));
  }
});

// ----------------------------------------------------------------------
// Phase 2A: Documents, Folders, Types, Tags & Versions
// ----------------------------------------------------------------------
apiRouter.use('/', documentRouter);


apiRouter.get(
  '/audit-logs',
  requireAuth,
  requireTenant,
  requirePermission('audit.read'),
  (req: AuthenticatedRequest, res: Response) => {
    try {
      const logs = organizationService.getAuditLogs(req.user!.organizationId!);
      res.json({ success: true, data: logs });
    } catch (err: unknown) {
      res.status(500).json(formatErrorResponse(err));
    }
  }
);
