import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Table, Button, Form, Input, Card, Space,
  Typography, message, Popconfirm, Tag, Divider, AutoComplete 
} from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, DatabaseOutlined, AlertOutlined } from '@ant-design/icons';
import "./ConfigMapeoPage.css";

const { Title, Text } = Typography;

// 📚 DICCIONARIO DICOM PROFESIONAL
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
  
  // 🔥 ESTADO PARA SELECCIÓN DE FILAS
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const API_URL = 'http://127.0.0.1:8000/api/dicom/mapeo';

  const fetchMapeos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API_URL);
      setMapeos(Array.isArray(res.data) ? res.data : []);
      setSelectedRowKeys([]); // Limpiar selección al recargar
    } catch (err) {
      console.error("Error al cargar:", err);
      setMapeos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMapeos(); }, []);

  const onFinish = async (values) => {
    try {
      await axios.post(API_URL, values);
      message.success("Campo vinculado al estándar DICOM");
      form.resetFields();
      fetchMapeos();
    } catch (err) {
      console.error("Error al guardar:", err);
      message.error("Error al guardar: Verifique la conexión");
    }
  };

  // 🔥 FUNCIÓN PARA ELIMINAR SELECCIONADOS
  const eliminarMapeosSeleccionados = async () => {
    setLoading(true);
    try {
      // Usamos Promise.all para eliminar todos los IDs seleccionados en paralelo
      await Promise.all(selectedRowKeys.map(id => axios.delete(`${API_URL}/${id}`)));
      message.success(`${selectedRowKeys.length} campo(s) eliminado(s) correctamente`);
      fetchMapeos(); // Recargar tabla y limpiar selección
    } catch (err) {
      console.error("Error al eliminar seleccionados:", err);
      message.error("Error al eliminar algunos campos");
      setLoading(false);
    }
  };

  // 🔥 CONFIGURACIÓN DE SELECCIÓN DE FILAS
  const onSelectChange = (newSelectedRowKeys) => {
    console.log('Filas seleccionadas (IDs): ', newSelectedRowKeys);
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
    selections: [
      Table.SELECTION_ALL,
      Table.SELECTION_INVERT,
      Table.SELECTION_NONE,
    ],
  };
  
  const hasSelected = selectedRowKeys.length > 0;

  const columns = [
    {
      title: 'Nombre en Formulario',
      dataIndex: 'nombre_mostrar',
      key: 'nombre_mostrar',
      render: (text) => <strong style={{ color: '#1890ff' }}>{text}</strong>,
    },
    {
      title: 'Tag DICOM (Código / Keyword)',
      dataIndex: 'tag_dicom',
      key: 'tag_dicom',
      render: (tag) => {
        const info = dicomFullDictionary.find(d => d.value === tag);
        return (
          <Space>
            {info && <Tag color="blue" style={{ fontWeight: 'bold' }}>{info.code}</Tag>}
            <Tag color="cyan" style={{ fontSize: '13px' }}>{tag}</Tag>
          </Space>
        );
      },
    },
    // Quitamos la columna de acciones individual para usar la eliminación masiva arriba
  ];

  return (
    <div className="mapeo-page-container">
      <style>{`
        .ant-select-dropdown { background-color: #141c27 !important; border: 1px solid #303030; }
        .ant-select-item-option-content { color: #ccc !important; }
        .ant-select-item-option-active { background-color: #1890ff !important; }
        
        /* Estilos para asegurar visibilidad de checkboxes en modo oscuro */
        .ant-checkbox-inner { background-color: transparent; border-color: #555; }
        .ant-checkbox-checked .ant-checkbox-inner { background-color: #1890ff; border-color: #1890ff; }
        .ant-table-tbody > tr.ant-table-row-selected > td { background: #1a2736 !important; }
      `}</style>

      <div style={{ marginBottom: '20px' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          <SettingOutlined /> Configuración de Tags DICOM (Worklist)
        </Title>
        <Text style={{ color: '#8c8c8c' }}>Vincule campos del formulario con el estándar internacional DICOM.</Text>
        <Divider style={{ borderColor: '#303030', margin: '15px 0' }} />
      </div>

      <div style={{ display: 'flex', gap: '24px', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '420px' }}>
          <Card 
            title={<span style={{color: '#eee'}}><PlusOutlined /> Nuevo Mapeo</span>} 
            style={{ background: '#141c27', border: '1px solid #303030' }}
            headStyle={{ borderBottom: '1px solid #303030' }}
          >
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item name="nombre_mostrar" label={<span style={{color: '#aaa'}}>Etiqueta en Recepción (Ej: Peso)</span>} rules={[{ required: true }]}>
                <Input placeholder="Ej: Fecha Nacimiento" />
              </Form.Item>
              
              <Form.Item name="tag_dicom" label={<span style={{color: '#aaa'}}>Tag DICOM (Keyword)</span>} rules={[{ required: true }]}>
                <AutoComplete
                  options={dicomFullDictionary}
                  placeholder="Busque por nombre o número..."
                  filterOption={(inputValue, option) =>
                    option.label.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                  }
                />
              </Form.Item>

              <Button type="primary" htmlType="submit" block icon={<DatabaseOutlined />} style={{marginTop: '10px'}}>
                Vincular y Limpiar Casillas
              </Button>
            </Form>
          </Card>
        </div>

        <Card 
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{color: '#eee'}}>Tags Activos en MI_PACS</span>
              
              {/* 🔥 BOTÓN DE ELIMINACIÓN MASIVA (Solo visible si hay selección) */}
              <Space style={{ visibility: hasSelected ? 'visible' : 'hidden' }}>
                <Text style={{ color: '#aaa', fontSize: '12px' }}>
                  {hasSelected ? `${selectedRowKeys.length} seleccionados` : ''}
                </Text>
                <Popconfirm 
                  title={`¿Eliminar los ${selectedRowKeys.length} campos seleccionados?`}
                  onConfirm={eliminarMapeosSeleccionados}
                  okText="Sí, eliminar"
                  cancelText="No"
                  icon={<AlertOutlined style={{ color: 'red' }} />}
                >
                  <Button 
                    type="primary" 
                    danger 
                    size="small" 
                    icon={<DeleteOutlined />}
                    loading={loading}
                  >
                    Eliminar Selección
                  </Button>
                </Popconfirm>
              </Space>
            </div>
          } 
          style={{ flex: 1, background: '#141c27', border: '1px solid #303030', overflow: 'hidden' }}
          headStyle={{ borderBottom: '1px solid #303030', padding: '0 15px' }}
          bodyStyle={{ padding: '0 10px' }}
        >
          <Table 
            rowSelection={rowSelection} // 🔥 ACTIVAMOS LOS CUADRADOS DE SELECCIÓN
            dataSource={mapeos} 
            columns={columns} 
            rowKey="id" // Importante: usar el ID de la base de datos
            loading={loading}
            pagination={{ pageSize: 8 }}
            size="small"
            locale={{ emptyText: <span style={{color: '#555'}}>No hay mapeos</span> }}
          />
        </Card>
      </div>
    </div>
  );
};

export default ConfigMapeoPage;