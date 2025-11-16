import React, { useState } from 'react';
import {
  Form,
  Select,
  Input,
  Button,
  Typography,
  message as antdMessage,
  Card,
  Alert,
  Upload,
  Row,
  Col,
  Steps,
  Tooltip,
  Modal,
  Descriptions,
} from 'antd';
import { UploadOutlined, InfoCircleOutlined, SendOutlined, ReloadOutlined, MailOutlined } from '@ant-design/icons';
import './InquiryForm.css';
import { useAuth } from '../contexts/AuthContext';
import { contactAPI } from '../services/api';

const { TextArea } = Input;

// We will use grouped options for the Inquiry Type select
const inquiryTypeGroups = [
  {
    label: 'Requests',
    options: [
      { value: 'DOCUMENT_REQUEST', label: 'Document Request' },
      { value: 'SCHEDULE_APPOINTMENT', label: 'Schedule Appointment' },
      { value: 'CERTIFICATE_REQUEST', label: 'Certificate Request' },
    ],
  },
  {
    label: 'Concerns',
    options: [
      { value: 'COMPLAINT', label: 'Complaint' },
      { value: 'ASSISTANCE', label: 'Assistance' },
    ],
  },
];

const InquiryForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [form] = Form.useForm();
  const [subjectCount, setSubjectCount] = React.useState(0);
  const [messageCount, setMessageCount] = React.useState(0);
  const SUBJECT_MAX = 100;
  const MESSAGE_MAX = 500;
  const [currentStep, setCurrentStep] = React.useState(0);
  const [fileListState, setFileListState] = React.useState<any[]>([]);
  const [previewModalVisible, setPreviewModalVisible] = React.useState(false);
  const [previewValues, setPreviewValues] = React.useState<any>(null);
  const LOCALSTORAGE_KEY = 'inquiryFormDraft_v1';

  // Load draft from localStorage on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCALSTORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed) {
          const { type, assignedRole, subject, message, attachments } = parsed;
          form.setFieldsValue({ type, assignedRole, subject, message });
          if (subject) setSubjectCount(subject.length);
          if (message) setMessageCount(message.length);
          if (attachments && Array.isArray(attachments) && attachments.length) {
            // create placeholder file entries (no preview available)
            const restored = attachments.map((name: string, idx: number) => ({ uid: `restored-${idx}`, name }));
            setFileListState(restored);
            form.setFieldsValue({ attachment: restored });
          }
          // set step based on restored values
          if (subject && message && (assignedRole || type)) setCurrentStep(2);
          else if (attachments && attachments.length) setCurrentStep(1);
          else setCurrentStep(0);
        }
      }
    } catch (err) {
      // ignore parse errors
      console.warn('Failed to load inquiry draft', err);
    }
  }, []);

  // Autosave draft every 5 seconds
  React.useEffect(() => {
    const saveDraft = () => {
      try {
        const values = form.getFieldsValue(true);
        const draft = {
          type: values.type || null,
          assignedRole: values.assignedRole || null,
          subject: values.subject || '',
          message: values.message || '',
          attachments: (fileListState || []).map((f: any) => f.name || (f.originFileObj && f.originFileObj.name) || ''),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        console.warn('Failed to save draft', err);
      }
    };

    const id = setInterval(saveDraft, 5000);
    // also save on unload
    const onUnload = () => saveDraft();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', onUnload);
      // final save
      try {
        const values = form.getFieldsValue(true);
        const draft = {
          type: values.type || null,
          assignedRole: values.assignedRole || null,
          subject: values.subject || '',
          message: values.message || '',
          attachments: (fileListState || []).map((f: any) => f.name || (f.originFileObj && f.originFileObj.name) || ''),
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(draft));
      } catch (err) {
        // ignore
      }
    };
  }, [fileListState]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    setShowSuccess(false);
    try {
      // Extract uploaded files if any and send as multipart/form-data
      let files: any[] = [];
      if (values.attachment) {
        if (Array.isArray(values.attachment)) files = values.attachment;
        else if (values.attachment.fileList && Array.isArray(values.attachment.fileList)) files = values.attachment.fileList;
      }
      const formData = new FormData();
      formData.append('type', values.type || '');
      formData.append('subject', values.subject || '');
      formData.append('message', values.message || '');
      formData.append('assignedRole', values.assignedRole || 'staff');
      formData.append('username', user?.username || '');
      formData.append('barangayID', user?.barangayID || '');
      if (values.assignedTo && Array.isArray(values.assignedTo)) {
        for (const id of values.assignedTo) formData.append('assignedTo[]', id);
      }
      // Append each file's originFileObj (Upload component stores the file under originFileObj)
      for (const f of files) {
        if (f.originFileObj) formData.append('attachments', f.originFileObj, f.name || (f.originFileObj && f.originFileObj.name));
      }

      await contactAPI.submitInquiry(formData);

      setShowSuccess(true);
      form.resetFields();
      setFileListState([]);
      localStorage.removeItem(LOCALSTORAGE_KEY);
      antdMessage.success('Your inquiry has been submitted!');
    } catch (err) {
      console.error(err);
      antdMessage.error('Failed to submit inquiry.');
    } finally {
      setLoading(false);
    }
  };

  const onFinishFailed = (_errorInfo: any) => {
    antdMessage.error('Please complete all required fields');
  };

  // Simple beforeUpload to prevent automatic upload — we keep files in form state
  const beforeUpload = (file: File) => {
    const isAllowed = file.size / 1024 / 1024 < 5; // < 5MB
    if (!isAllowed) antdMessage.error('File must be smaller than 5MB');
    return false; // prevent auto upload
  };

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 12px' }}>
      <Card
        style={{ borderRadius: 18, boxShadow: '0 4px 24px 0 rgba(64,201,255,0.10)', padding: 0, background: '#fff' }}
        headStyle={{
          borderRadius: '18px 18px 0 0',
          background: 'linear-gradient(90deg, rgba(64,169,255,0.08) 0%, rgba(146,84,222,0.06) 100%)',
          padding: '16px 24px',
        }}
        bodyStyle={{ padding: 24 }}
        bordered={false}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MailOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            <div style={{ lineHeight: 1 }}>
              <Typography.Title level={4} style={{ margin: 0, color: '#1890ff', fontWeight: 700, fontFamily: 'Poppins, Arial, sans-serif' }}>
                Submit an Inquiry
              </Typography.Title>
              <div style={{ fontSize: 12, color: '#6c757d', marginTop: 4 }}>
                Fill out the form below and our staff will get back to you.
              </div>
            </div>
          </div>
        }
      >
        {showSuccess && (
          <Alert
            type="success"
            showIcon
            message={<span style={{ fontWeight: 600 }}><span role="img" aria-label="success">✅</span> Your inquiry has been submitted!</span>}
            style={{ marginBottom: 16, borderRadius: 8 }}
            banner
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          autoComplete="off"
          onFieldsChange={() => showSuccess && setShowSuccess(false)}
          onValuesChange={(_, allValues) => {
            // Determine step: 0 = Details (type/subject), 1 = Attachments (attachments added), 2 = Review
            if (allValues && (allValues.attachment && allValues.attachment.length > 0)) {
              setCurrentStep(1);
            } else if (allValues && allValues.message && allValues.message.length > 0) {
              setCurrentStep(0);
            }
            // If subject, message, and either assigned role exist, go to review step
            if (
              allValues &&
              allValues.subject &&
              allValues.message &&
              (allValues.assignedRole || allValues.type)
            ) {
              setCurrentStep(2);
            }
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <Steps current={currentStep} size="small">
              <Steps.Step title="Details" />
              <Steps.Step title="Attachments" />
              <Steps.Step title="Review & Submit" />
            </Steps>
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="type"
                label={
                  <span>
                    Inquiry Type <span style={{ color: 'red' }}>*</span>{' '}
                    <Tooltip title="Choose the category that best describes your issue.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                    </Tooltip>
                  </span>
                }
                rules={[{ required: true, message: 'Please select an inquiry type' }]}
              >
                <Select placeholder="Select inquiry type" className="inquiry-rounded-input">
                  {inquiryTypeGroups.map(group => (
                    <Select.OptGroup key={group.label} label={group.label}>
                      {group.options.map(opt => (
                        <Select.Option key={opt.value} value={opt.value}>{opt.label}</Select.Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="assignedRole"
                label={
                  <span>
                    Assign to Role <span style={{ color: 'red' }}>*</span>{' '}
                    <Tooltip title="Select which role should handle your inquiry.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                    </Tooltip>
                  </span>
                }
                initialValue="staff"
                rules={[{ required: true, message: 'Please select a role to assign' }]}
              >
                <Select options={[{ value: 'staff', label: 'Staff' }, { value: 'admin', label: 'Admin' }]} placeholder="Assign to role" className="inquiry-rounded-input" />
              </Form.Item>

              <Form.Item
                name="subject"
                label={
                  <span>
                    Subject <span style={{ color: 'red' }}>*</span>{' '}
                    <Tooltip title="Enter a short subject line.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                    </Tooltip>
                  </span>
                }
                rules={[
                  { required: true, message: 'Please enter a subject' },
                  { min: 5, message: 'Subject must be at least 5 characters' },
                  { max: SUBJECT_MAX, message: `Subject must be at most ${SUBJECT_MAX} characters` },
                ]}
              >
                <div>
                  <Input
                    placeholder="Enter subject"
                    className="inquiry-rounded-input"
                    maxLength={SUBJECT_MAX + 20} // allow typing beyond limit but show error
                    onChange={(e) => setSubjectCount(e.target.value.length)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <small style={{ color: subjectCount > SUBJECT_MAX ? 'red' : '#8c8c8c' }}>{subjectCount}/{SUBJECT_MAX}</small>
                  </div>
                </div>
              </Form.Item>
            </Col>

            <Col xs={24} sm={12}>
              <Form.Item
                name="message"
                label={
                  <span>
                    Message <span style={{ color: 'red' }}>*</span>{' '}
                    <Tooltip title="Provide details about your inquiry.">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                    </Tooltip>
                  </span>
                }
                rules={[
                  { required: true, message: 'Please enter your message' },
                  { min: 10, message: 'Message must be at least 10 characters' },
                  { max: MESSAGE_MAX, message: `Message must be at most ${MESSAGE_MAX} characters` },
                ]}
              >
                <div>
                  <TextArea
                    rows={4}
                    placeholder="Enter your message"
                    className="inquiry-rounded-input inquiry-large-textarea"
                    maxLength={MESSAGE_MAX + 50}
                    onChange={(e) => setMessageCount(e.target.value.length)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <small style={{ color: messageCount > MESSAGE_MAX ? 'red' : '#8c8c8c' }}>{messageCount}/{MESSAGE_MAX}</small>
                  </div>
                </div>
              </Form.Item>

              <Form.Item
                name="attachment"
                label={
                  <span>
                    Attachments{' '}
                    <Tooltip title="Attach supporting documents (PDF, JPG, PNG).">
                      <InfoCircleOutlined style={{ marginLeft: 6, color: '#8c8c8c' }} />
                    </Tooltip>
                  </span>
                }
                valuePropName="fileList"
                getValueFromEvent={(e: any) => (Array.isArray(e) ? e : e && e.fileList)}
                extra="Allowed: PDF, JPG, PNG. Max 5MB each."
              >
                <Upload.Dragger
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  fileList={fileListState}
                  beforeUpload={() => false}
                  onChange={(info) => {
                    const incoming = info.fileList || [];
                    const nextList: any[] = [];
                    incoming.forEach((f: any) => {
                      const file = f.originFileObj || f;
                      const isAllowedType = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || (file.name && /\.(pdf|jpe?g|png)$/i.test(file.name));
                      const isLt5M = (file.size || 0) / 1024 / 1024 < 5;
                      if (!isAllowedType) {
                        antdMessage.error(`${file.name} is not a supported file type`);
                        return;
                      }
                      if (!isLt5M) {
                        antdMessage.error(`${file.name} must be smaller than 5MB`);
                        return;
                      }

                      // create preview for images
                      if (file.type && file.type.startsWith('image/') && !f.url && !f.preview) {
                        try {
                          // originFileObj exists for newly selected files
                          const preview = URL.createObjectURL(file);
                          f.preview = preview;
                        } catch (e) {
                          // ignore
                        }
                      }

                      nextList.push(f);
                    });

                    setFileListState(nextList);
                    // sync with form value
                    form.setFieldsValue({ attachment: nextList });
                  }}
                  onPreview={async (file) => {
                    // open image preview or PDF in new tab
                    const f: any = file;
                    const url = f.url || f.preview || (f.originFileObj && URL.createObjectURL(f.originFileObj));
                    if (url) window.open(url, '_blank');
                  }}
                  showUploadList={false}
                >
                  <p className="ant-upload-drag-icon">
                    <UploadOutlined />
                  </p>
                  <p className="ant-upload-text">Drag files here or click to upload</p>
                  <p className="ant-upload-hint">Support for multiple files. Each must be PDF, JPG, or PNG, and under 5MB.</p>
                </Upload.Dragger>

                {/* Custom file list with preview, icons and remove */}
                {fileListState && fileListState.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {fileListState.map((f: any) => {
                      const name = f.name || (f.originFileObj && f.originFileObj.name) || 'file';
                      const size = (f.size || (f.originFileObj && f.originFileObj.size) || 0);
                      const isImage = (f.type && f.type.startsWith('image/')) || /\.(jpe?g|png)$/i.test(name);
                      const isPdf = (f.type === 'application/pdf') || /\.pdf$/i.test(name);
                      return (
                        <div key={f.uid || f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', border: '1px solid #f0f0f0', borderRadius: 8, marginBottom: 8 }}>
                          <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa', borderRadius: 6 }}>
                            {isImage ? (
                              <img src={f.preview || (f.originFileObj && URL.createObjectURL(f.originFileObj))} alt={name} style={{ maxWidth: 44, maxHeight: 44, borderRadius: 4 }} />
                            ) : isPdf ? (
                              <div style={{ fontSize: 20, color: '#ff4d4f' }}>PDF</div>
                            ) : (
                              <div style={{ fontSize: 20 }}>FILE</div>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{name}</div>
                            <div style={{ color: '#8c8c8c', fontSize: 12 }}>{formatBytes(size)}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <Button type="link" onClick={() => {
                              // preview
                              const url = f.url || f.preview || (f.originFileObj && URL.createObjectURL(f.originFileObj));
                              if (url) window.open(url, '_blank');
                            }}>Preview</Button>
                            <Button type="link" danger onClick={() => {
                              const next = fileListState.filter(x => x.uid !== f.uid && x.name !== f.name);
                              setFileListState(next);
                              form.setFieldsValue({ attachment: next });
                            }}>Remove</Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Row justify="end" gutter={[8, 8]}>
              <Col xs={24} sm="auto" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="default"
                  onClick={() => {
                    form.resetFields();
                    setSubjectCount(0);
                    setMessageCount(0);
                    setFileListState([]);
                    localStorage.removeItem(LOCALSTORAGE_KEY);
                  }}
                  block
                  icon={<ReloadOutlined />}
                  style={{ borderRadius: 8, minWidth: 120 }}
                >
                  Reset
                </Button>
              </Col>
              <Col xs={24} sm="auto" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="primary"
                  loading={loading}
                  className="inquiry-gradient-btn"
                  block
                  icon={<SendOutlined />}
                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 16, minWidth: 160 }}
                  onClick={async () => {
                    try {
                      // validate fields before showing preview
                      const values = await form.validateFields();
                      setPreviewValues(values);
                      setPreviewModalVisible(true);
                    } catch (err) {
                      onFinishFailed(err);
                    }
                  }}
                >
                  Submit Inquiry
                </Button>
              </Col>
            </Row>
          </Form.Item>
        </Form>
        <Modal
          title="Review your inquiry"
          open={previewModalVisible}
          onCancel={() => setPreviewModalVisible(false)}
          footer={[
            <Button key="edit" onClick={() => setPreviewModalVisible(false)}>Edit</Button>,
            <Button key="confirm" type="primary" onClick={async () => {
              // call submit with previewValues
              setPreviewModalVisible(false);
              await onFinish(previewValues);
            }}>
              Confirm & Submit
            </Button>
          ]}
        >
          {previewValues && (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Inquiry Type">{previewValues.type}</Descriptions.Item>
              <Descriptions.Item label="Assign to Role">{previewValues.assignedRole}</Descriptions.Item>
              <Descriptions.Item label="Subject">{previewValues.subject}</Descriptions.Item>
              <Descriptions.Item label="Message">{previewValues.message}</Descriptions.Item>
              <Descriptions.Item label="Attachments">{(fileListState || []).map((f: any) => f.name || (f.originFileObj && f.originFileObj.name)).join(', ')}</Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
      </Card>
    </div>
  );
};

export default InquiryForm;
