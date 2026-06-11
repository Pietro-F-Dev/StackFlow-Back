import dns from 'dns';
import mongoose from 'mongoose';
import { env } from './env';

// Opt-in DNS override for environments where the system resolver blocks MongoDB SRV
// records (set DNS_SERVERS=8.8.8.8,8.8.4.4). Off by default to avoid leaking all
// process DNS queries to a third party.
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (servers.length > 0) dns.setServers(servers);
}

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.mongoUri);
  console.log('MongoDB connected');
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
