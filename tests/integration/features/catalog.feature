# language: es
Característica: Catálogo de Productos
  Como gerente de inventario
  Quiero gestionar el catálogo de productos
  Para mantener información actualizada de precios, costos y stock

  Escenario: Crear nuevo producto
    Dado estoy autenticado como "gerente"
    Cuando navego a "/erp/catalog/products"
    Y creo un producto con datos:
      | nombre          | Resina Epóxica       |
      | codigo          | RES-001              |
      | categoria       | Materias Primas      |
      | unidad          | kg                   |
      | precio_costo    | 150.50               |
      | precio_venta    | 250.00               |
    Entonces veo el mensaje "Producto creado exitosamente"
    Y veo el producto "Resina Epóxica" en la lista

  Escenario: Buscar producto por nombre
    Dado estoy autenticado como "gerente"
    Y existen productos en catálogo
    Cuando navego a "/erp/catalog/products"
    Y busco el producto "Resina Epóxica"
    Entonces veo el producto "Resina Epóxica" en la lista

  Escenario: Editar producto
    Dado estoy autenticado como "gerente"
    Cuando navego a "/erp/catalog/products"
    Y edito el producto "Resina Epóxica"
    Y establezco el precio de venta en "280.00"
    Y hago clic en "Guardar"
    Entonces veo el mensaje "Producto actualizado"

  Escenario: Archivar producto
    Dado estoy autenticado como "gerente"
    Cuando navego a "/erp/catalog/products"
    Y archivar el producto "Resina Epóxica"
    Y hago clic en "Confirmar" en el diálogo
    Entonces el producto "Resina Epóxica" está archivado
    Y no veo el producto "Resina Epóxica" en la lista (excepto en vista archivados)

  Escenario: Filtrar productos por categoría
    Dado estoy autenticado como "gerente"
    Cuando navego a "/erp/catalog/products"
    Y filtro productos por categoría "Materias Primas"
    Entonces veo solo productos de la categoría "Materias Primas"

  Escenario: Crear lista de precios
    Dado estoy autenticado como "gerente"
    Cuando establezco una lista de precios "Mayoristas" con:
      | producto | precio |
      | RES-001  | 220.00 |
      | CAT-001  | 100.00 |
    Entonces veo el mensaje "Lista de precios creada"
    Y la lista de precios "Mayoristas" existe
