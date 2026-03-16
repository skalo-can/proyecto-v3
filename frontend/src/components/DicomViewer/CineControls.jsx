/**
 * CineControls.jsx — MI_PACS (v3 estable)
 * ---------------------------------------------------------
 * Control CINE compatible con Cornerstone3D v3.
 * - No rompe reglas de hooks
 * - No deja pantalla blanca
 * - Funciona con stack v3
 */

import React, { useState, useEffect } from "react";

export default function CineControls({ viewport, stack }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(150); // ms por frame

  // ---------------------------------------------------------
  // Limpieza clínica al desmontar
  // ---------------------------------------------------------
  useEffect(() => {
    return () => {
      try {
        if (viewport?._cineInterval) {
          clearInterval(viewport._cineInterval);
        }
      } catch (err) {
        console.warn("MI_PACS → Error limpiando intervalo CINE:", err);
      }
    };
  }, [viewport]);

  // ---------------------------------------------------------
  // Si no hay viewport o stack, NO renderizamos controles,
  // pero los hooks ya se ejecutaron correctamente.
  // ---------------------------------------------------------
  if (!viewport || !stack) {
    return (
      <div style={{ marginTop: "10px", color: "#777" }}>
        Cargando controles CINE…
      </div>
    );
  }

  // ---------------------------------------------------------
  // Reproducir CINE
  // ---------------------------------------------------------
  const play = () => {
    if (isPlaying) return;

    setIsPlaying(true);

    try {
      const interval = setInterval(async () => {
        try {
          const nextIndex =
            (stack.currentImageIdIndex + 1) % stack.imageIds.length;

          const nuevoStack = {
            ...stack,
            currentImageIdIndex: nextIndex,
          };

          await viewport.setStack(nuevoStack);
          await viewport.render();
        } catch (err) {
          console.error("MI_PACS → Error durante reproducción CINE:", err);
          clearInterval(interval);
        }
      }, speed);

      viewport._cineInterval = interval;
      console.log("MI_PACS → CINE iniciado.");
    } catch (err) {
      console.error("MI_PACS → Error al iniciar CINE:", err);
    }
  };

  // ---------------------------------------------------------
  // Pausar CINE
  // ---------------------------------------------------------
  const stop = () => {
    setIsPlaying(false);

    try {
      if (viewport._cineInterval) {
        clearInterval(viewport._cineInterval);
        viewport._cineInterval = null;
      }
      console.log("MI_PACS → CINE pausado.");
    } catch (err) {
      console.error("MI_PACS → Error al pausar CINE:", err);
    }
  };

  // ---------------------------------------------------------
  // Navegación manual
  // ---------------------------------------------------------
  const next = async () => {
    try {
      const nextIndex =
        (stack.currentImageIdIndex + 1) % stack.imageIds.length;

      const nuevoStack = {
        ...stack,
        currentImageIdIndex: nextIndex,
      };

      await viewport.setStack(nuevoStack);
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error avanzando corte:", err);
    }
  };

  const prev = async () => {
    try {
      const prevIndex =
        (stack.currentImageIdIndex - 1 + stack.imageIds.length) %
        stack.imageIds.length;

      const nuevoStack = {
        ...stack,
        currentImageIdIndex: prevIndex,
      };

      await viewport.setStack(nuevoStack);
      await viewport.render();
    } catch (err) {
      console.error("MI_PACS → Error retrocediendo corte:", err);
    }
  };

  // ---------------------------------------------------------
  // Render clínico
  // ---------------------------------------------------------
  return (
    <div
      style={{
        marginTop: "10px",
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      <button onClick={prev}>◀ Corte anterior</button>
      <button onClick={next}>Corte siguiente ▶</button>

      {!isPlaying ? (
        <button onClick={play}>▶ Reproducir</button>
      ) : (
        <button onClick={stop}>⏸ Pausar</button>
      )}

      <label style={{ marginLeft: "10px" }}>
        Velocidad:
        <input
          type="range"
          min="50"
          max="500"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ marginLeft: "6px" }}
        />
        {speed} ms
      </label>
    </div>
  );
}