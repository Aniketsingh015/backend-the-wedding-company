import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from './config.js';

class PasswordManager {
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  static async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }
}

class TokenManager {
  static createAccessToken(adminId, orgId, orgName, role = 'org_admin') {
    const payload = {
      sub: adminId,
      org_id: orgId,
      org_name: orgName,
      role,
    };
    const expiresIn = '15m';
    return jwt.sign(payload, config.jwtSecret, {
      algorithm: config.jwtAlgorithm,
      expiresIn,
    });
  }

  static createRefreshToken(adminId, orgId) {
    const payload = {
      sub: adminId,
      org_id: orgId,
      type: 'refresh',
    };
    const expiresIn = '7d';
    return jwt.sign(payload, config.jwtSecret, {
      algorithm: config.jwtAlgorithm,
      expiresIn,
    });
  }

  static verifyToken(token) {
    try {
      return jwt.verify(token, config.jwtSecret, {
        algorithms: [config.jwtAlgorithm],
      });
    } catch (error) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  static hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

export { PasswordManager, TokenManager };
