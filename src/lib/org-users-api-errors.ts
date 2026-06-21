import { NextResponse } from 'next/server'

export function orgUserMutationErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof Error)) return null

  switch (err.message) {
    case 'EMAIL_TAKEN':
      return NextResponse.json({ error: 'Ese email ya está registrado', code: 'DUPLICATE_EMAIL' }, { status: 409 })
    case 'BRANCH_NOT_IN_ORG':
      return NextResponse.json(
        { error: 'Una o más sucursales no pertenecen a esta organización', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    case 'BRANCH_ADMIN_SINGLE_BRANCH':
      return NextResponse.json(
        { error: 'Encargado de sucursal debe tener exactamente una sucursal', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    case 'USER_NOT_IN_ORG':
      return NextResponse.json({ error: 'Usuario no encontrado en la organización', code: 'NOT_FOUND' }, { status: 404 })
    case 'USER_NOT_EDITABLE':
      return NextResponse.json({ error: 'Este usuario no se puede editar desde aquí', code: 'FORBIDDEN' }, { status: 403 })
    case 'DEFAULT_BRANCH_INVALID':
      return NextResponse.json(
        { error: 'La sucursal por defecto debe estar entre las permitidas', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    case 'CANNOT_DELETE_SELF':
      return NextResponse.json({ error: 'No podés eliminar tu propio usuario', code: 'FORBIDDEN' }, { status: 403 })
    case 'CANNOT_EDIT_SELF':
      return NextResponse.json(
        { error: 'Editá tu usuario desde Perfil para evitar cambios accidentales de rol', code: 'FORBIDDEN' },
        { status: 403 },
      )
    case 'CANNOT_EDIT_PEER':
      return NextResponse.json(
        { error: 'No podés editar usuarios de tu mismo nivel. Pedí a otro administrador.', code: 'FORBIDDEN' },
        { status: 403 },
      )
    case 'CANNOT_DEACTIVATE_SELF':
      return NextResponse.json({ error: 'No podés desactivar tu propio usuario', code: 'FORBIDDEN' }, { status: 403 })
    case 'LAST_ADMIN':
      return NextResponse.json(
        { error: 'Debe quedar al menos un administrador activo en la organización', code: 'VALIDATION_ERROR' },
        { status: 422 },
      )
    case 'ORG_ROLE_NOT_FOUND':
      return NextResponse.json({ error: 'Rol no encontrado en la organización', code: 'NOT_FOUND' }, { status: 404 })
    default:
      return null
  }
}
