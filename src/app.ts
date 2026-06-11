import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middlewares/errorHandler';
import { env } from './config/env';
import authRouter from './routes/auth.routes';
import productRouter from './routes/product.routes';
import stockRouter from './routes/stock.routes';
import saleRouter from './routes/sale.routes';
import reportRouter from './routes/report.routes';

const app = express();

// Trust X-Forwarded-* headers when behind a reverse proxy so rate-limiting,
// req.ip and req.protocol reflect the real client.
if (env.trustProxy) {
  const value = /^\d+$/.test(env.trustProxy) ? parseInt(env.trustProxy, 10) : env.trustProxy;
  app.set('trust proxy', value);
}

app.use(helmet());
app.use(cors({
  origin: env.allowedOrigin ?? (env.isProd ? false : '*'),
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/products', productRouter);
app.use('/api/stock', stockRouter);
app.use('/api/sales', saleRouter);
app.use('/api/reports', reportRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Route not found' });
});

app.use(errorHandler);

export default app;
