import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Textarea } from './Textarea'
import { FormField } from './FormField'

const meta: Meta<typeof Textarea> = {
  title: 'Primitives/Textarea',
  component: Textarea,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Textarea>

export const Default: Story = {
  args: { placeholder: 'Notas internas sobre el cliente…' },
}

export const WithValue: Story = {
  args: { defaultValue: 'Entregar en turno mañana. Avisar a recepción antes del ingreso.' },
}

export const Error: Story = {
  args: { error: true, defaultValue: 'texto con error', placeholder: 'Notas…' },
}

export const Disabled: Story = {
  args: { disabled: true, defaultValue: 'Campo deshabilitado' },
}

export const WithFormField: Story = {
  render: () => (
    <div className="w-80">
      <FormField label="Notas internas" htmlFor="notes">
        <Textarea id="notes" placeholder="Visible solo para el equipo…" rows={3} />
      </FormField>
    </div>
  ),
}

export const WithError: Story = {
  render: () => (
    <div className="w-80">
      <FormField label="Observaciones" htmlFor="obs" error="Campo requerido" required>
        <Textarea id="obs" error placeholder="Observaciones…" />
      </FormField>
    </div>
  ),
}

export const Resizable: Story = {
  args: {
    placeholder: 'Este campo es redimensionable verticalmente…',
    rows: 5,
    style: { resize: 'vertical' },
  },
}
