import type {NextFunction, Request, Response} from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import {eq} from 'drizzle-orm';
import {db} from '../../db/index.ts';
import {users} from '../../db/schema.ts';
import {adminAuth} from '../../lib/firebase-admin.ts';

export interface AuthUser {
  id: number;
  uid: string;
  role: 'PASSENGER' | 'CONDUCTOR' | 'ADMIN';
  name: string;
  language: string;
  isGuest: boolean;
}

export interface AuthedRequest extends Request {
  authUser?: AuthUser;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'sahayyatra-dev-jwt-secret-change-in-prod';
}

export function issueAccessAndRefreshTokens(user: AuthUser) {
  const secret = getJwtSecret();
  const accessToken = jwt.sign(
    {sub: user.uid, id: user.id, role: user.role, name: user.name, isGuest: user.isGuest},
    secret,
    {expiresIn: '2h'},
  );
  const refreshToken = jwt.sign(
    {sub: user.uid, id: user.id, type: 'refresh'},
    secret,
    {expiresIn: '14d'},
  );
  return {accessToken, refreshToken};
}

export function verifyInternalJwt(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as {
      sub: string;
      id: number;
      role?: 'PASSENGER' | 'CONDUCTOR' | 'ADMIN';
      name?: string;
      isGuest?: boolean;
    };
    return {
      id: decoded.id,
      uid: decoded.sub,
      role: decoded.role || 'PASSENGER',
      name: decoded.name || 'Commuter',
      language: 'en',
      isGuest: Boolean(decoded.isGuest),
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({error: 'Unauthorized: Missing Bearer token'});
    return;
  }

  const token = header.slice(7).trim();

  // 1. Try SahayYatra JWT (OTP / Guest / Staff login)
  const internalUser = verifyInternalJwt(token);
  if (internalUser) {
    req.authUser = internalUser;
    next();
    return;
  }

  // 2. Try Firebase ID Token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const existing = await db.query.users.findFirst({
      where: eq(users.uid, decoded.uid),
    });
    if (existing) {
      req.authUser = {
        id: existing.id,
        uid: existing.uid,
        role: existing.role as AuthUser['role'],
        name: existing.name,
        language: existing.language,
        isGuest: existing.isGuest,
      };
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          uid: decoded.uid,
          email: decoded.email || '',
          name: decoded.name || 'SahayYatra Commuter',
          role: 'PASSENGER',
        })
        .onConflictDoUpdate({
          target: users.uid,
          set: {email: decoded.email || ''},
        })
        .returning();
      req.authUser = {
        id: inserted.id,
        uid: inserted.uid,
        role: inserted.role as AuthUser['role'],
        name: inserted.name,
        language: inserted.language,
        isGuest: inserted.isGuest,
      };
    }
    next();
  } catch {
    res.status(401).json({error: 'Unauthorized: Invalid token'});
  }
};

export const optionalAuth = async (
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    const internal = verifyInternalJwt(token);
    if (internal) {
      req.authUser = internal;
    } else {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const existing = await db.query.users.findFirst({
          where: eq(users.uid, decoded.uid),
        });
        if (existing) {
          req.authUser = {
            id: existing.id,
            uid: existing.uid,
            role: existing.role as AuthUser['role'],
            name: existing.name,
            language: existing.language,
            isGuest: existing.isGuest,
          };
        }
      } catch {
        // ignore invalid optional token
      }
    }
  }
  next();
};

export const requireRole =
  (...roles: Array<AuthUser['role']>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !roles.includes(req.authUser.role)) {
      res.status(403).json({error: `Forbidden: Requires role ${roles.join(' or ')}`});
      return;
    }
    next();
  };

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {error: 'Too many OTP requests. Please wait 60 seconds.'},
});

export const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {error: 'Voice rate limit reached. Please pause briefly.'},
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
});
