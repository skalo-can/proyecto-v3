def filtrar_pacientes_service(db, id, nombre, apellido, fecha, sort, order, limit, offset):
    return filtrar_pacientes_db(db, id, nombre, apellido, fecha, sort, order, limit, offset)