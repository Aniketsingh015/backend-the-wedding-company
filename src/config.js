import dotenv from 'dotenv';

dotenv.config();

const config = {
  // MongoDB Configuration
  mongoUrl: process.env.MONGO_URL || 'mongodb://localhost:27017',
  masterDbName: process.env.MASTER_DB_NAME || 'master_db',
  masterCollection: process.env.MASTER_COLLECTION_NAME || 'organizations',
  adminCollection: process.env.ADMIN_COLLECTION_NAME || 'admin_users',

  // JWT Configuration
  jwtSecret: process.env.JWT_SECRET_KEY || 'your-super-secret-key-change-this-in-production',
  jwtAlgorithm: process.env.JWT_ALGORITHM || 'HS256',
  jwtExpirationHours: parseInt(process.env.JWT_EXPIRATION_HOURS || '24'),

  // Application Settings
  port: parseInt(process.env.PORT || '8000'),
  debug: process.env.DEBUG === 'true' || process.env.DEBUG === 'True',
};

export default config;
