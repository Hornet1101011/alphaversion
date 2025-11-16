import React, { useEffect, useState } from 'react';
import { documentsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileWordOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  SortAscendingOutlined,
  MoreOutlined,
  UploadOutlined,
  EyeOutlined,
  DownloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Input, 
  Select, 
  Dropdown, 
  Button, 
  Space,
  Breadcrumb,
  Menu,
  message,
  Modal,
  Form,
  Empty,
  DatePicker,
  Upload
} from 'antd';
// upload icon already imported above

const { Title, Text } = Typography;
const { Search } = Input;

interface FormValues {
  purpose: string;
  // fields may contain strings or date objects (dayjs) before serialization
  fields: Record<string, any>;
}

interface FileData {
  _id: string;
  filename: string;
  length: number;
  uploadDate: string;
  category?: string;
}

const DocumentRequestForm: React.FC = () => {
  // State management
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDocName, setModalDocName] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [purpose, setPurpose] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'type'>('name');
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [uploadList, setUploadList] = useState<any[]>([]);
  const { user: authUser, setUser } = useAuth();

  useEffect(() => {
    const fetchFiles = async () => {
      setLoading(true);
      try {
        const data = await documentsAPI.listFiles();
        setFiles(data);
      } catch (error) {
        message.error('Failed to fetch document templates');
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const handleCardClick = async (file: FileData) => {
    const currentUser = authUser || (() => {
      try { const stored = localStorage.getItem('userProfile'); return stored ? JSON.parse(stored) : null; } catch { return null; }
    })();
    // If resident and not verified, prompt verification upload
    if (currentUser && currentUser.role === 'resident' && !currentUser.verified) {
      setVerificationModalOpen(true);
      return;
    }
    setModalDocName(file.filename.replace(/\.docx$/i, ''));
    try {
      const res = await fetch(`/api/documents/preview/${file._id}?format=html`);
      const html = await res.text();
      const regex = /\{(.*?)\}/g;
      const fields: string[] = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        fields.push(match[1].trim());
      }
      // Hide QR field from the request form — it is generated server-side
      const visibleFields = fields.filter(f => f && f.toLowerCase() !== 'qr');
      setSelectedFields(visibleFields);
      const initialValues: Record<string, string> = {};
      // compute current date parts
      const now = new Date();
      const day = now.getDate();
      const monthNum = now.getMonth() + 1;
      const monthName = now.toLocaleString(undefined, { month: 'long' });
      const year = now.getFullYear();
      const mm = String(monthNum).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const currentDateFormatted = `${mm}/${dd}/${year}`;

      visibleFields.forEach(f => {
        // default empty
        initialValues[f] = '';
        // auto-fill common "current" fields
        if (/^current(day|dayof)?$/i.test(f) || /currentday/i.test(f)) {
          initialValues[f] = String(day);
        } else if (/current(month)?$/i.test(f) || /currentmonth/i.test(f)) {
          // put human-readable month name
          initialValues[f] = monthName;
        } else if (/current(year)?$/i.test(f) || /currentyear/i.test(f)) {
          initialValues[f] = String(year);
        } else if (/currentdate|current_date|current date|dateofrequest|requesteddate/i.test(f)) {
          // unified date field
          initialValues[f] = currentDateFormatted;
        }
      });
      setFieldValues(initialValues);
      setModalOpen(true);
    } catch (error) {
      message.error('Failed to load document preview');
      setSelectedFields([]);
      setFieldValues({});
    }
  };

  // Upload verification IDs
  const handleUploadSubmit = async () => {
    if (uploadList.length < 1) {
      message.warning('Please select at least one ID to upload');
      return;
    }
    const form = new FormData();
    uploadList.slice(0, 2).forEach((f, idx) => form.append('ids', f.originFileObj || f));
    try {
      const res = await fetch('/api/verification/upload', {
        method: 'POST',
        body: form,
        credentials: 'include'
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      message.success('Verification documents uploaded. Admin will review shortly.');
      setVerificationModalOpen(false);
      // Optionally refresh user profile from server so verified flag may be updated later
      try {
        const { authService } = await import('../services/api');
        const profile = await authService.getCurrentUser();
        if (profile && setUser) setUser(profile as any);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error('Upload error', err);
      message.error('Upload failed');
    }
  };

  const getActionMenu = (file: FileData) => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View'
    },
    {
      key: 'download',
      icon: <DownloadOutlined />,
      label: 'Download'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete'
    }
  ];

  const filteredFiles = files
    .filter(file => {
      const name = file.filename.toLowerCase();
      const search = searchTerm.toLowerCase();
      const categoryMatch = selectedCategory === 'all' || file.category === selectedCategory;
      return name.includes(search) && categoryMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        case 'type':
          return a.filename.split('.').pop()?.localeCompare(b.filename.split('.').pop() || '') || 0;
        default:
          return a.filename.localeCompare(b.filename);
      }
    });

  return (
    <div style={{ padding: '24px', minHeight: '80vh', background: '#f0f2f5' }}>
      {/* Header Section */}
      <Row justify="start" align="middle" style={{ marginBottom: 24 }}>
        <Col style={{ textAlign: 'left' }}>
          <Breadcrumb style={{ marginBottom: 8 }}>
            <Breadcrumb.Item>Home</Breadcrumb.Item>
            <Breadcrumb.Item>Documents</Breadcrumb.Item>
            <Breadcrumb.Item>Request</Breadcrumb.Item>
          </Breadcrumb>
          <Title level={2} style={{ margin: 0, textAlign: 'left' }}>Request Document</Title>
        </Col>
      </Row>

      {/* Filters Section */}
      <Row gutter={16} justify="center" style={{ marginBottom: 24 }}>
        <Col xs={24} sm={16} md={10} lg={8}>
          <Search
            placeholder="Search documents..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </Col>
        <Col xs={24} sm={16} md={10} lg={8}>
          <Space>
            <Select
              defaultValue="all"
              style={{ width: 220 }}
              onChange={value => setSelectedCategory(value)}
            >
              <Select.Option value="all">All Categories</Select.Option>
              <Select.Option value="personal">Personal Documents</Select.Option>
              <Select.Option value="business">Business Documents</Select.Option>
              <Select.Option value="certificates">Certificates</Select.Option>
            </Select>
            <Select
              defaultValue="name"
              style={{ width: 160 }}
              onChange={value => setSortBy(value as 'name' | 'date' | 'type')}
            >
              <Select.Option value="name">Sort by Name</Select.Option>
              <Select.Option value="date">Sort by Date</Select.Option>
              <Select.Option value="type">Sort by Type</Select.Option>
            </Select>
          </Space>
        </Col>
      </Row>

      {/* Documents Grid */}
      <Row gutter={[16, 16]}>
        {loading ? (
          <Col span={24} style={{ textAlign: 'center', padding: '40px' }}>
            Loading documents...
          </Col>
        ) : filteredFiles.length === 0 ? (
          <Col span={24} style={{ textAlign: 'center', padding: '40px' }}>
            No documents found
          </Col>
        ) : (
          filteredFiles.map((file) => (
            <Col xs={24} sm={12} md={8} lg={6} key={file._id}>
              <Card
                hoverable
                style={{ 
                  transition: 'all 0.3s ease',
                  borderRadius: 8
                }}
                bodyStyle={{ padding: 16 }}
                onClick={() => handleCardClick(file)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 12 }}>
                  <FileWordOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12, marginTop: 4 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ 
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.filename.replace(/\.docx$/i, '')}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(file.uploadDate).toLocaleDateString()} · {Math.round(file.length / 1024)} KB
                    </Text>
                  </div>
                  <Dropdown menu={{ items: getActionMenu(file) }} trigger={['click']}>
                    <Button type="text" icon={<MoreOutlined />} onClick={e => e.stopPropagation()} />
                  </Dropdown>
                </div>
              </Card>
            </Col>
          ))
        )}
      </Row>

      {/* Document Request Modal */}
      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={800}
        footer={null}
      >
        {selectedFields.length === 0 ? (
          <Empty description="No fields found in this template" />
        ) : (
          <Form
            layout="vertical"
            initialValues={{ fields: fieldValues }}
            onFinish={async (values: FormValues) => {
              setSubmitLoading(true);
              try {
                // convert any dayjs/date picker values to MM/DD/YYYY strings
                const processedFields: Record<string, any> = { ...values.fields };
                Object.entries(processedFields).forEach(([k, v]) => {
                  // dayjs/date-picker values have a `format` function
                  if (v && typeof (v as any).format === 'function') {
                    // format to MM/DD/YYYY for consistency with UI
                    try {
                      processedFields[k] = (v as any).format('MM/DD/YYYY');
                    } catch (e) {
                      processedFields[k] = String(v);
                    }
                  }
                });

                const payload = {
                  type: modalDocName,
                  documentType: modalDocName,
                  purpose: values.purpose,
                  fileId: files.find((f) => f.filename.replace(/\.docx$/i, '') === modalDocName)?._id,
                  fieldValues: processedFields
                };
                const result = await documentsAPI.requestDocument(payload);
                message.success('Request submitted successfully!');
                setLastRequestId(result?.documentRequest?._id || result?._id || null);
                setModalOpen(false);
              } catch (err) {
                message.error('Failed to submit request.');
              } finally {
                setSubmitLoading(false);
              }
            }}
          >
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Form.Item
                  name="purpose"
                  label="Purpose"
                  rules={[{ required: true, message: 'Please enter the purpose' }]}
                >
                  <Input.TextArea rows={4} placeholder="Enter the purpose of your request" />
                </Form.Item>
              </Col>
              
              {selectedFields.map((field, idx) => (
                <Col xs={24} sm={12} key={idx}>
                  <Form.Item
                    name={['fields', field]}
                    label={field}
                    rules={[{ required: true, message: `Please enter ${field}` }]}
                  >
                    {
                      // If the field name looks like a date (contains 'date', 'dob', 'birth', or 'issued'), show a calendar picker
                      /date|dob|birth|issued/i.test(field)
                        ? <DatePicker style={{ width: '100%' }} format="MM/DD/YYYY" />
                        : <Input placeholder={`Enter ${field}`} />
                    }
                  </Form.Item>
                </Col>
              ))}
              
              <Col span={24} style={{ textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="primary" htmlType="submit" loading={submitLoading}>
                    Submit Request
                  </Button>
                </Space>
              </Col>
            </Row>
          </Form>
        )}
      </Modal>
      {/* Verification Upload Modal for unverified residents */}
      <Modal
        title="Account Verification"
        open={verificationModalOpen}
        onCancel={() => setVerificationModalOpen(false)}
        onOk={handleUploadSubmit}
        okText="Upload"
        width={600}
      >
        <p>Please upload up to two valid government IDs to verify your account. Admin will review and approve.</p>
        <Upload
          multiple
          accept="image/*,application/pdf"
          beforeUpload={() => false}
          fileList={uploadList as any}
          onChange={({ fileList: newList }) => setUploadList(newList)}
          maxCount={2}
        >
          <Button icon={<UploadOutlined />}>Select ID files (max 2)</Button>
        </Upload>
      </Modal>
    </div>
  );
};

export default DocumentRequestForm;