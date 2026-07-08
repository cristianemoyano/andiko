import { createPageMetadata } from '@/lib/site'

export const metadata = createPageMetadata({
  title: 'Términos y Condiciones de Servicio',
  path: '/legales/terminos',
})

export default function TerminosPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-md p-3 text-sm mb-8">
        Este es un borrador sujeto a revisión legal. No debe considerarse asesoramiento legal
        definitivo hasta su validación por un profesional matriculado.
      </div>

      <h1 className="text-2xl font-semibold text-fg">
        TÉRMINOS Y CONDICIONES DE SERVICIO — ANDIKO
      </h1>
      <p className="text-sm text-fg-muted leading-relaxed mt-2">
        Última actualización: 7 de julio de 2026 (versión 2026-07-07)
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        1. Identificación del prestador y aceptación
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Estos Términos y Condiciones de Servicio (los &quot;Términos&quot;) constituyen un
        contrato entre [RAZÓN SOCIAL DEL TITULAR], CUIT [CUIT], con domicilio en [DOMICILIO],
        República Argentina (&quot;Andiko&quot;, &quot;nosotros&quot;), y la persona jurídica o
        humana que contrata la plataforma Andiko (el &quot;Cliente&quot; o la
        &quot;Organización&quot;). Regulan el acceso y uso de la plataforma de gestión
        empresarial Andiko, sus sitios, aplicaciones, APIs y servicios asociados (la
        &quot;Plataforma&quot; o el &quot;Servicio&quot;).
      </p>
      <p className="text-sm text-fg-muted leading-relaxed mt-3">
        Al crear una cuenta, aceptar estos Términos por medios electrónicos o utilizar la
        Plataforma, la persona que actúa (el &quot;Usuario&quot;) declara: (a) haber leído y
        aceptado estos Términos y la Política de Privacidad, que forma parte integrante de los
        mismos; y (b) contar con capacidad legal y, cuando actúa por una Organización,
        facultades suficientes para obligarla. Si no está de acuerdo con estos Términos, no
        debe utilizar la Plataforma. La aceptación por medios electrónicos tiene plena validez
        conforme a los artículos 286, 288 y 971 y concordantes del Código Civil y Comercial de
        la Nación y a la Ley 25.506 de Firma Digital. Andiko conserva registro de cada
        aceptación (usuario, fecha y versión aceptada) como medio de prueba.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">2. Definiciones</h2>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1">
        <li>
          <strong>Cliente u Organización:</strong> la empresa o persona que contrata la
          Suscripción y es titular de la cuenta principal.
        </li>
        <li>
          <strong>Usuario:</strong> cada persona humana autorizada por el Cliente a acceder a
          la Plataforma bajo su cuenta.
        </li>
        <li>
          <strong>Datos del Cliente:</strong> toda la información, documentos, archivos y
          datos (incluidos datos personales de terceros) que el Cliente o sus Usuarios cargan,
          generan o almacenan en la Plataforma.
        </li>
        <li>
          <strong>Suscripción y Plan:</strong> la modalidad de contratación por períodos, con
          las funcionalidades, límites de uso y precio del plan elegido.
        </li>
        <li>
          <strong>Servicios de Terceros:</strong> productos o servicios de terceros que el
          Cliente decide conectar o utilizar junto con la Plataforma.
        </li>
      </ul>

      <h2 className="text-lg font-semibold mt-8 text-fg">3. Descripción del Servicio</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko es un software de gestión (ERP) para pequeñas y medianas empresas, provisto
        como servicio (SaaS) mediante Suscripción, que incluye —según el Plan contratado—
        módulos de gestión de clientes, productos, inventario, compras, ventas, facturación,
        CRM, recursos humanos, reportes, integraciones con terceros, APIs, webhooks y
        almacenamiento de archivos, entre otros. Andiko puede incorporar, mejorar o reemplazar
        funcionalidades para la evolución del Servicio.
      </p>
      <p className="text-sm text-fg-muted leading-relaxed mt-3">
        La Plataforma es una herramienta de gestión. Andiko no presta servicios de
        asesoramiento contable, impositivo, laboral ni legal, y la información generada por la
        Plataforma no sustituye la intervención de los profesionales que correspondan.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        4. Cuentas, registro y credenciales
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Cliente debe proporcionar información veraz, completa y actualizada al registrarse
        y mantenerla actualizada. Las credenciales de acceso son personales e intransferibles.
        El Usuario es responsable de mantener la confidencialidad de sus credenciales y de
        toda actividad realizada bajo su cuenta, y debe notificar a Andiko sin demora ante
        cualquier uso no autorizado o compromiso de seguridad. Esta responsabilidad no alcanza
        al uso no autorizado que resulte de una falla de seguridad imputable a Andiko. La
        Organización es responsable de las altas, bajas, roles y permisos que asigna a sus
        propios Usuarios, y de revocar el acceso de quienes dejen de estar autorizados.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        5. Suscripción, precios, facturación e impuestos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El acceso a la Plataforma se contrata por Suscripción, según los planes, precios y
        límites publicados en el sitio de Andiko o acordados en una propuesta comercial. Los
        precios se expresan en pesos argentinos (ARS). En caso de divergencia, la propuesta
        comercial suscripta con el Cliente prevalece sobre los precios de lista. Salvo
        indicación expresa en contrario, los precios se informan sin impuestos; los tributos,
        tasas, percepciones y retenciones aplicables según la condición fiscal del Cliente
        están a su cargo. Cuando el Cliente revista carácter de consumidor, el precio se
        exhibirá de forma final, en moneda de curso legal y con los impuestos incluidos,
        conforme a la Ley 24.240 y su reglamentación. La facturación se realiza por adelantado
        por cada período de Suscripción, con emisión de comprobantes electrónicos conforme a la
        normativa fiscal vigente. [Completar cuando se incorporen pagos online: medios de pago
        aceptados, pasarela utilizada y momento de la percepción.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        6. Renovación automática y cambios de precio
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Suscripción se renueva automáticamente por períodos iguales al contratado, salvo
        que el Cliente la cancele antes de la finalización del período en curso desde la
        propia Plataforma o por comunicación fehaciente. Andiko puede modificar los precios
        con un preaviso mínimo de treinta (30) días corridos, comunicado por correo
        electrónico o mediante aviso en la Plataforma; el nuevo precio se aplica recién a
        partir de la renovación siguiente. Si el Cliente no está de acuerdo, puede cancelar la
        Suscripción antes de la renovación, sin penalidad. Cuando el Cliente revista carácter
        de consumidor: (i) la cancelación podrá realizarse por el mismo medio y con la misma
        facilidad con que se contrató la Suscripción, conforme a la Resolución 424/2020 de la
        Secretaría de Comercio Interior; y (ii) los aumentos de precio no operarán de modo
        automático sin su aceptación cuando ello resultara abusivo en los términos de los
        artículos 37 y 38 de la Ley 24.240.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        7. Falta de pago, reembolsos y derecho de revocación
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La falta de pago habilita a Andiko a suspender el acceso conforme a la cláusula 20,
        previa intimación con un plazo razonable para regularizar. Salvo disposición legal en
        contrario o incumplimiento imputable a Andiko, los importes abonados no son
        reembolsables y la cancelación anticipada no genera derecho a reintegros
        proporcionales: el Servicio permanece disponible hasta el fin del período pagado.
      </p>
      <p className="text-sm text-fg-muted leading-relaxed mt-3">
        Si el Cliente reviste carácter de consumidor en los términos de la Ley 24.240 y la
        contratación se realizó a distancia, le asiste el derecho de revocar la aceptación
        dentro de los diez (10) días corridos de celebrado el contrato (artículo 34 de la Ley
        24.240 y artículos 1110 y siguientes del Código Civil y Comercial), sin costo, en cuyo
        caso se reintegrarán los importes abonados. [Nota operativa: si se comercializa a
        consumidores por sitio web, debe implementarse el &quot;botón de arrepentimiento&quot;
        exigido por la Resolución 424/2020 de la Secretaría de Comercio Interior.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">8. Licencia de uso</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Sujeto al cumplimiento de estos Términos y al pago de la Suscripción, Andiko otorga al
        Cliente una licencia limitada, no exclusiva, intransferible y sin derecho a
        sublicenciar, para acceder y utilizar la Plataforma durante la vigencia de la
        Suscripción, exclusivamente para la gestión interna de su negocio y dentro de los
        límites del Plan contratado (incluyendo cantidad de usuarios y límites de uso). La
        licencia solo podrá suspenderse o revocarse en los supuestos previstos en las cláusulas
        20 y 21, y no de manera discrecional. No se otorga ningún otro derecho, expreso o
        implícito, sobre la Plataforma.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        9. Uso aceptable y conductas prohibidas
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Cliente y sus Usuarios se comprometen a utilizar la Plataforma de forma lícita y
        conforme a estos Términos. Está prohibido, en particular:
      </p>
      <ul className="text-sm text-fg-muted leading-relaxed list-disc pl-5 space-y-1 mt-3">
        <li>Utilizar la Plataforma con fines ilícitos o en infracción de derechos de terceros.</li>
        <li>
          Intentar vulnerar, eludir o probar la seguridad de la Plataforma, o acceder sin
          autorización a cuentas, datos o sistemas ajenos (conductas que además pueden
          configurar delitos conforme a la Ley 26.388 y al Código Penal).
        </li>
        <li>
          Realizar ingeniería inversa, descompilar o intentar derivar el código fuente de la
          Plataforma, salvo en la medida en que la ley lo permita de forma irrenunciable.
        </li>
        <li>
          Copiar, revender, alquilar, sublicenciar o poner la Plataforma a disposición de
          terceros ajenos a la Organización, o utilizarla para prestar servicios a terceros
          en modalidad de tercerización no autorizada.
        </li>
        <li>
          Realizar extracción masiva de datos (scraping) o acceso automatizado fuera de las
          APIs documentadas, o sobrecargar deliberadamente la infraestructura.
        </li>
        <li>Introducir malware o contenido dañino, o cargar contenido ilícito.</li>
        <li>
          Cargar datos personales de terceros sin contar con base legal suficiente para su
          tratamiento.
        </li>
        <li>Suplantar la identidad de otra persona u organización.</li>
        <li>
          Utilizar el acceso a la Plataforma, sus funcionalidades no públicas o su
          documentación para desarrollar, entrenar o comercializar un producto o servicio
          competidor. Esta restricción no limita la actividad comercial propia del Cliente
          ajena a la Plataforma.
        </li>
      </ul>
      <p className="text-sm text-fg-muted leading-relaxed mt-3">
        El incumplimiento de esta cláusula habilita la suspensión o terminación previstas en
        las cláusulas 20 y 21, sin perjuicio de las acciones legales que correspondan.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        10. APIs, claves de acceso y webhooks
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Cuando el Plan incluya acceso a APIs, Andiko emitirá claves de acceso que son
        confidenciales y de responsabilidad exclusiva del Cliente, quien debe custodiarlas y
        rotarlas ante cualquier sospecha de compromiso. El uso de las APIs está sujeto a
        límites de tasa y de uso razonable destinados a preservar la estabilidad del Servicio.
        Andiko puede versionar o modificar las APIs procurando mantener compatibilidad y
        comunicando con antelación razonable los cambios que la rompan. Los webhooks se
        entregan a los endpoints configurados por el Cliente, cuya seguridad y disponibilidad
        son responsabilidad del Cliente; Andiko no garantiza entrega única ni ordenada de los
        eventos, y el Cliente debe diseñar sus integraciones de forma tolerante a reintentos.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        11. Integraciones y Servicios de Terceros
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Plataforma puede interoperar con Servicios de Terceros que el Cliente decida
        habilitar. Dichos servicios se rigen por sus propios términos y políticas, que el
        Cliente debe aceptar directamente con cada proveedor. Al habilitar una integración, el
        Cliente instruye a Andiko a intercambiar con ese tercero los datos necesarios para su
        funcionamiento. Andiko no controla ni responde por los actos, omisiones,
        interrupciones o tratamiento de datos de los Servicios de Terceros, sin perjuicio de
        las obligaciones de Andiko respecto de los subencargados que contrata por sí, que se
        rigen por la Política de Privacidad.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        12. Funcionalidades de inteligencia artificial
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko puede incorporar funcionalidades de inteligencia artificial o automatización.
        En tal caso: (a) serán identificadas como tales y, cuando sea razonablemente posible,
        de activación opcional; (b) los resultados generados pueden contener errores u
        omisiones, no constituyen asesoramiento profesional y deben ser revisados por el
        Cliente antes de utilizarlos con efectos fiscales, contables o comerciales; (c) los
        Datos del Cliente no serán utilizados para entrenar modelos de inteligencia artificial
        propios ni de terceros sin consentimiento previo y expreso del Cliente; y (d) los
        proveedores que intervengan en el procesamiento serán informados en el listado de
        subencargados de la Política de Privacidad. [Nota: revisar y detallar esta cláusula al
        lanzar cada funcionalidad concreta de IA.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">13. Propiedad intelectual</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        La Plataforma, su software, código, diseño, interfaces, marcas, logos y documentación
        son de titularidad de Andiko o de sus licenciantes y están protegidos por la Ley
        11.723 de Propiedad Intelectual y demás normativa aplicable. Estos Términos no
        transfieren al Cliente ningún derecho de propiedad intelectual sobre la Plataforma,
        más allá de la licencia de uso de la cláusula 8. Si el Cliente envía sugerencias o
        comentarios sobre el Servicio, otorga a Andiko una licencia gratuita, perpetua e
        irrevocable para utilizarlos sin obligación alguna, sin que ello alcance a los Datos
        del Cliente.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">14. Datos del Cliente</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Los Datos del Cliente son y seguirán siendo de titularidad del Cliente. El Cliente
        otorga a Andiko una licencia limitada y no exclusiva para alojar, procesar, transmitir,
        respaldar y mostrar los Datos del Cliente con el único fin de prestar el Servicio,
        cumplir obligaciones legales y proteger la seguridad de la Plataforma. Andiko no vende
        los Datos del Cliente ni los utiliza con fines publicitarios. El Cliente declara y
        garantiza que cuenta con los derechos y bases legales necesarios para cargar y tratar
        en la Plataforma los datos —incluidos datos personales de terceros— que incorpora.
        Andiko puede elaborar y utilizar información estadística agregada y anonimizada, que
        no identifique al Cliente ni a persona alguna, para operar y mejorar el Servicio; dicho
        uso no comprende el empleo de Datos del Cliente identificables para entrenar modelos de
        inteligencia artificial, que se rige por la cláusula 12.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        15. Protección de datos personales
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Respecto de los datos personales de contactos, clientes, proveedores o empleados del
        Cliente cargados en la Plataforma, el Cliente actúa como responsable del tratamiento y
        Andiko como encargado, en los términos del artículo 25 de la Ley 25.326: Andiko trata
        esos datos únicamente conforme a las instrucciones del Cliente impartidas mediante el
        uso normal de la Plataforma, no los aplica a fines propios, no los cede salvo lo
        previsto en la Política de Privacidad y aplica las medidas de seguridad allí descriptas.
        En su carácter de encargado, Andiko además: (i) impone a los subencargados que contrata
        obligaciones de confidencialidad y seguridad no menores a las aquí asumidas; (ii)
        notifica al Cliente, sin demora indebida, los incidentes de seguridad que afecten sus
        datos; (iii) asiste razonablemente al Cliente para atender el ejercicio de derechos de
        los titulares y los requerimientos de la autoridad de control; y (iv) al terminar el
        contrato, suprime o devuelve los datos personales conforme a la cláusula 22 y a las
        instrucciones del Cliente, salvo obligación legal de conservación. Respecto de los
        datos de los Usuarios y de la relación comercial con el Cliente,
        Andiko actúa como responsable del tratamiento conforme a su Política de Privacidad,
        disponible en /legales/privacidad, que forma parte integrante de estos Términos. [Nota:
        se recomienda ofrecer a los Clientes un anexo de tratamiento de datos (DPA) que
        instrumente por escrito el encargo del artículo 25; requiere redacción específica.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">16. Confidencialidad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Cada parte se obliga a mantener la confidencialidad de la información no pública de la
        otra a la que acceda con motivo de este contrato, a utilizarla únicamente para su
        ejecución y a protegerla con un grado de cuidado no menor al que aplica a su propia
        información confidencial, y en ningún caso inferior al razonable. No es información
        confidencial la que: (a) sea o devenga pública sin incumplimiento; (b) estuviera
        lícitamente en poder del receptor con anterioridad; (c) sea recibida lícitamente de un
        tercero sin deber de confidencialidad; o (d) sea desarrollada de forma independiente.
        La parte requerida por autoridad competente a revelar información confidencial podrá
        hacerlo en la medida exigida, notificando a la otra parte cuando sea lícito. Esta
        obligación subsiste por cinco (5) años desde la terminación del contrato, sin
        perjuicio del deber de confidencialidad sobre datos personales, que subsiste conforme
        al artículo 10 de la Ley 25.326.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        17. Facturación electrónica y responsabilidad fiscal
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko provee herramientas para generar comprobantes y gestionar información fiscal,
        incluyendo la interacción con servicios de AFIP/ARCA. La exactitud de los datos
        cargados, la correcta configuración fiscal, el cumplimiento de las obligaciones
        tributarias y la validez de los comprobantes emitidos son responsabilidad exclusiva
        del Cliente. Ante cambios normativos, Andiko procurará adecuar la Plataforma en plazos
        razonables, sin garantizar la adecuación simultánea con la entrada en vigencia de cada
        cambio. La indisponibilidad de los servicios informáticos de organismos estatales o de
        terceros no constituye incumplimiento de Andiko.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        18. Disponibilidad del Servicio y mantenimiento
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko procura mantener la Plataforma disponible de manera continua, pero no garantiza
        disponibilidad ininterrumpida ni libre de errores, salvo que un acuerdo de nivel de
        servicio (SLA) haya sido pactado por escrito para el Plan contratado. Los
        mantenimientos programados se comunicarán con antelación razonable y se procurará
        realizarlos fuera del horario hábil argentino; los mantenimientos de emergencia podrán
        realizarse sin preaviso. [Nota: si se comercializan planes con SLA, definir métricas,
        exclusiones y créditos por incumplimiento en un anexo específico.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">19. Copias de respaldo (backups)</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko realiza copias de respaldo periódicas de las bases de datos de la Plataforma
        con fines de recuperación ante fallas o desastres del sistema en su conjunto. Los
        respaldos no constituyen un archivo histórico ilimitado ni un servicio de custodia
        documental, y no sustituyen la obligación del Cliente de conservar sus libros,
        registros e instrumentos respaldatorios por los plazos legales (artículo 328 del
        Código Civil y Comercial y normativa tributaria aplicable). La Plataforma ofrece
        mecanismos de exportación y se recomienda al Cliente exportar periódicamente su
        información. La restauración de datos individuales eliminados por el propio Cliente
        podrá no estar disponible o estar sujeta a las limitaciones del Plan.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">20. Suspensión de cuentas</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko puede suspender total o parcialmente el acceso del Cliente o de un Usuario,
        notificándolo en forma previa cuando sea razonablemente posible, ante: (a) mora en el
        pago que persista luego de una intimación con un plazo de regularización no menor a
        diez (10) días corridos; (b) infracción grave del uso aceptable o riesgo actual para la
        seguridad o integridad de la Plataforma, de otros clientes o de terceros; (c)
        requerimiento de autoridad competente; o (d) uso que exceda los límites del Plan y
        degrade el Servicio, si persiste tras el aviso. La suspensión se limitará, en alcance y
        duración, a lo necesario, se levantará sin demora una vez cesada su causa y no implica
        la eliminación de los Datos del Cliente ni exime del pago de las sumas devengadas.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">21. Vigencia y terminación</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El contrato rige durante el período de Suscripción y sus renovaciones. El Cliente
        puede cancelar en cualquier momento, con efecto al finalizar el período en curso.
        Andiko puede resolver el contrato: (a) ante incumplimiento grave del Cliente no
        subsanado dentro de los quince (15) días corridos de intimado; (b) por discontinuación
        general del Servicio, con un preaviso mínimo de sesenta (60) días corridos y reintegro
        proporcional de los períodos abonados y no consumidos; o (c) en los demás supuestos
        previstos por la ley.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        22. Efectos de la terminación: exportación y eliminación de datos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Terminado el contrato por cualquier causa, el Cliente dispondrá de un plazo de treinta
        (30) días corridos para exportar sus Datos del Cliente en formatos estándar, mediante
        la Plataforma o a su solicitud. Es responsabilidad exclusiva del Cliente exportar
        dentro de ese plazo la información que deba conservar por obligaciones legales,
        contables o fiscales. Cuando la terminación no sea imputable al Cliente, Andiko
        brindará asistencia razonable para la exportación. Vencido el plazo, Andiko eliminará o
        anonimizará los Datos del Cliente dentro de plazos técnicos razonables, salvo la
        información que Andiko deba conservar por obligación legal propia o para la defensa de
        reclamos, y sin perjuicio de las copias residuales en respaldos, que se depuran según
        su ciclo de rotación. Subsisten a la terminación las cláusulas que por su naturaleza
        deban subsistir, incluyendo propiedad intelectual, confidencialidad, limitación de
        responsabilidad y ley aplicable.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">23. Exclusión de garantías</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        En la máxima medida permitida por la ley argentina, la Plataforma se provee &quot;en el
        estado en que se encuentra&quot; y &quot;según disponibilidad&quot;. Andiko no
        garantiza que el Servicio sea ininterrumpido, libre de errores o que satisfaga
        requerimientos particulares del Cliente distintos de los descriptos en estos Términos
        y en el Plan contratado. Esta cláusula no limita las garantías legales irrenunciables,
        en particular las que asisten a consumidores conforme a la Ley 24.240, ni la
        responsabilidad que no puede dispensarse anticipadamente conforme al artículo 1743 del
        Código Civil y Comercial.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        24. Limitación de responsabilidad
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        En la máxima medida permitida por la ley aplicable: (a) Andiko no será responsable por
        daños indirectos, lucro cesante, pérdida de chance ni daño reputacional derivados del
        uso o imposibilidad de uso de la Plataforma; y (b) la responsabilidad total y
        acumulada de Andiko frente al Cliente por todo concepto queda limitada al monto
        efectivamente abonado por el Cliente por el Servicio durante los doce (12) meses
        anteriores al hecho generador. Estas limitaciones no se aplican: (i) en casos de dolo o
        culpa grave de Andiko, cuya dispensa anticipada está prohibida por el artículo 1743 del
        Código Civil y Comercial; (ii) a los daños a la persona; (iii) a los daños que la ley
        no permita limitar o excluir; ni (iv) frente a consumidores, en cuanto resulten
        aplicables normas de orden público de la Ley 24.240 (en particular su artículo 37).
        Estos Términos constituyen un contrato de adhesión y se interpretan conforme a los
        artículos 984 y siguientes del Código Civil y Comercial.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">25. Indemnidad</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Cliente mantendrá indemne a Andiko frente a reclamos de terceros que se funden en:
        (a) los Datos del Cliente, incluida la carga de datos personales sin base legal
        suficiente; (b) el uso de la Plataforma en infracción de estos Términos o de la ley; o
        (c) las relaciones del Cliente con sus propios clientes, proveedores o empleados.
        Andiko notificará al Cliente el reclamo y le permitirá participar de la defensa. Esta
        cláusula no será oponible al Cliente consumidor en cuanto contradiga normas de orden
        público. Recíprocamente, Andiko defenderá al Cliente frente a reclamos de terceros que
        imputen que la Plataforma, en sí misma, infringe derechos de propiedad intelectual
        vigentes en la República Argentina, y lo mantendrá indemne por las sumas que resulten
        de una sentencia firme o transacción aprobada por Andiko, con el límite previsto en la
        cláusula 24. Esta obligación no alcanza a reclamos originados en los Datos del Cliente,
        en usos no autorizados o en combinaciones con Servicios de Terceros.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        26. Caso fortuito y fuerza mayor
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Ninguna de las partes responde por el incumplimiento de sus obligaciones —excepto las
        de pago ya devengadas— causado por caso fortuito o fuerza mayor en los términos de los
        artículos 955, 956, 1730 y 1732 del Código Civil y Comercial, incluyendo a título
        ejemplificativo: catástrofes naturales, conflictos bélicos, actos de autoridad
        pública, interrupciones generalizadas de energía o telecomunicaciones, y ciberataques
        de gran escala ajenos a la culpa de la parte afectada. Si el evento se prolonga por
        más de treinta (30) días corridos, cualquiera de las partes podrá resolver el contrato
        sin penalidad, con reintegro proporcional de los períodos abonados y no prestados.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        27. Modificaciones de estos Términos
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko puede modificar estos Términos. Los cambios materiales serán comunicados con un
        preaviso mínimo de treinta (30) días corridos por correo electrónico o mediante aviso
        destacado en la Plataforma, y requerirán nueva aceptación expresa antes de continuar
        usando el Servicio. Mientras el Usuario no preste esa nueva aceptación, Andiko podrá
        restringir el acceso al Servicio; el mero uso continuado no suple la aceptación
        expresa. Si el Cliente no acepta los cambios, podrá rescindir la Suscripción antes de
        su entrada en vigencia, con reintegro proporcional de los períodos abonados y no
        consumidos. Los cambios no sustanciales, o los exigidos por normativa, rigen desde su
        publicación. Cada versión de los Términos se identifica con fecha y número de versión.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        28. Funcionalidades en versión preliminar (beta)
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Andiko puede ofrecer funcionalidades identificadas como preliminares, beta, de prueba
        o de acceso anticipado. Estas se proveen &quot;en el estado en que se encuentran&quot;,
        pueden modificarse o discontinuarse en cualquier momento sin responsabilidad, no están
        cubiertas por acuerdos de nivel de servicio y no deben utilizarse para operaciones
        críticas del Cliente. El uso de estas funcionalidades es voluntario.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">29. Cesión</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        El Cliente no puede ceder este contrato ni sus derechos u obligaciones sin
        consentimiento previo y escrito de Andiko. Andiko puede ceder el contrato a una
        sociedad de su grupo o en el marco de una reorganización societaria, fusión o
        transferencia de fondo de comercio, notificándolo al Cliente; en tal caso el
        cesionario asumirá estos Términos y la Política de Privacidad vigentes.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        30. Comunicaciones y notificaciones
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Las comunicaciones entre las partes se cursarán válidamente por correo electrónico a
        la casilla registrada por el Cliente —que éste se obliga a mantener actualizada y
        operativa— y mediante avisos dentro de la Plataforma. Las notificaciones dirigidas a
        Andiko deben enviarse a [EMAIL DE CONTACTO].
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">31. Disposiciones generales</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Si alguna cláusula de estos Términos fuera declarada nula o inaplicable, las restantes
        conservarán plena vigencia. La falta de ejercicio de un derecho por cualquiera de las
        partes no implica su renuncia. Estos Términos, junto con la Política de Privacidad, el
        Plan contratado y sus anexos, constituyen el acuerdo íntegro entre las partes respecto
        del Servicio y reemplazan todo acuerdo anterior sobre el mismo objeto. Las partes son
        independientes: nada en estos Términos crea sociedad, mandato ni relación laboral
        entre ellas.
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">
        32. Ley aplicable, jurisdicción y consumidores
      </h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Estos Términos se rigen por las leyes de la República Argentina. Ante cualquier
        controversia, las partes procurarán primero una solución amistosa dentro de los
        treinta (30) días de notificado el reclamo; agotada esa instancia, se someten a los
        tribunales ordinarios competentes de [JURISDICCIÓN]. Cuando el Cliente revista
        carácter de consumidor, quedan a salvo las normas imperativas de la Ley 24.240 y del
        Código Civil y Comercial; en particular, será competente el juez del domicilio real del
        consumidor y se tendrá por no convenida toda prórroga de jurisdicción en su perjuicio
        (artículos 36 de la Ley 24.240 y 1109 del Código Civil y Comercial). [Nota: la
        conveniencia de una cláusula arbitral para clientes empresa requiere análisis
        específico; no se incluye por defecto.]
      </p>

      <h2 className="text-lg font-semibold mt-8 text-fg">33. Contacto</h2>
      <p className="text-sm text-fg-muted leading-relaxed">
        Consultas sobre estos Términos: [EMAIL DE CONTACTO].
      </p>
    </div>
  )
}
