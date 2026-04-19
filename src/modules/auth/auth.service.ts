import bcrypt from 'bcryptjs'
import User from './user.model'
import logger from '@/lib/logger'

export async function findUserByEmail(email: string) {
  return User.findOne({ where: { email, is_active: true }, attributes: ['id', 'email', 'name', 'role', 'password_hash'] })
}

export async function validatePassword(plaintext: string, hash: string) {
  return bcrypt.compare(plaintext, hash)
}

export async function hashPassword(plaintext: string) {
  return bcrypt.hash(plaintext, 12)
}

export async function createUser(data: { email: string; name: string; password: string; role?: 'admin' | 'operator' | 'readonly' }) {
  const existing = await findUserByEmail(data.email)
  if (existing) throw new Error('EMAIL_TAKEN')

  const password_hash = await hashPassword(data.password)
  const user = await User.create({ email: data.email, name: data.name, password_hash, role: data.role ?? 'operator' })

  logger.info({ userId: user.id, email: user.email }, 'user created')
  return user
}
