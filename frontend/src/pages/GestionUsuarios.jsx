import React, { useState, useEffect } from 'react'; 
import axios from 'axios';
import './GestionUsuarios.css';

const PERMISOS_POR_DEFECTO = {
    superadmin: { atender_pacientes: true, reprocesar_dicom: true, notificar_critico: true, importar_medios: true, modificar_estudio: true, quemar_cd_dvd: true, subir_adjuntos: true, ver_worklist: true, escribir_informe: true, firma_electronica: true, solicitar_retoma: true, acceso_ia: true, validar_previo: true, exportar_key_images: true, consultar_historial: true, ver_pacientes: true, correccion_ortografica: true, envio_multicanal: true, gestionar_plantillas: true, escuchar_audio: true, crear_orden: true, validar_datos: true, gestionar_agenda: true, recaudo_pagos: true, entregar_resultados: true, estado_nodos_dicom: true, logs_sistema: true, configurar_aetitles: true, limpieza_cache: true, auditar_cuentas: true, ver_tarifas: true, liquidar_honorarios: true, generar_rips: true },
    admin: { atender_pacientes: true, reprocesar_dicom: true, ver_pacientes: true, crear_orden: true, gestionar_agenda: true, entregar_resultados: true, logs_sistema: true },
    tecnologo: { atender_pacientes: true, reprocesar_dicom: true, notificar_critico: true, importar_medios: true, modificar_estudio: true, quemar_cd_dvd: true, subir_adjuntos: true },
    radiologo: { ver_worklist: true, escribir_informe: true, firma_electronica: true, solicitar_retoma: true, acceso_ia: true, validar_previo: true, exportar_key_images: true, consultar_historial: true, ver_pacientes: true },
    medico: { ver_pacientes: true, consultar_historial: true, entregar_resultados: true, acceso_ia: true },
    transcriptor: { ver_pacientes: true, correccion_ortografica: true, envio_multicanal: true, gestionar_plantillas: true, escuchar_audio: true },
    recepcion: { crear_orden: true, validar_datos: true, gestionar_agenda: true, recaudo_pagos: true, entregar_resultados: true },
    it_biomedica: { estado_nodos_dicom: true, logs_sistema: true, configurar_aetitles: true, limpieza_cache: true }
};

const TODOS_LOS_PERMISOS = Array.from(new Set(Object.values(PERMISOS_POR_DEFECTO).flatMap(obj => Object.keys(obj))));

