
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Spin,
  Form,
  Input,
  message,
  Select,
  Drawer,
  Avatar,
  Dropdown,
  Menu,
  DatePicker,
  Row,
  Col,
  Breadcrumb,
  Popconfirm,
  Collapse,
  Modal,
  Tabs,
  Upload,
} from 'antd';
import { EditOutlined, DeleteOutlined, MoreOutlined, EyeOutlined, StopOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SortOrder } from 'antd/es/table/interface';
import { adminAPI, staffRegister } from '../../services/api';
import dayjs from 'dayjs';
import AvatarImage from '../AvatarImage';

const roleOptions = [
  { text: 'Admin', value: 'admin' },
  { text: 'Staff', value: 'staff' },
  { text: 'Resident', value: 'resident' },
];
const statusOptions = [
  { text: 'Active', value: true },
  { text: 'Inactive', value: false },
];

// ...existing code...
// Columns will be defined inside the component to access state/handlers


const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>(undefined);
  const [dateRange, setDateRange] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedResident, setSelectedResident] = useState<any | null>(null);
  const [residentLoading, setResidentLoading] = useState(false);
  const [showFullResident, setShowFullResident] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [userFormValues, setUserFormValues] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const pendingUploadRef = React.useRef<Promise<any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editFormValues, setEditFormValues] = useState<any>({});
  // Helper to generate a random unique Barangay ID
  function generateBarangayID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const length = Math.floor(Math.random() * 9) + 4; // 4-12
    let id = '';
    for (let i = 0; i < length; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  const fetchUsers = () => {
    setLoading(true);
    adminAPI.getUsers()
      .then((data: any[]) => {
        setUsers(data.map((user, idx) => ({
          key: user._id || idx,
          _id: user._id || null,
          fullName: user.fullName || user.username || '',
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          avatar: user.avatar || null,
          barangayId: user.barangayId || user.barangayID || user.barangay_id || null,
        })));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch resident info for a user when drawer opens
  const fetchResidentForUser = async (user: any) => {
    if (!user) return;
    setResidentLoading(true);
    try {
      // Prefer fetching by barangayId when available
      const barangayId = user.barangayId || user.barangayID || user.barangay_id;
      if (barangayId) {
        const resp: any = await adminAPI.getResidentByBarangayID(barangayId);
        // server returns { resident, user }
        setSelectedResident(resp?.resident || null);
      } else if (user._id) {
        const resp: any = await adminAPI.getUserWithResident(user._id);
        setSelectedResident(resp?.resident || null);
      } else {
        setSelectedResident(null);
      }
    } catch (err) {
      console.error('Failed to fetch resident for user', err);
      setSelectedResident(null);
    } finally {
      setResidentLoading(false);
    }
  };

  // Disable a user (optionally suspend until a date). Updates UI after success.
  const handleDisableUser = async (userId: string, suspendedUntil?: string | null) => {
    if (!userId) return;
    try {
      message.loading({ content: 'Disabling user...', key: 'disable' });
      const payload = suspendedUntil ? { suspendedUntil } : {};
      const res: any = await adminAPI.disableUser(userId, payload);
      message.success({ content: 'User disabled', key: 'disable', duration: 2 });
      // Refresh list and selected user
      await fetchUsers();
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(res.user || res);
      }
    } catch (err) {
      console.error('Failed to disable user', err);
      message.error('Failed to disable user');
    }
  };

  const handleEnableUser = async (userId: string) => {
    if (!userId) return;
    try {
      message.loading({ content: 'Enabling user...', key: 'enable' });
      const res: any = await adminAPI.enableUser(userId);
      message.success({ content: 'User enabled', key: 'enable', duration: 2 });
      await fetchUsers();
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(res.user || res);
      }
    } catch (err) {
      console.error('Failed to enable user', err);
      message.error('Failed to enable user');
    }
  };

  // Demote a staff user back to resident
  const handleDemoteUser = async (userId: string) => {
    if (!userId) return;
    try {
      message.loading({ content: 'Demoting user...', key: 'demote' });
      const res: any = await adminAPI.demoteUser(userId);
      message.success({ content: 'User demoted to resident', key: 'demote', duration: 2 });
      await fetchUsers();
      if (selectedUser && selectedUser._id === userId) {
        setSelectedUser(res.user || res);
      }
    } catch (err) {
      console.error('Failed to demote user', err);
      message.error('Failed to demote user');
    }
  };

  // add-user helpers removed (UI buttons were removed)

  // (registration helpers removed — staff registration handled elsewhere)

  // Filtered and searched users
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter ? user.role === roleFilter : true;
    const matchesStatus = statusFilter !== undefined ? user.isActive === statusFilter : true;
    const matchesDate = dateRange && dateRange.length === 2
      ? dayjs(user.createdAt).isAfter(dateRange[0], 'day') && dayjs(user.createdAt).isBefore(dateRange[1], 'day')
      : true;
    return matchesSearch && matchesRole && matchesStatus && matchesDate;
  });

  // Table columns with avatar, tags, actions, sticky header, selection
  const columns = [
    {
      title: 'Name',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text: string, record: any) => (
        <Space>
          <Avatar style={{ backgroundColor: '#1890ff', verticalAlign: 'middle' }}>
            {record.avatar ? <AvatarImage src={record.avatar} size={36} /> : (
              (() => {
                let displayUser = record;
                try {
                  const stored = localStorage.getItem('userProfile');
                  if (stored) displayUser = JSON.parse(stored);
                } catch (err) {}
                return displayUser?.profileImage || displayUser?.profileImageId
                  ? <AvatarImage user={displayUser} size={36} />
                  : ((text && text.length > 0) ? text.charAt(0).toUpperCase() : '?');
              })()
            )}
          </Avatar>
          <b>{text}</b>
        </Space>
      ),
      sorter: (a: any, b: any) => a.fullName.localeCompare(b.fullName),
      sortDirections: ['ascend' as SortOrder, 'descend' as SortOrder],
      fixed: 'left' as const,
    },
    {
      title: 'Barangay ID',
      dataIndex: 'barangayId',
      key: 'barangayId',
      render: (id: string) => id || '—',
      width: 160,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      sorter: (a: any, b: any) => a.email.localeCompare(b.email),
      sortDirections: ['ascend' as SortOrder, 'descend' as SortOrder],
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const r = role || '';
        return <Tag color={r === 'admin' ? 'magenta' : r === 'staff' ? 'blue' : 'green'}>{r ? (r.charAt(0).toUpperCase() + r.slice(1)) : ''}</Tag>;
      },
      filters: roleOptions,
      onFilter: (value: any, record: any) => record.role === value,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>,
      filters: statusOptions,
      onFilter: (value: any, record: any) => record.isActive === value,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
      sorter: (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      sortDirections: ['ascend' as SortOrder, 'descend' as SortOrder],
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right' as const,
      render: (_: any, record: any) => (
        <Dropdown
          popupRender={() => (
            <Menu>
              <Menu.Item key="edit" icon={<EditOutlined />} onClick={() => { setSelectedUser(record); setDrawerOpen(true); }}>
                Edit
              </Menu.Item>
              <Menu.Item key="logs" icon={<EyeOutlined />} onClick={() => { /* View logs logic */ }}>
                View Logs
              </Menu.Item>
              <Menu.Item key="deactivate" icon={<StopOutlined />} onClick={() => { /* Deactivate logic */ }}>
                Deactivate
              </Menu.Item>
              <Menu.Item key="disable_now" icon={<StopOutlined />} onClick={async () => {
                if (!record || !record._id) { message.error('No user selected'); return; }
                // confirm and disable immediately
                Modal.confirm({
                  title: 'Disable user',
                  content: `Are you sure you want to disable ${record.fullName || record.email || record._id}?`,
                  onOk: async () => { await handleDisableUser(record._id); }
                });
              }}>
                Disable
              </Menu.Item>
              {record.role === 'staff' && (
                <Menu.Item key="demote" icon={<ReloadOutlined />} onClick={async () => {
                  if (!record || !record._id) { message.error('No user selected'); return; }
                  Modal.confirm({
                    title: 'Demote user',
                    content: `Are you sure you want to demote ${record.fullName || record.email || record._id} to resident?`,
                    onOk: async () => { await handleDemoteUser(record._id); }
                  });
                }}>
                  Demote to Resident
                </Menu.Item>
              )}
              <Menu.Item key="enable_now" icon={<CheckOutlined />} onClick={async () => {
                if (!record || !record._id) { message.error('No user selected'); return; }
                Modal.confirm({
                  title: 'Enable user',
                  content: `Are you sure you want to enable ${record.fullName || record.email || record._id}?`,
                  onOk: async () => { await handleEnableUser(record._id); }
                });
              }}>
                Enable
              </Menu.Item>
              <Menu.Item key="delete" icon={<DeleteOutlined />} danger onClick={() => { /* Delete logic */ }}>
                Delete
              </Menu.Item>
            </Menu>
          )}
          trigger={['click']}
        >
          <Button icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ];

  // Bulk actions bar
  const hasSelection = selectedRowKeys.length > 0;
  const bulkBar = hasSelection && (
    <Space style={{ marginBottom: 16 }}>
      <Button icon={<CheckOutlined />} onClick={() => {/* bulk activate */}}>Activate</Button>
      <Button icon={<StopOutlined />} onClick={() => {/* bulk deactivate */}}>Deactivate</Button>
      <Popconfirm title="Are you sure to delete selected users?" onConfirm={() => {/* bulk delete */}} okText="Yes" cancelText="No">
        <Button icon={<DeleteOutlined />} danger>Delete</Button>
      </Popconfirm>
      <span style={{ marginLeft: 8 }}>{`Selected ${selectedRowKeys.length} users`}</span>
    </Space>
  );

  // Pagination info
  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, filteredUsers.length);

  return (
    <div>
      <Card
        style={{ marginBottom: 16, borderRadius: 8, background: '#fff' }}
        bodyStyle={{ padding: 0 }}
        bordered={false}
        title={
          <Row align="middle" justify="space-between">
            <Col>
              <Typography.Title level={4} style={{ margin: 0 }}>User Management</Typography.Title>
              <Breadcrumb>
                <Breadcrumb.Item>Admin</Breadcrumb.Item>
                <Breadcrumb.Item>User Management</Breadcrumb.Item>
              </Breadcrumb>
            </Col>
            <Col>
              <Space>
                {/* Add-user buttons removed per request */}
              </Space>
            </Col>
          </Row>
        }
      />
      <Card style={{ borderRadius: 16, boxShadow: '0 2px 16px #40c9ff11' }}>
        <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
          <Col>
            <Input.Search
              placeholder="Search by name or email"
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
            />
          </Col>
          <Col>
            <Select
              placeholder="Role"
              allowClear
              style={{ width: 120 }}
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleOptions}
            />
          </Col>
          <Col>
            <Select
              placeholder="Status"
              allowClear
              style={{ width: 120 }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />
          </Col>
          <Col>
            <DatePicker.RangePicker
              value={dateRange}
              onChange={setDateRange}
              style={{ width: 220 }}
              allowClear
            />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => {
              setSearch('');
              setRoleFilter(undefined);
              setStatusFilter(undefined);
              setDateRange(null);
            }}>Reset Filters</Button>
          </Col>
        </Row>
        {bulkBar}
        {loading ? <Spin size="large" /> : (
          <Table
            columns={columns}
            dataSource={filteredUsers}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
            }}
            pagination={{
              pageSize,
              current: page,
              onChange: setPage,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              onShowSizeChange: (_current, size) => setPageSize(size),
              showTotal: (total) => `Showing ${startIdx}–${endIdx} of ${total} users`,
            }}
            onRow={record => ({
              onClick: () => {
                setSelectedUser(record);
                setDrawerOpen(true);
                fetchResidentForUser(record);
              },
            })}
            style={{ cursor: 'pointer' }}
            scroll={{ x: 'max-content' }}
            sticky
          />
        )}
      </Card>

      <Drawer
        title={selectedUser ? selectedUser.fullName : 'User Profile'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={400}
      >
        {selectedUser && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Row align="middle" gutter={16}>
              <Col>
                  <Avatar size={64} style={{ backgroundColor: '#1890ff' }}>
                    {selectedResident && (selectedResident.profileImage || selectedResident.profileImageId) ? (
                      selectedResident.profileImage ? (
                        <AvatarImage src={selectedResident.profileImage} size={64} />
                      ) : (
                        <AvatarImage src={`/api/resident/personal-info/avatar/${selectedResident.profileImageId}`} size={64} />
                      )
                    ) : selectedUser.avatar ? (
                      <AvatarImage src={selectedUser.avatar} size={64} />
                    ) : (
                      (() => {
                        let displayUser = selectedUser;
                        try {
                          const stored = localStorage.getItem('userProfile');
                          if (stored) displayUser = JSON.parse(stored);
                        } catch (err) {}
                        return displayUser?.profileImage || displayUser?.profileImageId
                          ? <AvatarImage user={displayUser} size={64} />
                          : ((selectedUser.fullName && selectedUser.fullName.length > 0) ? selectedUser.fullName.charAt(0).toUpperCase() : '?');
                      })()
                    )}
                  </Avatar>
                </Col>
              <Col>
                <Typography.Title level={5} style={{ margin: 0 }}>{selectedUser.fullName}</Typography.Title>
                <div style={{ marginTop: 4 }}>
                  <Tag color={selectedUser.isActive ? 'green' : 'red'} style={{ marginRight: 8 }}>{selectedUser.isActive ? 'Active' : 'Inactive'}</Tag>
                  <Tag color={selectedUser.role === 'admin' ? 'magenta' : selectedUser.role === 'staff' ? 'blue' : 'green'}>{(selectedUser.role ? (selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1)) : '')}</Tag>
                </div>
                {selectedUser.barangayId && (
                  <div style={{ marginTop: 8 }}>
                    <Typography.Text type="secondary">Barangay ID: </Typography.Text>
                    <Typography.Text copyable>{selectedUser.barangayId}</Typography.Text>
                  </div>
                )}
              </Col>
            </Row>
            <Typography.Text strong>Email:</Typography.Text>
            <Typography.Text>{selectedUser.email}</Typography.Text>

            {/* Resident Information section (prefer resident container) */}
            <Typography.Title level={5} style={{ marginTop: 12 }}>Resident Information</Typography.Title>
            {residentLoading ? (
              <Spin />
            ) : selectedResident ? (
              <>
                {/* Personal / Identity */}
                <Typography.Title level={5}>Personal Information</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Typography.Text strong>Full Name:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{`${selectedResident.firstName || ''} ${selectedResident.middleName || ''} ${selectedResident.lastName || ''}`.trim() || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Barangay ID:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.barangayID || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={12}>
                    <Typography.Text strong>Username:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.username || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Email:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.email || selectedUser.email || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={12}>
                    <Typography.Text strong>Phone:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.contactNumber || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Landline:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.landlineNumber || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={24}>
                    <Typography.Text strong>Address:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.address || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={12}>
                    <Typography.Text strong>DOB:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.birthDate ? dayjs(selectedResident.birthDate).format('YYYY-MM-DD') : (selectedResident.birthDate || 'N/A')}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Sex/Gender:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.sex || selectedResident.gender || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={12}>
                    <Typography.Text strong>Civil/Marital Status:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.civilStatus || selectedResident.maritalStatus || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Nationality:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.nationality || 'N/A'}</Typography.Text>
                  </Col>

                  <Col span={12}>
                    <Typography.Text strong>Occupation:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.occupation || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Education:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.educationalAttainment || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                {/* Identification & IDs */}
                <Typography.Title level={5} style={{ marginTop: 12 }}>Identification</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Typography.Text strong>Passport #:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.passportNumber || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Gov ID #:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.governmentIdNumber || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>TIN:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.tin || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Barangay Clearance #:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.barangayClearanceNumber || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                {/* Family */}
                <Typography.Title level={5} style={{ marginTop: 12 }}>Family</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={24}>
                    <Typography.Text strong>Spouse:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.spouseName ? `${selectedResident.spouseName} ${selectedResident.spouseLastName || ''}` : 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Number of Children:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{(selectedResident.numberOfChildren || selectedResident.numberOfChildren === 0) ? selectedResident.numberOfChildren : 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Children Names/Ages:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.childrenNames ? `${selectedResident.childrenNames} (${selectedResident.childrenAges || ''})` : 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Mother:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.motherName || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Father:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.fatherName || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                {/* Emergency */}
                <Typography.Title level={5} style={{ marginTop: 12 }}>Emergency Contact</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Typography.Text strong>Contact Name:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.emergencyContactName || selectedResident.emergencyContact || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Relationship:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.emergencyContactRelationship || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Emergency Phone:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.emergencyContact || selectedResident.spouseContactNumber || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                {/* Business */}
                <Typography.Title level={5} style={{ marginTop: 12 }}>Business / Employment</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={24}>
                    <Typography.Text strong>Business Name:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.businessName || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Business Type:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.businessType || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Business Contact:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.businessContactNumber || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={24}>
                    <Typography.Text strong>Business Address:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.businessAddress || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                {/* Other fields / meta */}
                <Typography.Title level={5} style={{ marginTop: 12 }}>Other</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={12}>
                    <Typography.Text strong>Blood Type:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.bloodType || 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Disability Status:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.disabilityStatus || 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                <Row style={{ marginTop: 12 }} gutter={[8, 8]}>
                  <Col span={12}>
                    <Typography.Text strong>Created At:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.createdAt ? dayjs(selectedResident.createdAt).format('YYYY-MM-DD HH:mm') : 'N/A'}</Typography.Text>
                  </Col>
                  <Col span={12}>
                    <Typography.Text strong>Last Login:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedUser.lastLogin ? dayjs(selectedUser.lastLogin).format('YYYY-MM-DD HH:mm') : 'N/A'}</Typography.Text>
                  </Col>
                </Row>

                <Typography.Title level={5} style={{ marginTop: 12 }}>Social Media / Links</Typography.Title>
                <Row gutter={[8, 8]}>
                  <Col span={24}>
                    <Typography.Text strong>Facebook:</Typography.Text>
                    {selectedResident.facebook ? (
                      <Typography.Text style={{ display: 'block' }}>
                        <a href={selectedResident.facebook} target="_blank" rel="noreferrer">{selectedResident.facebook}</a>
                      </Typography.Text>
                    ) : <Typography.Text style={{ display: 'block' }}>N/A</Typography.Text>}
                  </Col>
                  <Col span={24}>
                    <Typography.Text strong>Instagram:</Typography.Text>
                    {selectedResident.instagram ? (
                      <Typography.Text style={{ display: 'block' }}>
                        <a href={selectedResident.instagram} target="_blank" rel="noreferrer">{selectedResident.instagram}</a>
                      </Typography.Text>
                    ) : <Typography.Text style={{ display: 'block' }}>N/A</Typography.Text>}
                  </Col>
                  <Col span={24}>
                    <Typography.Text strong>Other Link:</Typography.Text>
                    <Typography.Text style={{ display: 'block' }}>{selectedResident.website || 'N/A'}</Typography.Text>
                  </Col>
                </Row>
              </>
            ) : (
              <Typography.Text type="warning">This resident doesn't have resident info yet.</Typography.Text>
            )}

            {/* Social Media section */}
            <Typography.Title level={5} style={{ marginTop: 12 }}>Social Media</Typography.Title>
            <Row gutter={[8, 8]}>
              <Col span={24}>
                <Typography.Text strong>Facebook:</Typography.Text>
                {selectedUser.facebook ? (
                  <Typography.Text style={{ display: 'block' }}>
                    <a href={selectedUser.facebook} target="_blank" rel="noreferrer">{selectedUser.facebook}</a>
                  </Typography.Text>
                ) : <Typography.Text style={{ display: 'block' }}>N/A</Typography.Text>}
              </Col>
              <Col span={24}>
                <Typography.Text strong>Twitter:</Typography.Text>
                {selectedUser.twitter ? (
                  <Typography.Text style={{ display: 'block' }}>
                    <a href={selectedUser.twitter} target="_blank" rel="noreferrer">{selectedUser.twitter}</a>
                  </Typography.Text>
                ) : <Typography.Text style={{ display: 'block' }}>N/A</Typography.Text>}
              </Col>
              <Col span={24}>
                <Typography.Text strong>Instagram:</Typography.Text>
                {selectedUser.instagram ? (
                  <Typography.Text style={{ display: 'block' }}>
                    <a href={selectedUser.instagram} target="_blank" rel="noreferrer">{selectedUser.instagram}</a>
                  </Typography.Text>
                ) : <Typography.Text style={{ display: 'block' }}>N/A</Typography.Text>}
              </Col>
            </Row>

            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Space>
                <Button icon={<EditOutlined />} onClick={() => {
                  setUserFormValues(selectedUser || {});
                  setEditUserModalOpen(true);
                }}>Edit User</Button>
                <Button onClick={() => {
                  if (selectedResident) {
                    setEditFormValues(selectedResident || {});
                    setEditModalOpen(true);
                  } else {
                    message.warning('No resident data to edit');
                  }
                }}>Edit Resident</Button>
              </Space>

              <Space>
                <Button icon={<EyeOutlined />} onClick={() => { /* view logs action (kept as placeholder) */ }}>View Logs</Button>
                {selectedUser && selectedUser.role === 'staff' && (
                  <Popconfirm
                    title={`Demote ${selectedUser.fullName || selectedUser.email}?`}
                    onConfirm={async () => { if (selectedUser) await handleDemoteUser(selectedUser._id); }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button icon={<ReloadOutlined />}>Demote</Button>
                  </Popconfirm>
                )}
                {selectedUser && selectedUser.isActive ? (
                  <Popconfirm
                    title={`Disable ${selectedUser.fullName || selectedUser.email}?`}
                    onConfirm={async () => { await handleDisableUser(selectedUser._id); }}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button icon={<StopOutlined />} danger>Deactivate</Button>
                  </Popconfirm>
                ) : (
                  <Button icon={<CheckOutlined />} onClick={async () => { if (selectedUser) await handleEnableUser(selectedUser._id); }}>Enable</Button>
                )}
              </Space>
            </div>
            {/* Full resident JSON view removed per design */}
          </Space>
        )}
      </Drawer>

      <Modal
        title="Edit Resident"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={async () => {
          if (!selectedResident) return;
          try {
            // merge existing resident with form changes; server will whitelist allowed fields
            const payload: any = { ...selectedResident, ...editFormValues };
            const res = await adminAPI.updateResident(selectedResident._id, payload);
            message.success('Resident updated');
            setSelectedResident(res?.resident || { ...selectedResident, ...payload });
            setEditModalOpen(false);
          } catch (err: any) {
            console.error('Failed to save resident', err);
            message.error('Failed to update resident.');
          }
        }}
        width={900}
      >
        {/* Tabbed structured form with validation and avatar upload */}
        <Form
          layout="vertical"
          initialValues={{ ...(selectedResident || {}), barangayID: selectedResident?.barangayID || selectedUser?.barangayId }}
          onValuesChange={(_, values) => setEditFormValues(values as any)}
        >
          <Tabs defaultActiveKey="personal">
            <Tabs.TabPane tab="Personal" key="personal">
              <Row gutter={8}>
                <Col span={8}><Form.Item name="firstName" label="First Name" rules={[{ required: true, message: 'First name is required' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="middleName" label="Middle Name"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="lastName" label="Last Name" rules={[{ required: true, message: 'Last name is required' }]}><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="username" label="Username"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="barangayID" label="Barangay ID" rules={[{ required: true, message: 'Barangay ID is required' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="contactNumber" label="Contact Number" rules={[{ pattern: /^[0-9+\-() ]{6,20}$/, message: 'Enter a valid phone number' }]}><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="landlineNumber" label="Landline"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="address" label="Address"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="birthDate" label="Birth Date"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="placeOfBirth" label="Place of Birth"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="age" label="Age"><Input type="number" /></Form.Item></Col>
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane tab="IDs" key="ids">
              <Row gutter={8}>
                <Col span={8}><Form.Item name="passportNumber" label="Passport #"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="governmentIdNumber" label="Government ID #"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="tin" label="TIN"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="bloodType" label="Blood Type"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="disabilityStatus" label="Disability Status"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="educationalAttainment" label="Education"><Input /></Form.Item></Col>
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane tab="Family" key="family">
              <Row gutter={8}>
                <Col span={8}><Form.Item name="spouseName" label="Spouse Name"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="spouseMiddleName" label="Spouse Middle"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="spouseLastName" label="Spouse Last"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="spouseAge" label="Spouse Age"><Input type="number" /></Form.Item></Col>
                <Col span={8}><Form.Item name="spouseBirthDate" label="Spouse DOB"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="spouseOccupation" label="Spouse Occupation"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="numberOfChildren" label="# Children"><Input type="number" /></Form.Item></Col>
                <Col span={8}><Form.Item name="childrenNames" label="Children Names"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="childrenAges" label="Children Ages"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Form.Item name="motherName" label="Mother's Name"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="fatherName" label="Father's Name"><Input /></Form.Item></Col>
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane tab="Business" key="business">
              <Row gutter={8}>
                <Col span={12}><Form.Item name="businessName" label="Business Name"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="businessType" label="Business Type"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={12}><Form.Item name="businessContactNumber" label="Business Contact"><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="businessEmail" label="Business Email"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={24}><Form.Item name="businessAddress" label="Business Address"><Input /></Form.Item></Col>
              </Row>
              <Row gutter={8}>
                <Col span={8}><Form.Item name="registrationNumber" label="Registration #"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="businessPermitNumber" label="Business Permit #"><Input /></Form.Item></Col>
                <Col span={8}><Form.Item name="barangayClearanceNumber" label="Barangay Clearance #"><Input /></Form.Item></Col>
              </Row>
            </Tabs.TabPane>

            <Tabs.TabPane tab="Avatar / Media" key="media">
              <Row gutter={8}>
                <Col span={12}>
                  <Form.Item label="Upload Profile Image">
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={() => false}
                      customRequest={(options: any) => {
                        if (!selectedResident) return;
                        const file = options.file as File;
                        setUploading(true);
                        setUploadProgress(10);
                        // create a pending upload promise so modal save can await it
                        const p = (async () => {
                          try {
                            // small simulated progress
                            setUploadProgress(30);
                            const resp: any = await adminAPI.uploadResidentAvatar(selectedResident._id, file);
                            setUploadProgress(80);
                            if (resp?.resident) {
                              setSelectedResident(resp.resident);
                              setEditFormValues((prev: any) => ({ ...prev, profileImage: resp.resident.profileImage, profileImageId: resp.resident.profileImageId }));
                              setUploadPreview(resp.resident.profileImage || `/api/resident/personal-info/avatar/${resp.fileId}`);
                            } else if (resp?.fileId) {
                              setEditFormValues((prev: any) => ({ ...prev, profileImage: `/api/resident/personal-info/avatar/${resp.fileId}`, profileImageId: resp.fileId }));
                              setUploadPreview(`/api/resident/personal-info/avatar/${resp.fileId}`);
                            }
                            setUploadProgress(100);
                            message.success('Avatar uploaded');
                            return resp;
                          } catch (e: any) {
                            console.error('Avatar upload failed', e);
                            message.error(e?.message || 'Avatar upload failed');
                            throw e;
                          } finally {
                            setUploading(false);
                          }
                        })();
                        pendingUploadRef.current = p;
                        return p as any;
                      }}
                    >
                      <Button type="default">Choose Image</Button>
                    </Upload>
                    {uploading && <div style={{ marginTop: 8 }}>Uploading: {uploadProgress}%</div>}
                    {uploadPreview && <div style={{ marginTop: 8 }}><img src={uploadPreview} alt="preview" style={{ maxWidth: 120, maxHeight: 120, borderRadius: 6 }} /></div>}
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="profileImage" label="Profile Image URL"><Input /></Form.Item>
                  <Form.Item name="profileImageId" label="Profile Image ID"><Input /></Form.Item>
                </Col>
              </Row>
            </Tabs.TabPane>
          </Tabs>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={editUserModalOpen}
        onCancel={() => setEditUserModalOpen(false)}
        onOk={async () => {
          try {
            // Do not allow changing barangayId or role from this modal (read-only shown)
            const payload = { ...userFormValues };
            // Remove non-editable fields if present
            delete payload.barangayId;
            delete payload.role;
            // Call admin API to update user
            await adminAPI.updateUser(selectedUser._id, payload);
            message.success('User updated');
            // Update local list and selectedUser
            const updatedUsers = users.map(u => u._id === selectedUser._id ? { ...u, ...payload } : u);
            setUsers(updatedUsers);
            setSelectedUser((prev: any) => prev ? { ...prev, ...payload } : prev);
            setEditUserModalOpen(false);
          } catch (err) {
            console.error('Failed to update user', err);
            message.error('Failed to update user');
          }
        }}
        width={600}
      >
        <Form layout="vertical" initialValues={userFormValues} onValuesChange={(_, vals) => setUserFormValues(vals)}>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="fullName" label="Full Name" rules={[{ required: true, message: 'Full name required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={12}>
              <Form.Item name="isActive" label="Active">
                <Select options={[{ label: 'Active', value: true }, { label: 'Inactive', value: false }]} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Role">
                <Input value={selectedUser?.role} disabled />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col span={24}>
              <Form.Item label="Barangay ID">
                <Input value={selectedUser?.barangayId || selectedUser?.barangayID || ''} disabled />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Staff Registration Modal */}
      {/* Staff Registration Modal removed */}

      {/* User Registration Modal */}
      {/* User Registration Modal removed */}
  </div>
  );
};

export default UserManagement;
