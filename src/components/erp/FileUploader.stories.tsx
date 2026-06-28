'use client'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { FileUploader } from './FileUploader'
import type { FileMetadata } from '@/lib/storage-client'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const fakeUploaded = (file: File): FileMetadata => ({
  id: crypto.randomUUID(),
  original_filename: file.name,
  content_type: file.type || 'application/octet-stream',
  byte_size: String(file.size),
  status: 'available',
  uploaded_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
})

const fakeUpload = async (file: File) => {
  await sleep(1400)
  return fakeUploaded(file)
}

const fakeUploadFail = async () => {
  await sleep(1000)
  throw new Error('La subida al almacenamiento falló (HTTP 500)')
}

const meta: Meta<typeof FileUploader> = {
  title: 'ERP/FileUploader',
  component: FileUploader,
  tags: ['autodocs'],
  parameters: {
    docs: { description: { component: 'Drag-and-drop uploader running the presigned 3-step flow. Stories inject a fake `uploadFile` so they work offline.' } },
  },
}
export default meta
type Story = StoryObj<typeof FileUploader>

export const Default: Story = {
  render: () => <FileUploader uploadFile={fakeUpload} />,
}

export const Multiple: Story = {
  render: () => <FileUploader multiple uploadFile={fakeUpload} />,
}

export const RestrictedToPdf: Story = {
  render: () => <FileUploader accept={['application/pdf']} uploadFile={fakeUpload} />,
}

export const UploadError: Story = {
  name: 'Upload error (server)',
  render: () => <FileUploader uploadFile={fakeUploadFail} />,
}

export const SizeLimited: Story = {
  name: 'Rejects too-large files',
  render: () => <FileUploader maxBytes={1024} uploadFile={fakeUpload} />,
}

export const Disabled: Story = {
  render: () => <FileUploader disabled uploadFile={fakeUpload} />,
}
