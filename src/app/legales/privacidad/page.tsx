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
        Última actualización: 7 de julio de 2026 (versión 2026-07-07)
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">1. Responsable del tratamiento</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Esta Política de Privacidad describe cómo [RAZÓN SOCIAL], CUIT [CUIT], con domicilio
        en [DOMICILIO], República Argentina (&quot;Andiko&quot;, &quot;nosotros&quot;), trata
        los datos personales vinculados a la plataforma Andiko (la &quot;Plataforma&quot;), en
        cumplimiento de la Ley 25.326 de Protección de Datos Personales, su Decreto
        Reglamentario 1558/2001 y las disposiciones de la Agencia de Acceso a la Información
        Pública (AAIP). Canal de contacto en materia de datos personales: [EMAIL DE CONTACTO].
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        2. Alcance: responsable y encargado
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko cumple dos roles distintos, con consecuencias diferentes para el titular de los
        datos:
      </p>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1 mt-3">
        <li>
          <strong>Andiko como responsable:</strong> respecto de los datos de los Usuarios de
          la Plataforma (datos de cuenta), de la relación comercial y de facturación con cada
          organización cliente (la &quot;Organización&quot;) y de los datos técnicos y de uso
          descriptos en esta Política. A esos tratamientos se aplica íntegramente esta
          Política.
        </li>
        <li>
          <strong>Andiko como encargado (artículo 25, Ley 25.326):</strong> respecto de los
          datos que cada Organización carga sobre sus propios clientes, proveedores,
          contactos o empleados. En esos casos la Organización es la responsable del
          tratamiento; Andiko procesa esos datos únicamente conforme a sus instrucciones, no
          los aplica a fines propios y no los cede salvo lo previsto en esta Política. Los
          titulares de esos datos deben dirigir sus consultas y el ejercicio de sus derechos a
          la Organización correspondiente; si los recibimos nosotros, los reenviaremos a la
          Organización y cooperaremos con ella para responderlos.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">3. Datos que tratamos</h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          <strong>Datos de cuenta:</strong> nombre, correo electrónico, contraseña (almacenada
          en forma irreversible mediante hash), rol y permisos dentro de la Organización.
        </li>
        <li>
          <strong>Datos de la Organización:</strong> razón social, CUIT, domicilio fiscal,
          condición frente al IVA y datos de facturación de la suscripción.
        </li>
        <li>
          <strong>Datos técnicos y de uso:</strong> registros de acceso y auditoría, dirección
          IP, identificadores de sesión e información del dispositivo y navegador, con fines
          de seguridad, prevención de fraude y soporte.
        </li>
        <li>
          <strong>Analítica de producto y errores (solo con su consentimiento):</strong>
          eventos de uso de la Plataforma, reportes de errores y métricas de rendimiento,
          asociados al identificador de usuario, correo electrónico, nombre, rol y
          organización, tratados a través de nuestro proveedor de analítica (ver secciones 5
          y 8).
        </li>
        <li>
          <strong>Soporte:</strong> el contenido de las comunicaciones que usted nos envía.
        </li>
        <li>
          <strong>Datos cargados por la Organización:</strong> tratados por Andiko como
          encargado, conforme a la sección 2.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        4. Finalidades y base de licitud
      </h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          <strong>Prestar el Servicio</strong> (autenticación, operación de los módulos,
          soporte técnico, facturación de la suscripción): el tratamiento es necesario para el
          desarrollo y cumplimiento de la relación contractual (artículo 5, inciso 2.c, Ley
          25.326).
        </li>
        <li>
          <strong>Seguridad</strong> (registros de acceso, prevención de accesos no
          autorizados y fraude): necesario para la ejecución del contrato y para cumplir el
          deber de seguridad del artículo 9 de la Ley 25.326.
        </li>
        <li>
          <strong>Cumplimiento legal</strong> (obligaciones fiscales, contables y
          requerimientos de autoridad competente): obligación legal de Andiko.
        </li>
        <li>
          <strong>Comunicaciones operativas</strong> del Servicio (avisos de mantenimiento,
          cambios de términos, seguridad de la cuenta): necesarias para la relación
          contractual. Las comunicaciones publicitarias solo se envían con consentimiento
          previo y con opción de baja en cada envío.
        </li>
        <li>
          <strong>Analítica de producto y registro de errores:</strong> únicamente con su
          consentimiento, otorgado a través del banner de cookies y revocable en cualquier
          momento (artículo 5, inciso 1, Ley 25.326).
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        5. Analítica de producto (PostHog)
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Si usted acepta las cookies de analítica, utilizamos PostHog, un servicio de analítica
        de producto provisto por PostHog Inc. con infraestructura en los Estados Unidos de
        América, para comprender el uso de la Plataforma, diagnosticar errores y mejorar el
        Servicio. Los datos tratados incluyen eventos de uso, reportes de errores y registros
        técnicos, asociados a su identificador de usuario, correo electrónico, nombre, rol y
        organización. Mientras usted no otorgue su consentimiento, la analítica permanece
        desactivada para su navegador. Puede retirar su consentimiento en cualquier momento
        desde la configuración de cookies, sin que ello afecte el uso de la Plataforma.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">6. Cookies y tecnologías similares</h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          <strong>Estrictamente necesarias (siempre activas):</strong> mantener la sesión
          iniciada, seguridad de la autenticación y recordar su elección de consentimiento.
          Sin ellas la Plataforma no puede funcionar.
        </li>
        <li>
          <strong>Analítica (solo con su consentimiento):</strong> cookies e identificadores
          de PostHog descriptos en la sección 5, que se activan únicamente si usted las acepta
          en el banner de cookies y que puede desactivar en cualquier momento.
        </li>
        <li>
          <strong>Publicidad:</strong> no utilizamos cookies publicitarias ni de seguimiento
          con fines comerciales de terceros.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">7. Destinatarios de los datos</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        No vendemos datos personales. Compartimos datos únicamente con:
      </p>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1 mt-3">
        <li>
          <strong>Proveedores (subencargados)</strong> que nos prestan servicios de
          infraestructura, almacenamiento, envío de correo electrónico y analítica, bajo
          compromisos contractuales de confidencialidad y seguridad, y solo en la medida
          necesaria para prestar el Servicio. [Completar y mantener actualizado el listado
          real de subencargados: proveedor de hosting, proveedor de email, PostHog Inc.
          (analítica, EE. UU.), y los que se incorporen.]
        </li>
        <li>
          <strong>AFIP/ARCA y otros organismos:</strong> cuando la Organización utiliza las
          funciones de facturación electrónica, los datos necesarios se transmiten a los
          servicios del organismo por cuenta y orden de la Organización.
        </li>
        <li>
          <strong>Asesores profesionales</strong> (legales, contables, auditores) sujetos a
          deber de confidencialidad.
        </li>
        <li>
          <strong>Autoridades competentes,</strong> ante requerimiento legalmente exigible.
        </li>
        <li>
          <strong>Sucesores,</strong> en caso de reorganización societaria, fusión o
          transferencia del negocio, en cuyo caso el cesionario quedará obligado por esta
          Política y se lo notificará a los usuarios.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        8. Transferencias internacionales de datos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Algunos de nuestros proveedores procesan datos fuera de la República Argentina,
        incluso en países que no cuentan con niveles de protección considerados adecuados por
        la normativa argentina, como los Estados Unidos de América (artículo 12, Ley 25.326).
        En esos casos, Andiko instrumenta garantías contractuales con cada proveedor tomando
        como referencia las cláusulas modelo aprobadas por la autoridad de control argentina
        (Disposición DNPDP 60-E/2016 y sus actualizaciones), que obligan al receptor a brindar
        una protección equivalente a la de la ley argentina. Al aceptar esta Política, usted
        presta además su consentimiento informado a dichas transferencias, sin perjuicio de
        las restantes garantías. [Nota: verificar que exista un acuerdo de tratamiento de
        datos firmado con cada proveedor extranjero, incluyendo PostHog Inc., o evaluar el uso
        de su región europea u otra alternativa con mejores garantías.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">9. Plazos de conservación</h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          <strong>Datos de cuenta y de la Organización:</strong> mientras la cuenta esté
          activa y, tras la terminación, durante la ventana de exportación de treinta (30)
          días prevista en los Términos y Condiciones, luego de la cual se eliminan o
          anonimizan.
        </li>
        <li>
          <strong>Información fiscal y contable</strong> (comprobantes de la suscripción):
          por los plazos exigidos por la normativa tributaria y el artículo 328 del Código
          Civil y Comercial (en general, diez años).
        </li>
        <li>
          <strong>Registros de acceso y seguridad:</strong> por un plazo limitado y
          proporcional a su finalidad. [Definir plazo operativo, p. ej. 12 a 24 meses.]
        </li>
        <li>
          <strong>Copias de respaldo:</strong> los datos eliminados pueden subsistir en
          respaldos hasta completarse su ciclo de rotación, tras lo cual se depuran. [Definir
          plazo de rotación real.]
        </li>
        <li>
          <strong>Defensa de reclamos:</strong> podemos conservar la información estrictamente
          necesaria durante los plazos de prescripción aplicables.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">10. Seguridad de la información</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Aplicamos medidas técnicas y organizativas orientadas a garantizar la seguridad y
        confidencialidad de los datos (artículos 9 y 10, Ley 25.326), tomando como referencia
        las medidas de seguridad recomendadas por la AAIP (Resolución 47/2018), entre ellas:
        cifrado de las comunicaciones en tránsito (TLS), almacenamiento irreversible de
        contraseñas, control de acceso basado en roles y principio de mínimo privilegio,
        segregación de la información por organización, registros de auditoría y copias de
        respaldo periódicas. Adoptamos además buenas prácticas internacionales (como las guías
        OWASP y los marcos ISO 27001 y SOC 2) como referencia de mejora continua; ello no
        implica contar con certificaciones, salvo que se declaren expresamente. Ningún sistema
        es infalible: no podemos garantizar seguridad absoluta, pero revisamos y mejoramos
        nuestras medidas en forma continua.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">11. Incidentes de seguridad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Mantenemos un procedimiento de gestión de incidentes de seguridad. Ante un incidente
        que afecte datos personales y pueda causar un perjuicio a sus titulares, notificaremos
        sin demora indebida a las Organizaciones y usuarios afectados, con información sobre
        el alcance del incidente y las medidas adoptadas, y evaluaremos su comunicación a la
        AAIP. La Ley 25.326 no establece hoy un plazo legal específico de notificación de
        incidentes; asumimos este compromiso como buena práctica, alineada con las
        recomendaciones de la AAIP y con estándares internacionales como el RGPD europeo.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        12. Derechos de los titulares de datos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Usted tiene derecho a solicitar el acceso, la rectificación, la actualización, la
        supresión y la confidencialidad de sus datos personales (artículos 14 a 16, Ley
        25.326). El derecho de acceso se responde dentro de los diez (10) días corridos de la
        solicitud y es gratuito a intervalos no inferiores a seis meses, salvo interés
        legítimo acreditado; la rectificación, actualización o supresión se realiza dentro de
        los cinco (5) días hábiles. Para ejercer estos derechos, escríbanos a [EMAIL DE
        CONTACTO] acreditando su identidad. Si sus datos fueron cargados por una Organización
        cliente, canalizaremos su pedido hacia ella conforme a la sección 2. La supresión no
        procede respecto de datos que debamos conservar por obligación legal.
      </p>
      <p className="text-sm text-fg-muted leading-relaxed mt-3">
        LA AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de
        la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan
        quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes
        en materia de protección de datos personales (www.argentina.gob.ar/aaip).
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">13. Menores de edad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Plataforma está destinada a uso profesional y empresarial por personas mayores de
        dieciocho (18) años. No está dirigida a menores de edad ni recolectamos
        deliberadamente sus datos como usuarios. Si detectamos una cuenta de usuario creada
        por un menor de edad, la daremos de baja y eliminaremos sus datos de cuenta.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        14. Decisiones automatizadas e inteligencia artificial
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Actualmente no tomamos decisiones basadas únicamente en tratamientos automatizados que
        produzcan efectos jurídicos sobre los titulares de los datos. Si en el futuro
        incorporamos funcionalidades de inteligencia artificial, lo informaremos en esta
        Política y en el producto, identificaremos los proveedores intervinientes en el
        listado de subencargados y no utilizaremos datos personales para entrenar modelos de
        inteligencia artificial sin consentimiento previo y expreso.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">15. Modificaciones</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Podemos actualizar esta Política. Los cambios materiales serán notificados con
        antelación razonable por correo electrónico o mediante aviso en la Plataforma y,
        cuando corresponda, se solicitará una nueva aceptación. Cada versión se identifica con
        su fecha de actualización.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">16. Contacto</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Para consultas sobre esta Política o sobre el tratamiento de sus datos personales:
        [EMAIL DE CONTACTO].
      </p>

      {/*
        Pendientes internos de compliance (no publicar):
        - Inscribir la/s base/s de datos ante el Registro Nacional de Bases de Datos de la
          AAIP (art. 21, Ley 25.326).
        - Completar el listado real de subencargados (hosting, email, PostHog) y firmar
          acuerdos de tratamiento de datos con cada uno.
        - Definir plazos operativos de retención de logs y rotación de backups.
      */}
    </div>
  )
}
