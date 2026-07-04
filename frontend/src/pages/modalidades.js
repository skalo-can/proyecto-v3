// Lista estática de modalidades soportadas por el sistema PACS
export const modalitiesLista = [
  "CT - Tomografía", "MR - Resonancia", "US - Ecografía", 
  "RX - Rayos X", "MG - Mamografía", "CR - Radiología Digital",
  "DXA - Densitometría", "PET - Medicina Nuclear"
];

// Diccionario de diferenciación visual para Modalidades Médicas
export const obtenerEstiloModalidad = (modalidad) => {
  const mod = modalidad?.toUpperCase().substring(0, 2) || "CR"; 
  
  switch (mod) {
    case "CT": return { bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }; 
    case "MR": return { bg: "rgba(168, 85, 247, 0.15)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.3)" }; 
    case "US": return { bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)" }; 
    case "RX": return { bg: "rgba(249, 115, 22, 0.15)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" }; 
    case "CR": return { bg: "rgba(251, 191, 36, 0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }; 
    case "MG": return { bg: "rgba(236, 72, 153, 0.15)", color: "#ec4899", border: "1px solid rgba(236,72,153,0.3)" }; 
    default:   return { bg: "rgba(100, 116, 139, 0.15)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" }; 
  }
};