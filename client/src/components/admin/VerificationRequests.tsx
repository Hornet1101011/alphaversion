import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, message, Spin } from 'antd';
import { verificationAPI } from '../../services/api';

interface IVReq {
  _id: string;
  userId: any;
  files: string[];
  gridFileIds: string[];
  status: string;
  createdAt: string;
}

const VerificationRequests: React.FC = () => {
  const [data, setData] = useState<IVReq[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await verificationAPI.getRequests();
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
      message.error('Failed to load verification requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (userId: string) => {
    setLoading(true);
    try {
      await verificationAPI.verifyUser(userId, true);
      message.success('User verified');
      await load();
    } catch (err) {
      console.error(err);
      message.error('Failed to verify user');
    } finally {
      setLoading(false);
    }
  };

  const reject = async (record: IVReq) => {
    setLoading(true);
    try {
      // Try to call rejectRequest if request id available, then flip user's verified flag
      if (record && record._id) {
        try { await verificationAPI.rejectRequest(record._id); } catch (e) { /* best-effort */ }
      }
      const userId = record.userId?._id || record.userId;
      if (userId) await verificationAPI.verifyUser(userId, false);
      message.success('Verification request rejected');
      await load();
    } catch (err) {
      console.error(err);
      message.error('Failed to reject verification');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Resident',
      dataIndex: 'userId',
      key: 'user',
      render: (u: any) => u ? (u.fullName || u.username || u.email) : 'Unknown'
    },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={s === 'pending' ? 'orange' : s === 'approved' ? 'green' : 'red'}>{s}</Tag> },
    { title: 'Submitted', dataIndex: 'createdAt', key: 'createdAt', render: (d: string) => new Date(d).toLocaleString() },
    { title: 'Files', dataIndex: 'gridFileIds', key: 'files', render: (ids: string[]) => (
      <Space>
        {ids && ids.map((id: string) => (
          <Button key={id} type="link" href={`${(process.env.REACT_APP_API_URL || '/api')}/verification/file/${id}`} target="_blank">Open</Button>
        ))}
      </Space>
    ) },
    { title: 'Action', key: 'action', render: (_: any, record: IVReq) => (
      <Space>
        <Button onClick={() => approve(record.userId._id || record.userId)} type="primary">Verify</Button>
        <Button danger onClick={() => reject(record)}>Reject</Button>
        <Button type="link" href={`${(process.env.REACT_APP_API_URL || '/api')}/verification/file/${(record.gridFileIds && record.gridFileIds[0]) || ''}`} target="_blank">Check ID</Button>
      </Space>
    ) }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2>Verification Requests</h2>
      <Spin spinning={loading}>
        <Table rowKey="_id" loading={loading} dataSource={data} columns={columns as any} />
      </Spin>
    </div>
  );
};

export default VerificationRequests;
