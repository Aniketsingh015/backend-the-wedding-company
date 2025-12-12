import express from 'express';
import helmet from 'helmet';
import config from './config.js';
import DatabaseManager from './database.js';
import routes from './routes.js';
import logger from './logger.js';

const app = express();

// Security middleware
app.use(helmet());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { ip: req.ip });
  next();
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Request error', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal Server Error',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

async function startServer() {
  try {
    const dbManager = DatabaseManager.getInstance();
    await dbManager.connect();

    const db = dbManager.getDb();
    const orgsCollection = db.collection(config.masterCollection);
    await orgsCollection.createIndex({ organization_name: 1 }, { unique: true });

    const adminCollection = db.collection(config.adminCollection);
    await adminCollection.createIndex({ admin_email: 1 }, { unique: true });

    app.listen(config.port, () => {
      logger.info(`Server running on http://localhost:${config.port}`, {
        debug: config.debug,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { message: error.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  const dbManager = DatabaseManager.getInstance();
  await dbManager.disconnect();
  process.exit(0);
});

startServer();

export default app;
