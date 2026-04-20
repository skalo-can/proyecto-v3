import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GestionUsuarios.css';

// 1. DEFINICIÓN MAESTRA DE ROLES Y PERMISOS (PERMANECE IGUAL)
const PERMISOS_POR_DEFECTO = {
    superadmin: { atender_pacientes: true, reprocesar_dicom: true, notificar_critico: true, importar_medios: true, modificar_estudio: true, quemar_cd_dvd: true, subir_adjuntos: true, ver_worklist: true, escribir_informe: true, firma_electronica: true, solicitar_retoma: true, acceso_ia: true, validar_previo: true, exportar_key_images: true, consultar_historial: true, ver_pacientes: true, correccion_ortografica: true, envio_multicanal: true, gestionar_plantillas: true, escuchar_audio: true, crear_orden: true, validar_datos: true, gestionar_agenda: true, recaudo_pagos: true, entregar_resultados: true, estado_nodos_dicom: true, logs_sistema: true, configurar_aetitles: true, limpieza_cache: true, auditar_cuentas: true, ver_tarifas: true, liquidar_honorarios: true, generar_rips: true },
    admin: { atender_pacientes: true, reprocesar_dicom: true, ver_pacientes: true, crear_orden: true, gestionar_agenda: true, entregar_resultados: true, logs_sistema: true },
    tecnologo: { atender_pacientes: true, reprocesar_dicom: true, notificar_critico: true, importar_medios: true, modificar_estudio: true, quemar_cd_dvd: true, subir_adjuntos: true },
    radiologo: { ver_worklist: true, escribir_informe: true, firma_electronica: true, solicitar_retoma: true, acceso_ia: true, validar_previo: true, exportar_key_images: true, consultar_historial: true },
    transcriptor: { ver_pacientes: true, correccion_ortografica: true, envio_multicanal: true, gestionar_plantillas: true, escuchar_audio: true },
    recepcion: { crear_orden: true, validar_datos: true, gestionar_agenda: true, recaudo_pagos: true, entregar_resultados: true },
    it_biomedica: { estado_nodos_dicom: true, logs_sistema: true, configurar_aetitles: true, limpieza_cache: true }
};

const TODOS_LOS_PERMISOS = Array.from(new Set(Object.values(PERMISOS_POR_DEFECTO).flatMap(obj => Object.keys(obj))));

