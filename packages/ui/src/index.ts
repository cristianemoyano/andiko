// Re-exports from the ERP design system for use in apps/pos and other consumers.
// Source components live in apps/web (root) src/components/primitives/.
// When consumed by apps/pos, Vite resolves these via the workspace symlink.

export { Button } from '../../../src/components/primitives/Button'
export type { ButtonProps } from '../../../src/components/primitives/Button'

export { Badge, StatusBadge } from '../../../src/components/primitives/Badge'

export { AndikoMark, AndikoMarkGlyph, PoweredByAndiko } from '../../../src/components/layout/AndikoMark'
export type { AndikoMarkSize, AndikoMarkTone } from '../../../src/components/layout/AndikoMark'
export { AndikoLogo } from '../../../src/components/layout/AndikoLogo'
