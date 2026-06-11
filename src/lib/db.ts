import { Sequelize } from 'sequelize'
import { env } from '@/config/env'

// In serverless environments (Vercel) each function invocation is isolated,
// so min:0 avoids holding idle connections across cold starts.
const isServerless = env.NODE_ENV === 'production'

const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: isServerless ? 1 : 10,
    min: 0,
    acquire: 30000,
    idle: isServerless ? 0 : 10000,
  },
  define: {
    underscored: true,
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  },
})

export default sequelize
