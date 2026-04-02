import uuid

def crear_link_seguro(estudio_id: int):
    token = uuid.uuid4().hex
    link = f"https://tuservidor.com/secure/{estudio_id}/{token}"
    print(f"[LINK SEGURO] Generado: {link}")
    return link