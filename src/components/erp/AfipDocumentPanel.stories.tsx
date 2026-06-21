import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AfipDocumentPanel } from './AfipDocumentPanel'

const meta: Meta<typeof AfipDocumentPanel> = {
  title: 'ERP/AfipDocumentPanel',
  component: AfipDocumentPanel,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof AfipDocumentPanel>

const noop = async () => {}

export const MissingPuntoVenta: Story = {
  args: {
    canAuthorize: true,
    onAuthorize: noop,
    branch: { name: 'Sucursal Norte', branch_code: 2, punto_venta: null },
    doc: {
      afip_status: 'not_sent',
      cae: null,
      cae_expiration: null,
      comprobante_tipo: null,
      punto_venta: null,
      cbte_numero: null,
      afip_observations: null,
    },
  },
}

export const NotSentAuthorizable: Story = {
  args: {
    canAuthorize: true,
    onAuthorize: noop,
    branch: { name: 'Casa Central', branch_code: 1, punto_venta: 3 },
    doc: {
      afip_status: 'not_sent',
      cae: null,
      cae_expiration: null,
      comprobante_tipo: null,
      punto_venta: null,
      cbte_numero: null,
      afip_observations: null,
    },
  },
}

export const Authorized: Story = {
  args: {
    canAuthorize: false,
    onAuthorize: noop,
    doc: {
      afip_status: 'authorized',
      cae: '70000000000123',
      cae_expiration: '2026-07-01',
      comprobante_tipo: 1,
      punto_venta: 3,
      cbte_numero: 42,
      afip_observations: null,
    },
  },
}

export const Rejected: Story = {
  args: {
    canAuthorize: true,
    onAuthorize: noop,
    doc: {
      afip_status: 'rejected',
      cae: null,
      cae_expiration: null,
      comprobante_tipo: null,
      punto_venta: null,
      cbte_numero: null,
      afip_observations: [
        { code: 10016, msg: 'El campo CbteDesde no se corresponde con el último autorizado' },
      ],
    },
  },
}

export const Contingency: Story = {
  args: {
    canAuthorize: true,
    onAuthorize: noop,
    doc: {
      afip_status: 'contingency',
      cae: null,
      cae_expiration: null,
      comprobante_tipo: null,
      punto_venta: null,
      cbte_numero: null,
      afip_observations: null,
    },
  },
}
