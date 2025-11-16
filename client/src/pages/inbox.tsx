import React, { useEffect, useRef, useState } from 'react';
import { Layout, Card, List, Typography, Spin, Empty, message as antdMessage, Divider, Avatar, Row, Col, Space, Badge, Select, Input, Collapse, Button, Tag, Upload, Popconfirm, Result, Skeleton, Tooltip } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined, SendOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import styles from './inbox.module.css';
import { InboxFilters, defaultFilterState, FilterState } from './inbox-filters';
import { contactAPI } from '../services/api';

const Inbox: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterState>(defaultFilterState);
  const [category, setCategory] = useState<string>('All');
  const [reply, setReply] = useState<{ [id: string]: string }>({});
  const [replyLoading, setReplyLoading] = useState<{ [id: string]: boolean }>({});
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);
  const [threadVisible, setThreadVisible] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  // Make messages list fullscreen by default
  const [listFullscreen, setListFullscreen] = useState(true);
  const [replyText, setReplyText] = useState<string>('');
  const [fileList, setFileList] = useState<any[]>([]);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  // Ref for auto-scrolling message area
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // read current user profile from localStorage so we can mark replies with the correct author/role
  // Auto-scroll to bottom of message area when selectedInquiry or its responses change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedInquiry, selectedInquiry && selectedInquiry.responses && selectedInquiry.responses.length]);
  const storedProfile = (() => {
    try {
      return localStorage.getItem('userProfile') ? JSON.parse(localStorage.getItem('userProfile') || 'null') : null;
    } catch (err) {
      return null;
    }
  })();

  useEffect(() => {
    setLoading(true);
    contactAPI.getMyInquiries()
      .then(res => {
        setInquiries(res || []);
      })
      .catch(() => {
        antdMessage.error('Failed to load inbox.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtering and search logic
  const filteredInquiries = inquiries.filter(inquiry => {
    // Status filter
    let statusMatch = true;
    if (filter.status === 'pending') statusMatch = !inquiry.responses || inquiry.responses.length === 0;
    // Treat "responded" filter as "has responses OR explicitly resolved"
    if (filter.status === 'responded') statusMatch = inquiry.status === 'resolved' || (inquiry.responses && inquiry.responses.length > 0);
    if (filter.status === 'closed') statusMatch = inquiry.status === 'closed';
  // Category filter
  let categoryMatch = true;
  if (category && category !== 'All') categoryMatch = inquiry.category === category;
    // Search filter
    const search = filter.search.toLowerCase();
    const searchMatch =
      !search ||
      (inquiry.residentName && inquiry.residentName.toLowerCase().includes(search)) ||
      (inquiry.category && inquiry.category.toLowerCase().includes(search)) ||
      (inquiry.subject && inquiry.subject.toLowerCase().includes(search)) ||
      (inquiry.createdAt && new Date(inquiry.createdAt).toLocaleString().toLowerCase().includes(search));
    return statusMatch && searchMatch && categoryMatch;
  });

  // Inline reply handler (stub)
  const handleReply = async (id: string) => {
    setReplyLoading(r => ({ ...r, [id]: true }));
    try {
      // TODO: Replace with actual API call
      await new Promise(res => setTimeout(res, 800));
      setReply(r => ({ ...r, [id]: '' }));
      antdMessage.success('Reply sent!');
    } finally {
      setReplyLoading(r => ({ ...r, [id]: false }));
    }
  };

  const openThread = (inquiry: any) => {
    // simulate loading the thread
    setLoadingThread(true);
    // ensure the conversation panel is visible when opening a thread
    setListFullscreen(false);
    setTimeout(() => {
      setSelectedInquiry(inquiry);
      setLoadingThread(false);
      setThreadVisible(true);
    }, 250);
  };

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

  // Lightweight replacement for AntD Comment to avoid import/type issues
  const MessageComment: React.FC<{ author?: string; avatar?: React.ReactNode; content?: React.ReactNode; datetime?: React.ReactNode; align?: 'left'|'right' }> = ({ author, avatar, content, datetime, align = 'left' }) => (
    <div style={{ display: 'flex', justifyContent: align === 'left' ? 'flex-start' : 'flex-end' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '80%' }}>
        {align === 'left' && avatar}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{author}</div>
          <div style={{ marginTop: 6 }}>{content}</div>
          {datetime && <div style={{ marginTop: 6, fontSize: 12, color: '#777' }}>{datetime}</div>}
        </div>
        {align === 'right' && avatar}
      </div>
    </div>
  );

  // Helper to safely get the first initial from a name-like value
  const getInitial = (val: any, fallback = '?') => {
    if (!val) return fallback;
    try {
      const s = String(val).trim();
      return s.length > 0 ? s.charAt(0).toUpperCase() : fallback;
    } catch (e) {
      return fallback;
    }
  };

  return (
  <div style={{ minHeight: '100vh', background: '#f0f4f8', padding: '24px', fontFamily: 'Poppins, Arial, sans-serif', position: 'relative' }}>
      <Card
        style={{ maxWidth: 1200, margin: '0 auto', borderRadius: 18, boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.08)', padding: 0, background: '#fff' }}
        bodyStyle={{ padding: 0, background: '#fff' }}
      >
        <div style={{ padding: '24px 32px 0 32px' }}>
          <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
            <Col xs={24} sm={6}>
              <Select value={category} onChange={(val) => setCategory(val)} style={{ width: '100%' }}>
                <Select.Option value="All">All</Select.Option>
                <Select.Option value="Complaints">Complaints</Select.Option>
                <Select.Option value="Requests">Requests</Select.Option>
                <Select.Option value="Announcements">Announcements</Select.Option>
              </Select>
            </Col>
            <Col xs={24} sm={12}>
              <Input.Search placeholder="Search by date, name, or category" allowClear value={filter.search} onChange={(e) => setFilter(s => ({ ...s, search: e.target.value }))} onSearch={(val) => setFilter(s => ({ ...s, search: val }))} />
            </Col>
            <Col xs={24} sm={6} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <div style={{ flex: 1 }} />
              <Button
                type="text"
                onClick={() => setLeftCollapsed(v => !v)}
                style={{ borderRadius: 8 }}
                title={leftCollapsed ? 'Show conversation list' : 'Hide conversation list'}
                icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              />
            </Col>
          </Row>
          <Typography.Title level={3} style={{ marginBottom: 0, color: '#1890ff', display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Poppins, Arial, sans-serif' }}>
            <span role="img" aria-label="inbox">📩</span> Inbox
          </Typography.Title>
        </div>
        <Divider style={{ margin: '16px 0 0 0' }} />
        <div style={{ padding: '0 32px 32px 32px' }}>
          {loading ? (
            <Spin />
          ) : filteredInquiries.length === 0 ? (
            <Result
              icon={<InboxOutlined />}
              status="info"
              title="No messages yet"
              subTitle="There are no messages in your inbox."
            />
          ) : (
            <div style={{ display: 'flex', gap: 16 }}>
            {/* Conversation list (collapsible) */}
            {!leftCollapsed ? (
              <div style={{ flex: listFullscreen ? 1 : '0 0 300px', maxHeight: listFullscreen ? 'calc(100vh - 220px)' : 500, overflowY: 'auto', position: 'relative' }}>
                <Button
                  type="text"
                  onClick={() => setLeftCollapsed(true)}
                  style={{ position: 'absolute', right: -12, top: -8, zIndex: 10, borderRadius: 8, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  title="Collapse list"
                >
                  <MenuFoldOutlined />
                </Button>
                <List
                  itemLayout="vertical"
                  dataSource={filteredInquiries}
                  renderItem={inquiry => {
                // Prefer explicit 'resolved' status. If not resolved, fall back to checking responses.
                const statusTag = inquiry.status === 'resolved' ? (
                  <Tag color="green">Resolved</Tag>
                ) : Array.isArray(inquiry.responses) && inquiry.responses.length > 0 ? (
                  null
                ) : (
                  <Tag color="gold">Pending</Tag>
                );

                const typeIcon = (() => {
                  switch ((inquiry.category || '').toLowerCase()) {
                    case 'complaints': return '🛑';
                    case 'requests': return '📨';
                    case 'announcements': return '📣';
                    default: return '✉️';
                  }
                })();

                const isSelected = selectedInquiry && selectedInquiry._id === inquiry._id;

                return (
                  <List.Item
                    style={{ marginBottom: 8, background: isSelected ? '#f7fbff' : '#fff', borderRadius: 12, border: '1px solid #e6edf3', boxShadow: '0 1px 4px rgba(31,38,135,0.04)', cursor: 'pointer' }}
                    onClick={() => openThread(inquiry)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 10px', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 18 }}>{typeIcon}</span>
                          <Typography.Text strong style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{inquiry.residentName || inquiry.username || (inquiry.createdBy && (inquiry.createdBy.fullName || inquiry.createdBy.username)) || 'Unknown'}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {inquiry.subject || 'No subject'}</Typography.Text>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#888' }}>{inquiry.createdAt ? timeAgo(inquiry.createdAt) : ''}</span>
                          {statusTag ? React.cloneElement(statusTag as any, { style: { fontSize: 11, padding: '0 6px', marginLeft: 8 } }) : null}
                        </div>
                        <div style={{ marginTop: 6 }}>
                          <Typography.Text type="secondary" style={{ display: 'block', margin: 0, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inquiry.message}</Typography.Text>
                        </div>
                        <div style={{ marginTop: 6 }}>
                          {Array.isArray(inquiry.responses) && inquiry.responses.length > 0 ? (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>{inquiry.responses.length} response(s)</Typography.Text>
                          ) : (
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>No responses yet</Typography.Text>
                          )}
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 10 }}>
                        {(() => {
                          const displayName = inquiry.residentName || inquiry.username || (inquiry.createdBy && (inquiry.createdBy.fullName || inquiry.createdBy.username)) || inquiry.subject || 'Unknown';
                          const initial = (displayName && displayName !== 'Unknown') ? getInitial(displayName, '?') : '?';
                          return (
                            <Avatar style={{ background: '#1890ff', color: '#fff', fontWeight: 700 }} size={36}>
                              {initial}
                            </Avatar>
                          );
                        })()}
                      </div>
                    </div>
                  </List.Item>
                );
              }}
                />
              </div>
            ) : (
              <div style={{ width: 72, maxHeight: 500, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 8 }}>
                {/* collapse: show compact vertical icons similar to dashboard sidebar */}
                <Button
                  type="text"
                  onClick={() => setLeftCollapsed(false)}
                  style={{ borderRadius: 8, background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
                  title="Show list"
                >
                  <MenuUnfoldOutlined />
                </Button>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
                  {filteredInquiries.map(inquiry => {
                    const displayName = inquiry.residentName || inquiry.username || (inquiry.createdBy && (inquiry.createdBy.fullName || inquiry.createdBy.username)) || inquiry.subject || 'Unknown';
                    const initial = (displayName && displayName !== 'Unknown') ? getInitial(displayName, '?') : '?';
                    const isSelected = selectedInquiry && selectedInquiry._id === inquiry._id;
                    return (
                      <Tooltip key={inquiry._id} title={`${displayName} — ${inquiry.subject || 'No subject'}`} placement="right">
                        <button
                          onClick={() => openThread(inquiry)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 6,
                            borderRadius: 8,
                            border: isSelected ? '2px solid #1890ff' : '1px solid transparent',
                            background: isSelected ? '#e6f7ff' : 'transparent',
                            cursor: 'pointer'
                          }}
                          aria-label={displayName}
                        >
                          <Avatar style={{ background: '#1890ff', color: '#fff', fontWeight: 700 }} size={36}>{initial}</Avatar>
                        </button>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {!listFullscreen && (<div style={{ flex: 1 }}>)
              {/* Make conversation panel visually blend into the page by removing card background/shadow */}
              <Card
                style={{ borderRadius: 12, height: '100%', background: 'transparent', boxShadow: 'none', border: 'none' }}
                bodyStyle={{ display: 'flex', flexDirection: 'column', padding: 0, gap: 10, background: 'transparent' }}
              >
                {selectedInquiry ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {/* Place staff/respondent info on the left and resident on the right to reflect message flow */}
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {/* Removed General and Responded tags */}
                        {selectedInquiry.status === 'resolved' ? (
                          <Tag color="green">Resolved</Tag>
                        ) : (
                          <Tag color="gold">Pending</Tag>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        {(() => {
                          const displayNameSelected = selectedInquiry.residentName || selectedInquiry.username || selectedInquiry.subject || 'Unknown';
                          return (
                            <>
                              <Typography.Text strong style={{ display: 'block', textAlign: 'right', fontSize: 15 }}>{displayNameSelected}</Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 10, display: 'block', textAlign: 'right' }}>{selectedInquiry.createdAt ? new Date(selectedInquiry.createdAt).toLocaleString() : ''}</Typography.Text>
                            </>
                          );
                        })()}
                      </div>
                      {(() => {
                          const displayNameSelected = selectedInquiry.residentName || selectedInquiry.username || (selectedInquiry.createdBy && (selectedInquiry.createdBy.fullName || selectedInquiry.createdBy.username)) || selectedInquiry.subject || 'Unknown';
                        const initial = (displayNameSelected && displayNameSelected !== 'Unknown') ? getInitial(displayNameSelected, '?') : '?';
                        return <Avatar size={40} style={{ background: '#1890ff' }}>{initial}</Avatar>;
                      })()}
                    </div>

                    <Divider />

                    <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 6, minHeight: 0, maxHeight: 220 }}>
                      {/* Resident original message */}
                      <div style={{ alignSelf: 'flex-end', maxWidth: '100%' }}>
                        {(() => {
                          const originalSenderName = selectedInquiry.residentName || selectedInquiry.username || (selectedInquiry.createdBy && (selectedInquiry.createdBy.fullName || selectedInquiry.createdBy.username)) || 'Resident';
                          const originalInitial = (originalSenderName && originalSenderName !== 'Resident') ? getInitial(originalSenderName, 'U') : 'U';
                          return (
                            <MessageComment
                              author={originalSenderName}
                              avatar={<Avatar style={{ background: '#1890ff' }}>{originalInitial}</Avatar>}
                              content={<div style={{ background: '#e6f7ff', padding: 10, borderRadius: 8 }}>
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
                              </div>}
                              datetime={<span style={{ fontSize: 12 }}>{selectedInquiry.createdAt ? new Date(selectedInquiry.createdAt).toLocaleString() : ''}</span>}
                              align="right"
                            />
                          );
                        })()}
                      </div>

                      {/* Staff responses */}
                      {Array.isArray(selectedInquiry.responses) && selectedInquiry.responses.map((r: any, idx: number) => {
                        // Support multiple possible field shapes from server/client.
                        // Primary: trust an explicit role field if present. Fallback: try to detect resident replies
                        // by comparing createdBy id or author name to the selected inquiry's resident info.
                        const roleRaw = r.role || r.authorRole || r.author_role || '';
                        let role = (roleRaw || '').toString().toLowerCase();

                        // Prefer explicit author name provided by the server (authorName).
                        // Also accept several common alias fields that servers sometimes use.
                        // Only fall back to 'You' when the response was created by the current user.
                        const authorRaw = r.author || r.authorName || r.author_name || r.createdByName || r.createdByFullName || r.userName || r.user || '';
                        const createdById = r.createdBy ? String(r.createdBy) : undefined;
                        const currentUserId = storedProfile && (storedProfile._id || storedProfile.id) ? String(storedProfile._id || storedProfile.id) : undefined;

                        // If role is missing, try a few heuristics to detect resident replies
                        if (!role) {
                          try {
                            // resident id may be stored in selectedInquiry.createdBy (object or id) or selectedInquiry.residentId
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
                            // ignore heuristic errors and fall back to existing logic
                          }
                        }

                        let authorDisplay: string;
                        if (authorRaw && authorRaw.trim() !== '') {
                          authorDisplay = authorRaw;
                        } else if (currentUserId && createdById && currentUserId === createdById) {
                          authorDisplay = 'You';
                        } else if (r.authorName && r.authorName.trim() !== '') {
                          authorDisplay = r.authorName;
                        } else if (r.createdBy && typeof r.createdBy === 'object' && (r.createdBy.fullName || r.createdBy.username)) {
                          authorDisplay = r.createdBy.fullName || r.createdBy.username;
                        } else if (r.createdByName && typeof r.createdByName === 'string' && r.createdByName.trim() !== '') {
                          authorDisplay = r.createdByName;
                        } else if (r.user && typeof r.user === 'object' && (r.user.fullName || r.user.username)) {
                          authorDisplay = r.user.fullName || r.user.username;
                        } else {
                          // Reasonable fallback depending on role. If this response appears to be from the resident
                          // prefer the selected inquiry's resident name / username so the UI shows the sender's name.
                          if (role === 'resident') {
                            authorDisplay = (selectedInquiry && (selectedInquiry.residentName || selectedInquiry.username)) ? (selectedInquiry.residentName || selectedInquiry.username) : 'Resident';
                          } else {
                            // Try common places for staff name before falling back to 'Staff'
                            // If responses don't include authorName but the inquiry has assignedTo populated,
                            // try to match the response.createdBy id to an assigned staff to show their name.
                            let staffNameFromAssigned: string | undefined;
                            try {
                              if (createdById && selectedInquiry && Array.isArray(selectedInquiry.assignedTo)) {
                                const match = selectedInquiry.assignedTo.find((a: any) => String(a._id) === String(createdById));
                                if (match) staffNameFromAssigned = match.fullName || match.username;
                              }
                            } catch (e) {
                              // ignore
                            }

                            authorDisplay = r.staffName || r.staffFullName || (r.createdBy && typeof r.createdBy === 'object' && (r.createdBy.fullName || r.createdBy.username)) || staffNameFromAssigned || 'Staff';
                          }
                        }

                        // Determine alignment: replies from the resident (or the current user) are shown on the right; staff on the left.
                        const isResidentReply = role === 'resident' || role === 'user';
                        const isCurrentUser = currentUserId && createdById && currentUserId === createdById;
                        const align: 'left' | 'right' = (isResidentReply || isCurrentUser) ? 'right' : 'left';

                        const avatarNode = (isResidentReply || isCurrentUser) ? (
                          <Avatar style={{ background: '#1890ff' }}>{getInitial(authorDisplay, 'U')}</Avatar>
                        ) : (
                          <Avatar style={{ background: '#666' }}>{getInitial(authorDisplay, 'B')}</Avatar>
                        );

                        return (
                          <div key={idx} style={{ alignSelf: (isResidentReply || isCurrentUser) ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
                            <MessageComment
                              author={isCurrentUser ? 'You' : authorDisplay}
                              avatar={avatarNode}
                              content={<div style={{ background: (isResidentReply || isCurrentUser) ? '#e6f7ff' : '#f6f6f6', padding: 10, borderRadius: 8 }}>
                                <Typography.Paragraph style={{ margin: 0 }}>{r.text}</Typography.Paragraph>
                                {r.attachments && r.attachments.length > 0 && (
                                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {r.attachments.map((a: any, i: number) => {
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
                              </div>}
                              datetime={<span style={{ fontSize: 12 }}>{r.createdAt ? new Date(r.createdAt).toLocaleString() : ''}</span>}
                              align={align}
                            />
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    <div style={{ marginTop: 0, flexShrink: 0 }}>
                      {/* Reply bar fixed at bottom of the conversation card */}
                      <div style={{ background: '#fff', paddingTop: 4, paddingBottom: 4, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                        {/* Auto-resizing textarea implemented with a controlled textarea and a simple resize handler */}
                        <textarea
                          value={replyText}
                          onChange={e => {
                            setReplyText(e.target.value);
                            // auto-resize
                            const el = e.target as HTMLTextAreaElement;
                            el.style.height = 'auto';
                            el.style.height = Math.min(200, el.scrollHeight) + 'px';
                          }}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              // send
                              if (!replyText || replyText.trim() === '') return antdMessage.warning('Reply cannot be empty');
                              if (!selectedInquiry || !selectedInquiry._id) return antdMessage.error('No inquiry selected');
                              const sendingKey = selectedInquiry._id;
                              setReplyLoading(r => ({ ...r, [sendingKey]: true }));
                              try {
                                const resp = await contactAPI.respondToInquiry(selectedInquiry._id, { response: replyText.trim() });
                                const updatedInquiry = resp;
                                setInquiries(prev => prev.map(i => i._id === updatedInquiry._id ? updatedInquiry : i));
                                setSelectedInquiry(updatedInquiry);
                                setReplyText('');
                                antdMessage.success('Reply sent');
                              } catch (err) {
                                console.error('Failed to send reply', err);
                                antdMessage.error('Failed to send reply');
                              } finally {
                                setReplyLoading(r => ({ ...r, [sendingKey]: false }));
                              }
                            }
                          }}
                          placeholder="Type your reply..."
                          style={{
                            width: '100%',
                            minHeight: 40,
                            maxHeight: 200,
                            resize: 'none',
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: '1px solid #e6edf3',
                            boxShadow: '0 1px 4px rgba(15, 23, 42, 0.04)',
                            fontSize: 14,
                            outline: 'none',
                            fontFamily: 'Poppins, Arial, sans-serif',
                            color: '#222'
                          }}
                        />

                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <button
                            onClick={async () => {
                              if (!replyText || replyText.trim() === '') return antdMessage.warning('Reply cannot be empty');
                              if (!selectedInquiry || !selectedInquiry._id) return antdMessage.error('No inquiry selected');
                              const sendingKey = selectedInquiry._id;
                              setReplyLoading(r => ({ ...r, [sendingKey]: true }));
                              try {
                                const resp = await contactAPI.respondToInquiry(selectedInquiry._id, { response: replyText.trim() });
                                const updatedInquiry = resp;
                                setInquiries(prev => prev.map(i => i._id === updatedInquiry._id ? updatedInquiry : i));
                                setSelectedInquiry(updatedInquiry);
                                setReplyText('');
                                antdMessage.success('Reply sent');
                              } catch (err) {
                                console.error('Failed to send reply', err);
                                antdMessage.error('Failed to send reply');
                              } finally {
                                setReplyLoading(r => ({ ...r, [sendingKey]: false }));
                              }
                            }}
                            style={{
                              background: '#0ea5a3',
                              color: '#fff',
                              border: 'none',
                              padding: '8px 14px',
                              borderRadius: 10,
                              cursor: 'pointer',
                              fontSize: 18,
                              fontWeight: 600,
                              boxShadow: '0 4px 10px rgba(14,165,163,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Send Reply"
                            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.95')}
                            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                            disabled={!!(selectedInquiry && replyLoading[selectedInquiry._id])}
                          >
                            <SendOutlined style={{ fontSize: 22, verticalAlign: 'middle' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: 32 }}>
                    <Typography.Text type="secondary">Select a message to view the conversation</Typography.Text>
                  </div>
                )}
              </Card>
            </div>)}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Inbox;