export default function GestionUsuarios() {
    const [userForm, setUserForm] = useState({ id: null, nombre: '', username: '', email: '', password: '', rol: '' });
    const [permisos, setPermisos] = useState({}); 
    const [usuarios, setUsuarios] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState({});
    const [verPassword, setVerPassword] = useState(false);

    useEffect(() => { fetchUsuarios(); }, []);

    const fetchUsuarios = async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/usuarios/');
            setUsuarios(res.data || []);
        } catch (err) { console.error("Error al cargar usuarios:", err); }
    };

    const cambiarRol = (nuevoRol) => {
        if (!nuevoRol) {
            setUserForm(prev => ({ ...prev, rol: '' }));
            setPermisos({});
            return;
        }
        setUserForm(prev => ({ ...prev, rol: nuevoRol }));
        setPermisos({ ...PERMISOS_POR_DEFECTO[nuevoRol] });
    };

    const seleccionarParaEditar = (u) => {
        setUserForm({ id: u.id, nombre: u.nombre, username: u.username, email: u.email || '', password: '', rol: u.rol });
        setPermisos(u.permisos || {});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleGuardar = async () => {
        if (!userForm.rol) return alert("⚠️ Debe seleccionar un Rol Institucional.");
        if (!userForm.username || !userForm.nombre) return alert("⚠️ Nombre y Username son obligatorios");

        try {
            const permisosLimpios = {};
            Object.keys(permisos).forEach(key => {
                if (permisos[key] === true) permisosLimpios[key] = true;
            });
            const payload = { ...userForm, permisos: permisosLimpios };

            if (userForm.id) {
                await axios.put(`http://localhost:8000/api/usuarios/${userForm.id}`, payload);
                alert("✅ Usuario actualizado correctamente");
            } else {
                await axios.post('http://localhost:8000/api/usuarios/crear-perfil', payload);
                alert("✅ Colaborador creado con éxito");
            }
            setUserForm({ id: null, nombre: '', username: '', email: '', password: '', rol: '' });
            setPermisos({});
            setVerPassword(false);
            fetchUsuarios();
        } catch (err) { alert("❌ Error al procesar la solicitud."); }
    };

    // ✅ FUNCIÓN CORREGIDA PARA ACTIVAR Y BLOQUEAR
    const handleCambiarEstado = async (nuevoEstado) => {
        const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
        if (ids.length === 0) return alert("Seleccione usuarios en la tabla");
        const accion = nuevoEstado ? "ACTIVAR" : "BLOQUEAR";
        try {
            for (let id of ids) {
                await axios.patch(`http://localhost:8000/api/usuarios/${id}/estado?activo=${nuevoEstado}`);
            }
            alert(`✅ Usuarios actualizados: ${accion}`);
            setSelectedUsers({});
            fetchUsuarios();
        } catch (err) { alert(`Error al intentar ${accion}.`); }
    };

    const handleEliminar = async () => {
        const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
        if (ids.length === 0) return alert("Seleccione usuarios");
        if (window.confirm(`⚠️ ¿Eliminar permanentemente a ${ids.length} usuarios?`)) {
            try {
                for (let id of ids) { await axios.delete(`http://localhost:8000/api/usuarios/${id}`); }
                alert("🗑️ Usuarios eliminados");
                setUserForm({ id: null, nombre: '', username: '', email: '', password: '', rol: '' });
                setPermisos({}); 
                setSelectedUsers({}); 
                setVerPassword(false);
                fetchUsuarios(); 
            } catch (err) { alert("Error al eliminar."); }
        }
    };

    return (
        <div className="gestion-usuarios-wrapper">
            <header className="gestion-header">
                <h1 style={{color: '#fbbf24', margin: 0, fontSize: '1.5rem', fontWeight: 'bold'}}>🛠️ CONSOLA DE MANDO MI_PACS</h1>
                <p style={{color: '#aaa', fontSize: '0.85rem'}}>Gestión de Seguridad y Colaboradores</p>
            </header>

            <main className="gestion-main">
                <section className="gestion-card-registro">
                    <div className="form-grid-maestro">
                        <div className="field-group"><label>NOMBRE COMPLETO</label><input value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} /></div>
                        <div className="field-group"><label>USERNAME</label><input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /></div>
                        <div className="field-group"><label>EMAIL INST.</label><input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                        
                        <div className="field-group">
                            <label>NUEVA PASSWORD {userForm.id && "(OPCIONAL)"}</label>
                            <div style={{ display: 'flex', position: 'relative' }}>
                                <input type={verPassword ? "text" : "password"} value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{ flex: 1, paddingRight: '45px' }} />
                                <button type="button" onClick={() => setVerPassword(!verPassword)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#fbbf24', cursor: 'pointer' }}>
                                    {verPassword ? "👁️‍🗨️" : "👁️"}
                                </button>
                            </div>
                        </div>

                        <div className="field-group">
                            <label>ROL INSTITUCIONAL</label>
                            <select value={userForm.rol} onChange={e => cambiarRol(e.target.value)} style={{ border: !userForm.rol ? '2px solid #ef4444' : '1px solid #444' }}>
                                <option value="">-- SELECCIONE ROL --</option>
                                {Object.keys(PERMISOS_POR_DEFECTO).map(r => (
                                    <option key={r} value={r}>{r.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {userForm.rol && (
                        <>
                            <h3 style={{color: '#fbbf24', margin: '20px 0 10px 0', fontSize: '0.9rem'}}>MATRIZ PARA: {userForm.rol.toUpperCase()}</h3>
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
                            {userForm.id ? "💾 GUARDAR CAMBIOS" : "👤 CREAR USUARIO"}
                        </button>
                        
                        {/* ✅ BOTONES DE ESTADO ACTUALIZADOS */}
                        <button className="btn-maestro" style={{ background: '#10b981' }} onClick={() => handleCambiarEstado(true)}>🔓 ACTIVAR</button>
                        <button className="btn-maestro btn-bloquear" onClick={() => handleCambiarEstado(false)}>🔒 BLOQUEAR</button>
                        
                        <button className="btn-maestro btn-eliminar" onClick={handleEliminar}>🗑️ ELIMINAR</button>
                    </div>
                </section>

                <section className="gestion-card-tabla">
                    <h3 style={{color: '#fbbf24', margin: '0 0 15px 0', fontSize: '1.1rem', fontWeight: 'bold'}}>👥 COLABORADORES ACTIVOS EN SISTEMA</h3>
                    <div className="tabla-scroll-area">
                        <table className="tabla-usuarios">
                            <thead>
                                <tr>
                                    <th>SEL.</th>
                                    <th>COLABORADOR</th>
                                    <th>ACCESO</th>
                                    <th>ROL</th>
                                    <th>ESTADO</th>
                                    <th>ACCIÓN</th>
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map(u => (
                                    <tr key={u.id}>
                                        <td><input type="checkbox" checked={!!selectedUsers[u.id]} onChange={() => setSelectedUsers(prev => ({...prev, [u.id]: !prev[u.id]}))} /></td>
                                        <td style={{ color: '#ffffff' }}><strong>{u.nombre}</strong></td>
                                        <td style={{ color: '#ffffff', fontSize: '0.85rem' }}>{u.username}</td>
                                        <td><span className="rol-badge" style={{ background: '#333', color: '#fbbf24', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>{u.rol.toUpperCase()}</span></td>
                                        <td><span style={{color: u.is_active ? '#10b981' : '#ef4444', fontWeight: 'bold'}}>{u.is_active ? '● OPERATIVO' : '○ BLOQUEADO'}</span></td>
                                        <td><button className="btn-editar-mini" style={{ background: '#ffffff', color: '#000000', fontWeight: 'bold', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => seleccionarParaEditar(u)}>EDITAR</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}