// dicomDictionary.js
export const fullDicomDictionary = [
  // --- IDENTIFICACIÓN DEL PACIENTE (0010,xxxx) ---
  { value: 'PatientName', label: '(0010,0010) PatientName - Nombre del Paciente', code: '0010,0010' },
  { value: 'PatientID', label: '(0010,0020) PatientID - ID del Paciente', code: '0010,0020' },
  { value: 'PatientBirthDate', label: '(0010,0030) PatientBirthDate - Fecha de Nacimiento', code: '0010,0030' },
  { value: 'PatientSex', label: '(0010,0040) PatientSex - Sexo', code: '0010,0040' },
  { value: 'PatientBirthTime', label: '(0010,0032) PatientBirthTime - Hora de Nacimiento', code: '0010,0032' },
  { value: 'PatientWeight', label: '(0010,1030) PatientWeight - Peso (kg)', code: '0010,1030' },
  { value: 'PatientSize', label: '(0010,1022) PatientSize - Talla (m)', code: '0010,1022' },
  { value: 'PatientAddress', label: '(0010,1040) PatientAddress - Dirección', code: '0010,1040' },
  { value: 'PatientComments', label: '(0010,4000) PatientComments - Observaciones', code: '0010,4000' },
  { value: 'MedicalAlerts', label: '(0010,2000) MedicalAlerts - Alergias / Alertas', code: '0010,2000' },
  { value: 'EthnicGroup', label: '(0010,2160) EthnicGroup - Grupo Étnico', code: '0010,2160' },

  // --- INFORMACIÓN DEL ESTUDIO / VISITA (0008,xxxx) ---
  { value: 'InstitutionName', label: '(0008,0080) InstitutionName - Nombre Institución', code: '0008,0080' },
  { value: 'ReferringPhysicianName', label: '(0008,0090) ReferringPhysicianName - Médico Referente', code: '0008,0090' },
  { value: 'AdmittingDiagnosesDescription', label: '(0008,1080) AdmittingDiagnosesDescription - Diagnóstico de Admisión', code: '0008,1080' },
  { value: 'StudyDescription', label: '(0008,1030) StudyDescription - Descripción del Estudio', code: '0008,1030' },
  { value: 'InstitutionalDepartmentName', label: '(0008,1040) InstitutionalDepartmentName - Departamento', code: '0008,1040' },

  // --- PROCEDIMIENTO SOLICITADO (0032,xxxx / 0040,xxxx) ---
  { value: 'RequestedProcedureDescription', label: '(0032,1060) RequestedProcedureDescription - Procedimiento Solicitado', code: '0032,1060' },
  { value: 'RequestedProcedureID', label: '(0040,1001) RequestedProcedureID - ID Procedimiento', code: '0040,1001' },
  { value: 'ReasonForTheRequestedProcedure', label: '(0040,1002) ReasonForTheRequestedProcedure - Motivo del Estudio', code: '0040,1002' },
  { value: 'RequestingPhysician', label: '(0032,1032) RequestingPhysician - Médico Solicitante', code: '0032,1032' },
  { value: 'RequestedProcedurePriority', label: '(0040,1003) RequestedProcedurePriority - Prioridad DICOM', code: '0040,1003' },
  { value: 'AdmissionID', label: '(0038,0010) AdmissionID - Número de Admisión', code: '0038,0010' },
  { value: 'ScheduledStationAETitle', label: '(0040,0001) ScheduledStationAETitle - Estación Destino', code: '0040,0001' },
];