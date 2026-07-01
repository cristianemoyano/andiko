import { createPageMetadata } from '@/lib/site'

export const metadata = createPageMetadata({
  title: 'Términos de Servicio',
  path: '/legales/terminos',
})

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm mb-8">
        Este es un borrador sujeto a revisión legal. No debe considerarse asesoramiento legal
        definitivo hasta su validación por un profesional matriculado.
      </div>

      <h1 className="text-2xl font-semibold text-fg">TÉRMINOS DE SERVICIO — ANDIKO</h1>
      <p className="text-sm text-fg-muted leading-relaxed mt-2">
        Última actualización: 1 de julio de 2026 (versión 2026-07-01)
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">1. Aceptación de los términos</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Estos Términos de Servicio (&quot;Términos&quot;) regulan el acceso y uso de la plataforma
        Andiko (&quot;la Plataforma&quot;, &quot;el Servicio&quot;), operada por [RAZÓN SOCIAL DEL
        TITULAR] (&quot;Andiko&quot;, &quot;nosotros&quot;), CUIT [CUIT], con domicilio en
        [DOMICILIO], Argentina. Al crear una cuenta, iniciar sesión o utilizar la Plataforma,
        usted (&quot;el Usuario&quot;) acepta estos Términos en representación propia o de la
        organización que lo emplea o autoriza (&quot;la Organización&quot;).
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">2. Descripción del servicio</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko es un software de gestión (ERP) para pequeñas y medianas empresas que ofrece
        módulos de ventas, inventario, compras, contabilidad, contactos y facturación
        electrónica, entre otros, provistos como servicio (SaaS) mediante suscripción.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">3. Cuentas y responsabilidad de uso</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Usuario es responsable de mantener la confidencialidad de sus credenciales de acceso
        y de toda actividad realizada bajo su cuenta. La Organización es responsable de las
        altas, bajas y permisos que asigna a sus propios usuarios.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        4. Rol de Andiko como encargado del tratamiento de datos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        En la medida en que la Organización carga en la Plataforma datos personales de sus
        propios clientes, proveedores o contactos, Andiko actúa como encargado del tratamiento
        (conforme el art. 25 de la Ley 25.326) y la Organización como responsable del
        tratamiento de esos datos. Andiko procesa dichos datos únicamente conforme las
        instrucciones impartidas por la Organización a través del uso normal de la Plataforma,
        no los utiliza para fines propios ni los cede a terceros salvo lo indicado en la
        Política de Privacidad, y aplica medidas de seguridad razonables para su resguardo.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">5. Responsabilidad fiscal</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko provee las herramientas para generar comprobantes y gestionar información
        fiscal, pero la exactitud de los datos cargados, el cumplimiento de las obligaciones
        fiscales ante AFIP/ARCA y la validez de los comprobantes emitidos son responsabilidad
        exclusiva de la Organización.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">6. Uso aceptable</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Usuario se compromete a no utilizar la Plataforma para fines ilícitos, no intentar
        vulnerar su seguridad, y no cargar contenido que infrinja derechos de terceros.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        7. Disponibilidad y modificaciones del servicio
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko procura mantener el Servicio disponible pero no garantiza disponibilidad
        ininterrumpida. Podemos modificar, suspender o discontinuar funcionalidades con aviso
        razonable cuando sea posible.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">8. Limitación de responsabilidad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        En la medida permitida por la ley aplicable, Andiko no será responsable por daños
        indirectos, lucro cesante o pérdida de datos derivados del uso de la Plataforma, salvo
        dolo o culpa grave.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">9. Modificaciones a estos Términos</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Podemos actualizar estos Términos. Los cambios materiales serán notificados y, cuando
        corresponda, se solicitará una nueva aceptación explícita antes de continuar usando la
        Plataforma.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">10. Ley aplicable y jurisdicción</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Estos Términos se rigen por las leyes de la República Argentina. Para cualquier
        controversia, las partes se someten a los tribunales ordinarios competentes de
        [JURISDICCIÓN], salvo que corresponda un fuero distinto por aplicación de normas de
        protección al consumidor.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">11. Contacto</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Consultas sobre estos Términos: [EMAIL DE CONTACTO].
      </p>
    </div>
  )
}
