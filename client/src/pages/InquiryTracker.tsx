import React, { useEffect, useState, useMemo } from 'react';
import { Table, Spin, Empty, Tag, Typography, notification, DatePicker, Select, Space, Button } from 'antd';
import { contactAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../utils/formatDate';

const getStatusTag = (status?: string) => {
  const statusColors: { [k: string]: string } = {
    'pending': 'gold',
    'open': 'gold',
    'approved': 'success',
    'resolved': 'green',
    'rejected': 'error'
  };
  const s = (status || '').toString().toLowerCase();
  return <Tag color={statusColors[s] || 'default'}>{(status || '').toUpperCase() || 'UNKNOWN'}</Tag>;
};

const InquiryTracker: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<any[] | null>(null);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await contactAPI.getAllInquiries();
      setInquiries(Array.isArray(res) ? res : (res && res.items) ? res.items : []);
    } catch (err) {
      console.error('Failed to load inquiries', err);
      notification.error({ message: 'Failed to load inquiries' });
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const types = useMemo(() => {
    return Array.from(new Set(inquiries.map(i => (i.type || 'General'))));
  }, [inquiries]);

  const filtered = useMemo(() => {
    return (inquiries || []).filter((i: any) => {
      if (statusFilter && (!i.status || i.status.toString().toLowerCase() !== statusFilter.toLowerCase())) return false;
      const t = (i.type || 'General');
      if (typeFilter && t.toString().toLowerCase() !== typeFilter.toString().toLowerCase()) return false;
      if (dateRange && dateRange[0] && dateRange[1] && i.createdAt) {
        try {
          const start = dateRange[0].toDate ? dateRange[0].toDate() : new Date(dateRange[0]);
          const end = dateRange[1].toDate ? dateRange[1].toDate() : new Date(dateRange[1]);
          const d = new Date(i.createdAt);
          if (d < start || d > end) return false;
        } catch (e) {
          // ignore parsing errors
        }
      }
      return true;
    });
  }, [inquiries, statusFilter, typeFilter, dateRange]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Inquiry Tracker</Typography.Title>
        <Typography.Text type="secondary">Showing {inquiries.length} records</Typography.Text>
      </div>

      <Spin spinning={loading}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Select allowClear placeholder="Status" style={{ width: 160 }} value={statusFilter ?? undefined} onChange={(v) => setStatusFilter(v || null)}>
              <Select.Option value="open">Open</Select.Option>
              <Select.Option value="in-progress">In Progress</Select.Option>
              <Select.Option value="resolved">Resolved</Select.Option>
            </Select>
            <Select allowClear placeholder="Type" style={{ width: 180 }} value={typeFilter ?? undefined} onChange={(v) => setTypeFilter(v || null)}>
              {types.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
            <DatePicker.RangePicker onChange={(vals) => setDateRange(vals ? vals.filter(Boolean) : null)} />
            <Button onClick={() => { setStatusFilter(null); setTypeFilter(null); setDateRange(null); }}>Reset</Button>
          </Space>
        </div>

        {filtered.length === 0 && !loading ? (
          <Empty description="No inquiries" />
        ) : (
          <Table
            dataSource={filtered.slice().sort((a,b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))}
            rowKey={(r:any) => r._id}
            pagination={{ pageSize: 12 }}
            onRow={(record) => ({
              onClick: () => {
                // go to staff inbox and open the thread
                navigate('/staff/inbox', { state: { openInquiryId: record._id } });
              }
            })}
          >
            <Table.Column title="Name" dataIndex="username" key="username" render={(v:any,r:any)=> v || r.residentName || r.subject || 'Unknown'} />
            <Table.Column title="Type of Inquiry" dataIndex="type" key="type" render={(t:any)=> t ? String(t) : 'General'} />
            <Table.Column title="Status" dataIndex="status" key="status" render={(s:any)=> getStatusTag(s)} />
            <Table.Column title="Date Inquired" dataIndex="createdAt" key="createdAt" render={(d:any)=> formatDate(d)} />
            <Table.Column title="Date Resolved" dataIndex="updatedAt" key="updatedAt" render={(d:any, r:any) => (r.status && r.status.toString().toLowerCase() === 'resolved' ? formatDate(d) : '')} />
          </Table>
        )}
      </Spin>
    </div>
  );
};

export default InquiryTracker;
