import { connectDB } from './config/db';
import { env } from './config/env';
import app from './app';

async function main() {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
