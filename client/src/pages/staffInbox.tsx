import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout, Card, List, Typography, Spin, Result, Divider, Avatar, Row, Col, Space, Badge, Select, Tabs, Input, Tag, Button, Modal, message as antdMessage } from 'antd';
import { InboxOutlined, SendOutlined, CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { contactAPI, adminAPI } from '../services/api';

type FilterState = {
  status: string;
  search: string;
};

const StaffInbox: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterState>({ status: 'all', search: '' });
  const [category, setCategory] = useState<string>('All');
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [replyLoading, setReplyLoading] = useState<{ [id: string]: boolean }>({});
  const [residentsModalVisible, setResidentsModalVisible] = useState(false);
  const [residentsLoading, setResidentsLoading] = useState(false);
  const [residents, setResidents] = useState<Array<{ label: string; username?: string; barangayID?: string }>>([]);
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchAll();
    // If navigation state contains an inquiry to open, store it for after fetch
    const state: any = (location && (location as any).state) || {};
    if (state && state.openInquiryId) {
      // We'll try to open after loading inquiries
      const openId = state.openInquiryId;
      // Wait for fetchAll to populate inquiries, then open
      const waiter = setInterval(() => {
        const found = inquiries.find(i => i._id === openId);
        if (found) {
          setSelectedInquiry(found);
          clearInterval(waiter);
        }
      }, 200);
      // As fallback, after 3s, try fetching single inquiry from API
      setTimeout(async () => {
        const found = inquiries.find(i => i._id === openId);
        if (!found) {
          try {
            const single = await contactAPI.getInquiryById(openId);
            if (single) setSelectedInquiry(single);
          } catch (e) {
            // ignore
          }
        }
      }, 3000);
    }
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await contactAPI.getAllInquiries();
      setInquiries(res || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load inquiries', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [selectedInquiry, selectedInquiry && selectedInquiry.responses && selectedInquiry.responses.length]);

  const timeAgo = (iso?: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const getInitial = (val: any, fallback = '?') => {
    if (!val) return fallback;
    try { const s = String(val).trim(); return s.length ? s.charAt(0).toUpperCase() : fallback; } catch (e) { return fallback; }
  };

  // Lightweight message/comment renderer (keeps layout consistent with resident inbox)
  const MessageComment: React.FC<{ author?: string; avatar?: React.ReactNode; content?: React.ReactNode; datetime?: React.ReactNode; align?: 'left'|'right' }> = ({ author, avatar, content, datetime, align = 'left' }) => (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '80%' }}>
        {align === 'left' && avatar}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{author}</div>
          <div style={{ marginTop: 6 }}>{content}</div>
          {datetime && <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>{datetime}</div>}
        </div>
        {align === 'right' && avatar}
      </div>
    </div>
  );

  const openThread = (inquiry: any) => {
    setSelectedInquiry(inquiry);
  };

  const handleSendReply = async () => {
    if (!replyText || !selectedInquiry || !selectedInquiry._id) return;
    const id = selectedInquiry._id;
    setReplyLoading(s => ({ ...s, [id]: true }));
    try {
      if (selectedInquiry.isNewThread) {
  // Determine recipient username/barangayID from several possible places to avoid falling
  // back to the current staff account (which would make the inquiry show up only on staff)
  let recipientUsername = selectedInquiry.residentUsername || selectedInquiry.username || selectedInquiry.userName || selectedInquiry.author || selectedInquiry.createdBy && (selectedInquiry.createdBy.username || selectedInquiry.createdBy.userName);
  let recipientBarangayID = (selectedInquiry as any).residentBarangayID || selectedInquiry.barangayID || (selectedInquiry.createdBy && selectedInquiry.createdBy.barangayID);

        // If createdBy info exists, try its username/barangayID
        if ((!recipientUsername || recipientUsername === '') && selectedInquiry.createdBy) {
          if (typeof selectedInquiry.createdBy === 'string') {
            recipientUsername = selectedInquiry.createdBy;
          } else if (selectedInquiry.createdBy.username || selectedInquiry.createdBy.userName) {
            recipientUsername = selectedInquiry.createdBy.username || selectedInquiry.createdBy.userName;
          }
          if (!recipientBarangayID && selectedInquiry.createdBy && (selectedInquiry.createdBy.barangayID)) {
            recipientBarangayID = selectedInquiry.createdBy.barangayID;
          }
        }

        // Try to resolve from the cached residents list by matching the display label if still missing
        if ((!recipientUsername || recipientUsername === '') && Array.isArray(residents) && selectedInquiry.residentName) {
          const match = residents.find(r => r.label && r.label.toString().toLowerCase() === (selectedInquiry.residentName || '').toString().toLowerCase());
          if (match) {
            recipientUsername = (match as any).username || recipientUsername;
            recipientBarangayID = (match as any).barangayID || recipientBarangayID;
          }
        }

        const payload: any = {
          type: 'staff_message',
          subject: `Message to ${selectedInquiry.residentName}`,
          message: replyText.trim(),
          // Include explicit recipient identifiers so resident's getMyInquiries will find it
          ...(recipientUsername ? { username: recipientUsername } : {}),
          ...(recipientBarangayID ? { barangayID: recipientBarangayID } : {}),
          // optional: server may accept assignedTo / assignedRole depending on API
        };

        // If we couldn't resolve a recipient for a staff-created thread, block sending and show an error
        if (!payload.username) {
          antdMessage.error('Please select a resident to send this message to.');
          // Also log for debugging
          // eslint-disable-next-line no-console
          console.warn('Blocked staff-created inquiry without recipient', { selectedInquiry, residents });
          return;
        }

        // Log payload right before submitting so we can inspect what is being sent
        // eslint-disable-next-line no-console
        console.debug('Submitting staff-created inquiry payload', payload, { selectedInquirySummary: { residentName: selectedInquiry.residentName, residentUsername: selectedInquiry.residentUsername, residentBarangayID: (selectedInquiry as any).residentBarangayID } });

        const created = await contactAPI.submitInquiry(payload);
        antdMessage.success(`Message sent to ${selectedInquiry.residentName || payload.username}`);
        // add to list and open created thread
        setInquiries(prev => [created].concat(prev));
        setSelectedInquiry(created);
        setReplyText('');
      } else {
        const resp = await contactAPI.respondToInquiry(id, { response: replyText.trim() });
        setInquiries(prev => prev.map(i => i._id === resp._id ? resp : i));
        setSelectedInquiry(resp);
        setReplyText('');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('reply failed', e);
    } finally {
      setReplyLoading(s => ({ ...s, [id]: false }));
    }
  };

  const handleResolve = async () => {
    if (!selectedInquiry || !selectedInquiry._id) return;
    const id = selectedInquiry._id;
    try {
      const resp = await contactAPI.resolveInquiry(id);
      setInquiries(prev => prev.map(i => i._id === resp._id ? resp : i));
      setSelectedInquiry(resp);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('resolve failed', e);
    }
  };

  const filtered = inquiries.filter((inquiry) => {
    let statusMatch = true;
    if (filter.status === 'pending') statusMatch = !inquiry.responses || inquiry.responses.length === 0;
    if (filter.status === 'responded') statusMatch = inquiry.status === 'resolved' || (inquiry.responses && inquiry.responses.length > 0);
    if (filter.status === 'closed') statusMatch = inquiry.status === 'closed';
    let categoryMatch = true;
    if (category && category !== 'All') categoryMatch = inquiry.category === category;
    const search = (filter.search || '').toLowerCase();
    const searchMatch = !search || (inquiry.residentName && inquiry.residentName.toLowerCase().includes(search)) || (inquiry.subject && inquiry.subject.toLowerCase().includes(search));
    return statusMatch && categoryMatch && searchMatch;
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f7f9fb', padding: 24 }}>
      <Card style={{ maxWidth: 1200, margin: '0 auto', borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: 20 }}>
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} sm={6}>
              <Select value={category} onChange={(v) => setCategory(v)} style={{ width: '100%' }}>
                <Select.Option value="All">All</Select.Option>
                <Select.Option value="Complaints">Complaints</Select.Option>
                <Select.Option value="Requests">Requests</Select.Option>
                <Select.Option value="Announcements">Announcements</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12}>
              <Input.Search
                placeholder="Search by name or subject"
                allowClear
                value={filter.search}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilter((s: FilterState) => ({ ...s, search: e.target.value }))
                }
                onSearch={(v: string) =>
                  setFilter((s: FilterState) => ({ ...s, search: v }))
                }
              />
            </Col>
            <Col xs={24} sm={6}>
              <Tabs activeKey={filter.status || 'all'} onChange={(k) => setFilter(s => ({ ...s, status: k }))}>
                <Tabs.TabPane tab="All" key="all" />
                <Tabs.TabPane tab="Pending" key="pending" />
                <Tabs.TabPane
                  tab={
                    <span>
                      Responded{' '}
                      <Button
                        type="link"
                        size="small"
                        style={{ marginLeft: 20 }}
                        icon={<PlusOutlined />}
                        onClick={(e) => {
                          // prevent tab change when clicking the icon
                          e.stopPropagation();
                          (async () => {
                            setResidentsModalVisible(true);
                            setResidentsLoading(true);
                            try {
                              const users: any[] = await adminAPI.getUsers();
                              // Heuristic: users that appear to be residents
                              const list = (users || []).filter(u => {
                                const role = (u.role || u.type || '').toString().toLowerCase();
                                return role.includes('resident') || (!role.includes('admin') && !role.includes('staff'));
                              }).map(u => ({
                                label: u.fullName || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.username || u.email || u.name)),
                                // Be liberal in picking a username-like identifier: username, userName, email, or _id
                                username: u.username || u.userName || u.email || u._id,
                                // Barangay ID may be stored in several fields depending on user record shape
                                barangayID: u.barangayID || u.brgy || (u.barangay && (u.barangay.id || u.barangayID))
                              }));
                              setResidents(list.filter(r => r && r.label));
                            } catch (err) {
                              // fallback: empty list
                              setResidents([]);
                            } finally {
                              setResidentsLoading(false);
                            }
                          })();
                        }}
                      />
                    </span>
                  }
                  key="responded"
                />
              </Tabs>
            </Col>
          </Row>
        </div>
        <Divider style={{ margin: 0 }} />
        <Modal
          title="Residents"
          visible={residentsModalVisible}
          onCancel={() => setResidentsModalVisible(false)}
          footer={null}
        >
          {residentsLoading ? <div style={{ textAlign: 'center' }}><Spin /></div> : (
            residents.length === 0 ? (
              <Typography.Text type="secondary">No residents found.</Typography.Text>
            ) : (
              <List
                dataSource={residents}
                renderItem={resident => (
                    <List.Item style={{ cursor: 'pointer' }} onClick={() => {
                    const name = resident.label;
                    const username = resident.username;
                    const barangayID = (resident as any).barangayID;
                    // Try to find an existing inquiry for this resident by username or display name
                    const found = inquiries.find(i => {
                      const rn = (i.username || i.residentName || i.createdBy && (i.createdBy.username || '') || '').toString().toLowerCase();
                      return rn && (username ? rn === (username || '').toString().toLowerCase() : rn === (name || '').toString().toLowerCase());
                    });
                    if (found) {
                      setSelectedInquiry(found);
                      setResidentsModalVisible(false);
                    } else {
                      // create a temporary thread object so staff can send a message
                      const temp: any = {
                        _id: `new-${Date.now()}`,
                        residentName: name,
                        residentUsername: username,
                        residentBarangayID: barangayID,
                        message: '',
                        responses: [],
                        isNewThread: true,
                      };
                      setSelectedInquiry(temp);
                      // debug log the temp selection to ensure username/barangayID are present
                      // eslint-disable-next-line no-console
                      console.debug('Resident selected for new thread', temp);
                      setResidentsModalVisible(false);
                    }
                  }}>
                    <List.Item.Meta
                      avatar={<Avatar style={{ background: '#1890ff' }}>{getInitial(resident.label)}</Avatar>}
                      title={resident.label}
                    />
                  </List.Item>
                )}
              />
            )
          )}
        </Modal>
        <div style={{ padding: 16 }}>
          {loading ? <Spin /> : filtered.length === 0 ? (
            <Result icon={<InboxOutlined />} title="No inquiries" subTitle="There are no inquiries to show." />
          ) : (
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ width: 320, maxHeight: 520, overflowY: 'auto' }}>
                <List
                  dataSource={filtered}
                  renderItem={inquiry => (
                    <List.Item onClick={() => openThread(inquiry)} style={{ cursor: 'pointer', marginBottom: 8, borderRadius: 8, padding: 8, border: selectedInquiry && selectedInquiry._id === inquiry._id ? '1px solid #1890ff' : '1px solid #eee' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Avatar style={{ background: '#1890ff' }}>{getInitial(inquiry.residentName || inquiry.username || inquiry.subject, '?')}</Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Typography.Text strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inquiry.residentName || inquiry.username || 'Unknown'}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>— {inquiry.subject || 'No subject'}</Typography.Text>
                            <span style={{ marginLeft: 'auto', fontSize: 11 }}>{inquiry.createdAt ? timeAgo(inquiry.createdAt) : ''}</span>
                          </div>
                          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inquiry.message}</Typography.Text>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </div>

              <div style={{ flex: 1 }}>
                <Card style={{ borderRadius: 8 }} bodyStyle={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
                  {selectedInquiry ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <Typography.Text strong style={{ display: 'block' }}>{selectedInquiry.residentName || selectedInquiry.username || 'Unknown'}</Typography.Text>
                          <Typography.Text type="secondary">{selectedInquiry.createdAt ? new Date(selectedInquiry.createdAt).toLocaleString() : ''}</Typography.Text>
                        </div>
                        <Avatar size={48} style={{ background: '#1890ff' }}>{getInitial(selectedInquiry.residentName || selectedInquiry.username)}</Avatar>
                      </div>
                      <Divider />
                      <div style={{ overflowY: 'auto', maxHeight: 340 }}>
                        <div style={{ marginBottom: 8 }}>
                          <Typography.Paragraph style={{ margin: 0 }}>{selectedInquiry.message}</Typography.Paragraph>
                          {selectedInquiry.attachments && selectedInquiry.attachments.length > 0 && (
                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {selectedInquiry.attachments.map((a: any, i: number) => {
                                const url = a.url || a.path || '#';
                                const filename = a.name || a.filename || 'attachment';
                                const isImage = (a.contentType && a.contentType.startsWith('image/')) || /\.(jpe?g|png|gif|webp)$/i.test(filename);
                                return (
                                  <div key={i}>
                                    {isImage ? (
                                      <a href={url} target="_blank" rel="noreferrer">
                                        <img src={url} alt={filename} style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8, objectFit: 'cover', border: '1px solid #f0f0f0' }} />
                                      </a>
                                    ) : (
                                      <div>
                                        <a href={url} target="_blank" rel="noreferrer">{filename}</a>
                                        {a.size ? <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>({Math.round(a.size/1024)} KB)</span> : null}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {Array.isArray(selectedInquiry.responses) && selectedInquiry.responses.map((r: any, idx: number) => {
                          // Determine role heuristics similar to resident inbox to calculate alignment
                          const roleRaw = r.role || r.authorRole || r.author_role || '';
                          let role = (roleRaw || '').toString().toLowerCase();
                          const authorRaw = r.author || r.authorName || r.author_name || r.createdByName || r.createdByFullName || r.userName || r.user || '';
                          const createdById = r.createdBy ? String(r.createdBy) : undefined;
                          const currentUserId = undefined; // staff view does not mark current user specially here

                          // Heuristic: if role missing, try to detect resident replies by matching selectedInquiry createdBy/residentId
                          if (!role) {
                            try {
                              let residentId: string | undefined;
                              if (selectedInquiry) {
                                if (selectedInquiry.createdBy && typeof selectedInquiry.createdBy === 'string') residentId = String(selectedInquiry.createdBy);
                                else if (selectedInquiry.createdBy && typeof selectedInquiry.createdBy === 'object' && (selectedInquiry.createdBy._id || selectedInquiry.createdBy.id)) residentId = String(selectedInquiry.createdBy._id || selectedInquiry.createdBy.id);
                                else if (selectedInquiry.residentId) residentId = String(selectedInquiry.residentId);
                              }
                              const residentName = (selectedInquiry && (selectedInquiry.residentName || selectedInquiry.username || '')) ? String(selectedInquiry.residentName || selectedInquiry.username).toLowerCase() : '';
                              const authorName = (authorRaw || r.authorName || '').toString().toLowerCase();
                              if (residentId && createdById && residentId === createdById) {
                                role = 'resident';
                              } else if (residentName && authorName && residentName === authorName) {
                                role = 'resident';
                              }
                            } catch (e) {
                              // ignore
                            }
                          }

                          let authorDisplay: string;
                          if (authorRaw && authorRaw.trim() !== '') authorDisplay = authorRaw;
                          else if (r.authorName && r.authorName.trim() !== '') authorDisplay = r.authorName;
                          else if (r.createdBy && typeof r.createdBy === 'object' && (r.createdBy.fullName || r.createdBy.username)) authorDisplay = r.createdBy.fullName || r.createdBy.username;
                          else authorDisplay = role === 'resident' ? (selectedInquiry && (selectedInquiry.residentName || selectedInquiry.username) ? (selectedInquiry.residentName || selectedInquiry.username) : 'Resident') : 'Staff';

                          const isResidentReply = role === 'resident' || role === 'user';
                          const align: 'left' | 'right' = isResidentReply ? 'right' : 'left';

                          const avatarNode = isResidentReply ? (
                            <Avatar style={{ background: '#1890ff' }}>{getInitial(authorDisplay, 'U')}</Avatar>
                          ) : (
                            <Avatar style={{ background: '#666' }}>{getInitial(authorDisplay, 'B')}</Avatar>
                          );

                          return (
                            <div key={idx} style={{ alignSelf: isResidentReply ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                              <MessageComment
                                author={authorDisplay}
                                avatar={avatarNode}
                                content={<div style={{ background: isResidentReply ? '#e6f7ff' : '#f6f6f6', padding: 10, borderRadius: 8 }}>
                                  <Typography.Paragraph style={{ margin: 0 }}>{r.text}</Typography.Paragraph>
                                  {r.attachments && r.attachments.length > 0 && (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {r.attachments.map((a: any, j: number) => {
                                        const url = a.url || a.path || '#';
                                        const filename = a.name || a.filename || 'attachment';
                                        const isImage = (a.contentType && a.contentType.startsWith('image/')) || /\.(jpe?g|png|gif|webp)$/i.test(filename);
                                        return (
                                          <div key={j}>
                                            {isImage ? (
                                              <a href={url} target="_blank" rel="noreferrer">
                                                <img src={url} alt={filename} style={{ maxWidth: 220, maxHeight: 140, borderRadius: 8, objectFit: 'cover', border: '1px solid #f0f0f0' }} />
                                              </a>
                                            ) : (
                                              <div>
                                                <a href={url} target="_blank" rel="noreferrer">{filename}</a>
                                                {a.size ? <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>({Math.round(a.size/1024)} KB)</span> : null}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>}
                                datetime={<span style={{ fontSize: 12 }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</span>}
                                align={align}
                              />
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                        <textarea
                          value={replyText}
                          onChange={e => {
                            setReplyText(e.target.value);
                            const el = e.target as HTMLTextAreaElement;
                            el.style.height = 'auto';
                            el.style.height = Math.min(200, el.scrollHeight) + 'px';
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              await handleSendReply();
                            }
                          }}
                          placeholder="Type your reply..."
                          style={{ flex: 1, minHeight: 40, maxHeight: 200, padding: 10, borderRadius: 8, resize: 'none' }}
                        />
                        <Button type="primary" icon={<SendOutlined />} loading={!!(selectedInquiry && replyLoading[selectedInquiry._id])} onClick={handleSendReply} />
                        <Button icon={<CheckOutlined />} onClick={handleResolve}>Resolve</Button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 32 }}>
                      <Typography.Text type="secondary">Select an inquiry to view details</Typography.Text>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StaffInbox;
