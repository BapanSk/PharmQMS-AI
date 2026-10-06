require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const db = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const publicRoutes = require('./routes/publicRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const auditRoutes = require('./routes/auditRoutes');
const productRoutes = require('./routes/productRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { ensureUploadDir } = require('./middleware/uploadMiddleware');

const PORT = Number(process.env.PORT) || 3000;

function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
      hsts: false
    })
  );

  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean)
    : true;

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());

  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'PharmQMS API'
    });
  });

  ensureUploadDir();

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit-logs', auditRoutes);
  app.use('/api/admin/products', productRoutes);
  app.use('/api', publicRoutes);

  const pageRoutes = {
    '/': 'index.html',
    '/submit': 'submit.html',
    '/track': 'track.html',
    '/login': 'login.html',
    '/dashboard': 'dashboard.html',
    '/complaints': 'complaints.html',
    '/complaint-details': 'complaint-details.html',
    '/admin': 'admin.html'
  };

  Object.keys(pageRoutes).forEach((routePath) => {
    app.get(routePath, (req, res) => {
      res.sendFile(path.join(publicDir, pageRoutes[routePath]));
    });
  });

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return notFoundHandler(req, res, next);
    }
    res.status(404).sendFile(path.join(publicDir, '404.html'));
  });

  app.use(errorHandler);

  return app;
}

function describeDbError(error) {
  const code = error && error.code;
  if (code === 'ECONNREFUSED') {
    return `MySQL is not reachable at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}. Start MySQL and confirm DB_HOST/DB_PORT.`;
  }
  if (code === 'ER_ACCESS_DENIED_ERROR') {
    return `MySQL rejected the credentials for user '${process.env.DB_USER || 'root'}'. Check DB_USER and DB_PASSWORD.`;
  }
  if (code === 'ER_BAD_DB_ERROR') {
    return `MySQL database '${process.env.DB_NAME || 'pharmqms'}' does not exist. Run database/schema.sql.`;
  }
  return `MySQL connection failed: ${error && error.message ? error.message : 'unknown error'}`;
}

async function start() {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set in the environment');
  }

  try {
    await db.ping();
    process.stdout.write('MySQL connection OK\n');
  } catch (error) {
    process.stderr.write(`${describeDbError(error)}\n`);
    process.stderr.write('PharmQMS API will still listen for health checks; database routes will fail until MySQL is available.\n');
  }

  const app = createApp();
  const server = app.listen(PORT, '0.0.0.0', () => {
    process.stdout.write(`PharmQMS API listening on http://0.0.0.0:${PORT}\n`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      process.stderr.write(`Port ${PORT} is already in use. Stop the other process or change PORT.\n`);
    } else {
      process.stderr.write(`Failed to bind 0.0.0.0:${PORT}: ${error.message}\n`);
    }
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    process.stderr.write(`Uncaught exception: ${error.stack || error.message}\n`);
  });

  process.on('unhandledRejection', (reason) => {
    const message = reason && reason.stack ? reason.stack : String(reason);
    process.stderr.write(`Unhandled rejection: ${message}\n`);
  });

  return server;
}

if (require.main === module) {
  start().catch((error) => {
    process.stderr.write(`Failed to start PharmQMS API: ${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  createApp,
  start
};
