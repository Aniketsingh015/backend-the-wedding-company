import express from 'express';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { OrganizationService, AuthService } from './services.js';
import { TokenManager } from './auth.js';
import {
  validateRequest,
  createOrgSchema,
  loginSchema,
  updateOrgSchema,
  deleteOrgSchema,
  getOrgSchema,
} from './validators.js';
import logger from './logger.js';

const router = express.Router();

const createOrgLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many organization creation attempts, please try again later.',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
});

// Extract token from Authorization header
const extractToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    req.token = authHeader.slice(7);
  }
  next();
};

// Verify JWT token
const requireAuth = (req, res, next) => {
  if (!req.token) {
    return res.status(401).json({
      error: { code: 'MISSING_TOKEN', message: 'Authorization header missing' },
    });
  }

  try {
    const decoded = TokenManager.verifyToken(req.token);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
    });
  }
};

router.use(extractToken);

// POST /org/create
router.post(
  '/org/create',
  createOrgLimiter,
  validateRequest(createOrgSchema),
  async (req, res) => {
    try {
      const { organization_name, email, password } = req.validatedData;

      const result = await OrganizationService.createOrganization(
        organization_name,
        email,
        password
      );

      logger.info('Organization created', { org: organization_name });
      res.status(200).json(result);
    } catch (error) {
      logger.error('Create org error', { message: error.message });
      const statusCode = error.message.includes('already exists') ? 409 : 400;
      res.status(statusCode).json({
        error: { code: 'CREATE_ORG_ERROR', message: error.message },
      });
    }
  }
);

// GET /org/get
router.get('/org/get', validateRequest(getOrgSchema), async (req, res) => {
  try {
    const { organization_name } = req.validatedData;

    const result = await OrganizationService.getOrganization(organization_name);

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    res.status(statusCode).json({
      error: { code: 'GET_ORG_ERROR', message: error.message },
    });
  }
});

// PUT /org/update
router.put(
  '/org/update',
  requireAuth,
  validateRequest(updateOrgSchema),
  async (req, res) => {
    try {
      const { organization_name, email, password } = req.validatedData;

      // Check authorization
      if (req.user.role !== 'admin' && req.user.org_name !== organization_name) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Cannot update other organizations' },
        });
      }

      const result = await OrganizationService.updateOrganization(
        organization_name,
        email,
        password
      );

      logger.info('Organization updated', { org: organization_name });
      res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        error: { code: 'UPDATE_ORG_ERROR', message: error.message },
      });
    }
  }
);

// DELETE /org/delete
router.delete(
  '/org/delete',
  requireAuth,
  validateRequest(deleteOrgSchema),
  async (req, res) => {
    try {
      const { organization_name } = req.validatedData;

      // Check authorization
      if (req.user.role !== 'admin' && req.user.org_name !== organization_name) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Cannot delete other organizations' },
        });
      }

      const result = await OrganizationService.deleteOrganization(
        organization_name,
        req.user.sub
      );

      logger.info('Organization deleted', { org: organization_name });
      res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes('not found') ? 404 : 403;
      res.status(statusCode).json({
        error: { code: 'DELETE_ORG_ERROR', message: error.message },
      });
    }
  }
);

// POST /admin/login
router.post(
  '/admin/login',
  loginLimiter,
  validateRequest(loginSchema),
  async (req, res) => {
    try {
      const { email, password } = req.validatedData;

      const result = await AuthService.adminLogin(email, password);

      res.status(200).json(result);
    } catch (error) {
      const statusCode = error.message.includes('credentials') ? 401 : 400;
      res.status(statusCode).json({
        error: { code: 'LOGIN_ERROR', message: error.message },
      });
    }
  }
);

// POST /auth/refresh
const refreshTokenSchema = Joi.object({
  admin_id: Joi.string().required(),
  refresh_token: Joi.string().required(),
});

router.post(
  '/auth/refresh',
  validateRequest(refreshTokenSchema),
  async (req, res) => {
    try {
      const { admin_id, refresh_token } = req.validatedData;

      const result = await AuthService.refreshAccessToken(admin_id, refresh_token);

      res.status(200).json(result);
    } catch (error) {
      res.status(401).json({
        error: { code: 'REFRESH_ERROR', message: error.message },
      });
    }
  }
);

// GET /admin/verify-token
router.get('/admin/verify-token', requireAuth, (req, res) => {
  res.status(200).json({
    admin_id: req.user.sub,
    organization_id: req.user.org_id,
    organization_name: req.user.org_name,
    role: req.user.role,
    message: 'Token is valid',
  });
});

// GET /health
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
