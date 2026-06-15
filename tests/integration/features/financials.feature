# language: es
Característica: Gestión Financiera y Reportes
  Como contador o gerente general
  Quiero consultar deudas, generar reportes y llevar seguimiento de cuentas por cobrar/pagar
  Para tener visibilidad total del estado financiero del negocio

  Escenario: Consultar deuda pendiente por cliente
    Dado estoy autenticado como "gerente"
    Y existem invoices pendientes:
      | Cliente     | Monto | Vencimiento |
      | Cliente XYZ | 500   | 2026-07-15  |

    Cuando consulto el estado de "Cliente XYZ"
    Entonces veo deuda pendiente de 500
    Y el vencimiento fue hace X días

  Escenario: Registrar abono a deuda
    Dado estoy autenticado como "gerente"
    Y existe deuda de 500 pendiente de "Cliente XYZ"

    Cuando registro abono de 250
    Entonces la deuda disminuye a 250
    Y se registra en el diario contable

  Escenario: Consultar cuentas por cobrar
    Dado estoy autenticado como "contador"
    Cuando navego a reportes financieros
    Y genero reporte de deudas pendientes

    Entonces el reporte muestra 3 deudas pendientes
    Y veo columnas: Cliente, Documento, Monto, Vencimiento

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
      | documento | fecha      | concepto       | monto  |
      | INV-001   | 2026-06-01 | Factura        | -1000  |
      | PGO-001   | 2026-06-05 | Pago Transferencia | +500 |

  Escenario: Balance de situación patrimonial
    Dado estoy autenticado como "contador"
    Cuando consulto saldo de cuenta por período "2026-06"

    Entonces veo activos totales de 250000
    Y veo pasivos totales de 100000
    Y el patrimonio neto es 150000

  Escenario: Diario contable
    Dado estoy autenticado como "contador"
    Cuando navego a reportes financieros
    Y busco "Pago Cliente XYZ" en diario

    Entonces se registra en el diario contable
    Y veo asiento con débito a Caja y crédito a CxC

  Escenario: Conciliación bancaria
    Dado estoy autenticado como "contador"
    Y tengo transacciones pendientes de conciliar

    Cuando concilio la cuenta bancaria
    Y verifico transacciones del 2026-06-01 al 2026-06-15

    Entonces todas las transacciones están conciliadas
    Y la diferencia es cero

  Escenario: Reporte de IVA
    Dado estoy autenticado como "contador"
    Cuando genero reporte de IVA para período "2026-06"

    Entonces veo:
      | Concepto              | Monto      |
      | IVA Cobrado           | 15000      |
      | IVA Pagado            | 8000       |
      | IVA a Pagar           | 7000       |

  Escenario: Retenciones
    Dado estoy autenticado como "contador"
    Y existen facturas con retención

    Cuando genero reporte de retenciones
    Entonces veo detalle por proveedor
    Y el monto total de retenciones es correcto
