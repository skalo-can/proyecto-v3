import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { 
  Table, Button, Form, Input, Card, Space,
  Typography, message, Popconfirm, Tag, Divider, AutoComplete 
} from 'antd';
import { PlusOutlined, DeleteOutlined, SettingOutlined, DatabaseOutlined } from '@ant-design/icons';
import "./ConfigMapeoPage.css";

const { Title, Text } = Typography;

const getDicomDictionary = (isEn) => [
  { value: 'PatientBirthDate', label: `(0010,0030) PatientBirthDate - ${isEn ? 'Date of Birth' : 'Fecha de Nacimiento'}`, code: '0010,0030' },
  { value: 'PatientWeight', label: `(0010,1030) PatientWeight - ${isEn ? 'Patient Weight' : 'Peso del Paciente'}`, code: '0010,1030' },
  { value: 'PatientSize', label: `(0010,1022) PatientSize - ${isEn ? 'Patient Height / Size' : 'Talla / Estatura'}`, code: '0010,1022' },
  { value: 'PatientSex', label: `(0010,0040) PatientSex - ${isEn ? 'Patient Sex' : 'Sexo del Paciente'}`, code: '0010,0040' },
  { value: 'AdmittingDiagnosesDescription', label: `(0008,1080) AdmittingDiagnosesDescription - ${isEn ? 'Reason for Visit / Admitting Diagnosis' : 'Motivo de Consulta'}`, code: '0008,1080' },
  { value: 'ReferringPhysicianName', label: `(0008,0090) ReferringPhysicianName - ${isEn ? 'Referring Physician' : 'Médico Referente'}`, code: '0008,0090' },
  { value: 'MedicalAlerts', label: `(0010,2000) MedicalAlerts - ${isEn ? 'Allergies / Medical Alerts' : 'Alergias / Alertas'}`, code: '0010,2000' },
  { value: 'AdditionalPatientHistory', label: `(0010,21B0) AdditionalPatientHistory - ${isEn ? 'Additional Patient History' : 'Historia Clínica'}`, code: '0010,21B0' },
  { value: 'PregnancyStatus', label: `(0010,21C0) PregnancyStatus - ${isEn ? 'Pregnancy Status' : 'Estado de Embarazo'}`, code: '0010,21C0' },
  { value: 'PatientComments', label: `(0010,4000) PatientComments - ${isEn ? 'Patient Comments / Observations' : 'Observaciones'}`, code: '0010,4000' },
  { value: 'InstitutionName', label: `(0008,0080) InstitutionName - ${isEn ? 'Institution Name' : 'Nombre Institución'}`, code: '0008,0080' },
  { value: 'RequestingPhysician', label: `(0032,1032) RequestingPhysician - ${isEn ? 'Requesting Physician' : 'Médico Solicitante'}`, code: '0032,1032' },
  { value: 'RequestedProcedureDescription', label: `(0032,1060) RequestedProcedureDescription - ${isEn ? 'Requested Procedure Description' : 'Descripción del Procedimiento'}`, code: '0032,1060' },
  { value: 'AdmissionID', label: `(0038,0010) AdmissionID - ${isEn ? 'Admission ID' : 'ID de Admisión'}`, code: '0038,0010' },
];

const ConfigMapeoPage = () => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language?.startsWith('en');
  const dicomFullDictionary = useMemo(() => getDicomDictionary(isEn), [isEn]);

  const [mapeos, setMapeos] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const apiBase = import.meta.env.VITE_API_URL || window.API_URL || '';
  const API_URL = `${apiBase}/api/dicom/mapeo`;

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

  useEffect(() => { fetchMapeos(); }, [API_URL]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const seleccion = dicomFullDictionary.find(
        d => d.label === values.tag_dicom || d.value === values.tag_dicom
      );
      
      const payload = {
        nombre_mostrar: values.nombre_mostrar,
        tag_dicom: seleccion ? seleccion.value : values.tag_dicom 
      };

      await axios.post(API_URL, payload);
      message.success(t('config_mapeo.msg_vinculado'));
      form.resetFields();
      fetchMapeos();
    } catch (err) {
      console.error("Error al guardar:", err);
      message.error(t('config_mapeo.msg_error_guardar'));
    } finally {
      setLoading(false);
    }
  };

  const eliminarMapeosSeleccionados = async () => {
    try {
      await Promise.all(selectedRowKeys.map(id => axios.delete(`${API_URL}/${id}`)));
      message.success(t('config_mapeo.msg_eliminados'));
      setSelectedRowKeys([]);
      fetchMapeos();
    } catch (err) {
      message.error(t('config_mapeo.msg_error_eliminar'));
    }
  };

  const columns = [
    {
      title: t('config_mapeo.col_nombre'),
      dataIndex: 'nombre_mostrar',
      key: 'nombre_mostrar',
      render: (text) => <strong style={{ color: '#fbbf24' }}>{text}</strong>,
    },
    {
      title: t('config_mapeo.col_tag'),
      dataIndex: 'tag_dicom',
      key: 'tag_dicom',
      render: (tag) => {
        const info = dicomFullDictionary.find(d => d.value === tag);
        return (
          <Space>
            {info && <Tag color="orange" style={{ background: '#333', color: '#fbbf24', border: '1px solid #fbbf24' }}>{info.code}</Tag>}
            <Tag color="cyan">{tag}</Tag>
          </Space>
        );
      },
    },
  ];

  const requiredMsg = isEn ? 'This field is required' : 'Este campo es obligatorio';

  return (
    <div className="mapeo-page-container">
      <div className="mapeo-header">
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          <SettingOutlined /> {t('config_mapeo.titulo')}
        </Title>
        <Text style={{ color: '#8c8c8c' }}>{t('config_mapeo.subtitulo')}</Text>
        <Divider style={{ borderColor: '#333', margin: '15px 0' }} />
      </div>

      <div className="mapeo-content-layout">
        <div className="mapeo-form-side">
          <Card title={<span style={{ color: '#eee' }}><PlusOutlined /> {t('config_mapeo.nuevo_mapeo')}</span>} className="mapeo-card-dark">
            <Form form={form} layout="vertical" onFinish={onFinish}>
              <Form.Item
                name="nombre_mostrar"
                label={t('config_mapeo.etiqueta_recepcion')}
                rules={[{ required: true, message: requiredMsg }]}
              >
                <Input placeholder={t('config_mapeo.placeholder_etiqueta')} className="mapeo-input" />
              </Form.Item>
              
              <Form.Item
                name="tag_dicom"
                label={t('config_mapeo.tag_dicom')}
                rules={[{ required: true, message: requiredMsg }]}
              >
                <AutoComplete
                  placeholder={t('config_mapeo.placeholder_tag')}
                  className="mapeo-input"
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
                {t('config_mapeo.btn_vincular')}
              </Button>
            </Form>
          </Card>
        </div>

        <div className="mapeo-table-side">
          <Card 
            title={<span style={{ color: '#eee' }}>{t('config_mapeo.tags_activos')}</span>} 
            className="mapeo-card-dark"
            extra={selectedRowKeys.length > 0 && (
              <Popconfirm
                title={t('config_mapeo.confirm_eliminar')}
                onConfirm={eliminarMapeosSeleccionados}
                okText={isEn ? 'Yes' : 'Sí'}
                cancelText="No"
              >
                <Button type="primary" danger size="small" icon={<DeleteOutlined />}>{t('config_mapeo.btn_eliminar')}</Button>
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