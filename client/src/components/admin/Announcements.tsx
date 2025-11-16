import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, Input, Upload, Button, message, Typography, List, Popconfirm, Image, Modal, Space, Tooltip } from 'antd';
import { UploadOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { adminAPI } from '../../services/api';

const { TextArea } = Input;

const Announcements: React.FC = () => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [anns, setAnns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editText, setEditText] = useState('');
  const [editFile, setEditFile] = useState<File | null>(null);

  const { user } = useAuth();

  const loadAnns = async () => {
    // Avoid calling admin endpoint when user isn't admin or no token available
    if (!user || user.role !== 'admin') return;
    const token = localStorage.getItem('token');
    if (!token) {
      // No token - likely not logged in yet
      return;
    }
    setLoading(true);
    try {
      const data = await adminAPI.listAdminAnnouncements();
      setAnns(Array.isArray(data) ? data : []);
    } catch (err: any) {
      // Handle 401 explicitly
      if (err?.response?.status === 401) {
        message.error('Not authorized. Please sign in as an admin.');
      } else {
        console.error('Failed to load announcements', err);
        message.error('Failed to load announcements');
      }
    } finally {
      setLoading(false);
    }
  };

  // Load admin announcements only when we have an authenticated admin user
  useEffect(() => {
    if (user?.role === 'admin') {
      loadAnns();
    }
  }, [user]);

  const beforeUpload = (f: File) => {
    // accept only images
    const isImage = f.type.startsWith('image/');
    if (!isImage) {
      message.error('Only image files are allowed');
      return Upload.LIST_IGNORE;
    }
    // keep single file
    setFile(f);
    return Upload.LIST_IGNORE; // Prevent auto upload
  };

  const removeFile = () => setFile(null);

  const beforeEditUpload = (f: File) => {
    const isImage = f.type.startsWith('image/');
    if (!isImage) {
      message.error('Only image files are allowed');
      return Upload.LIST_IGNORE;
    }
    setEditFile(f);
    return Upload.LIST_IGNORE;
  };

  const handleSubmit = async () => {
    if (!text || text.trim() === '') return message.warning('Announcement text cannot be empty');
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('text', text.trim());
      if (file) form.append('image', file, file.name);
      // POST to admin announcements endpoint
      await adminAPI.createAnnouncement(form);
      message.success('Announcement posted');
      setText('');
      setFile(null);
    } catch (err: any) {
      console.error('Failed to post announcement', err);
      message.error(err?.response?.data?.message || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const openView = (item: any) => setViewing(item);

  const openEdit = (item: any) => {
    setEditing(item);
    setEditText(item.text || '');
    setEditFile(null);
  };

  const handleEditSave = async () => {
    if (!editing) return;
    try {
      const form = new FormData();
      form.append('text', editText.trim());
      if (editFile) form.append('image', editFile, editFile.name);
      await adminAPI.updateAnnouncement(editing._id, form);
      message.success('Updated');
      setEditing(null);
      setEditFile(null);
      setEditText('');
      loadAnns();
    } catch (err) {
      console.error(err);
      message.error('Update failed');
    }
  };

  return (
    <>
      <Card title={<Typography.Title level={4} style={{ margin: 0 }}>{user?.role === 'admin' ? 'Post Announcement' : 'Announcements'}</Typography.Title>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Show create form only to admins */}
          {user?.role === 'admin' && (
            <>
              <TextArea value={text} onChange={e => setText(e.target.value)} rows={6} placeholder="Write your announcement here" />

              <Upload beforeUpload={beforeUpload} onRemove={removeFile} accept="image/*" maxCount={1} showUploadList={{ showPreviewIcon: false }}>
                <Button icon={<UploadOutlined />}>Upload Image (optional)</Button>
              </Upload>

              {/* Image upload confirmation */}
              {file && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#237804' }}>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span style={{ fontWeight: 600 }}>Image uploaded:</span>
                  <span style={{ marginLeft: 6 }}>{file.name}</span>
                  <Button type="text" icon={<CloseCircleOutlined />} onClick={removeFile} style={{ marginLeft: 8 }} />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button type="primary" onClick={handleSubmit} loading={submitting} disabled={!text.trim()}>
                  Post Announcement
                </Button>
              </div>
            </>
          )}

          <div style={{ marginTop: 12 }}>
            <Typography.Title level={5} style={{ marginBottom: 8 }}>Existing Announcements</Typography.Title>
            <List
              loading={loading}
              dataSource={anns}
              renderItem={item => (
                <List.Item actions={
                  [
                    <Tooltip key="view" title="View" placement="top">
                      <Button shape="circle" size="small" icon={<EyeOutlined />} onClick={() => openView(item)} aria-label={`View announcement ${item._id}`} />
                    </Tooltip>,
                    user?.role === 'admin' ? (
                      <Tooltip key="edit" title="Edit" placement="top">
                        <Button shape="circle" size="small" icon={<EditOutlined />} onClick={() => openEdit(item)} aria-label={`Edit announcement ${item._id}`} />
                      </Tooltip>
                    ) : null,
                    user?.role === 'admin' ? (
                      <Popconfirm key="del" title="Delete announcement?" onConfirm={async () => {
                        try {
                          await adminAPI.deleteAnnouncement(item._id);
                          message.success('Deleted');
                          loadAnns();
                        } catch (err) {
                          console.error(err);
                          message.error('Delete failed');
                        }
                      }}>
                        <Tooltip title="Delete" placement="top">
                          <Button danger shape="circle" size="small" icon={<DeleteOutlined />} aria-label={`Delete announcement ${item._id}`} />
                        </Tooltip>
                      </Popconfirm>
                    ) : null
                  ].filter(Boolean) as any
                }>
                  <List.Item.Meta title={new Date(item.createdAt).toLocaleString()} description={item.text} />
                  {item.imagePath && <Image className="rounded-img" width={80} src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${item._id}/image`} />}
                </List.Item>
              )}
            />
          </div>
        </div>
      </Card>

      {/* View Modal */}
      <Modal
        title={viewing ? `Announcement - ${new Date(viewing.createdAt).toLocaleString()}` : 'Announcement'}
        open={!!viewing}
        onCancel={() => setViewing(null)}
        footer={[<Button key="close" onClick={() => setViewing(null)}>Close</Button>]}
      >
        {viewing && (
          <div>
            <p>{viewing.text}</p>
            {viewing.imagePath && <Image className="rounded-img rounded-img-lg" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${viewing._id}/image`} width={320} />}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit Announcement`}
        open={!!editing}
        onCancel={() => { setEditing(null); setEditFile(null); setEditText(''); }}
        onOk={handleEditSave}
        okText="Save"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <TextArea value={editText} onChange={e => setEditText(e.target.value)} rows={6} />
          <Upload beforeUpload={beforeEditUpload} onRemove={() => setEditFile(null)} accept="image/*" maxCount={1} showUploadList={{ showPreviewIcon: false }}>
            <Button icon={<UploadOutlined />}>Replace Image</Button>
          </Upload>
          {editFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#237804' }}>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontWeight: 600 }}>New image selected:</span>
              <span style={{ marginLeft: 6 }}>{editFile?.name}</span>
              <Button type="text" icon={<CloseCircleOutlined />} onClick={() => setEditFile(null)} style={{ marginLeft: 8 }} />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Announcements;
