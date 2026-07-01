import { createPageMetadata } from '@/lib/site'

export const metadata = createPageMetadata({
  title: 'Política de Privacidad',
  path: '/legales/privacidad',
})

export default function PrivacidadPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm mb-8">
        Este es un borrador sujeto a revisión legal. No debe considerarse asesoramiento legal
        definitivo hasta su validación por un profesional matriculado.
      </div>

      <h1 className="text-2xl font-semibold text-fg">POLÍTICA DE PRIVACIDAD — ANDIKO</h1>
      <p className="text-sm text-fg-muted leading-relaxed mt-2">
        Última actualización: 1 de julio de 2026
      </p>

      <p className="text-sm text-fg-muted leading-relaxed mt-6">
        Esta Política de Privacidad describe cómo [RAZÓN SOCIAL], CUIT [CUIT], con domicilio en
        [DOMICILIO] (&quot;Andiko&quot;, &quot;nosotros&quot;), responsable/encargado del
        tratamiento según corresponda, recolecta, usa y protege los datos personales de los
        Usuarios de la Plataforma, en cumplimiento de la Ley 25.326 de Protección de Datos
        Personales y su normativa reglamentaria.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">1. Datos que recolectamos</h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          Datos de cuenta: nombre, email, contraseña (almacenada de forma cifrada), rol dentro
          de la Organización.
        </li>
        <li>
          Datos de la Organización: razón social, CUIT, domicilio fiscal, condición frente al
          IVA.
        </li>
        <li>
          Datos cargados por la Organización sobre sus propios contactos (clientes/proveedores):
          en estos casos Andiko actúa como encargado del tratamiento, no como responsable —
          remitimos a la política de privacidad de cada Organización respecto de sus propios
          contactos.
        </li>
        <li>
          Datos de uso: registros de acceso, dirección IP, información del dispositivo/navegador,
          con fines de seguridad y soporte.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">2. Finalidad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Utilizamos estos datos para: proveer y mantener el Servicio, autenticar usuarios, brindar
        soporte técnico, cumplir obligaciones legales/fiscales, y comunicar novedades operativas
        del Servicio (no publicitarias sin consentimiento adicional).
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">3. Base legal y consentimiento</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El tratamiento se basa en el consentimiento libre, expreso e informado del titular de los
        datos, otorgado al aceptar estos Términos y esta Política, y en la necesidad de ejecutar
        el contrato de servicio.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">4. Conservación</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Conservamos los datos mientras la cuenta esté activa y por el plazo adicional necesario
        para cumplir obligaciones legales (incluyendo las fiscales/contables) o resolver
        disputas.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">5. Transferencias y proveedores</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Para operar la Plataforma utilizamos proveedores de infraestructura (hosting,
        almacenamiento, envío de email) que pueden procesar datos fuera de la República
        Argentina, incluyendo países que no cuentan con un nivel de protección de datos
        reconocido como adecuado por la autoridad argentina. En esos casos, el Usuario presta su
        consentimiento expreso a dicha transferencia internacional al aceptar esta Política, y
        Andiko exige a dichos proveedores compromisos contractuales de confidencialidad y
        seguridad razonables. [Completar/actualizar con el listado real de subencargados:
        proveedor de hosting, email, etc.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">6. Seguridad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito, control de
        acceso, respaldo de datos) para proteger la información contra pérdida, alteración o
        acceso no autorizado.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">7. Cookies</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Plataforma utiliza únicamente cookies estrictamente necesarias para el funcionamiento
        (mantener la sesión iniciada). Si en el futuro incorporamos cookies de analítica o de
        terceros no esenciales, se lo informaremos mediante un aviso específico y solicitaremos
        su consentimiento antes de activarlas.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        8. Derechos del titular de los datos (Derechos ARCO)
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Usted tiene derecho a acceder, rectificar, actualizar y solicitar la supresión de sus
        datos personales. Para ejercer estos derechos, puede escribirnos a [EMAIL DE CONTACTO].
        Asimismo, la Agencia de Acceso a la Información Pública (AAIP), en su carácter de Órgano
        de Control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que
        se interpongan con relación al incumplimiento de las normas sobre protección de datos
        personales (www.argentina.gob.ar/aaip).
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">9. Menores de edad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Plataforma está destinada a uso profesional/empresarial y no está dirigida a menores
        de edad.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">10. Modificaciones</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Podemos actualizar esta Política. Los cambios materiales serán notificados y, cuando
        corresponda, se solicitará una nueva aceptación.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">11. Contacto</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Para consultas sobre esta Política o el tratamiento de sus datos: [EMAIL DE CONTACTO].
      </p>

      <p className="mt-8 text-xs text-fg-subtle">
        Nota interna: pendiente inscribir la/s base/s de datos ante el Registro Nacional de
        Bases de Datos de la AAIP (art. 21, Ley 25.326).
      </p>
    </div>
  )
}
