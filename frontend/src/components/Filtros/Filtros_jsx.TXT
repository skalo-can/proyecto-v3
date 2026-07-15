import React from "react";
import "./Filtros.css";

export default function Filtros({ filtros, setFiltros, tipo }) {

  const handleChange = (e) => {
    setFiltros({
      ...filtros,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="filtros-container glass-box fade-in">

      {/* Filtros comunes */}
      <input
        type="text"
        name="id"
        placeholder="ID"
        value={filtros.id}
        onChange={handleChange}
      />

      <input
        type="text"
        name="nombre"
        placeholder="Nombre"
        value={filtros.nombre}
        onChange={handleChange}
      />

      <input
        type="text"
        name="apellido"
        placeholder="Apellido"
        value={filtros.apellido}
        onChange={handleChange}
      />

      {/* Modalidad solo si es estudios */}
      {tipo === "estudios" && (
        <select name="modalidad" value={filtros.modalidad} onChange={handleChange}>
          <option value="">Modalidad</option>
          <option value="CT">CT</option>
          <option value="MR">MR</option>
          <option value="CR">CR</option>
          <option value="US">US</option>
        </select>
      )}

      {/* Filtros rápidos */}
      <select name="fecha" value={filtros.fecha} onChange={handleChange}>
        <option value="">Fecha</option>
        <option value="hoy">Hoy</option>
        <option value="ayer">Ayer</option>
        <option value="7">Últimos 7 días</option>
        <option value="30">Últimos 30 días</option>
        <option value="todos">Todos</option>
      </select>

    </div>
  );
}