export default function GestionUsuarios() {
    const [userForm, setUserForm] = useState({ id: null, nombre: '', username: '', email: '', password: '', rol: 'tecnologo' });
    const [permisos, setPermisos] = useState(PERMISOS_POR_DEFECTO.tecnologo);
    const [usuarios, setUsuarios] = useState([]);
    const [selectedUsers, setSelectedUsers] = useState({});
    
    // --- NUEVO ESTADO PARA VER PASSWORD ---
    const [verPassword, setVerPassword] = useState(false);

    useEffect(() => { fetchUsuarios(); }, []);

    const fetchUsuarios = async () => {
        try {
            const res = await axios.get('http://localhost:8000/api/usuarios/');
            setUsuarios(res.data);
        } catch (err) { console.error("Error al cargar usuarios:", err); }
    };

    const cambiarRol = (nuevoRol) => {
        setUserForm({ ...userForm, rol: nuevoRol });
        setPermisos(PERMISOS_POR_DEFECTO[nuevoRol] || {});
    };

    const seleccionarParaEditar = (u) => {
        setUserForm({ id: u.id, nombre: u.nombre, username: u.username, email: u.email || '', password: '', rol: u.rol });
        setPermisos(u.permisos || {});
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleGuardar = async () => {
        if (!userForm.username || !userForm.nombre) return alert("⚠️ Nombre y Username son obligatorios");
        try {
            if (userForm.id) {
                await axios.put(`http://localhost:8000/api/usuarios/${userForm.id}`, { ...userForm, permisos });
                alert("✅ Usuario actualizado correctamente");
            } else {
                await axios.post('http://localhost:8000/api/usuarios/crear-perfil', { ...userForm, permisos });
                alert("✅ Colaborador creado con éxito");
            }
            setUserForm({ id: null, nombre: '', username: '', email: '', password: '', rol: 'tecnologo' });
            setVerPassword(false); // Resetear ojo al guardar
            fetchUsuarios();
        } catch (err) { alert("❌ Error al procesar la solicitud."); }
    };

    const handleBloquear = async () => {
        const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
        if (ids.length === 0) return alert("Seleccione usuarios en la tabla");
        try {
            for (let id of ids) {
                await axios.patch(`http://localhost:8000/api/usuarios/${id}/estado?activo=false`);
            }
            alert("🔒 Usuarios bloqueados");
            setSelectedUsers({});
            fetchUsuarios();
        } catch (err) { alert("Error al bloquear."); }
    };

    const handleEliminar = async () => {
        const ids = Object.keys(selectedUsers).filter(id => selectedUsers[id]);
        if (ids.length === 0) return alert("Seleccione usuarios");
        if (window.confirm(`⚠️ ¿Eliminar permanentemente a ${ids.length} usuarios?`)) {
            try {
                for (let id of ids) { await axios.delete(`http://localhost:8000/api/usuarios/${id}`); }
                alert("🗑️ Usuarios eliminados");
                setSelectedUsers({});
                fetchUsuarios();
            } catch (err) { alert("Error al eliminar."); }
        }
    };

    return (
        <div className="gestion-usuarios-wrapper">
            <header className="gestion-header">
                <h1 style={{color: '#fbbf24', margin: 0, fontSize: '1.5rem'}}>🛠️ Consola de Mando MI_PACS</h1>
                <p style={{color: '#666', fontSize: '0.85rem'}}>Modo Maestro: Gestión de Seguridad y Colaboradores</p>
            </header>

            <main className="gestion-main">
                <section className="gestion-card-registro">
                    <div className="form-grid-maestro">
                        <div className="field-group"><label>Nombre Completo</label><input value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} /></div>
                        <div className="field-group"><label>Username</label><input value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} /></div>
                        <div className="field-group"><label>Email Inst.</label><input value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} /></div>
                        
                        {/* --- CAMPO DE PASSWORD CON OJO --- */}
                        <div className="field-group">
                            <label>Nueva Password {userForm.id && "(Opcional)"}</label>
                            <div style={{ display: 'flex', gap: '5px', position: 'relative' }}>
                                <input 
                                    type={verPassword ? "text" : "password"} 
                                    value={userForm.password} 
                                    onChange={e => setUserForm({...userForm, password: e.target.value})} 
                                    style={{ flex: 1, paddingRight: '40px' }}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setVerPassword(!verPassword)}
                                    title={verPassword ? "Ocultar" : "Mostrar"}
                                    style={{ 
                                        position: 'absolute',
                                        right: '5px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#fbbf24',
                                        cursor: 'pointer',
                                        fontSize: '1.2rem'
                                    }}
                                >
                                    {verPassword ? "👁️‍🗨️" : "👁️"}
                                </button>
                            </div>
                        </div>

                        <div className="field-group">
                            <label>Rol Institucional</label>
                            <select value={userForm.rol} onChange={e => cambiarRol(e.target.value)}>
                                {Object.keys(PERMISOS_POR_DEFECTO).map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
                            </select>
                        </div>
                    </div>

                    <h3 style={{color: '#fbbf24', margin: '15px 0 10px 0', fontSize: '0.9rem'}}>✅ Matriz Global de Permisos</h3>
                    <div className="permisos-container-master">
                        {TODOS_LOS_PERMISOS.map(key => (
                            <label key={key} className="permiso-label">
                                <input type="checkbox" checked={!!permisos[key]} onChange={() => setPermisos({...permisos, [key]: !permisos[key]})} />
                                {key.replace(/_/g, ' ').toUpperCase()}
                            </label>
                        ))}
                    </div>

                    <div className="botones-accion-container">
                        <button className="btn-maestro btn-crear" onClick={handleGuardar}>
                            {userForm.id ? "💾 GUARDAR CAMBIOS" : "👤 CREAR USUARIO"}
                        </button>
                        <button className="btn-maestro btn-bloquear" onClick={handleBloquear}>🔒 BLOQUEAR</button>
                        <button className="btn-maestro btn-eliminar" onClick={handleEliminar}>🗑️ ELIMINAR</button>
                        {userForm.id && <button className="btn-maestro" style={{background: '#444'}} onClick={() => {setUserForm({id:null, nombre:'', username:'', email:'', password:'', rol:'tecnologo'}); setVerPassword(false);}}>CANCELAR</button>}
                    </div>
                </section>

                <section className="gestion-card-tabla">
                    <h3 style={{color: '#fbbf24', margin: '0 0 15px 0', fontSize: '1rem'}}>👥 Colaboradores Activos en Sistema</h3>
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
                                        <td><strong>{u.nombre}</strong></td>
                                        <td style={{fontSize: '0.75rem'}}>{u.username}</td>
                                        <td><span className="rol-badge">{u.rol.toUpperCase()}</span></td>
                                        <td><span style={{color: u.is_active ? '#10b981' : '#ef4444'}}>{u.is_active ? '● OPERATIVO' : '○ BLOQUEADO'}</span></td>
                                        <td><button className="btn-editar-mini" onClick={() => seleccionarParaEditar(u)}>EDITAR</button></td>
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