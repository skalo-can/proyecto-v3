import React, { useEffect, useState } from "react";
import Filtros from "../components/Filtros/Filtros";
import "./Pacientes.css";

export default function Pacientes() {

  // -----------------------------
  // ESTADOS
  // -----------------------------
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

    fetch(`http://localhost:8000/filtros/pacientes?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setPacientes(data.items);
        setTotal(data.total);
      })
      .catch((err) => console.error("Error cargando pacientes:", err));
  }, [filtros, pagina, sort, order]);

  // -----------------------------
  // ACCIONES (Enviar, Editar, Eliminar)
  // -----------------------------
  const handleEnviar = (paciente) => {
    console.log("Enviar paciente:", paciente);
  };

  const handleEditar = (paciente) => {
    console.log("Editar paciente:", paciente);
  };

  const handleEliminar = (paciente) => {
    console.log("Eliminar paciente:", paciente);
  };

  // -----------------------------
  // RENDER
  // -----------------------------
  return (
    <div className="pacientes-page fade-in">

      <h2 className="titulo-pagina">Pacientes</h2>

      {/* FILTROS */}
      <Filtros filtros={filtros} setFiltros={setFiltros} tipo="pacientes" />

      {/* TABLA */}
      <div className="tabla-container glass-box">
        <table className="tabla-pacientes">
          <thead>
            <tr>
              <th onClick={() => toggleSort("id")}>ID</th>
              <th onClick={() => toggleSort("nombre")}>Nombre</th>
              <th onClick={() => toggleSort("apellido")}>Apellido</th>
              <th onClick={() => toggleSort("fecha_registro")}>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {pacientes.length === 0 ? (
              <tr>
                <td colSpan="5" className="sin-datos">Sin datos</td>
              </tr>
            ) : (
              pacientes.map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.nombre}</td>
                  <td>{p.apellido}</td>
                  <td>{p.fecha_registro}</td>
                  <td className="acciones">
                    <button className="btn-accion enviar" onClick={() => handleEnviar(p)}>✉</button>
                    <button className="btn-accion editar" onClick={() => handleEditar(p)}>✎</button>
                    <button className="btn-accion eliminar" onClick={() => handleEliminar(p)}>🗑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINACIÓN */}
      <div className="paginacion glass-box">
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