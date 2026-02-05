export { sendMagicLink } from './auth.email';
export { authMiddleware } from './auth.middleware';
export { authRoutes } from './auth.routes';
export {
  generateMagicLinkToken,
  generateTokens,
  hashPassword,
  type RefreshPayload,
  revokeAllRefreshTokens,
  type TokenPayload,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from './auth.service';
