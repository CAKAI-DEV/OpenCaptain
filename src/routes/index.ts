import { Hono } from 'hono';
import auth from './auth/index.ts';
import health from './health/index.ts';

const app = new Hono();

app.route('/auth', auth);
app.route('/health', health);

export default app;
