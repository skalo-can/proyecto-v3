import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Table, Button, Form, Input, Card, Space,
  Typography, message, Popconfirm, Tag, Divider, AutoComplete 
} from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, DatabaseOutlined, AlertOutlined } from '@ant-design/icons';
import "./ConfigMapeoPage.css";

const { Title, Text } = Typography;

const dicomFullDictionary = [
  { value: 'PatientBirthDate', label: '(0010,0030) PatientBirthDate - Fecha de Nacimiento', code: '0010,0030' },
  { value: 'PatientWeight', label: '(0010,1030) PatientWeight - Peso del Paciente', code: '0010,1030' },
  { value: 'PatientSize', label: '(0010,1022) PatientSize - Talla / Estatura', code: '0010,1022' },
  { value: 'PatientSex', label: '(0010,0040) PatientSex - Sexo del Paciente', code: '0010,0040' },
  { value: 'AdmittingDiagnosesDescription', label: '(0008,1080) AdmittingDiagnosesDescription - Motivo de Consulta', code: '0008,1080' },
  { value: 'ReferringPhysicianName', label: '(0008,0090) ReferringPhysicianName - Médico Referente', code: '0008,0090' },
  { value: 'MedicalAlerts', label: '(0010,2000) MedicalAlerts - Alergias / Alertas', code: '0010,2000' },
  { value: 'AdditionalPatientHistory', label: '(0010,21B0) AdditionalPatientHistory - Historia Clínica', code: '0010,21B0' },
  { value: 'PregnancyStatus', label: '(0010,21C0) PregnancyStatus - Estado de Embarazo', code: '0010,21C0' },
  { value: 'PatientComments', label: '(0010,4000) PatientComments - Observaciones', code: '0010,4000' },
  { value: 'InstitutionName', label: '(0008,0080) InstitutionName - Nombre Institución', code: '0008,0080' },
  { value: 'RequestingPhysician', label: '(0032,1032) RequestingPhysician - Médico Solicitante', code: '0032,1032' },
  { value: 'RequestedProcedureDescription', label: '(0032,1060) RequestedProcedureDescription - Descripción del Procedimiento', code: '0032,1060' },
  { value: 'AdmissionID', label: '(0038,0010) AdmissionID - ID de Admisión', code: '0038,0010' },
];

const ConfigMapeoPage = () => {
  const [mapeos, setMapeos] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // ✅ CORREGIDO: Se eliminó la barra final '/' para evitar el error 307 de redirección
  const API_URL = 'http://192.168.5.21:8000/api/dicom/mapeo';

  const fetchMapeos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL);
      setMapeos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMapeos(); }, []);

  // ✅ NUEVA LÓGICA DE GUARDADO: Limpia el Tag antes de enviarlo
  const onFinish = async (values) => {
    setLoading(true);
    try {
      // Buscamos el Keyword original (value) para que el Backend lo guarde bien
      const seleccion = dicomFullDictionary.find(d => d.label === values.tag_dicom || d.value === values.tag_dicom);
      
      const payload = {
        nombre_mostrar: values.nombre_mostrar,
        tag_dicom: seleccion ? seleccion.value : values.tag_dicom 
      };

      await axios.post(API_URL, payload);
      message.success("Campo vinculado al estándar DICOM");
      form.resetFields();
      fetchMapeos();
    } catch (err) {
      console.error("Error al guardar:", err);
      message.error("Error al guardar: Verifique la conexión o el método (405)");
    } finally {
      setLoading(false);
    }
  };

  const eliminarMapeosSeleccionados = async () => {
    try {
      await Promise.all(selectedRowKeys.map(id => axios.delete(`${API_URL}/${id}`)));
      message.success("Mapeos eliminados correctamente");
      setSelectedRowKeys([]);
      fetchMapeos();
    } catch (err) {
      message.error("Error al eliminar");
    }
  };

  const columns = [
    {
      title: 'Nombre en Formulario',
      dataIndex: 'nombre_mostrar',
      key: 'nombre_mostrar',
      render: (text) => <strong style={{ color: '#fbbf24' }}>{text}</strong>,
    },
    {
      title: 'Tag DICOM (Keyword)',
      dataIndex: 'tag_dicom',
      key: 'tag_dicom',
      render: (tag) => {
        const info = dicomFullDictionary.find(d => d.value === tag);
        return (
          <Space>
            {info && <Tag color="orange" style={{background: '#333', color: '#fbbf24', border: '1px solid #fbbf24'}}>{info.code}</Tag>}
            <Tag color="cyan">{tag}</Tag>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="mapeo-page-container">
      <div className="mapeo-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          <SettingOutlined /> Configuración de Tags DICOM
        </Title>
        <Text style={{ color: '#8c8c8c' }}>Vincule campos del formulario con el estándar internacional DICOM.</Text>
        <Divider style={{ borderColor: '#333', margin: '15px 0' }} />
      </div>

      <div className="mapeo-content-layout">
        <div className="mapeo-form-side">
          <Card title={<span style={{color: '#eee'}}><PlusOutlined /> Nuevo Mapeo</span>} className="mapeo-card-dark">
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item name="nombre_mostrar" label="ETIQUETA EN RECEPCIÓN" rules={[{ required: true }]}>
                <Input placeholder="Ej: Fecha Nacimiento" className="mapeo-input" />
              </Form.Item>
              
              <Form.Item name="tag_dicom" label="TAG DICOM (KEYWORD)" rules={[{ required: true }]}>
                <AutoComplete
                  placeholder="Busque por nombre o código DICOM..."
                  className="mapeo-input"
                  // ✅ Manejo de opciones optimizado para evitar Warnings
                  onSelect={(value, option) => form.setFieldsValue({ tag_dicom: option.label })}
                  filterOption={(inputValue, option) =>
                    option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                >
                  {dicomFullDictionary.map((item) => (
                    <AutoComplete.Option key={item.value} value={item.label} label={item.label}>
                      {item.label}
                    </AutoComplete.Option>
                  ))}
                </AutoComplete>
              </Form.Item>

              <Button type="primary" htmlType="submit" block icon={<DatabaseOutlined />} className="btn-vincular" loading={loading}>
                Vincular y Limpiar Casillas
              </Button>
            </Form>
          </Card>
        </div>

        <div className="mapeo-table-side">
          <Card 
            title={<span style={{color: '#eee'}}>Tags Activos en MI_PACS</span>} 
            className="mapeo-card-dark"
            extra={selectedRowKeys.length > 0 && (
              <Popconfirm title="¿Eliminar seleccionados?" onConfirm={eliminarMapeosSeleccionados}>
                <Button type="primary" danger size="small" icon={<DeleteOutlined />}>ELIMINAR</Button>
              </Popconfirm>
            )}
          >
            <Table 
              rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
              dataSource={mapeos} 
              columns={columns} 
              rowKey="id" 
              loading={loading}
              pagination={{ pageSize: 8 }}
              size="small"
              className="mapeo-table-custom"
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ConfigMapeoPage;