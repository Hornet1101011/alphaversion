import React, { useEffect, useState } from 'react';
import { Card, List, Typography, Modal, Image, Empty } from 'antd';
import { contactAPI } from '../services/api';

const { Title, Paragraph } = Typography;

const AnnouncementsList: React.FC = () => {
  const [anns, setAnns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await contactAPI.getAnnouncements();
      setAnns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load announcements', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  return (
    <Card title={<Title level={4} style={{ margin: 0 }}>Announcements</Title>}>
      {anns.length === 0 ? (
        <Empty description="No announcements" />
      ) : (
        <List
          loading={loading}
          dataSource={anns}
          renderItem={item => (
            <List.Item style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }} onClick={() => setSelected(item)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <List.Item.Meta
                  title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                  </div>}
                  description={<Paragraph ellipsis={{ rows: 2 }}>{item.text}</Paragraph>}
                />
              </div>
              {item.imagePath && (
                <div style={{ marginLeft: 12, width: 80, display: 'flex', justifyContent: 'flex-end' }}>
                  <Image className="rounded-img" width={72} height={48} src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${item._id}/image`} alt="announcement" preview={false} />
                </div>
              )}
            </List.Item>
          )}
        />
      )}

      <Modal open={!!selected} onCancel={() => setSelected(null)} footer={null} title="Announcement">
        {selected && (
          <div>
            <Paragraph>{selected.text}</Paragraph>
            {selected.imagePath && (
              <Image className="rounded-img rounded-img-lg" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${selected._id}/image`} alt="announcement" />
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

export default AnnouncementsList;
