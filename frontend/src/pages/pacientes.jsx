import React, { useEffect, useState, useCallback } from "react";
import Filtros from "../components/Filtros/Filtros";
import "./Pacientes.css";

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState({
    id: "",
    nombre: "",
    apellido: "",
    fecha: "",
  });
  const [pagina, setPagina] = useState(0);
  const [sort, setSort] = useState("id");
  const [order, setOrder] = useState("asc");

  const limit = 20;

  // ---------------------------------------------------------
  // 1. FUNCIÓN DE CARGA (Ahora independiente para ser reutilizada)
  // ---------------------------------------------------------
  const cargarDatos = useCallback(() => {
    const params = new URLSearchParams({
      ...filtros,
      sort,
      order,
      limit,
      offset: pagina * limit,
    });

    fetch(`http://localhost:8000/filtros/pacientes?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPacientes(data.items);
        setTotal(data.total);
      })
      .catch((err) => console.error("Error cargando pacientes:", err));
  }, [filtros, pagina, sort, order]);

  // ---------------------------------------------------------
  // 2. EFECTO DE CARGA POR FILTROS/PAGINACIÓN
  // ---------------------------------------------------------
  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ---------------------------------------------------------
  // 3. CONEXIÓN WEBSOCKET (La "oreja" invisible)
  // ---------------------------------------------------------
  useEffect(() => {
    // Conectamos al endpoint que creamos en el backend
    const socket = new WebSocket("ws://localhost:8000/ws/notifications");

    socket.onmessage = (event) => {
      if (event.data === "refresh_data") {
        console.log("📡 Nuevo estudio detectado: Actualizando lista en silencio...");
        cargarDatos(); // Recarga los datos sin parpadear la pantalla
      }
    };

    socket.onclose = () => {
      console.warn("⚠️ WebSocket cerrado. Reintentando en 5s...");
      // Opcional: Reintento de conexión si se cae
    };

    return () => socket.close(); // Limpieza al salir de la página
  }, [cargarDatos]);

  // ---------------------------------------------------------
  // INTERFAZ Y EVENTOS
  // ---------------------------------------------------------
  const toggleSort = (campo) => {
    if (sort === campo) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(campo);
      setOrder("asc");
    }
  };

  const handleEnviar = (paciente) => console.log("Enviar:", paciente);
  const handleEditar = (paciente) => console.log("Editar:", paciente);
  const handleEliminar = (paciente) => console.log("Eliminar:", paciente);

  return (
    <div className="pacientes-page fade-in">
      <h2 className="titulo-pagina">Pacientes</h2>

      <Filtros filtros={filtros} setFiltros={setFiltros} tipo="pacientes" />

      <div className="tabla-container glass-box">
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th onClick={() => toggleSort("id")}>ID {sort === "id" && (order === "asc" ? "🔼" : "🔽")}</th>
              <th onClick={() => toggleSort("nombre")}>Nombre</th>
              <th onClick={() => toggleSort("apellido")}>Apellido</th>
              <th onClick={() => toggleSort("fecha_registro")}>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pacientes.length === 0 ? (
              <tr>
                <td colSpan="5" className="sin-datos">Esperando estudios...</td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id} className="row-animation">
                  <td>{p.id}</td>
                  <td>{p.nombre}</td>
                  <td>{p.apellido}</td>
                  <td>{p.fecha_registro}</td>
                  <td className="acciones">
                    <button className="btn-accion enviar" title="Enviar" onClick={() => handleEnviar(p)}>✉</button>
                    <button className="btn-accion editar" title="Editar" onClick={() => handleEditar(p)}>✎</button>
                    <button className="btn-accion eliminar" title="Eliminar" onClick={() => handleEliminar(p)}>🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="paginacion glass-box">
        <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
        <span>Página {pagina + 1} de {Math.ceil(total / limit) || 1}</span>
        <button disabled={(pagina + 1) * limit >= total} onClick={() => setPagina(pagina + 1)}>Siguiente →</button>
      </div>
    </div>
  );
}