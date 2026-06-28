import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { WooCommerceIcon } from './WooCommerceIcon'

const meta: Meta<typeof WooCommerceIcon> = {
  title: 'ERP/WooCommerceIcon',
  component: WooCommerceIcon,
}

export default meta
type Story = StoryObj<typeof WooCommerceIcon>

export const Mark: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <WooCommerceIcon size={32} variant="mark" />
      <WooCommerceIcon size={40} variant="mark" />
      <WooCommerceIcon size={48} variant="mark" />
    </div>
  ),
}

export const GlyphOnButton: Story = {
  render: () => (
    <div className="inline-flex items-center gap-1.5 rounded-sm bg-[#7F54B3] px-3 py-2 text-white">
      <WooCommerceIcon size={18} variant="glyph" className="text-white" />
      <span className="text-[13px] font-medium">Conectar sitio</span>
    </div>
  ),
}
