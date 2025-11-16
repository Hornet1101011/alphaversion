import React, { useEffect, useState } from 'react';
import { Card, Typography, Statistic, Row, Col, Spin } from 'antd';
import { UserOutlined, CrownOutlined, TeamOutlined, HomeOutlined, FileTextOutlined, NotificationOutlined } from '@ant-design/icons';
import { adminAPI, documentsAPI, contactAPI } from '../services/api';

const StatsPanel: React.FC = () => {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch admin statistics, list of files, document requests, and public announcements in parallel
        const [resStats, filesRes, docRequestsRes, announcementsRes] = await Promise.all([
          adminAPI.getSystemStatistics(),
          documentsAPI.listFiles().catch(() => ([])),
          documentsAPI.getAllDocuments().catch(() => ([])),
          contactAPI.getAnnouncements().catch(() => ([]))
        ]);

        if (mounted) {
          // attach filesCount, docRequestsCount and announcementsCount to stats for display
          const filesCount = Array.isArray(filesRes) ? filesRes.length : (filesRes && filesRes.length) || 0;
          const docRequestsCount = Array.isArray(docRequestsRes) ? docRequestsRes.length : (docRequestsRes && docRequestsRes.length) || 0;
          const announcementsCount = Array.isArray(announcementsRes) ? announcementsRes.length : (announcementsRes && announcementsRes.length) || 0;
          setStats({ ...resStats, filesCount, docRequestsCount, announcementsCount });
        }
      } catch (err) {
        console.error('Failed to load system statistics', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ width: '100%', textAlign: 'center' }}><Spin /></div>;
  if (!stats) return <div style={{ textAlign: 'center' }}><Typography.Text type="secondary">No statistics available</Typography.Text></div>;

  const users = stats.users || {};
  const documents = stats.documents || {};
  const filesCount = stats.filesCount ?? 0;

  // Arrange items so that with a 3-column layout the Documents tile falls under Admins
  const items = [
    { key: 'users', title: 'Total Users', value: users.total ?? 0, icon: <UserOutlined style={{ color: '#9254de', fontSize: 20 }} /> },
    { key: 'admins', title: 'Admins', value: users.byRole?.admin ?? 0, icon: <CrownOutlined style={{ color: '#f5a623', fontSize: 20 }} /> },
    { key: 'staff', title: 'Staff', value: users.byRole?.staff ?? 0, icon: <TeamOutlined style={{ color: '#1677ff', fontSize: 20 }} /> },
    { key: 'residents', title: 'Residents', value: users.byRole?.resident ?? 0, icon: <HomeOutlined style={{ color: '#22c55e', fontSize: 20 }} /> },
    { key: 'announcements', title: 'Announcements', value: stats.announcementsCount ?? 0, icon: <NotificationOutlined style={{ color: '#faad14', fontSize: 20 }} /> },
    { key: 'docFiles', title: 'Documents Available', value: filesCount, icon: <FileTextOutlined style={{ color: '#0ea5e9', fontSize: 20 }} /> },
  ];

  return (
    <Card className="glass-card stats-card" bordered={false} style={{ width: '100%' }}>
      <Typography.Title level={4}>Quick Stats</Typography.Title>
      <div style={{ height: 6, background: 'linear-gradient(90deg, rgba(22,119,255,0.08), rgba(146,84,222,0.08))', borderRadius: 4, marginBottom: 12 }} />

      <Row gutter={[12,12]} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        {items.map(it => (
          <Col key={it.key} xs={12} sm={8} md={8} lg={8} style={{ display: 'flex' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.9)', borderRadius: 8, boxShadow: '0 6px 14px rgba(2,6,23,0.06)' }}>
                {it.icon}
              </div>
              <div style={{ flex: 1 }}>
                <Statistic title={it.title} value={it.value} />
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};

export default StatsPanel;
