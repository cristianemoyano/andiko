# language: es
Característica: Gestión Financiera y Reportes
  Como contador o gerente general
  Quiero consultar deudas, generar reportes y llevar seguimiento de cuentas por cobrar/pagar
  Para tener visibilidad total del estado financiero del negocio

  Escenario: Consultar deuda pendiente por cliente
    Dado estoy autenticado como "gerente"
    Y existen facturas pendientes:
      | Cliente     | Monto | Vencimiento |
      | Cliente XYZ | 500   | 2026-07-15  |

    Cuando consulto el estado de "Cliente XYZ"
    Entonces veo deuda pendiente de 500
    Y veo vencimiento de factura "2026-07-15"

  Escenario: Registrar abono a deuda
    Dado estoy autenticado como "gerente"
    Y existe deuda de 500 pendiente de "Cliente XYZ"

    Cuando registro abono de 250
    Entonces la deuda disminuye a 250
    Y se registra en el diario contable

  Escenario: Consultar cuentas por cobrar
    Dado estoy autenticado como "contador"
    Y hay al menos 3 clientes con saldo pendiente
    Cuando navego a cuentas por cobrar
    Y filtro clientes con saldo pendiente

    Entonces veo 3 clientes con deuda pendiente
    Y veo columnas: "Cliente, CUIT, Estado, Facturado, Saldo, Vencido"

  @skip
  Escenario: Deudas vencidas
    Dado estoy autenticado como "contador"
    Y existen facturas vencidas sin pagar

    Cuando consulto vencimiento de deudas de "Cliente XYZ"
    Entonces veo deudas vencidas:
      | Documento | Monto | Días Atraso |
      | INV-001   | 1000  | 15          |
      | INV-002   | 500   | 8           |

  Escenario: Estado de cuenta del cliente
    Dado estoy autenticado como "vendedor"
    Cuando genero estado de cuenta de "Cliente XYZ"

    Entonces el estado de cuenta contiene:
      | tipo    | debe | haber |
      | Factura | 500  |       |
    Y veo columnas: "Fecha, Tipo, Comprobante, Vencimiento, Debe, Haber, Saldo"

  Escenario: Balance de situación patrimonial
    Dado estoy autenticado como "contador"
    Y hay situación patrimonial de integración para "2026-06"
    Cuando consulto saldo de cuenta por período "2026-06"

    Entonces veo activos totales de 250000
    Y veo pasivos totales de 100000
    Y el patrimonio neto es 150000

  @skip
  Escenario: Diario contable
    Dado estoy autenticado como "contador"
    Cuando navego a reportes financieros
    Y busco "Pago Cliente XYZ" en diario

    Entonces se registra en el diario contable
    Y veo asiento con débito a Caja y crédito a CxC

  @skip
  Escenario: Conciliación bancaria
    Dado estoy autenticado como "contador"
    Y tengo transacciones pendientes de conciliar

    Cuando concilio la cuenta bancaria
    Y verifico transacciones del 2026-06-01 al 2026-06-15

    Entonces todas las transacciones están conciliadas
    Y la diferencia es cero

  @skip
  Escenario: Reporte de IVA
    Dado estoy autenticado como "contador"
    Cuando genero reporte de IVA para período "2026-06"

    Entonces veo:
      | Concepto              | Monto      |
      | IVA Cobrado           | 15000      |
      | IVA Pagado            | 8000       |
      | IVA a Pagar           | 7000       |

  @skip
  Escenario: Retenciones
    Dado estoy autenticado como "contador"
    Y existen facturas con retención

    Cuando genero reporte de retenciones
    Entonces veo detalle por proveedor
    Y el monto total de retenciones es correcto
