import { Hono } from 'hono';
import auth from './auth/index.ts';

const app = new Hono();

app.route('/auth', auth);

export default app;
