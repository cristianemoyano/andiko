import bcrypt from 'bcryptjs'
import sequelize from '@/lib/db'
import User from '@/modules/auth/user.model'
import { splitLegacyUserName } from '@/modules/auth/user.utils'

const MIN_PASSWORD_LENGTH = 16

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

async function hashPassword(plaintext: string) {
  return bcrypt.hash(plaintext, 12)
}

async function run() {
  const email = requireEnv('SYSADMIN_EMAIL')
  const password = requireEnv('SYSADMIN_PASSWORD')
  const name = process.env.SYSADMIN_NAME?.trim() || 'Sys Admin'

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`SYSADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }

  const { firstName, lastName } = splitLegacyUserName(name)
  const passwordHash = await hashPassword(password)

  await sequelize.transaction(async (transaction) => {
    const [user, created] = await User.findOrCreate({
      where: { email },
      defaults: {
        email,
        name,
        first_name: firstName,
        last_name: lastName,
        password_hash: passwordHash,
        role: 'sys-admin',
        is_active: true,
        org_id: null,
        branch_id: null,
      },
      transaction,
    })

    if (!created) {
      await user.update(
        {
          name,
          first_name: firstName,
          last_name: lastName,
          password_hash: passwordHash,
          role: 'sys-admin',
          is_active: true,
          org_id: null,
          branch_id: null,
        },
        { transaction },
      )
    }
  })

  console.log(`Sys-admin ready: ${email}`)
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())
