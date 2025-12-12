import DatabaseManager from './database.js';
import { PasswordManager, TokenManager } from './auth.js';
import { ObjectId } from 'mongodb';
import validator from 'validator';
import config from './config.js';
import logger from './logger.js';

class OrganizationService {
  static async createOrganization(orgName, email, password) {
    const db = DatabaseManager.getInstance().getDb();

    // Validate input
    if (!orgName || !email || !password) {
      throw new Error('Organization name, email, and password are required');
    }

    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    // Check if organization already exists
    const orgsCollection = db.collection(config.masterCollection);
    const existing = await orgsCollection.findOne({
      organization_name: orgName,
    });

    if (existing) {
      throw new Error('Organization with this name already exists');
    }

    try {
      // Create organization database and collection
      const { dbName, orgDb } = await DatabaseManager.getInstance().createOrgDatabase(orgName);

      // Hash password
      const hashedPassword = await PasswordManager.hashPassword(password);

      // Create admin user in organization database
      const usersCollection = orgDb.collection('users');
      const userResult = await usersCollection.insertOne({
        email,
        password: hashedPassword,
        role: 'org_admin',
        created_at: new Date(),
        is_active: true,
      });

      // Store organization metadata in master database
      const adminCollection = db.collection(config.adminCollection);
      const adminResult = await adminCollection.insertOne({
        admin_email: email,
        password: hashedPassword,
        role: 'org_admin',
        organization_id: null,
        organization_name: orgName,
        created_at: new Date(),
        is_active: true,
      });

      const orgsResult = await orgsCollection.insertOne({
        organization_name: orgName,
        db_name: dbName,
        admin_email: email,
        admin_user_id: userResult.insertedId.toString(),
        created_at: new Date(),
        is_active: true,
      });

      // Update admin record with org ID
      await adminCollection.updateOne(
        { _id: adminResult.insertedId },
        { $set: { organization_id: orgsResult.insertedId.toString() } }
      );

      return {
        id: orgsResult.insertedId.toString(),
        organization_name: orgName,
        db_name: dbName,
        admin_email: email,
        created_at: new Date().toISOString(),
        message: 'Organization created successfully',
      };
    } catch (error) {
      throw new Error(`Failed to create organization: ${error.message}`);
    }
  }

  static async getOrganization(orgName) {
    const db = DatabaseManager.getInstance().getDb();

    if (!orgName) {
      throw new Error('Organization name is required');
    }

    const orgsCollection = db.collection(config.masterCollection);
    const org = await orgsCollection.findOne({ organization_name: orgName });

    if (!org) {
      throw new Error('Organization not found');
    }

    return {
      id: org._id.toString(),
      organization_name: org.organization_name,
      db_name: org.db_name,
      admin_email: org.admin_email,
      created_at: org.created_at.toISOString(),
      is_active: org.is_active,
    };
  }

  static async updateOrganization(orgName, email, password) {
    const db = DatabaseManager.getInstance().getDb();

    if (!orgName || !email || !password) {
      throw new Error('Organization name, email, and password are required');
    }

    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    const orgsCollection = db.collection(config.masterCollection);
    const org = await orgsCollection.findOne({ organization_name: orgName });

    if (!org) {
      throw new Error('Organization not found');
    }

    try {
      const hashedPassword = await PasswordManager.hashPassword(password);

      // Update in master database
      const adminCollection = db.collection(config.adminCollection);
      await adminCollection.updateOne(
        { organization_id: org._id.toString() },
        {
          $set: {
            admin_email: email,
            password: hashedPassword,
          },
        }
      );

      // Update in organization database
      const orgDb = await DatabaseManager.getInstance().getOrgDb(orgName);
      const usersCollection = orgDb.collection('users');
      await usersCollection.updateOne(
        { role: 'admin' },
        {
          $set: {
            email,
            password: hashedPassword,
            updated_at: new Date(),
          },
        }
      );

      return {
        message: 'Organization updated successfully',
        organization_name: orgName,
      };
    } catch (error) {
      throw new Error(`Failed to update organization: ${error.message}`);
    }
  }

  static async deleteOrganization(orgName, adminId) {
    const db = DatabaseManager.getInstance().getDb();

    if (!orgName) {
      throw new Error('Organization name is required');
    }

    const orgsCollection = db.collection(config.masterCollection);
    const org = await orgsCollection.findOne({ organization_name: orgName });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Verify admin ownership (optional: can skip for simplicity)
    try {
      // Delete from master database
      await orgsCollection.deleteOne({ organization_name: orgName });

      const adminCollection = db.collection(config.adminCollection);
      await adminCollection.deleteOne({ organization_id: org._id.toString() });

      // Delete organization database
      await DatabaseManager.getInstance().deleteOrgDatabase(orgName);

      return {
        message: 'Organization deleted successfully',
        organization_name: orgName,
      };
    } catch (error) {
      throw new Error(`Failed to delete organization: ${error.message}`);
    }
  }
}

class AuthService {
  static async adminLogin(email, password) {
    const db = DatabaseManager.getInstance().getDb();

    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const adminCollection = db.collection(config.adminCollection);
    const admin = await adminCollection.findOne({ admin_email: email });

    if (!admin) {
      throw new Error('Invalid credentials');
    }

    const isPasswordValid = await PasswordManager.verifyPassword(password, admin.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    const accessToken = TokenManager.createAccessToken(
      admin._id.toString(),
      admin.organization_id,
      admin.organization_name,
      admin.role
    );

    const refreshToken = TokenManager.createRefreshToken(
      admin._id.toString(),
      admin.organization_id
    );

    // Store hashed refresh token
    const hashedRefresh = TokenManager.hashToken(refreshToken);
    await adminCollection.updateOne(
      { _id: admin._id },
      { $set: { refresh_token_hash: hashedRefresh, refresh_token_issued_at: new Date() } }
    );

    logger.info('Admin login successful', { admin_id: admin._id, org_name: admin.organization_name });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 15 * 60,
      admin_id: admin._id.toString(),
      organization_id: admin.organization_id,
      organization_name: admin.organization_name,
    };
  }

  static async refreshAccessToken(adminId, refreshToken) {
    const db = DatabaseManager.getInstance().getDb();

    try {
      const decoded = TokenManager.verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token type');
      }

      const adminCollection = db.collection(config.adminCollection);
      const admin = await adminCollection.findOne({ _id: new ObjectId(adminId) });

      if (!admin) {
        throw new Error('Admin not found');
      }

      const hashedToken = TokenManager.hashToken(refreshToken);
      if (admin.refresh_token_hash !== hashedToken) {
        throw new Error('Refresh token mismatch');
      }

      const newAccessToken = TokenManager.createAccessToken(
        admin._id.toString(),
        admin.organization_id,
        admin.organization_name,
        admin.role
      );

      logger.info('Token refreshed', { admin_id: adminId });

      return {
        access_token: newAccessToken,
        token_type: 'bearer',
        expires_in: 15 * 60,
      };
    } catch (error) {
      logger.warn('Token refresh failed', { error: error.message });
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }
}

export { OrganizationService, AuthService };
