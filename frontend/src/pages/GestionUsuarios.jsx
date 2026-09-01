import React, { useState, useEffect } from 'react'; 
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import './GestionUsuarios.css';

// =========================================================
// NUEVA MATRIZ DE PERMISOS DEFINITIVA MI_PACS
// =========================================================
const PERMISOS_POR_DEFECTO = {
    superadmin: { 
        ver_lista_pacientes: true, desbloquear_pacientes: true, editar_datos_pacientes: true, 
        grabar_dictado: true, transcribir: true, escuchar_dictado: true, verificar_informe: true, 
        firmar_informe: true, ver_pdf: true, ver_documentos_adjuntos: true, entregar_resultados: true, 
        importar_archivos: true, exportar_archivos: true, gestion_usuarios: true, modificar_usuarios: true, 
        activar_desactivar_usuarios: true, recepcion_ris: true, ver_estadisticas: true, 
        configuracion_mipacs: true, ciclo_vida_backups: true, configurar_tags_dicom: true, 
        reporte_cobro_glosas: true, auditoria_sistema: true, logs_email: true, logs_whatsapp: true, 
        resetear_sistema: true, panel_productividad: true, ver_visor_dicom: true, gestionar_plantillas: true, 
        generar_enlaces_seguros: true, acceso_ia: true 
    },
    admin: { 
        ver_lista_pacientes: true, editar_datos_pacientes: true, ver_pdf: true, entregar_resultados: true, 
        gestion_usuarios: true, modificar_usuarios: true, activar_desactivar_usuarios: true, 
        recepcion_ris: true, ver_estadisticas: true, reporte_cobro_glosas: true, auditoria_sistema: true, 
        panel_productividad: true, generar_enlaces_seguros: true 
    },
    tecnologo: { 
        ver_lista_pacientes: true, editar_datos_pacientes: true, ver_documentos_adjuntos: true, 
        importar_archivos: true, exportar_archivos: true, recepcion_ris: true, configurar_tags_dicom: true, 
        ver_visor_dicom: true 
    },
    radiologo: { 
        ver_lista_pacientes: true, grabar_dictado: true, escuchar_dictado: true, verificar_informe: true, 
        firmar_informe: true, ver_pdf: true, ver_documentos_adjuntos: true, ver_visor_dicom: true, 
        gestionar_plantillas: true, acceso_ia: true 
    },
    medico: { 
        ver_lista_pacientes: true, ver_pdf: true, entregar_resultados: true, ver_visor_dicom: true 
    },
    transcriptor: { 
        ver_lista_pacientes: true, transcribir: true, escuchar_dictado: true, ver_documentos_adjuntos: true, 
        gestionar_plantillas: true 
    },
    recepcion: { 
        ver_lista_pacientes: true, editar_datos_pacientes: true, entregar_resultados: true, 
        recepcion_ris: true, reporte_cobro_glosas: true, generar_enlaces_seguros: true 
    },
    it_biomedica: { 
        configuracion_mipacs: true, ciclo_vida_backups: true, configurar_tags_dicom: true, 
        auditoria_sistema: true, logs_email: true, logs_whatsapp: true, resetear_sistema: true 
    },
    auxiliar: { 
        ver_lista_pacientes: true, entregar_resultados: true, ver_pdf: true, generar_enlaces_seguros: true 
    },
    invitado: { 
        ver_lista_pacientes: true, ver_pdf: true 
    },
    paciente: { 
        ver_pdf: true, entregar_resultados: true 
    } 
};

// Generamos la lista de todos los permisos únicos para la matriz
const TODOS_LOS_PERMISOS = Array.from(new Set(Object.values(PERMISOS_POR_DEFECTO).flatMap(obj => Object.keys(obj))));

