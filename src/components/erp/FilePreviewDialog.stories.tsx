'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { FilePreviewDialog } from './FilePreviewDialog'
import { Button } from '@/components/primitives/Button'
import type { FileMetadata } from '@/lib/storage-client'

const SAMPLE_PDF =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovMediaBCb3ggWzAgMCAyMDAgMjAwXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5NwolJUVPRgo='

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

function Harness({ file }: { file: FileMetadata }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Ver archivo</Button>
      <FilePreviewDialog
        open={open}
        onOpenChange={setOpen}
        file={file}
        previewUrl={SAMPLE_PDF}
        getDownloadUrl={async () => ({ url: SAMPLE_PDF, filename: file.original_filename })}
      />
    </>
  )
}

const meta: Meta<typeof FilePreviewDialog> = {
  title: 'ERP/FilePreviewDialog',
  component: FilePreviewDialog,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof FilePreviewDialog>

export const Pdf: Story = {
  render: () => <Harness file={makeFile()} />,
}

export const Image: Story = {
  render: () => (
    <Harness
      file={makeFile({
        original_filename: 'foto.jpg',
        content_type: 'image/jpeg',
      })}
    />
  ),
}

export const UnsupportedType: Story = {
  render: () => (
    <Harness
      file={makeFile({
        original_filename: 'datos.xlsx',
        content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })}
    />
  ),
}
