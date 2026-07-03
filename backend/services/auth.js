import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'server-portal-ast-secret-key-2026';
const JWT_EXPIRES = '2h';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export { JWT_SECRET };
