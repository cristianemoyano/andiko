# language: es
Característica: Gestión de Contactos (Clientes y Proveedores)
  Como administrador del negocio
  Quiero gestionar información de clientes y proveedores
  Para mantener relaciones comerciales organizadas y precisas

  Escenario: Crear nuevo proveedor
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y creo un nuevo contacto proveedor con:
      | nombre         | Proveedor Químicos        |
      | cuit           | 20123456789               |
      | email          | contacto@quimicos.ar      |
      | telefono       | 0261-4123456              |
      | condiciones    | neto_30                   |
    Y veo el contacto creado

  Escenario: Crear nuevo cliente
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y creo un nuevo contacto cliente con:
      | nombre         | Cliente XYZ               |
      | cuit           | 20555666777               |
      | email          | contacto@clientexyz.ar    |
      | telefono       | 0261-4987654              |
      | limite_credito | 50000                     |
    Y veo el contacto creado

  Escenario: Validación de CUIT
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y creo un nuevo contacto cliente con:
      | nombre | Test CUIT Inválido |
    Y ingreso CUIT inválido "12345678"
    Entonces el validador rechaza CUIT inválido "12345678"

  Escenario: Editar contacto
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y busco el contacto "Cliente XYZ"
    Y edito el contacto "Cliente XYZ"
    Y actualizo el email a "nuevo-email@clientexyz.ar"
    Y actualizo el teléfono a "0261-5555555"
    Y guardo el contacto
    Entonces veo el mensaje "Contacto actualizado"

  Escenario: Registrar CBU para proveedor
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y busco el contacto "Proveedor Químicos"
    Y abro el detalle del contacto "Proveedor Químicos"
    Y establezco CBU "0140001420000013999999"
    Entonces veo el mensaje "Dato de pago agregado"
    Y el CBU es validado correctamente

  Escenario: Filtrar por tipo de contacto
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y filtro contactos por tipo "proveedor"
    Entonces veo solo contactos de tipo "proveedor"

  Escenario: Buscar contacto
    Dado estoy autenticado como "gerente"
    Cuando navego a contactos
    Y busco el contacto "Cliente XYZ"
    Entonces veo el contacto "Cliente XYZ"
