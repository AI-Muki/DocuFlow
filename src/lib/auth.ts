import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { TokenPayload } from '../types/index.ts';

const JWT_SECRET = process.env.AUTH_SECRET || 'docuflow-enterprise-default-secret-development-only-32';
const JWT_EXPIRES_IN = process.env.AUTH_TOKEN_EXPIRY || '7d';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}
