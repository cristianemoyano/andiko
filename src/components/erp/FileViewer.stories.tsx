'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FileViewer } from './FileViewer'
import type { FileMetadata } from '@/lib/storage-client'

const SAMPLE_IMG =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#a78bfa"/><circle cx="28" cy="28" r="10" fill="#fde68a"/></svg>',
  )

const fakeDownload = async () => ({ url: SAMPLE_IMG, filename: 'archivo' })

const makeFile = (o: Partial<FileMetadata> = {}): FileMetadata => ({
  id: crypto.randomUUID(),
  original_filename: 'factura.pdf',
  content_type: 'application/pdf',
  byte_size: '184320',
  status: 'available',
  uploaded_at: '2026-06-20T14:30:00.000Z',
  created_at: '2026-06-20T14:30:00.000Z',
  ...o,
})

const meta: Meta<typeof FileViewer> = {
  title: 'ERP/FileViewer',
  component: FileViewer,
  tags: ['autodocs'],
  args: { getDownloadUrl: fakeDownload, deleteFile: async () => {} },
  parameters: {
    docs: { description: { component: 'Renders one file: type icon (or image thumbnail), name, size, status and actions. Injects fake download/delete for offline stories.' } },
  },
}
export default meta
type Story = StoryObj<typeof FileViewer>

export const Pdf: Story = { args: { file: makeFile() } }

export const ImageWithThumbnail: Story = {
  args: { file: makeFile({ original_filename: 'logo.png', content_type: 'image/png', byte_size: '40960' }), canManage: true },
}

export const Spreadsheet: Story = {
  args: {
    file: makeFile({
      original_filename: 'reporte-ventas.xlsx',
      content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      byte_size: '2359296',
    }),
  },
}

export const Pending: Story = { args: { file: makeFile({ status: 'pending', uploaded_at: null }) } }

export const Failed: Story = { args: { file: makeFile({ status: 'failed', uploaded_at: null }) } }

export const LongFilename: Story = {
  args: {
    file: makeFile({
      original_filename: 'comprobante-afip-factura-electronica-2026-cliente-importante-muy-largo.pdf',
    }),
    canManage: true,
  },
}

export const Manageable: Story = {
  name: 'With manage actions',
  args: { file: makeFile(), canManage: true },
}

export const ReadOnly: Story = { args: { file: makeFile(), canManage: false } }

export const ListOfFiles: Story = {
  render: (args) => (
    <div className="flex max-w-xl flex-col gap-2">
      <FileViewer {...args} file={makeFile({ original_filename: 'contrato.pdf' })} canManage />
      <FileViewer {...args} file={makeFile({ original_filename: 'foto-producto.jpg', content_type: 'image/jpeg', byte_size: '512000' })} canManage />
      <FileViewer {...args} file={makeFile({ original_filename: 'padron.csv', content_type: 'text/csv', byte_size: '8192', status: 'pending', uploaded_at: null })} canManage />
    </div>
  ),
}
