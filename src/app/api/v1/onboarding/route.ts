import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  getOnboardingStatus,
  saveOnboardingProgress,
  completeOnboarding,
} from '@/modules/auth/onboarding.service'
import { ORG_MODULE_KEYS } from '@/modules/auth/organization-modules'
import { withSettingsPermission } from '@/lib/settings-guard'
import logger from '@/lib/logger'

const onboardingDataSchema = z.object({
  company: z
    .object({
      razonSocial: z.string().optional(),
      cuit: z.string().optional(),
      condicionIVA: z.string().optional(),
      nombreComercial: z.string().optional(),
      actividad: z.string().optional(),
      calle: z.string().optional(),
      ciudad: z.string().optional(),
      provincia: z.string().optional(),
      cp: z.string().optional(),
      pais: z.string().optional(),
      telefono: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  modules: z.array(z.enum(ORG_MODULE_KEYS)).optional(),
  productsMode: z.enum(['manual', 'csv', 'later']).nullable().optional(),
  integrations: z.array(z.string()).optional(),
  sales: z
    .object({
      tipoFactura: z.string().optional(),
      puntoVenta: z.string().optional(),
      moneda: z.string().optional(),
      iva: z.string().optional(),
      incluirIVA: z.boolean().optional(),
      condPago: z.string().optional(),
      afipEnvironment: z.enum(['homologacion', 'produccion']).optional(),
      afipCert: z.string().optional(),
      afipKey: z.string().optional(),
    })
    .optional(),
  wizardStep: z.number().int().min(0).optional(),
  completedStepIds: z.array(z.string()).optional(),
})

const saveSchema = z.object({
  data: onboardingDataSchema,
  complete: z.boolean().optional().default(false),
})

export const GET = withSettingsPermission('settings:write', async (_req, _ctx, _session, orgId) => {
  const status = await getOnboardingStatus(orgId)
  return NextResponse.json(status)
})

export const POST = withSettingsPermission('settings:write', async (req, _ctx, _session, orgId) => {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON', code: 'INVALID_BODY' }, { status: 400 })
  }

  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 422 },
    )
  }

  const { data, complete } = parsed.data

  try {
    if (complete) {
      await completeOnboarding(orgId, data)
      return NextResponse.json({ completed: true }, { status: 200 })
    }
    await saveOnboardingProgress(orgId, data)
    return NextResponse.json({ saved: true }, { status: 200 })
  } catch (err) {
    logger.error({ err, orgId }, 'onboarding save error')
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    )
  }
})
