/**
 * Integration test setup — loads .env.local only.
 * No mocks. All services are real.
 */
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