export default function GestionUsuarios() {
    const { t } = useTranslation();
    
    // 🚀 ESTADO ACTUALIZADO: Incluye registro_medico y es_urgenciologo
    const estadoInicial = { id: null, nombre: '', username: '', email: '', password: '', rol: '', registro_medico: '', es_urgenciologo: false };
    const [userForm, setUserForm] = useState(estadoInicial);
    const [permisos, setPermisos] = useState({}); 
    const [usuarios, setUsuarios] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState({});
    const [verPassword, setVerPassword] = useState(false);

    // ✨ NUEVO ESTADO PARA EFECTO VISUAL DE TABLA
    const [hoveredRow, setHoveredRow] = useState(null);

    useEffect(() => { fetchUsuarios(); }, []);

    const fetchUsuarios = async () => {
        try {
            // ✅ CÓDIGO CORREGIDO 1/4
            const res = await axios.get(`${window.API_URL}/api/usuarios/`);
            setUsuarios(res.data || []);
        } catch (err) { console.error("Error al cargar usuarios:", err); }
    };

    const cambiarRol = (nuevoRol) => {
        if (!nuevoRol) {
            setUserForm(prev => ({ ...prev, rol: '', es_urgenciologo: false }));
            setPermisos({});
            return;
        }
        
        // Si cambian a un rol no médico, apagamos el flag de urgenciologo por seguridad
        const esRolMedico = nuevoRol === 'medico' || nuevoRol === 'radiologo';
        setUserForm(prev => ({ ...prev, rol: nuevoRol, es_urgenciologo: esRolMedico ? prev.es_urgenciologo : false }));
        
        // Aquí cargamos los permisos automáticos según el rol elegido
        setPermisos({ ...PERMISOS_POR_DEFECTO[nuevoRol] });
    };

    const seleccionarParaEditar = (u) => {
        // 🚀 RECUPERACIÓN ACTUALIZADA: Carga el registro médico y el poder de urgenciologo al editar
        setUserForm({ 
            id: u.id, 
            nombre: u.nombre, 
            username: u.username, 
            email: u.email || '', 
            password: '', 
            rol: u.rol, 
            registro_medico: u.registro_medico || '',
            es_urgenciologo: u.es_urgenciologo || false
        });
        setPermisos(u.permisos || {});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleGuardar = async () => {
        if (!userForm.rol) return alert(t('gestion_usuarios.alerta_rol'));
        if (!userForm.username || !userForm.nombre) return alert(t('gestion_usuarios.alerta_obligatorios'));

        try {
            const permisosLimpios = {};
            Object.keys(permisos).forEach(key => {
                if (permisos[key] === true) permisosLimpios[key] = true;
            });
            // El payload ya incluye automáticamente es_urgenciologo desde userForm
            const payload = { ...userForm, permisos: permisosLimpios };

            if (userForm.id) {
                // ✅ CÓDIGO CORREGIDO 2/4
                await axios.put(`${window.API_URL}/api/usuarios/${userForm.id}`, payload);
                alert(t('gestion_usuarios.alerta_actualizado'));
            } else {
                // ✅ CÓDIGO CORREGIDO 3/4
                await axios.post(`${window.API_URL}/api/usuarios/crear-perfil`, payload);
                alert(t('gestion_usuarios.alerta_creado'));
            }
            setUserForm(estadoInicial);
            setPermisos({});
            setVerPassword(false);
            fetchUsuarios();
        } catch (err) { alert(t('gestion_usuarios.alerta_error_solicitud')); }
    };

    const handleCambiarEstado = async (nuevoEstado) => {
            const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
            if (ids.length === 0) return alert(t('gestion_usuarios.alerta_seleccione_tabla'));
            const accion = nuevoEstado ? "ACTIVAR" : "BLOQUEAR";
            try {
                for (let id of ids) {
                    // 🔥 SOLUCIÓN: Usamos axios.put en lugar de patch para evitar el bloqueo del CORS
                    // ✅ CÓDIGO CORREGIDO 4/4
                    await axios.put(`${window.API_URL}/api/usuarios/${id}/estado?activo=${nuevoEstado}`);
                }
                alert(`${t('gestion_usuarios.alerta_usuarios_actualizados')}${accion}`);
                setSelectedUsers({});
                fetchUsuarios();
            } catch (err) { alert(`${t('gestion_usuarios.alerta_error_intentar')}${accion}.`); }
        };

    const handleEliminar = async () => {
        const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
        if (ids.length === 0) return alert(t('gestion_usuarios.alerta_seleccione_usuarios'));
        if (window.confirm(`${t('gestion_usuarios.alerta_eliminar_permanente')}${ids.length}${t('gestion_usuarios.alerta_usuarios')}`)) {
            try {
                for (let id of ids) { 
                    // ✅ CÓDIGO CORREGIDO 5/4 (Bonus track en la eliminación)
                    await axios.delete(`${window.API_URL}/api/usuarios/${id}`); 
                }
                alert(t('gestion_usuarios.alerta_eliminados'));
                setUserForm(estadoInicial);
                setPermisos({}); 
                setSelectedUsers({}); 
                setVerPassword(false);
                fetchUsuarios(); 
            } catch (err) { alert(t('gestion_usuarios.alerta_error_eliminar')); }
        }
    };

    return (
        <div className="gestion-usuarios-wrapper">
            <header className="gestion-header">
                <h1 style={{color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold'}}>{t('gestion_usuarios.titulo')}</h1>
                <p style={{color: '#aaa', fontSize: '0.85rem'}}>{t('gestion_usuarios.subtitulo')}</p>
            </header>

            <main className="gestion-main">
                <section className="gestion-card-registro">
                    <div className="form-grid-maestro">
                        <div className="field-group"><label>{t('gestion_usuarios.nombre_completo')}</label><input value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} /></div>
                        <div className="field-group"><label>{t('gestion_usuarios.username')}</label><input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /></div>
                        <div className="field-group"><label>{t('gestion_usuarios.email_inst')}</label><input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                        
                        <div className="field-group">
                            <label>{t('gestion_usuarios.registro_medico')}</label>
                            <input 
                                placeholder={t('gestion_usuarios.placeholder_rm')} 
                                value={userForm.registro_medico} 
                                onChange={e => setUserForm({...userForm, registro_medico: e.target.value})} 
                            />
                        </div>
                        
                        <div className="field-group">
                            <label>{t('gestion_usuarios.nueva_password')} {userForm.id && t('gestion_usuarios.opcional')}</label>
                            <div style={{ display: 'flex', position: 'relative' }}>
                                <input type={verPassword ? "text" : "password"} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{ flex: 1, paddingRight: '45px' }} />
                                <button type="button" onClick={() => setVerPassword(!verPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer' }}>
                                    {verPassword ? "👁️‍🗨️" : "👁️"}
                                </button>
                            </div>
                        </div>

                        <div className="field-group">
                            <label>{t('gestion_usuarios.rol_institucional')}</label>
                            <select value={userForm.rol} onChange={e => cambiarRol(e.target.value)} style={{ border: !userForm.rol ? '2px solid #ef4444' : '1px solid #444' }}>
                                <option value="">{t('gestion_usuarios.seleccione_rol')}</option>
                                {Object.keys(PERMISOS_POR_DEFECTO).map(r => (
                                    <option key={r} value={r}>{r.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        {/* 🔥 NUEVO: CASILLA DE URGENCIÓLOGO (Solo visible para médicos y radiólogos) */}
                        {(userForm.rol === 'medico' || userForm.rol === 'radiologo') && (
                            <div className="field-group" style={{ gridColumn: '1 / -1', backgroundColor: 'rgba(249, 115, 22, 0.1)', padding: '15px', borderRadius: '6px', border: '1px solid rgba(249, 115, 22, 0.4)', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                                <input 
                                    type="checkbox" 
                                    id="check-urgencias"
                                    checked={userForm.es_urgenciologo}
                                    onChange={e => setUserForm({...userForm, es_urgenciologo: e.target.checked})}
                                    style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#f97316' }}
                                />
                                <label htmlFor="check-urgencias" style={{ margin: 0, color: '#f97316', fontSize: '1rem', cursor: 'pointer', fontWeight: 'bold' }}>
                                    {t('gestion_usuarios.permisos_urgenciologo')}
                                </label>
                            </div>
                        )}
                    </div>

                    {userForm.rol && (
                        <>
                            <h3 style={{color: '#fbbf24', margin: '20px 0 10px 0', fontSize: '0.9rem'}}>{t('gestion_usuarios.matriz_permisos')} {userForm.rol.toUpperCase()}</h3>
                            <div className="permisos-container-master">
                                {TODOS_LOS_PERMISOS.map(key => (
                                    <label key={key} className="permiso-label" style={{ color: '#fff' }}>
                                        <input type="checkbox" checked={!!permisos[key]} onChange={() => setPermisos({...permisos, [key]: !permisos[key]})} />
                                        {key.replace(/_/g, ' ').toUpperCase()}
                                    </label>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="botones-accion-container">
                        <button className="btn-maestro btn-crear" onClick={handleGuardar} style={{ opacity: !userForm.rol ? 0.6 : 1 }}>
                            {userForm.id ? t('gestion_usuarios.btn_guardar_cambios') : t('gestion_usuarios.btn_crear_usuario')}
                        </button>
                        <button className="btn-maestro" style={{ background: '#10b981' }} onClick={() => handleCambiarEstado(true)}>{t('gestion_usuarios.btn_activar')}</button>
                        <button className="btn-maestro btn-bloquear" onClick={() => handleCambiarEstado(false)}>{t('gestion_usuarios.btn_bloquear')}</button>
                        <button className="btn-maestro btn-eliminar" onClick={handleEliminar}>{t('gestion_usuarios.btn_eliminar')}</button>
                    </div>
                </section>

                <section className="gestion-card-tabla">
                    <h3 style={{color: '#fbbf24', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 'bold'}}>{t('gestion_usuarios.colaboradores_activos')}</h3>
                    <div className="tabla-scroll-area">
                        <table className="tabla-usuarios">
                            <thead>
                                <tr>
                                    <th>{t('gestion_usuarios.th_sel')}</th>
                                    <th>{t('gestion_usuarios.th_colaborador')}</th>
                                    <th>{t('gestion_usuarios.th_acceso')}</th>
                                    <th>{t('gestion_usuarios.th_rol')}</th>
                                    <th>{t('gestion_usuarios.th_estado')}</th>
                                    <th>{t('gestion_usuarios.th_accion')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => {
                                    const isSelected = !!selectedUsers[u.id];
                                    const isHovered = hoveredRow === u.id;

                                    return (
                                        <tr 
                                            key={u.id}
                                            onMouseEnter={() => setHoveredRow(u.id)}
                                            onMouseLeave={() => setHoveredRow(null)}
                                            // 🔥 CORRECCIÓN: Selección única. Si ya está seleccionado lo limpia, si no, lo selecciona a él solo.
                                            onClick={() => setSelectedUsers(prev => prev[u.id] ? {} : { [u.id]: true })}
                                            style={{
                                                backgroundColor: isSelected ? 'rgba(251, 191, 36, 0.15)' : (isHovered ? '#1e293b' : 'transparent'),
                                                borderLeft: isSelected ? '4px solid #fbbf24' : '4px solid transparent',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease-in-out'
                                            }}
                                        >
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected} 
                                                    // 🔥 CORRECCIÓN: Mismo comportamiento para el checkbox directo
                                                    onChange={() => setSelectedUsers(prev => prev[u.id] ? {} : { [u.id]: true })} 
                                                />
                                            </td>
                                            <td style={{ color: '#ffffff' }}><strong>{u.nombre}</strong></td>
                                            <td style={{ color: '#ffffff', fontSize: '0.85rem' }}>{u.username}</td>
                                            <td>
                                                <span className="rol-badge" style={{ background: '#333', color: '#fbbf24', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                    {u.rol.toUpperCase()}
                                                    {u.es_urgenciologo && <span title={t('gestion_usuarios.title_urgencias_activas')} style={{marginLeft: '6px', fontSize: '14px'}}>🚨</span>}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{
                                                    color: u.bloqueado ? '#f97316' : (u.is_active ? '#10b981' : '#ef4444'), 
                                                    fontWeight: 'bold',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    {u.bloqueado ? t('gestion_usuarios.estado_bloqueo') : (u.is_active ? t('gestion_usuarios.estado_operativo') : t('gestion_usuarios.estado_inactivo'))}
                                                </span>
                                            </td>
                                            <td onClick={(e) => e.stopPropagation()}>
                                                <button className="btn-editar-mini" style={{ background: '#ffffff', color: '#000000', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => seleccionarParaEditar(u)}>{t('gestion_usuarios.btn_editar')}</button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}