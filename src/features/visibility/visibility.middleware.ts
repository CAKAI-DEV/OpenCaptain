import type { Context, Next } from 'hono';
import {
  type AppAbility,
  defineAbilitiesFor,
  type UserContext,
} from '../../shared/lib/permissions';
import { computeVisibleSquads, loadUserContext } from './visibility.service';

declare module 'hono' {
  interface ContextVariableMap {
    ability: AppAbility;
    userContext: UserContext;
    visibleSquadIds: string[]; // Empty = all (for admin/PM/unrestricted)
  }
}

/**
 * Middleware that loads user context and builds CASL abilities.
 * Must run after authMiddleware which sets c.get('user').
 */
export async function visibilityMiddleware(c: Context, next: Next) {
  const user = c.get('user'); // From auth middleware: { sub: userId, org: orgId }

  if (!user) {
    // No auth = no visibility context (let auth middleware handle rejection)
    return next();
  }

  // Load full user context from database
  const userContext = await loadUserContext(user.sub, user.org);
  c.set('userContext', userContext);

  // Build CASL ability
  const ability = defineAbilitiesFor(userContext);
  c.set('ability', ability);

  // Pre-compute visible squad IDs for query filtering
  const visibleSquadIds = computeVisibleSquads(userContext);
  c.set('visibleSquadIds', visibleSquadIds);

  await next();
}
