# language: es
@skip
Característica: Gestión de Inventario y Stock
  Como encargado de almacén
  Quiero llevar control del stock, registrar movimientos y alertas de bajo nivel
  Para mantener la precisión del inventario

  Escenario: Registrar lote de entrada por compra
    Dado estoy autenticado como "gerente"
    Y existe una orden de compra "OC-001" recibida

    Cuando navego a inventario
    Y registro un lote con:
      | Producto    | Cantidad | Fecha       |
      | Resina      | 10       | 2026-06-15  |
      | Catalizador | 5        | 2026-06-15  |

    Entonces el stock de "Resina" es 10
    Y el stock de "Catalizador" es 5
    Y se registra el movimiento de entrada

  Escenario: Consultar saldo de stock
    Dado estoy autenticado como "gerente"
    Y existen productos con stock registrado

    Cuando navego a inventario
    Y busco el producto "Resina Epóxica"

    Entonces veo saldo: 50 unidades
    Y veo ubicación: Estantería A-01
    Y veo lotes disponibles

  Escenario: Conteo físico
    Dado estoy autenticado como "gerente"
    Y el stock del sistema dice "Resina: 50"

    Cuando creo un conteo físico
    Y registrar cantidades reales:
      | Producto | Cantidad Real |
      | Resina   | 48            |

    Entonces se genera ajuste por 2 unidades faltantes
    Y se crea documento de "Ajuste de Inventario"

  Escenario: Deducción de stock por venta
    Dado estoy autenticado como "vendedor"
    Y el stock de "Resina" es 50

    Cuando creo una factura con 10 unidades de "Resina"
    Y confirmo la factura

    Entonces el stock de "Resina" disminuye a 40
    Y se registra movimiento de salida

  Escenario: Alerta de stock bajo
    Dado estoy autenticado como "gerente"
    Y "Catalizador" tiene límite mínimo de 5 unidades
    Y el stock actual es 3 unidades

    Cuando navego a inventario
    Entonces veo alerta "Stock bajo" para "Catalizador"
    Y se marca en color rojo

  Escenario: Movimiento de transferencia entre almacenes
    Dado estoy autenticado como "gerente"
    Y existen dos almacenes: "Central" y "Sucursal"
    Y "Resina" está en almacén "Central" con 30 unidades

    Cuando creo transferencia de 10 unidades a "Sucursal"
    Entonces el stock en "Central" disminuye a 20
    Y el stock en "Sucursal" aumenta a 10
    Y se registran dos movimientos

  Escenario: Seguimiento de lotes con vencimiento
    Dado estoy autenticado como "gerente"
    Y existen productos con vencimiento

    Cuando navego a inventario
    Y filtro por lotes próximos a vencer

    Entonces veo listado de lotes con fecha de vencimiento
    Y se resaltan los vencidos o próximos a vencer

  Escenario: Devolución de material al proveedor
    Dado estoy autenticado como "comprador"
    Y existe una recepción "REC-001" registrada

    Cuando creo una nota de devolución por defecto
    Y especifico 5 unidades a devolver

    Entonces el stock disminuye
    Y se crea movimiento de salida por devolución
    Y se registra nota de crédito al proveedor
