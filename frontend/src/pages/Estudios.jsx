import React, { useEffect, useState } from "react";
import Filtros from "../components/Filtros/Filtros";
import "./Estudios.css";

export default function Estudios() {

  // -----------------------------
  // ESTADOS
  // -----------------------------
  const [estudios, setEstudios] = useState([]);
  const [total, setTotal] = useState(0);

  const [filtros, setFiltros] = useState({
    id: "",
    nombre: "",
    apellido: "",
    modalidad: "",
    fecha: "",
  });

  const [pagina, setPagina] = useState(0);
  const [sort, setSort] = useState("fecha");
  const [order, setOrder] = useState("desc");

  const limit = 20;

  // -----------------------------
  // FUNCIÓN PARA CAMBIAR ORDEN
  // -----------------------------
  const toggleSort = (campo) => {
    if (sort === campo) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSort(campo);
      setOrder("asc");
    }
  };

  // -----------------------------
  // FETCH DINÁMICO (FILTROS + PAGINACIÓN + ORDEN)
  // -----------------------------
  useEffect(() => {
    const params = new URLSearchParams({
      ...filtros,
      sort,
      order,
      limit,
      offset: pagina * limit,
    });

    fetch(`http://192.168.5.21:8000/filtros/estudios?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setEstudios(data.items);
        setTotal(data.total);
      })
      .catch((err) => console.error("Error cargando estudios:", err));
  }, [filtros, pagina, sort, order]);

  // -----------------------------
  // ACCIONES (Enviar, Editar, Eliminar)
  // -----------------------------
  const handleEnviar = (estudio) => {
    console.log("Enviar estudio:", estudio);
  };

  const handleEditar = (estudio) => {
    console.log("Editar estudio:", estudio);
  };

  const handleEliminar = (estudio) => {
    console.log("Eliminar estudio:", estudio);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
return (
  <div className="estudios-container fade-in">

    <h1 className="estudios-title">Estudios</h1>

    {/* FILTROS */}
    <div className="glass-panel filtros-panel">
      <Filtros filtros={filtros} setFiltros={setFiltros} tipo="estudios" />
    </div>

    {/* TABLA */}
    <div className="glass-panel tabla-panel">
      <table className="tabla-estudios">
        <thead>
          <tr>
            <th onClick={() => toggleSort("paciente_id")}>ID Paciente</th>
            <th onClick={() => toggleSort("nombre")}>Nombre</th>
            <th onClick={() => toggleSort("apellido")}>Apellido</th>
            <th onClick={() => toggleSort("modality")}>Modalidad</th>
            <th onClick={() => toggleSort("fecha")}>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>

        <tbody>
          {estudios.length === 0 ? (
            <tr>
              <td colSpan="6" className="sin-datos-elegante">
                No hay estudios disponibles
              </td>
            </tr>
          ) : (
            estudios.map((e) => (
              <tr key={e.id}>
                <td>{e.paciente_id}</td>
                <td>{e.paciente_nombre}</td>
                <td>{e.paciente_apellido}</td>
                <td>{e.modality}</td>
                <td>{e.fecha}</td>
                <td className="acciones">
                  <button className="btn-accion enviar" onClick={() => handleEnviar(e)}>✉</button>
                  <button className="btn-accion editar" onClick={() => handleEditar(e)}>✎</button>
                  <button className="btn-accion eliminar" onClick={() => handleEliminar(e)}>🗑</button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>

    {/* PAGINACIÓN */}
    <div className="glass-panel paginacion-panel">
      <button disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
        ← Anterior
      </button>

      <span>Página {pagina + 1}</span>

      <button
        disabled={(pagina + 1) * limit >= total}
        onClick={() => setPagina(pagina + 1)}
      >
        Siguiente →
      </button>
    </div>

  </div>
);
}