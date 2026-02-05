import { Hono } from 'hono';
import register from './register.ts';
import login from './login.ts';
import magicLink from './magic-link.ts';
import refresh from './refresh.ts';
import logout from './logout.ts';

const app = new Hono();

app.route('/register', register);
app.route('/login', login);
app.route('/magic-link', magicLink);
app.route('/refresh', refresh);
app.route('/logout', logout);

export default app;
