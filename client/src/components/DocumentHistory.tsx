import React, { useEffect, useState } from 'react';
import { Table, Typography, Spin } from 'antd';
import { documentsAPI } from '../services/api';
import { formatDate as formatDateUtil } from '../utils/formatDate';

const DocumentHistory: React.FC = () => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        // Fetch all completed/rejected document requests
        const requests = await documentsAPI.getAllDocuments();
        const filtered = (requests || []).filter((r: any) => {
          const status = r.status && r.status.toLowerCase();
          return status === 'rejected' || status === 'completed' || status === 'approved';
        });
        setHistory(filtered);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div style={{ maxWidth: 2000, margin: '12px auto', padding: '0 16px' }}>
      <Typography.Title level={3} style={{ marginTop: 8, marginBottom: 12 }}>Document History</Typography.Title>
      {loading ? <Spin /> : (
        <Table
          dataSource={history}
          rowKey="_id"
          pagination={{ pageSize: 8 }}
          columns={[
            { title: 'Requester Name', dataIndex: 'username', key: 'username', render: (text: string) => text || 'Unknown' },
            { title: 'Transactional ID', dataIndex: 'transactionCode', key: 'transactionCode', render: (text: string) => text || '—' },
            { title: 'Type', dataIndex: 'type', key: 'type', render: (text: string) => text || 'Unknown' },
            { title: 'Date Approved', dataIndex: 'completedAt', key: 'completedAt', render: (text: string, record: any) => {
                const date = text || record.dateApproved || record.completedAt || record.approvedAt || null;
                if (!date) return '—';
                try {
                  return formatDateUtil(date);
                } catch {
                  return String(date);
                }
              }
            },
            { title: 'Status', dataIndex: 'status', key: 'status', render: (text: string, record: any) => {
                // Prefer the staff's fullName when available, fall back to username, then Unknown
                const staffName = record.processedBy?.fullName || record.processedBy?.username || 'Unknown';
                const staffBarangayID = record.processedBy?.barangayID || 'Unknown';
                if (text && text.toLowerCase() === 'rejected') {
                  return <span style={{ color: '#FF3B3B', fontWeight: 600 }}>Rejected by: {staffName} ({staffBarangayID})</span>;
                } else if (text && (text.toLowerCase() === 'completed' || text.toLowerCase() === 'approved')) {
                  return <span style={{ color: '#43D96B', fontWeight: 600 }}>Completed by: {staffName} ({staffBarangayID})</span>;
                } else {
                  return <span>{text}</span>;
                }
              }
            }
          ]}
        />
      )}
    </div>
  );
};

export default DocumentHistory;
