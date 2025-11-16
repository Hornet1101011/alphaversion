import React from 'react';
import { Modal, Form, Input, message } from 'antd';
import axios from 'axios';

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreated: (resident: any) => void;
  defaultBarangayID?: string | null;
  defaultUsername?: string | null;
  defaultEmail?: string | null;
}

const ResidentCreateModal: React.FC<Props> = ({ visible, onClose, onCreated, defaultBarangayID, defaultUsername, defaultEmail }) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        barangayID: defaultBarangayID || undefined,
        username: defaultUsername || undefined,
        email: defaultEmail || undefined
      });
    } else {
      form.resetFields();
    }
  // only when modal open/close or defaults change
  }, [visible, defaultBarangayID, defaultUsername, defaultEmail, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      // Minimal payload expected by server to create resident container
      const payload: any = {
        firstName: values.firstName,
        lastName: values.lastName,
        barangayID: defaultBarangayID || values.barangayID || '',
        username: defaultUsername || values.username || '',
        email: defaultEmail || values.email || ''
      };
  const resp = await axios.put('/api/resident/personal-info', payload);
      message.success('Resident container created');
      onCreated(resp.data);
      form.resetFields();
      onClose();
    } catch (err: any) {
      console.error('Failed to create resident container', err);
      if (err?.response?.data?.message) message.error(err.response.data.message);
      else message.error('Failed to create resident container');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Create Resident Info"
      visible={visible}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onClose(); }}
      confirmLoading={submitting}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="firstName" label="First name" rules={[{ required: true, message: 'First name is required' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="lastName" label="Last name" rules={[{ required: true, message: 'Last name is required' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="barangayID" label="Barangay ID">
          <Input disabled />
        </Form.Item>
        <Form.Item name="username" label="Username">
          <Input disabled />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Invalid email' }]}>
          <Input disabled />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ResidentCreateModal;
