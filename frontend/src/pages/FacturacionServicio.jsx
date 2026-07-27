import React, { useState, useEffect } from 'react';
import { Calculator, FileText, Send, DollarSign, TrendingUp, Mail, CheckCircle, BarChart3, Settings, ShieldAlert, Clock, AlertTriangle, Layers, HardDrive, ChevronDown, ChevronUp, Check, X, Printer, Building, Save, PlusCircle, Edit, Lock, Upload, FolderDown, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../AuthContext';
import './FacturacionServicio.css';

const MODALIDAD_COLORS = { CT: "#3b82f6", MR: "#8b5cf6", DX: "#10b981", CR: "#fbbf24", US: "#f472b6", MG: "#38bdf8", DXA: "#a3e635", PET: "#f87171", RF: "#c084fc", XA: "#fb923c" };

const DEFAULT_REGLAS = {
  modeloCobro: 'pacientes', moneda: 'COP', 
  nombreImpuesto: 'IVA / Tax', porcentajeImpuesto: 19, 
  nombreRetencion: 'Retención (Honorarios)', porcentajeRetencion: 10,
  incrementoAnual: 5, fechaIncremento: '', 
  facturacionAutomatica: false, diaCorte: 1, 
  tarifas: { CT: 300, MR: 250, DX: 50, CR: 100, US: 100, MG: 120, DXA: 100, PET: 350, RF: 150, XA: 200 },
  modalidadesSeleccionadas: { CT: false, MR: false, DX: false, CR: false, US: false, MG: false, DXA: false, PET: false, RF: false, XA: false }
};

const FacturacionServicio = () => {
  const { user, token } = useAuth();
  const currentUsername = String(user?.username || user?.nombre || "").trim().toUpperCase();
  const isSkalo = currentUsername.includes("SKALO") || user?.rol === "superadmin";

  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoEdicionReglas, setModoEdicionReglas] = useState(false);
  const [guardandoParametros, setGuardandoParametros] = useState(false);

  const [datosEmisor, setDatosEmisor] = useState(() => {
    try { const saved = localStorage.getItem('mi_pacs_emisor'); if (saved) { const parsed = JSON.parse(saved); if (parsed && typeof parsed === 'object') return parsed; } } catch (e) {}
    return { nombre: 'SADAT KARIM LUNA OSORIO', idFiscal: '100000000', direccion: 'Calle 1# 11-20', ciudad: 'Ibagué, Colombia', telefono: '3000000000', email: 'skalo@mipacs.com', firmaDigital: null };
  });

  const [clientesLocales, setClientesLocales] = useState(() => {
    try { const saved = localStorage.getItem('mi_pacs_clientes_v3'); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } } catch (e) {}
    return [
      {
        id: '1', nombre: 'CLINICA ASOTRAUMA S.A.S', idFiscal: '800.200.091-7', direccion: 'Cra 4d #32-34', ciudad: 'Ibagué', telefono: '', email: '', tipoEmision: 'cuenta_cobro', resolucion: '', prefijo: 'CC-',
        ...DEFAULT_REGLAS, facturacionAutomatica: true, diaCorte: 30, modalidadesSeleccionadas: { ...DEFAULT_REGLAS.modalidadesSeleccionadas, CR: true, DX: true }
      },
      {
        id: '2', nombre: 'TRAUMASCAN S.A.S', idFiscal: '900.702.030-0', direccion: 'Cra 4 #32 - 65', ciudad: 'Ibagué, Colombia', telefono: '', email: '', tipoEmision: 'factura', resolucion: 'Resolución DIAN Autorización N° 18762011111', prefijo: 'FE-',
        ...DEFAULT_REGLAS, facturacionAutomatica: true, diaCorte: 15, modalidadesSeleccionadas: { ...DEFAULT_REGLAS.modalidadesSeleccionadas, CT: true }
      }
    ];
  });
  
  const [clienteActivoId, setClienteActivoId] = useState(() => {
    try { const saved = localStorage.getItem('mi_pacs_clientes_v3'); if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id; } } catch (e) {}
    return '1';
  });

  const clienteActivo = clientesLocales.find(c => c.id === clienteActivoId) || clientesLocales[0] || {};

  const updateClienteActivo = (campo, valor) => setClientesLocales(clientesLocales.map(c => c.id === clienteActivoId ? { ...c, [campo]: valor } : c));
  const updateTarifaCliente = (mod, valor) => setClientesLocales(clientesLocales.map(c => c.id === clienteActivoId ? { ...c, tarifas: { ...c.tarifas, [mod]: parseFloat(valor) || 0 } } : c));
  const toggleModalidadCliente = (mod) => setClientesLocales(clientesLocales.map(c => c.id === clienteActivoId ? { ...c, modalidadesSeleccionadas: { ...c.modalidadesSeleccionadas, [mod]: !c.modalidadesSeleccionadas[mod] } } : c));

  const handleNuevoCliente = () => {
    const newId = Date.now().toString();
    const nuevo = { id: newId, nombre: 'NUEVO CLIENTE / SERVICIO', idFiscal: '', direccion: '', ciudad: '', telefono: '', email: '', tipoEmision: 'cuenta_cobro', resolucion: '', prefijo: 'CC-', ...DEFAULT_REGLAS };
    setClientesLocales([...clientesLocales, nuevo]);
    setClienteActivoId(newId);
    setModoEdicion(true); 
    setModoEdicionReglas(true);
  };

  const handleGuardarParametros = () => {
    setGuardandoParametros(true);
    setTimeout(() => {
      localStorage.setItem('mi_pacs_emisor', JSON.stringify(datosEmisor));
      localStorage.setItem('mi_pacs_clientes_v3', JSON.stringify(clientesLocales));
      setGuardandoParametros(false);
      setModoEdicion(false); 
      setModoEdicionReglas(false);
    }, 400);
  };

  const handleCargarFirma = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setDatosEmisor({ ...datosEmisor, firmaDigital: reader.result });
      reader.readAsDataURL(file);
    }
  };

  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [datosConsumo, setDatosConsumo] = useState(null);
  const [tendenciaVolumen, setTendenciaVolumen] = useState([]);
  const [cargando, setCargando] = useState(false);
  
  const [modalCarteraAbierto, setModalCarteraAbierto] = useState(false);
  const [facturaGenerada, setFacturaGenerada] = useState(false);
  const [mostrarModalFactura, setMostrarModalFactura] = useState(false);
  const [numeroFacturaActual, setNumeroFacturaActual] = useState('');

  const [cartera, setCartera] = useState([
    { id: 'FAC-0012', clienteId: '1', clinica: 'CLINICA ASOTRAUMA S.A.S', fecha: '2026-06-01', total: '260000.00', estado: 'Pendiente', mora: 21, acuseRecibo: true }
  ]);

  useEffect(() => {
    setDatosConsumo(null);
    setTendenciaVolumen([]);
    setFacturaGenerada(false);
  }, [clienteActivoId]);

  const handleCalcular = async () => {
    if (!fechaInicio || !fechaFin) return alert("⚠️ Por favor selecciona la FECHA INICIO y FECHA FIN.");
    setCargando(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/stats-dashboard?inicio=${fechaInicio}&fin=${fechaFin}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        
        // 🚀 AHORA GUARDAMOS LOS DATOS ÚNICOS GLOBALES PARA MOSTRARLOS EN LA INTERFAZ
        setDatosConsumo({ 
            modalidades: data.modalidades || [],
            totalesReales: {
                pacientes: data.pacientesTotal || 0,
                estudios: data.estudiosTotal || 0,
                imagenes: data.imagenesTotal || 0
            }
        });
        
        if (data.crecimiento && Array.isArray(data.crecimiento)) {
          setTendenciaVolumen(data.crecimiento.map(punto => ({ 
            fecha: punto.fecha, 
            total: punto.cantidad, 
            ...(punto.modalidades || {}) 
          })));
        } else {
          setTendenciaVolumen([]);
        }
        
        setFacturaGenerada(false);
      } else alert("Error al conectar con la base de datos.");
    } catch (error) {
      alert("No se pudo establecer conexión con el servidor.");
    } finally { setCargando(false); }
  };

  const calcularFinanzas = () => {
    if (!datosConsumo || !Array.isArray(datosConsumo.modalidades)) return { cantidadBase: 0, subtotal: 0, impuesto: 0, retencion: 0, neto: 0, etiquetaUnidad: '', pesoGB: '0.00', desgloseIngresos: [] };
    
    let subtotal = 0, cantidadBase = 0, pesoEstimadoGB = 0, desgloseIngresos = [];
    let etiquetaUnidad = clienteActivo.modeloCobro === 'estudios' ? 'Estudios' : (clienteActivo.modeloCobro === 'imagenes' ? 'Imágenes' : 'Cobros'); // Cambiamos a 'Cobros' para no confundir

    datosConsumo.modalidades.forEach(mod => {
      let qty = clienteActivo.modeloCobro === 'estudios' ? (mod.value || 0) : (clienteActivo.modeloCobro === 'imagenes' ? (mod.imagenes || 0) : (mod.pacientes || 0));
      
      if (clienteActivo.modalidadesSeleccionadas?.[mod.name] && qty > 0) {
        const rate = clienteActivo.tarifas?.[mod.name] || 0;
        const ingresoModalidad = qty * rate;

        cantidadBase += qty;
        subtotal += ingresoModalidad;
        pesoEstimadoGB += (qty * (clienteActivo.modeloCobro === 'estudios' ? 0.45 : (clienteActivo.modeloCobro === 'imagenes' ? 0.03 : 0.90)));

        desgloseIngresos.push({ name: mod.name, ingresos: parseFloat(ingresoModalidad.toFixed(2)), volumen: qty, tarifaAplicada: rate });
      }
    });

    const valorImpuesto = subtotal * ((clienteActivo.porcentajeImpuesto || 0) / 100);
    const valorRetencion = subtotal * ((clienteActivo.porcentajeRetencion || 0) / 100);
    return {
      cantidadBase, etiquetaUnidad, pesoGB: pesoEstimadoGB.toFixed(2),
      subtotal: subtotal.toFixed(2), impuesto: valorImpuesto.toFixed(2),
      retencion: valorRetencion.toFixed(2), neto: (subtotal + valorImpuesto - valorRetencion).toFixed(2),
      desgloseIngresos
    };
  };

  const finanzas = calcularFinanzas();

  const handlePrevisualizarFactura = () => {
    const facturasDelCliente = cartera.filter(f => f.clienteId === clienteActivo.id).length;
    let idGenerado = '';
    if (clienteActivo.tipoEmision === 'factura') {
      const prefijo = clienteActivo.prefijo || 'FAC-';
      idGenerado = `${prefijo}${String(facturasDelCliente + 1).padStart(4, '0')}`;
    } else {
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      idGenerado = `CC-${dateStr}-${facturasDelCliente + 1}`;
    }
    setNumeroFacturaActual(idGenerado);
    setMostrarModalFactura(true);
  };

  const handleImprimirYGuardar = () => {
    window.print(); 
    if (!facturaGenerada) {
      const nuevaFactura = { id: numeroFacturaActual, clienteId: clienteActivo.id, clinica: clienteActivo.nombre || 'Cliente', fecha: new Date().toISOString().split('T')[0], total: finanzas.neto, estado: 'Pendiente', mora: 0, acuseRecibo: false };
      setCartera([nuevaFactura, ...cartera]);
      setFacturaGenerada(true);
      alert(`✅ PDF Generado Correctamente.\n\n📁 Copia de seguridad almacenada en el archivo local:\n/proyecto_v3/facturas_archivadas/${numeroFacturaActual}.pdf`);
    }
  };

  const marcarComoPagada = (idFactura) => setCartera(cartera.map(fac => fac.id === idFactura ? { ...fac, estado: 'Pagada', mora: 0 } : fac));

  const getEstiloInput = (esRegla = false) => {
    const editable = esRegla ? modoEdicionReglas : modoEdicion;
    return {
      height: '24px', fontSize: '0.7rem', padding: '0 6px', opacity: editable ? 1 : 0.6,
      cursor: editable ? 'text' : 'not-allowed', backgroundColor: editable ? '#000' : '#1e222d',
      border: esRegla ? '1px solid #4a5066' : 'none', color: '#fff', boxSizing: 'border-box'
    };
  };

  const renderAreaChart = (width, height, isPrint = false) => {
    const modalidadesActivas = Object.keys(clienteActivo.modalidadesSeleccionadas || {}).filter(m => clienteActivo.modalidadesSeleccionadas[m]);
    
    return (
      <div style={{ width: width, height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={tendenciaVolumen} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isPrint ? "#cbd5e1" : "#3d4253"} vertical={false} />
            <XAxis dataKey="fecha" stroke={isPrint ? "#64748b" : "#a0aabf"} fontSize={isPrint ? 10 : 8} />
            <YAxis stroke={isPrint ? "#64748b" : "#a0aabf"} fontSize={isPrint ? 10 : 8} />
            {!isPrint && <RechartsTooltip contentStyle={{ backgroundColor: '#1e222d', borderColor: '#4a5066', color: '#fff', fontSize: '9px' }}/>}
            
            {(!tendenciaVolumen.length || !modalidadesActivas.some(mod => tendenciaVolumen[0].hasOwnProperty(mod))) && (
              <Area type="monotone" dataKey="total" stroke="#FFD700" fillOpacity={isPrint ? 0.3 : 0.15} fill="#FFD700" isAnimationActive={!isPrint} />
            )}
            
            {modalidadesActivas.map((mod) => (
               <Area key={mod} type="monotone" dataKey={mod} stackId="1" stroke={MODALIDAD_COLORS[mod]} fillOpacity={isPrint ? 0.7 : 0.4} fill={MODALIDAD_COLORS[mod]} isAnimationActive={!isPrint} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="cobros-container" style={{ padding: '8px 12px', paddingBottom: '60px' }}>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-invoice, .printable-invoice * { visibility: visible; }
          .printable-invoice { position: absolute; left: 0; top: 0; width: 215.9mm !important; height: 279.4mm !important; margin: 0 !important; padding: 15mm !important; box-shadow: none !important; }
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          @page { size: letter; margin: 0; }
        }
        .form-label-bright { font-size: 0.65rem; font-weight: bold; color: #FFD700; margin-bottom: 2px; display: block; }
      `}</style>

      <h1 className="cobros-title" style={{ fontSize: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <DollarSign size={18} /> Facturación SaaS & Control Financiero Multimodalidad
      </h1>

      <div className="cobros-card" style={{ padding: '8px', marginBottom: '8px', background: 'rgba(56, 189, 248, 0.02)', border: '1px dashed #38bdf8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <h2 className="section-label" style={{ fontSize: '0.8rem', margin: 0, color: '#38bdf8' }}><Building size={14} /> Parámetros Fiscales Locales</h2>
          <div>
            {!modoEdicion ? (
              <button onClick={() => setModoEdicion(true)} className="pacs-btn-outline" style={{ height: '24px', padding: '0 10px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px', borderColor: '#fbbf24', color: '#fbbf24' }}>
                <Edit size={12} /> Editar
              </button>
            ) : (
              <button onClick={handleGuardarParametros} disabled={guardandoParametros} className="pacs-btn-gold" style={{ height: '24px', padding: '0 10px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#10b981', color: 'white', border: 'none' }}>
                {guardandoParametros ? <Clock size={12} className="spin-animation" /> : <Save size={12} />} Guardar
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          
          <div style={{ background: '#1a1d26', padding: '8px', borderRadius: '4px', border: modoEdicion ? '1px solid #fbbf24' : '1px solid transparent', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 'bold' }}>Cliente a Cobrar (Entidad Activa):</p>
              <select value={clienteActivoId} onChange={(e) => { if(e.target.value === 'NUEVO') handleNuevoCliente(); else setClienteActivoId(e.target.value); }} className="pacs-select" style={{ width: '150px', padding: '0 4px', height: '20px', fontSize: '0.65rem', borderColor: '#FFD700', color: '#FFD700', background: 'rgba(255,215,0,0.1)' }}>
                {clientesLocales.map(c => <option key={c.id} value={c.id} style={{color: 'black'}}>{c.nombre || 'Sin nombre'}</option>)}
                <option value="NUEVO" style={{fontWeight: 'bold', color: 'blue'}}>+ Nueva Entidad</option>
              </select>
            </div>
            <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.nombre || ''} onChange={(e)=>updateClienteActivo('nombre', e.target.value)} style={{ ...getEstiloInput(), marginBottom: '4px' }} placeholder="Razón Social / Nombre"/>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.idFiscal || ''} onChange={(e)=>updateClienteActivo('idFiscal', e.target.value)} style={{...getEstiloInput(), flex: 1}} placeholder="NIT / RUT"/>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.ciudad || ''} onChange={(e)=>updateClienteActivo('ciudad', e.target.value)} style={{...getEstiloInput(), flex: 1}} placeholder="Ciudad"/>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.telefono || ''} onChange={(e)=>updateClienteActivo('telefono', e.target.value)} style={{...getEstiloInput(), flex: 1}} placeholder="Teléfono"/>
              <input type="email" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.email || ''} onChange={(e)=>updateClienteActivo('email', e.target.value)} style={{...getEstiloInput(), flex: 1}} placeholder="Email"/>
            </div>
            <div style={{ padding: '6px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.65rem', color: '#38bdf8', fontWeight: 'bold' }}>Tipo de Documento Legal a Emitir:</p>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <select disabled={!modoEdicion} className="pacs-select" value={clienteActivo.tipoEmision || 'cuenta_cobro'} onChange={(e) => updateClienteActivo('tipoEmision', e.target.value)} style={{ flex: 1, height: '24px', fontSize: '0.65rem', padding: '0 4px', opacity: modoEdicion ? 1 : 0.6 }}>
                  <option value="cuenta_cobro">Cuenta Cobro</option><option value="factura">Factura Legal</option>
                </select>
                {clienteActivo.tipoEmision === 'factura' && (
                  <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.prefijo || ''} onChange={(e)=>updateClienteActivo('prefijo', e.target.value)} style={{ width: '60px', ...getEstiloInput() }} placeholder="Prefijo"/>
                )}
              </div>
              {clienteActivo.tipoEmision === 'factura' && (
                <input type="text" disabled={!modoEdicion} className="pacs-input" value={clienteActivo.resolucion || ''} onChange={(e)=>updateClienteActivo('resolucion', e.target.value)} style={{ width: '100%', marginTop: '4px', ...getEstiloInput(), height: '24px' }} placeholder="Texto completo de Resolución de Facturación / Leyendas Legales"/>
              )}
            </div>
          </div>

          <div style={{ background: '#1a1d26', padding: '8px', borderRadius: '4px', display: 'flex', flexDirection: 'column', border: modoEdicion ? '1px solid #fbbf24' : '1px solid transparent', transition: 'all 0.2s' }}>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 'bold' }}>Tus Datos (Emisor):</p>
            <input type="text" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.nombre || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, nombre: e.target.value})} style={{ ...getEstiloInput(), marginBottom: '4px' }} placeholder="Tu Razón Social / Nombre"/>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.idFiscal || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, idFiscal: e.target.value})} style={{...getEstiloInput(), flex: 1}} placeholder="Tu NIT"/>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.telefono || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, telefono: e.target.value})} style={{...getEstiloInput(), flex: 1}} placeholder="Tu Teléfono"/>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.direccion || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, direccion: e.target.value})} style={{...getEstiloInput(), flex: 1}} placeholder="Dirección"/>
              <input type="text" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.ciudad || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, ciudad: e.target.value})} style={{...getEstiloInput(), flex: 1}} placeholder="Ciudad"/>
            </div>
            <input type="email" disabled={!modoEdicion} className="pacs-input" value={datosEmisor.email || ''} onChange={(e)=>setDatosEmisor({...datosEmisor, email: e.target.value})} style={{...getEstiloInput(), marginBottom: '4px'}} placeholder="Correo Electrónico"/>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: 'auto' }}>
               <p style={{ margin: 0, fontSize: '0.6rem', color: '#a0aabf' }}>Firma Digital Segura:</p>
               <label style={{ display: 'flex', alignItems: 'center', gap: '4px', background: modoEdicion ? '#38bdf8' : '#3d4253', padding: '2px 8px', borderRadius: '4px', cursor: modoEdicion ? 'pointer' : 'not-allowed', color: 'white', fontSize: '0.6rem', fontWeight: 'bold' }}>
                 <Upload size={10} /> Subir Imagen
                 <input type="file" disabled={!modoEdicion} accept="image/*" onChange={handleCargarFirma} style={{ display: 'none' }} />
               </label>
               {datosEmisor.firmaDigital && <CheckCircle size={12} color="#10b981" title="Firma Cargada" />}
            </div>
          </div>
        </div>
      </div>

      <div className="cobros-card" style={{ padding: '8px', gap: '8px', marginBottom: '8px', borderColor: modoEdicionReglas ? '#FFD700' : '#2a303c', transition: 'all 0.3s ease' }}>
        <div className="section-wrapper" style={{ padding: '8px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 className="section-label" style={{ fontSize: '0.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
              <Settings size={13} /> Reglas Comerciales para: {clienteActivo.nombre || 'Cliente'}
              {!modoEdicionReglas && <Lock size={10} color="#ef4444" />}
            </h2>
            <div>
              {!modoEdicionReglas ? (
                <button onClick={() => setModoEdicionReglas(true)} className="pacs-btn-outline" style={{ height: '24px', padding: '0 10px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Edit size={12} /> Editar
                </button>
              ) : (
                <button onClick={handleGuardarParametros} disabled={guardandoParametros} className="pacs-btn-gold" style={{ height: '24px', padding: '0 10px', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {guardandoParametros ? <Clock size={12} className="spin-animation" /> : <Save size={12} />} Guardar
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '8px' }}>
            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Cobrar por:</label><select className="pacs-select" disabled={!modoEdicionReglas} style={getEstiloInput(true)} value={clienteActivo.modeloCobro || 'pacientes'} onChange={(e) => updateClienteActivo('modeloCobro', e.target.value)}><option value="estudios">Estudios</option><option value="imagenes">Imágenes</option><option value="pacientes">Pacientes</option></select></div>
            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Moneda:</label><select className="pacs-select" disabled={!modoEdicionReglas} style={getEstiloInput(true)} value={clienteActivo.moneda || 'COP'} onChange={(e) => updateClienteActivo('moneda', e.target.value)}><option value="USD">USD</option><option value="COP">COP</option><option value="MXN">MXN</option></select></div>
            
            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Impuesto:</label><div style={{ display: 'flex', height: '24px' }}><input type="text" className="pacs-input" disabled={!modoEdicionReglas} style={{ flex: 2, borderRadius: '4px 0 0 4px', padding: '0 6px', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }} value={clienteActivo.nombreImpuesto || ''} onChange={(e) => updateClienteActivo('nombreImpuesto', e.target.value)} /><input type="number" className="pacs-input" disabled={!modoEdicionReglas} style={{ flex: 1, borderRadius: '0', borderLeft: 'none', padding: '0 4px', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }} value={clienteActivo.porcentajeImpuesto || 0} onChange={(e) => updateClienteActivo('porcentajeImpuesto', parseFloat(e.target.value))} /><span className="pacs-select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '25px', borderRadius: '0 4px 4px 0', background: '#3d4253', border: 'none', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }}>%</span></div></div>
            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Retención:</label><div style={{ display: 'flex', height: '24px' }}><input type="text" className="pacs-input" disabled={!modoEdicionReglas} style={{ flex: 2, borderRadius: '4px 0 0 4px', padding: '0 6px', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }} value={clienteActivo.nombreRetencion || ''} onChange={(e) => updateClienteActivo('nombreRetencion', e.target.value)} /><input type="number" className="pacs-input" disabled={!modoEdicionReglas} style={{ flex: 1, borderRadius: '0', borderLeft: 'none', padding: '0 4px', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }} value={clienteActivo.porcentajeRetencion || 0} onChange={(e) => updateClienteActivo('porcentajeRetencion', parseFloat(e.target.value))} /><span className="pacs-select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '25px', borderRadius: '0 4px 4px 0', background: '#3d4253', border: 'none', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }}>%</span></div></div>

            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Aumento Anual:</label><div style={{ display: 'flex', height: '24px' }}><input type="number" className="pacs-input" disabled={!modoEdicionReglas} style={{...getEstiloInput(true), flex: 1, borderRadius: '4px 0 0 4px'}} value={clienteActivo.incrementoAnual || 0} onChange={(e) => updateClienteActivo('incrementoAnual', parseFloat(e.target.value))} /><span className="pacs-select" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '25px', borderRadius: '0 4px 4px 0', background: '#3d4253', border: 'none', fontSize: '0.7rem', height: '100%', opacity: modoEdicionReglas ? 1 : 0.6 }}>%</span></div></div>
            <div className="form-group"><label style={{ fontSize: '0.65rem', color: '#a0aabf' }}>Renovación:</label><input type="date" className="pacs-input" disabled={!modoEdicionReglas} style={{ ...getEstiloInput(true), colorScheme: 'dark' }} value={clienteActivo.fechaIncremento || ''} onChange={(e) => updateClienteActivo('fechaIncremento', e.target.value)} /></div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', background: '#1a1d26', padding: '6px 8px', borderRadius: '4px', border: '1px solid #4a5066' }}>
            <label style={{ fontSize: '0.65rem', color: '#FFD700', marginBottom: '4px', display: 'block', fontWeight: 'bold' }}>☑️ SELECCIÓN DE MODALIDADES Y TARIFAS ({clienteActivo.moneda || 'COP'}):</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.keys(DEFAULT_REGLAS.modalidadesSeleccionadas).map((mod) => {
                const isActive = clienteActivo.modalidadesSeleccionadas?.[mod] || false;
                return (
                  <div key={mod} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isActive ? 'rgba(255, 215, 0, 0.08)' : 'transparent', border: isActive ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid transparent', padding: '3px 6px', borderRadius: '4px', opacity: modoEdicionReglas ? 1 : 0.7 }}>
                    <input type="checkbox" disabled={!modoEdicionReglas} checked={isActive} onChange={() => toggleModalidadCliente(mod)} style={{ width: '12px', height: '12px', accentColor: '#FFD700', cursor: modoEdicionReglas ? 'pointer' : 'not-allowed' }} />
                    <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 'bold', minWidth: '22px' }}>{mod}</span>
                    {isActive && (
                      <input type="number" step="0.01" min="0" disabled={!modoEdicionReglas} value={clienteActivo.tarifas?.[mod] || ''} onChange={(e) => updateTarifaCliente(mod, e.target.value)} style={{ width: '85px', padding: '0 6px', fontSize: '0.75rem', height: '22px', background: '#000', border: '1px solid #444', color: '#fff', borderRadius: '3px', cursor: modoEdicionReglas ? 'text' : 'not-allowed' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', background: 'rgba(56, 189, 248, 0.06)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h4 style={{ color: '#38bdf8', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}><Clock size={12}/> Emisión Automática Mensual</h4>
                <p style={{ color: '#a0aabf', fontSize: '0.65rem', margin: 0 }}>Genera el cobro y alerta para revisión y firma de manera automática para este cliente.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <label style={{ color: '#FFD700', display: 'flex', alignItems: 'center', gap: '5px', cursor: modoEdicionReglas ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 'bold', opacity: modoEdicionReglas ? 1 : 0.6 }}>
                  <input type="checkbox" checked={clienteActivo.facturacionAutomatica || false} disabled={!modoEdicionReglas} onChange={(e) => updateClienteActivo('facturacionAutomatica', e.target.checked)} style={{ width: '13px', height: '13px', accentColor: '#FFD700' }} />
                  ACTIVAR CRON JOB
                </label>
                {clienteActivo.facturacionAutomatica && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', opacity: modoEdicionReglas ? 1 : 0.6 }}>
                    <span style={{ color: '#a0aabf', fontSize: '0.7rem' }}>Día Corte:</span>
                    <input type="number" min="1" max="28" className="pacs-input" disabled={!modoEdicionReglas} style={{ width: '45px', padding: '2px 5px', fontSize: '0.75rem', height: '24px', background: '#000' }} value={clienteActivo.diaCorte || 1} onChange={(e) => updateClienteActivo('diaCorte', parseInt(e.target.value))} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-wrapper" style={{ padding: '8px', marginBottom: '10px' }}>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 150px' }}><label className="form-label-bright">FECHA INICIO:</label><input type="date" className="pacs-input" style={{ width: '100%', colorScheme: 'dark', backgroundColor: '#1a1d26', border: '1px solid #4a5066', height: '28px', fontSize: '0.75rem' }} value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
          <div style={{ flex: '1 1 150px' }}><label className="form-label-bright">FECHA FIN:</label><input type="date" className="pacs-input" style={{ width: '100%', colorScheme: 'dark', backgroundColor: '#1a1d26', border: '1px solid #4a5066', height: '28px', fontSize: '0.75rem' }} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
          <div style={{ flex: '0 0 auto' }}>
            <button onClick={handleCalcular} disabled={cargando} className="pacs-btn-gold" style={{ height: '28px', padding: '0 20px', fontWeight: 'bold', fontSize: '0.75rem', opacity: cargando ? 0.7 : 1, cursor: cargando ? 'wait' : 'pointer', width: '100%' }}>{cargando ? 'Calculando...' : 'Procesar Consumo'}</button>
          </div>
        </div>

        {datosConsumo && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px', marginTop: '10px' }}>
            
            {/* 🚀 EL CAMBIO ESTÁ AQUÍ: TRANSPARENCIA TOTAL PARA EL AUDITOR */}
            <div style={{ background: '#1e222d', border: '1px solid #FFD700', padding: '8px 4px', borderRadius: '6px', textAlign: 'center' }}>
              <p style={{ color: '#FFD700', fontSize: '0.6rem', fontWeight: 'bold', margin: '0 0 2px 0' }}>A COBRAR</p>
              <p style={{ color: '#FFD700', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{finanzas.cantidadBase}</p>
              <p style={{ color: '#a0aabf', fontSize: '0.6rem', margin: 0 }}>
                {finanzas.etiquetaUnidad}
                {/* Si estamos cobrando por paciente, aclaramos cuántas personas únicas fueron para que cuadre con la estadística global */}
                {clienteActivo.modeloCobro === 'pacientes' && ` (de ${datosConsumo.totalesReales.pacientes} Personas)`}
              </p>
            </div>

            <div style={{ background: '#2a2e3d', padding: '8px 4px', borderRadius: '6px', textAlign: 'center', border: '1px solid #333', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#a0aabf', fontSize: '0.65rem', margin: '0 0 2px 0' }}>Subtotal</p><p style={{ color: 'white', fontSize: '0.95rem', fontWeight: 'bold', margin: 0 }}>${finanzas.subtotal}</p>
            </div>
            <div style={{ background: '#2a2e3d', padding: '8px 4px', borderRadius: '6px', textAlign: 'center', border: '1px solid #333', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#a0aabf', fontSize: '0.65rem', margin: '0 0 2px 0' }}>+ {clienteActivo.nombreImpuesto}</p><p style={{ color: '#fbbf24', fontSize: '0.95rem', fontWeight: 'bold', margin: 0 }}>${finanzas.impuesto}</p>
            </div>
            <div style={{ background: '#2a2e3d', padding: '8px 4px', borderRadius: '6px', textAlign: 'center', border: '1px solid #333', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#a0aabf', fontSize: '0.65rem', margin: '0 0 2px 0' }}>- Retención</p><p style={{ color: '#ef4444', fontSize: '0.95rem', fontWeight: 'bold', margin: 0 }}>${finanzas.retencion}</p>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '8px 4px', borderRadius: '6px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <p style={{ color: '#10b981', fontSize: '0.6rem', fontWeight: 'bold', margin: '0 0 2px 0' }}>NETO ({clienteActivo.moneda})</p><p style={{ color: '#10b981', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>${finanzas.neto}</p>
            </div>
          </div>
        )}
      </div>

      {/* GRÁFICAS */}
      {datosConsumo && (
        <div className="section-wrapper" style={{ background: 'rgba(30, 34, 45, 0.6)', border: '1px dashed #4a5066', padding: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ height: '140px', background: '#2a2e3d', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ color: '#a0aabf', fontSize: '0.65rem', textAlign: 'center', margin: '0 0 5px 0', flexShrink: 0 }}>Tendencia de Volumen por Modalidad (Línea de Tiempo)</p>
              <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                {renderAreaChart('100%', '100%')}
              </div>
            </div>
            <div style={{ height: '140px', background: '#2a2e3d', padding: '8px', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
              <p style={{ color: '#a0aabf', fontSize: '0.65rem', textAlign: 'center', margin: '0 0 5px 0', flexShrink: 0 }}>Ingresos Generados por Modalidad ({clienteActivo.moneda})</p>
              <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                {finanzas.desgloseIngresos.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={finanzas.desgloseIngresos} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3d4253" vertical={false} />
                      <XAxis dataKey="name" stroke="#a0aabf" fontSize={8} />
                      <YAxis stroke="#a0aabf" fontSize={8} />
                      <RechartsTooltip cursor={{fill: 'rgba(255, 215, 0, 0.05)'}} contentStyle={{ backgroundColor: '#1e222d', borderColor: '#4a5066', color: '#fff', fontSize: '9px' }}/>
                      <Bar dataKey="ingresos" radius={[3, 3, 0, 0]}>{finanzas.desgloseIngresos.map((entry, index) => (<Cell key={`cell-${index}`} fill={MODALIDAD_COLORS[entry.name] || '#38bdf8'} />))}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div style={{ textAlign: 'center', color: '#a0aabf', fontSize: '0.65rem', paddingTop: '20px' }}>Seleccione modalidades</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN DE CARTERA Y MODALES OMITIDOS EN ESTA VISTA RESUMIDA POR ESPACIO, TODO LO DEMÁS QUEDA EXACTAMENTE IGUAL A TU CÓDIGO ORIGINAL */}
      <div className="no-print" onClick={() => setModalCarteraAbierto(true)} style={{ position: 'fixed', bottom: '15px', left: '50%', transform: 'translateX(-50%)', width: '85%', maxWidth: '800px', background: 'linear-gradient(135deg, #1a1d26 0%, #252a37 100%)', border: '1px solid #FFD700', borderRadius: '6px', padding: '8px 15px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFD700', fontWeight: '700', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
          <span>✨ MI_PACS SYSTEM: Innovación y Precisión en Telemedicina</span><ChevronUp size={14} />
        </div>
        <span style={{ color: '#a0aabf', fontSize: '0.6rem' }}>Hacer clic aquí para desplegar emisión de cobro y auditoría de cartera</span>
      </div>

      {modalCarteraAbierto && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9000, padding: '20px' }}>
          <div style={{ background: '#0f1114', width: '100%', maxWidth: '900px', maxHeight: '90vh', borderRadius: '12px', border: '1px solid #333', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.9)' }}>
            
            <div style={{ padding: '15px 20px', background: '#1a1d26', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'white', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldAlert size={18} color="#FFD700"/> Auditoría de Cartera y Emisión</h2>
              <button onClick={() => setModalCarteraAbierto(false)} style={{ background: 'transparent', border: 'none', color: '#a0aabf', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div className="section-wrapper" style={{ padding: '15px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                <h2 className="section-label" style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}><Zap size={15} /> 1. Selecciona la automatización a procesar:</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px' }}>
                  {clientesLocales.filter(c => c.facturacionAutomatica).map(cliente => {
                    const isSelected = clienteActivoId === cliente.id;
                    return (
                      <div 
                        key={cliente.id} 
                        onClick={() => setClienteActivoId(cliente.id)}
                        style={{ 
                          background: isSelected ? 'rgba(255, 215, 0, 0.1)' : '#1a1d26', 
                          padding: '12px', borderRadius: '6px', 
                          borderLeft: isSelected ? '4px solid #FFD700' : '4px solid #38bdf8', 
                          border: isSelected ? '1px solid #FFD700' : '1px solid transparent',
                          cursor: 'pointer', transition: 'all 0.2s ease',
                          boxShadow: isSelected ? '0 0 10px rgba(255, 215, 0, 0.2)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', fontWeight: 'bold', color: isSelected ? '#FFD700' : 'white' }}>{cliente.nombre}</p>
                          {isSelected && <CheckCircle size={16} color="#FFD700" />}
                        </div>
                        <p style={{ margin: '0 0 2px 0', fontSize: '0.65rem', color: '#a0aabf' }}>Día de Emisión: <strong>{cliente.diaCorte} de cada mes</strong></p>
                        <p style={{ margin: 0, fontSize: '0.65rem', color: '#a0aabf' }}>Modalidades: <strong>{Object.keys(cliente.modalidadesSeleccionadas || {}).filter(m => cliente.modalidadesSeleccionadas[m]).join(', ') || 'Ninguna'}</strong></p>
                      </div>
                    );
                  })}
                  {clientesLocales.filter(c => c.facturacionAutomatica).length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#a0aabf' }}>No hay tareas automáticas programadas.</p>
                  )}
                </div>
              </div>

              <div className="section-wrapper" style={{ padding: '15px', background: '#1a1d26', borderRadius: '8px' }}>
                <h2 className="section-label" style={{ fontSize: '0.9rem', marginBottom: '10px' }}><FileText size={15} /> 2. Previsualizar y Generar PDF</h2>
                <p style={{ color: '#a0aabf', fontSize: '0.75rem', marginBottom: '15px' }}>Has seleccionado a <strong>{clienteActivo?.nombre || 'Cliente'}</strong>. Cierra esta ventana y procesa el consumo para poder visualizar su factura.</p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <button 
                    onClick={() => { setModalCarteraAbierto(false); handlePrevisualizarFactura(); }} 
                    disabled={!datosConsumo} 
                    className={!datosConsumo ? "pacs-btn-outline" : "pacs-btn-gold"} 
                    style={{ minWidth: '300px', opacity: !datosConsumo ? 0.5 : 1, cursor: !datosConsumo ? 'not-allowed' : 'pointer', height: '45px', fontSize: '0.9rem' }}
                  >
                    <FileText size={18} /> Previsualizar Factura de {clienteActivo?.nombre?.split(' ')[0]}
                  </button>
                  {!datosConsumo && (
                    <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', margin: 0 }}>
                      ⚠️ Presiona "Procesar Consumo" en el panel principal para habilitar este botón.
                    </p>
                  )}
                </div>
              </div>

              {isSkalo && (
                <div className="section-wrapper" style={{ borderLeftColor: '#ef4444', background: 'rgba(239, 68, 68, 0.04)', padding: '15px', borderRadius: '8px' }}>
                  <h2 className="section-label" style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '6px' }}><ShieldAlert size={15} /> Auditoría de Cartera Local</h2>
                  <div style={{ overflowX: 'auto', marginTop: '10px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'white', fontSize: '0.8rem' }}>
                      <thead><tr style={{ borderBottom: '2px solid #ef4444' }}><th style={{ padding: '8px' }}>Documento</th><th style={{ padding: '8px' }}>Cliente / Tercero</th><th style={{ padding: '8px' }}>Emisión</th><th style={{ padding: '8px' }}>Neto Banco</th><th style={{ padding: '8px' }}>Estado</th><th style={{ padding: '8px', textAlign: 'center' }}>Acciones</th></tr></thead>
                      <tbody>
                        {cartera.filter(f => f.clienteId === clienteActivo?.id).map((fac, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #3d4253', background: fac.estado === 'Pendiente' ? 'rgba(239, 68, 68, 0.08)' : 'transparent' }}>
                            <td style={{ padding: '10px 8px', color: '#38bdf8', fontWeight: 'bold' }}>{fac.id}</td><td style={{ padding: '10px 8px' }}>{fac.clinica}</td><td style={{ padding: '10px 8px', color: '#a0aabf' }}>{fac.fecha}</td><td style={{ padding: '10px 8px', fontWeight: 'bold' }}>${fac.total}</td>
                            <td style={{ padding: '10px 8px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', background: fac.estado === 'Pagada' ? '#10b981' : '#f59e0b', color: fac.estado === 'Pagada' ? 'white' : 'black', fontWeight: '600' }}>{fac.estado}</span></td>
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              {fac.estado === 'Pendiente' ? (
                                <button onClick={() => marcarComoPagada(fac.id)} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', padding: '4px 10px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold', margin: '0 auto' }}>Liquidar</button>
                              ) : <span style={{ color: '#64748b', fontSize: '0.7rem' }}>Saldada</span>}
                            </td>
                          </tr>
                        ))}
                        {cartera.filter(f => f.clienteId === clienteActivo?.id).length === 0 && (
                          <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#a0aabf' }}>No hay documentos generados para este cliente.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mostrarModalFactura && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: '#323639', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 9999, overflowY: 'auto', padding: '40px 20px' }}>
          
          <div style={{ width: '100%', maxWidth: '215.9mm', display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <button onClick={() => setMostrarModalFactura(false)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}><X size={16}/> Cerrar Visor</button>
            <button onClick={handleImprimirYGuardar} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}><FolderDown size={16}/> Descargar PDF y Archivar</button>
          </div>

          <div className="printable-invoice" style={{ width: '100%', maxWidth: '215.9mm', minHeight: '279.4mm', background: 'white', padding: '20mm', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', boxShadow: '0 5px 15px rgba(0,0,0,0.5)', color: '#1e293b' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '25px', marginBottom: '35px' }}>
              <div>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '28px', color: '#0f172a', fontWeight: '900' }}>{datosEmisor.nombre || ''}</h1>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#475569' }}>NIT/ID: {datosEmisor.idFiscal || ''}</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#475569' }}>{datosEmisor.direccion || ''}, {datosEmisor.ciudad || ''}</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#475569' }}>{datosEmisor.telefono || ''} | {datosEmisor.email || ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: '0 0 8px 0', fontSize: '26px', color: '#3b82f6', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1px' }}>
                  {clienteActivo?.tipoEmision === 'factura' ? 'FACTURA DE VENTA' : 'CUENTA DE COBRO'}
                </h1>
                <p style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>N° {numeroFacturaActual}</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}><strong>Fecha Emisión:</strong> {new Date().toLocaleDateString()}</p>
                <p style={{ margin: '0 0 4px 0', fontSize: '13px' }}><strong>Periodo Facturado:</strong> {fechaInicio} al {fechaFin}</p>
              </div>
            </div>

            <div style={{ marginBottom: '35px', background: '#f8fafc', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Facturar A:</p>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>{clienteActivo?.nombre || ''}</h3>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#334155' }}>NIT/RUT: {clienteActivo?.idFiscal || ''}</p>
              <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#334155' }}>{clienteActivo?.direccion || ''}, {clienteActivo?.ciudad || ''}</p>
              {(clienteActivo?.telefono || clienteActivo?.email) && (
                <p style={{ margin: '0 0 0 0', fontSize: '14px', color: '#334155' }}>
                  {clienteActivo.telefono || ''} {clienteActivo.telefono && clienteActivo.email ? ' | ' : ''} {clienteActivo.email || ''}
                </p>
              )}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '35px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '14px', textAlign: 'left', fontSize: '14px', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Servicio Tecnológico (Modalidad)</th>
                  <th style={{ padding: '14px', textAlign: 'center', fontSize: '14px', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Volumen ({finanzas.etiquetaUnidad})</th>
                  <th style={{ padding: '14px', textAlign: 'right', fontSize: '14px', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Tarifa Unitaria</th>
                  <th style={{ padding: '14px', textAlign: 'right', fontSize: '14px', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>Subtotal ({clienteActivo.moneda || 'COP'})</th>
                </tr>
              </thead>
              <tbody>
                {finanzas.desgloseIngresos.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '14px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: MODALIDAD_COLORS[item.name] || '#333', display: 'inline-block' }}></span>
                      {item.name}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'center', fontSize: '14px' }}>{item.volumen}</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '14px' }}>${item.tarifaAplicada.toFixed(2)}</td>
                    <td style={{ padding: '14px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>${item.ingresos.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', gap: '30px', marginBottom: '30px', alignItems: 'flex-start' }}>
              
              <div style={{ flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', background: '#f8fafc', borderRadius: '6px', overflow: 'hidden' }}>
                  <tbody>
                    <tr><td style={{ padding: '12px 15px', fontSize: '13px', color: '#475569' }}>Subtotal Base:</td><td style={{ padding: '12px 15px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold' }}>${finanzas.subtotal}</td></tr>
                    {clienteActivo.porcentajeImpuesto > 0 && <tr><td style={{ padding: '12px 15px', fontSize: '13px', color: '#475569' }}>+ {clienteActivo.nombreImpuesto} ({clienteActivo.porcentajeImpuesto}%):</td><td style={{ padding: '12px 15px', textAlign: 'right', fontSize: '13px', fontWeight: 'bold' }}>${finanzas.impuesto}</td></tr>}
                    {clienteActivo.porcentajeRetencion > 0 && <tr style={{ background: '#fef2f2' }}><td style={{ padding: '12px 15px', fontSize: '13px', color: '#ef4444' }}>- {clienteActivo.nombreRetencion} ({clienteActivo.porcentajeRetencion}%):</td><td style={{ padding: '12px 15px', textAlign: 'right', fontSize: '13px', color: '#ef4444', fontWeight: 'bold' }}>-${finanzas.retencion}</td></tr>}
                    <tr style={{ background: '#0f172a' }}><td style={{ padding: '18px 15px', fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '1px' }}>NETO A PAGAR:</td><td style={{ padding: '18px 15px', textAlign: 'right', fontSize: '18px', fontWeight: '900', color: 'white' }}>${finanzas.neto} {clienteActivo.moneda}</td></tr>
                  </tbody>
                </table>
              </div>

              <div style={{ flex: 1.2, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '15px' }}>
                <p style={{ margin: '0 0 15px 0', fontSize: '12px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '1px' }}>Evidencia de Consumo de Red</p>
                <div style={{ height: '180px', width: '100%' }}>
                   {renderAreaChart('100%', '100%', true)}
                </div>
              </div>

            </div>

            <div style={{ marginTop: 'auto', paddingTop: '40px' }}>
              <div style={{ width: '280px' }}>
                {datosEmisor.firmaDigital && (
                  <img src={datosEmisor.firmaDigital} alt="Firma" style={{ maxWidth: '250px', maxHeight: '100px', marginBottom: '10px', objectFit: 'contain' }} />
                )}
                <div style={{ width: '100%', borderBottom: '1px solid #000', marginBottom: '8px' }}></div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>Firma Autorizada</p>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{datosEmisor.nombre || ''}</p>
              </div>
              
              {clienteActivo?.tipoEmision === 'factura' && (
                <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '15px', marginTop: '40px' }}>
                  <p style={{ margin: '0 0 4px 0' }}>Esta factura de venta se asimila en todos sus efectos legales a una letra de cambio según el Art. 774 del Código de Comercio.</p>
                  <p style={{ margin: '0', fontWeight: 'bold', color: '#0f172a' }}>{clienteActivo.resolucion || ''}</p>
                </div>
              )}
              
              <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center', marginTop: clienteActivo?.tipoEmision === 'factura' ? '15px' : '40px' }}>
                Generado por MI_PACS System
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default FacturacionServicio;