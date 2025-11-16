import React, { useState, useEffect } from 'react';
import { Button, Form, Input, message, Upload, Alert, Modal } from 'antd';
import { UserOutlined, MailOutlined, HomeOutlined, PhoneOutlined, UploadOutlined } from '@ant-design/icons';
import AvatarImage from './AvatarImage';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import dayjs from 'dayjs';

interface ProfileProps {
  profile: any | null;
  onProfileUpdate: (profile: any) => void;
}

const Profile: React.FC<ProfileProps> = ({ profile, onProfileUpdate }) => {
  const [userForm] = Form.useForm();
  const [residentForm] = Form.useForm();
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [residentMissing, setResidentMissing] = useState(false);
  const [pwdModalVisible, setPwdModalVisible] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [changeForm] = Form.useForm();
  const { setUser } = useAuth();

  const autoCreateResident = async () => {
    try {
      // derive basic fields from userForm (if available)
      const values = userForm.getFieldsValue();
      const parts = (values.fullName || values.username || '').toString().trim().split(' ');
      const firstName = parts.length ? parts[0] : (values.username || values.email || 'Resident');
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
      const payload: any = {
        firstName,
        lastName,
        barangayID: values.barangayID || '',
        username: values.username || '',
        email: values.email || ''
      };
      const resp = await axios.put('/api/resident/personal-info', payload);
      residentForm.setFieldsValue(resp.data || {});
      setResidentMissing(false);
      message.success('Resident profile created');
    } catch (err) {
      console.error('Failed to auto-create resident:', err);
      message.error('Failed to create resident info. Please fill the form manually.');
    }
  };

  useEffect(() => {
    axios.get('/api/resident/profile')
      .then(res => {
        userForm.setFieldsValue(res.data || {});
        if (res.data?.profileImage) {
          const url = res.data.profileImage.startsWith('http') ? res.data.profileImage : `${window.location.origin}${res.data.profileImage}`;
          setAvatarPreview(url);
        }
      })
      .catch(() => {});

    axios.get('/api/resident/personal-info')
      .then(res => {
        residentForm.setFieldsValue(res.data || {});
        if (res.data?.profileImage) {
          const url = res.data.profileImage.startsWith('http') ? res.data.profileImage : `${window.location.origin}${res.data.profileImage}`;
          setAvatarPreview(url);
        }
      })
      .catch((err) => {
        if (err?.response && err.response.status === 404) {
          setResidentMissing(true);
          residentForm.setFieldsValue({});
        }
      });
  }, [userForm, residentForm]);

  const handleUserSave = async () => {
    try {
      const values = await userForm.validateFields();
      const resp = await axios.put('/api/resident/profile', values);
      // If server returned an updated user profile, update auth context
      const returned = resp?.data || null;
      if (returned) {
        // prefer returned.user or returned.profile, otherwise use returned itself
        const returnedUser = returned.user || returned.profile || (returned?.userProfile ? returned.userProfile : (returned?.username ? returned : null));
        if (returnedUser && typeof setUser === 'function') setUser(returnedUser);
      }
      onProfileUpdate(values);
      message.success('User info updated');
      setEditMode(false);
    } catch (err) {
      message.error('Failed to update user info');
    }
  };

  const handleResidentSave = async () => {
    try {
      const values = await residentForm.validateFields();
      await axios.put('/api/resident/personal-info', values);
      message.success('Resident info updated');
    } catch (err) {
      message.error('Failed to update resident info');
    }
  };

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const form = new FormData();
    form.append('avatar', file);
    try {
      const resp = await axios.post('/api/resident/personal-info/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const updated = resp.data?.resident;
      const returnedUser = resp.data?.user;
      if (updated) {
        residentForm.setFieldsValue(updated || {});
        if (updated.profileImage) {
          const url = updated.profileImage.startsWith('http') ? updated.profileImage : `${window.location.origin}${updated.profileImage}`;
          setAvatarPreview(url);
        }
        setResidentMissing(false);
      }
      if (returnedUser) {
        try {
          // update auth context immediately so UI reflects new avatar
          if (typeof setUser === 'function') setUser(returnedUser);
          else localStorage.setItem('userProfile', JSON.stringify(returnedUser));
          try {
            const ev = new CustomEvent('userProfileUpdated', { detail: returnedUser });
            window.dispatchEvent(ev);
          } catch (err) {}
        } catch (err) {}
      }
      message.success('Profile image updated');
    } catch (err) {
      message.error('Failed to upload avatar');
    }
  };

  // ...existing code...

  const handleRequestStaff = async () => {
    setRequesting(true);
    try {
      const resp = await axios.post('/api/resident/request-staff-access');
      message.success(resp.data?.message || 'Request sent');
    } catch (err) {
      message.error('Failed to send request');
    }
    setRequesting(false);
  };

  return (
    <div>
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, overflow: 'hidden', background: '#f0f0f0' }}>
            {avatarPreview ? (
              <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <AvatarImage user={(() => {
                let displayUser = profile;
                if (!displayUser) {
                  try {
                    const stored = localStorage.getItem('userProfile');
                    if (stored) displayUser = JSON.parse(stored);
                  } catch (err) {}
                }
                return displayUser;
              })()} size={72} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <Form form={userForm} layout="vertical" disabled={!editMode}>
              <Form.Item name="username" label="Username">
                <Input prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item name="email" label="Email">
                <Input prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item name="address" label="Address">
                <Input prefix={<HomeOutlined />} />
              </Form.Item>
              <Form.Item name="contactNumber" label="Contact Number">
                <Input prefix={<PhoneOutlined />} />
              </Form.Item>
            </Form>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              {editMode ? <Button type="primary" onClick={handleUserSave}>Save</Button> : null}
              <Button onClick={() => setEditMode(!editMode)} type={editMode ? 'default' : 'primary'}>{editMode ? 'Cancel' : 'Edit'}</Button>
              <Button style={{ marginLeft: 8 }} onClick={() => setPwdModalVisible(true)}>Change Password</Button>

              {/* Prominent Upload button for avatar */}
              <Upload
                showUploadList={false}
                accept="image/*"
                customRequest={async ({ file, onSuccess, onError }) => {
                  try {
                    await handleAvatarChange(file as File);
                    if (typeof onSuccess === 'function') onSuccess('ok');
                  } catch (err) {
                    if (typeof onError === 'function') onError(err as any);
                  }
                }}
              >
                <Button icon={<UploadOutlined />} style={{ marginLeft: 8 }}>Upload Avatar</Button>
              </Upload>

              <Button type="dashed" loading={requesting} onClick={handleRequestStaff} style={{ marginLeft: 'auto' }}>Request Staff Access</Button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        title="Change Password"
        visible={pwdModalVisible}
        onCancel={() => { setPwdModalVisible(false); changeForm.resetFields(); }}
        footer={null}
      >
        <Form form={changeForm} layout="vertical" onFinish={async (vals) => {
          const { currentPassword, newPassword, confirmPassword } = vals;
          if (newPassword !== confirmPassword) {
            message.error('New password and confirmation do not match');
            return;
          }
          setPwdLoading(true);
          try {
            const resp = await axios.post('/api/change-password', { currentPassword, newPassword });
            message.success('Changes have been saved');
            setPwdModalVisible(false);
            changeForm.resetFields();
          } catch (err: any) {
            const text = err?.response?.data?.message || 'Failed to change password';
            message.error(text);
          } finally {
            setPwdLoading(false);
          }
        }}>
          <Form.Item name="currentPassword" label="Current password" rules={[{ required: true, message: 'Enter your current password' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="newPassword" label="New password" rules={[{ required: true, message: 'Enter a new password' }, { min: 6, message: 'Password must be at least 6 characters' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="confirmPassword" label="Confirm new password" rules={[{ required: true, message: 'Confirm your new password' }]}>
            <Input.Password />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={() => { setPwdModalVisible(false); changeForm.resetFields(); }}>Cancel</Button>
            <Button type="primary" loading={pwdLoading} onClick={() => changeForm.submit()}>Save</Button>
          </div>
        </Form>
      </Modal>

      <div style={{ background: '#fff', borderRadius: 8, padding: 24 }}>
        <h3 style={{ marginTop: 0 }}>Resident Info</h3>
        {residentMissing && (
          <Alert
            message="Resident profile missing"
            description={
              <div>
                <p>We couldn't find your resident personal info. Please create it so you can upload your profile picture and use resident features.</p>
                <Button type="primary" onClick={autoCreateResident}>Create Resident Info</Button>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}
        <Form form={residentForm} layout="vertical">
          <Form.Item name="firstName" label="First Name">
            <Input />
          </Form.Item>
          <Form.Item name="lastName" label="Last Name">
            <Input />
          </Form.Item>
          <Form.Item name="birthDate" label="Birthdate">
            <Input type="date" onChange={e => {
              const v = e.target.value; if (v) {
                const age = dayjs().diff(dayjs(v), 'year');
                residentForm.setFieldsValue({ age });
              }
            }} />
          </Form.Item>
          <Form.Item name="age" label="Age">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input />
          </Form.Item>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" onClick={handleResidentSave}>Save Resident Info</Button>
          </div>
        </Form>
      </div>
    </div>
  );
};

export default Profile;
