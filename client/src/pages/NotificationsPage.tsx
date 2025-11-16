import React, { useEffect, useState } from 'react';
import { Table, Input, Tag, Badge, Button, Space, Dropdown, Menu, message, Card, Pagination, Grid, Typography, Modal } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import type { Key } from 'antd/es/table/interface';
import { SearchOutlined, DeleteOutlined, CheckCircleOutlined, FilterOutlined } from '@ant-design/icons';
import { notificationService, Notification } from '../services/notificationService';
import { notification as antdNotification } from 'antd';
import dayjs from 'dayjs';

const { useBreakpoint } = Grid;
const { Text } = Typography;

const typeOptions = [
  { label: 'All', value: 'all' },
  { label: 'Documents', value: 'documents' },
  { label: 'Inquiries', value: 'inquiries' },
  { label: 'System', value: 'system' },
];

const statusBadge = (read: boolean) => (
  <Badge color={read ? 'green' : 'blue'} text={read ? 'Read' : 'Unread'} />
);

const typeTag = (type: string) => {
  const t = type || '';
  const color = t === 'documents' ? 'blue' : t === 'inquiries' ? 'orange' : t === 'system' ? 'purple' : 'default';
  return <Tag color={color}>{t ? (t.charAt(0).toUpperCase() + t.slice(1)) : ''}</Tag>;
};

const NotificationsPage: React.FC = () => {
  const screens = useBreakpoint();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);


  useEffect(() => {
    fetchData();
    // Initialize socket connection (optionally pass token if needed)
    notificationService.initNotificationSocket();

    // Handler for new notification
    const handleNew = (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
      antdNotification.open({
        message: notif.title,
        description: notif.message,
        type: 'info',
        duration: 4,
      });
    };
    // Handler for updated notifications (e.g., marked as read)
    const handleUpdated = ({ ids }: { ids: string[] }) => {
      setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    };
    // Handler for deleted notifications
    const handleDeleted = ({ ids }: { ids: string[] }) => {
      setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
    };

    notificationService.onNotificationEvent('new-notification', handleNew);
    notificationService.onNotificationEvent('notifications-updated', handleUpdated);
    notificationService.onNotificationEvent('notifications-deleted', handleDeleted);

    return () => {
      notificationService.offNotificationEvent('new-notification', handleNew);
      notificationService.offNotificationEvent('notifications-updated', handleUpdated);
      notificationService.offNotificationEvent('notifications-deleted', handleDeleted);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await notificationService.getNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  // Defensive: ensure notifications is always an array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const filtered = safeNotifications.filter(n => {
    const matchesType = typeFilter === 'all' || n.type === typeFilter;
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.message.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const paged = Array.isArray(filtered) ? filtered.slice((page - 1) * pageSize, page * pageSize) : [];

  const handleMarkRead = async () => {
    await Promise.all(selectedRowKeys.map(id => notificationService.markAsRead(String(id))));
    setSelectedRowKeys([]);
    fetchData();
    message.success('Marked as read');
  };

  // Delete action removed: notificationService.deleteNotification does not exist
  const handleDelete = async () => {
    setConfirmDelete(false);
    message.info('Delete action is not implemented.');
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Notification) => (
        <Text strong={!record.read}>{text}</Text>
      ),
      sorter: (a: Notification, b: Notification) => a.title.localeCompare(b.title),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      render: (text: string) => <Text ellipsis={{ tooltip: text }}>{text}</Text>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => typeTag(type),
      filters: typeOptions.slice(1).map(opt => ({ text: opt.label, value: opt.value })),
      onFilter: (value: boolean | Key, record: Notification) => record.type === value,
    },
    {
      title: 'Date/Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).format('MMM D, YYYY h:mm A'),
      sorter: (a: Notification, b: Notification) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix(),
  defaultSortOrder: 'descend' as SortOrder,
    },
    {
      title: 'Status',
      dataIndex: 'read',
      key: 'read',
      render: (read: boolean) => statusBadge(read),
      filters: [
        { text: 'Unread', value: false },
        { text: 'Read', value: true },
      ],
  onFilter: (value: boolean | Key, record: Notification) => record.read === value,
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  // Responsive: show cards on mobile
  if (!screens.md) {
    return (
      <div style={{ padding: 16 }}>
        <Input
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Dropdown popupRender={() => (
            <Menu onClick={({ key }) => setTypeFilter(key)}>
              {typeOptions.map(opt => (
                <Menu.Item key={opt.value}>{opt.label}</Menu.Item>
              ))}
            </Menu>
        )}>
          <Button icon={<FilterOutlined />} style={{ marginBottom: 16 }}>
            {typeOptions.find(opt => opt.value === typeFilter)?.label || 'Type'}
          </Button>
        </Dropdown>
  {(Array.isArray(paged) ? paged : []).map(n => (
          <Card
            key={n.id}
            style={{ marginBottom: 12, borderLeft: n.read ? '4px solid #52c41a' : '4px solid #1677ff' }}
            bodyStyle={{ padding: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong={!n.read}>{n.title}</Text>
              <Text type="secondary" ellipsis={{ tooltip: n.message }}>{n.message}</Text>
              <Space>
                {typeTag(n.type ?? 'unknown')}
                {statusBadge(n.read)}
                <Text type="secondary">{dayjs(n.createdAt).format('MMM D, YYYY h:mm A')}</Text>
              </Space>
            </Space>
          </Card>
        ))}
        <Pagination
          current={page}
          pageSize={pageSize}
          total={filtered.length}
          onChange={setPage}
          style={{ marginTop: 16, textAlign: 'center' }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search notifications..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        <Dropdown popupRender={() => (
            <Menu onClick={({ key }) => setTypeFilter(key)}>
              {typeOptions.map(opt => (
                <Menu.Item key={opt.value}>{opt.label}</Menu.Item>
              ))}
            </Menu>
        )}>
          <Button icon={<FilterOutlined />}>{typeOptions.find(opt => opt.value === typeFilter)?.label || 'Type'}</Button>
        </Dropdown>
        <Button
          icon={<CheckCircleOutlined />}
          disabled={selectedRowKeys.length === 0}
          onClick={handleMarkRead}
        >
          Mark as Read
        </Button>
        {/* Delete button disabled since deleteNotification is not implemented */}
        <Button
          icon={<DeleteOutlined />}
          danger
          disabled
        >
          Delete
        </Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
  dataSource={Array.isArray(paged) ? paged : []}
        loading={loading}
        rowSelection={rowSelection}
        pagination={false}
        onChange={(pagination, filters, sorter: any) => {
          if (sorter && sorter.field === 'createdAt') {
            setNotifications([...notifications].sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix()));
          }
        }}
      />
      <Pagination
        current={page}
        pageSize={pageSize}
        total={filtered.length}
        onChange={setPage}
        style={{ marginTop: 16, textAlign: 'right' }}
      />
      {/* Delete modal disabled since deleteNotification is not implemented */}
      <Modal
        open={confirmDelete}
        onOk={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        okText="Delete"
        okButtonProps={{ danger: true }}
        title="Delete Notifications"
      >
        Delete action is not implemented.
      </Modal>
    </div>
  );
};

export default NotificationsPage;

// Notification type is now imported from notificationService
