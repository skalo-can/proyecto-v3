from backend.app.crud.filtros.busqueda_global_crud import buscar_en_todo

def busqueda_global_service(db, search, limit, offset):
    return buscar_en_todo(db, search, limit, offset)