import express from 'express';
import cookieParser from 'cookie-parser';
import { apiRouter } from './routes.ts';

export function createApiApp() {
  const app = express();

  // Global Middlewares
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Mount API Routes
  app.use('/api', apiRouter);

  return app;
}
