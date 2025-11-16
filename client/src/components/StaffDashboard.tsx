import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Typography, Space, Avatar, Spin, Button, Modal, Input, Collapse, Tag, Empty, Badge, Timeline, Drawer, Table, notification } from 'antd';
import {
  HourglassOutlined,
  CaretUpOutlined,
  FolderOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  InboxOutlined,
  RightOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FileExclamationOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  ProfileOutlined,
  FileSearchOutlined,
  SolutionOutlined,
  TeamOutlined,
  MailOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, contactAPI } from '../services/api';


interface DocumentRequest {
  _id?: string;
  type?: string;
  title?: string;
  description?: string;
  username?: string;
  barangayID?: string;
  dateRequested?: string;
  status?: string;
  [key: string]: any;
}

const StaffDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [documentRequests, setDocumentRequests] = useState<DocumentRequest[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [inboxInquiries, setInboxInquiries] = useState<any[]>([]);
  const [viewedInquiryIds, setViewedInquiryIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('viewedInquiries');
      const arr = raw ? JSON.parse(raw) as string[] : [];
      return new Set(arr || []);
    } catch (e) {
      return new Set<string>();
    }
  });

  const markInquiryViewed = (id?: string) => {
    if (!id) return;
    setViewedInquiryIds(prev => {
      const next = new Set(Array.from(prev));
      next.add(String(id));
      try { localStorage.setItem('viewedInquiries', JSON.stringify(Array.from(next))); } catch (e) {}
      return next;
    });
  };
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  // Mini announcements (replace Recent Activity)
  const [miniAnns, setMiniAnns] = useState<any[]>([]);
  const [miniLoading, setMiniLoading] = useState(false);
  const [miniSelected, setMiniSelected] = useState<any | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRequest | null>(null);
  const [selectedInquiry, setSelectedInquiry] = useState<any>(null);
  const [manageModalVisible, setManageModalVisible] = useState(false);
  const [manageTableData, setManageTableData] = useState<any[] | null>(null);
  const [responseText, setResponseText] = useState('');
  const [documentStatus, setDocumentStatus] = useState('');
  const [responding, setResponding] = useState(false);
  const [completedModalVisible, setCompletedModalVisible] = useState(false);
  // Documents modal state
  const [docsModalVisible, setDocsModalVisible] = useState(false);
  const [allDocuments, setAllDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // Group document requests by type for processing
  const requestsByCategory: { [type: string]: DocumentRequest[] } = {};
  documentRequests.forEach((req) => {
    const docType = req.type || 'Unknown';
    if (!requestsByCategory[docType]) requestsByCategory[docType] = [];
    requestsByCategory[docType].push(req);
  });

  // Example stats for staff
  const [stats, setStats] = useState({
    pendingRequests: 0,
    totalDocuments: 0,
    completedRequests: 0,
  });

  // Group requests by category
  const categorizeRequests = (requests: DocumentRequest[]) => {
    const categories = {
      'Certificates': {
        icon: <SafetyCertificateOutlined style={{ fontSize: '18px', color: '#1890ff' }} />,
        items: [] as DocumentRequest[],
        color: '#1890ff',
        description: 'Birth, Death, Residency Certificates and more'
      },
      'Permits': {
        icon: <ProfileOutlined style={{ fontSize: '18px', color: '#52c41a' }} />,
        items: [] as DocumentRequest[],
        color: '#52c41a',
        description: 'Building, Business, and Special Event Permits'
      }
      ,
      'Complete': {
        icon: <FileDoneOutlined style={{ fontSize: '18px', color: '#52c41a' }} />,
        items: [] as DocumentRequest[],
        color: '#52c41a',
        description: 'All completed and approved document requests'
      }
    };

    requests.forEach(req => {
      const type = (req.type || '').toLowerCase();
      const status = (req.status || '').toLowerCase();
      if (type.includes('certificate') || type.includes('certification')) {
        categories['Certificates'].items.push(req);
      } else if (type.includes('permit')) {
        categories['Permits'].items.push(req);
      }

      // Add to Complete category if status is approved/completed
      if (status === 'approved' || status === 'completed') {
        categories['Complete'].items.push(req);
      }
    });

    return categories;
  };

  // Download processed document (handles both metadata id and direct GridFS file id)
  const handleDownloadProcessed = async (rec: any) => {
    try {
      // Follow TemplatesManager behavior: fetch the raw endpoint, convert to blob, and save using the server-provided filename when available.
      // Try metadata id first, then fall back to gridFsFileId if present and the first attempt 404s.
      const normalizeId = (v: any): string | null => {
        if (!v && v !== 0) return null;
        if (typeof v === 'string') return v;
        if (typeof v === 'object') {
          // Mongoose ObjectId-like objects may expose $oid (BSON) or toString()
          if (typeof v.$oid === 'string') return v.$oid;
          try {
            const s = (v as any).toString();
            if (s && s !== '[object Object]') return s;
          } catch (e) {}
          return null;
        }
        return String(v);
      };

      const tryIds = [] as string[];
      const nid = normalizeId(rec && rec._id);
      const ngfid = normalizeId(rec && rec.gridFsFileId);
      if (nid) tryIds.push(nid);
      if (ngfid) tryIds.push(ngfid);
      // de-dupe
      const ids = Array.from(new Set(tryIds));
      let finalResp: Response | null = null;
      let usedId: string | null = null;
      let lastError: any = null;

      console.debug('[handleDownloadProcessed] record:', rec, 'candidateIds:', ids);
      for (const id of ids) {
        try {
          console.debug('[handleDownloadProcessed] attempting id=', id);
          const r = await fetch(`/api/processed-documents/${id}/raw`, { credentials: 'include' });
          console.debug('[handleDownloadProcessed] response for id=', id, 'status=', r.status, 'headers:', {
            xProcessedSource: r.headers.get('x-processed-source'),
            contentDisposition: r.headers.get('content-disposition')
          });
          if (r.ok) {
            finalResp = r;
            usedId = id;
            break;
          }
          // If 404, try next id. For other statuses, surface error.
          if (r.status === 404) {
            lastError = { status: r.status, body: await (async () => { try { return await r.json(); } catch (e) { return null; } })() };
            continue;
          }
          // Non-404 failure: capture and stop
          let body = null;
          try { body = await r.json(); } catch (e) {}
          notification.error({ message: 'Download failed', description: (body && body.message) ? body.message : `Server returned ${r.status}` });
          return;
        } catch (err) {
          lastError = err;
          continue;
        }
      }

      if (!finalResp) {
        // Nothing worked
        const msg = lastError && lastError.body && lastError.body.message ? lastError.body.message : (lastError && lastError.message) ? lastError.message : 'File not found';
        notification.error({ message: 'Download failed', description: msg });
        return;
      }

      const blob = await finalResp.blob();

      // Prefer filename from Content-Disposition header if provided
      let filename: string | null = null;
      const cd = finalResp.headers.get('content-disposition') || finalResp.headers.get('Content-Disposition');
      if (cd) {
        const m = cd.match(/filename\*=UTF-8''([^;\n\r]+)/i);
        if (m && m[1]) filename = decodeURIComponent(m[1]);
        else {
          const m2 = cd.match(/filename="?([^";]+)"?/i);
          if (m2 && m2[1]) filename = m2[1];
        }
      }
      // Fallback to X-Processed headers or record fields
      if (!filename) filename = finalResp.headers.get('x-processed-transactioncode') || finalResp.headers.get('X-Processed-TransactionCode') || rec.filename || rec.name || `document_${usedId || rec._id}.docx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const downloadName = filename || `document_${usedId || rec._id}.docx`;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error', err);
      notification.error({ message: 'Download error', description: String(err) });
    }
  };

  const getStatusTag = (status?: string) => {
    const statusColors: { [key: string]: string } = {
      'pending': 'gold',
      'approved': 'success',
      'rejected': 'error',
      'processing': 'processing'
    };

    return (
      <Tag color={statusColors[status?.toLowerCase() || 'default']}>
        {status?.toUpperCase() || 'UNKNOWN'}
      </Tag>
    );
  };

  const getActivityIcon = (type: string) => {
    const iconStyle = { fontSize: '20px' };
    const iconMap: { [key: string]: React.ReactNode } = {
      'document_approved': <FileDoneOutlined style={{ ...iconStyle, color: '#52c41a' }} />,
      'document_rejected': <FileExclamationOutlined style={{ ...iconStyle, color: '#ff4d4f' }} />,
      'inquiry_responded': <MessageOutlined style={{ ...iconStyle, color: '#1890ff' }} />,
      'document_submitted': <FileTextOutlined style={{ ...iconStyle, color: '#faad14' }} />,
      'default': <ClockCircleOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />
    };
    return iconMap[type] || iconMap['default'];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch document records from /documents (not /document-requests/all)
      const [docRecords, inq] = await Promise.all([
        documentsAPI.getDocumentRecords(),
        contactAPI.getAllInquiries()
      ]);
      setDocumentRequests(docRecords);
      setInquiries(inq);
      // Filter for inbox: assignedRole matches user.role or assignedTo includes user._id
      const filtered = inq.filter((inq: any) =>
        (inq.assignedRole && user && inq.assignedRole === user.role) ||
        (inq.assignedTo && Array.isArray(inq.assignedTo) && user && inq.assignedTo.includes(user._id))
      );
      setInboxInquiries(filtered);
      // Attempt to get count of processed documents from server-side processed_documents metadata
      let processedCount = docRecords.length;
      try {
        const resp = await fetch('/api/processed-documents?page=1&limit=1', { credentials: 'include' });
        if (resp.ok) {
          const j = await resp.json();
          if (j && typeof j.total === 'number') processedCount = j.total;
        }
      } catch (e) {
        // ignore and fall back to docRecords.length
      }

      setStats({
        pendingRequests: docRecords.filter((d: any) => d.status === 'pending').length,
        totalDocuments: processedCount,
        completedRequests: docRecords.filter((d: any) => d.status === 'approved').length,
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchMiniAnnouncements();
  }, []);

  // Fetch processed documents (from documents collection) and open modal
  const fetchAllProcessedDocuments = async () => {
    setDocsLoading(true);
    try {
      // Prefer processed_documents metadata endpoint; fallback to older documents listing
      let processedItems: any[] = [];
      try {
        const resp = await fetch('/api/processed-documents?page=1&limit=200', { credentials: 'include' });
        if (resp.ok) {
          const j = await resp.json();
          if (j && Array.isArray(j.items)) {
            processedItems = j.items;
          } else if (Array.isArray(j)) {
            processedItems = j;
          }
        }
      } catch (e) {
        // fallback to older endpoints
        try {
          const files: any = await documentsAPI.listFiles();
          const arr = Array.isArray(files) ? files : (files && files.data) ? files.data : [];
          processedItems = arr.filter((d: any) => {
            const s = (d.status || '').toString().toLowerCase();
            return ['processed', 'approved', 'completed'].includes(s) || d.processed === true;
          });
        } catch (e2) {
          processedItems = [];
        }
      }

      setAllDocuments(processedItems || []);
    } catch (err) {
      console.error('Failed to fetch documents for modal', err);
      setAllDocuments([]);
    } finally {
      setDocsLoading(false);
      setDocsModalVisible(true);
    }
  };

  const fetchMiniAnnouncements = async () => {
    setMiniLoading(true);
    try {
      const data = await contactAPI.getAnnouncements();
      setMiniAnns(Array.isArray(data) ? data.slice(0, 6) : []);
    } catch (err) {
      console.error('Failed to load mini announcements', err);
      setMiniAnns([]);
    } finally {
      setMiniLoading(false);
    }
  };

  // Document status update
  const handleDocumentAction = async () => {
    if (!selectedDocument || !documentStatus) return;
    try {
      await documentsAPI.updateDocumentStatus(selectedDocument._id || '', {
        status: documentStatus,
        notes: responseText,
      });
      setSelectedDocument(null);
      setResponseText('');
      setDocumentStatus('');
      fetchData();
    } catch (error) {
      console.error('Error updating document status:', error);
    }
  };

  // Inquiry response
  const handleInquiryResponse = async () => {
    if (!selectedInquiry || !responseText) return;
    try {
      setResponding(true);
      await contactAPI.respondToInquiry(selectedInquiry._id, {
        response: responseText,
      });
      setSelectedInquiry(null);
      setResponseText('');
      fetchData();
    } catch (error) {
      console.error('Error responding to inquiry:', error);
    } finally {
      setResponding(false);
    }
  };

  // Mark inquiry as resolved
  const handleResolveInquiry = async (inquiryId?: string) => {
    const id = inquiryId || (selectedInquiry && selectedInquiry._id);
    if (!id) return;
    try {
      await contactAPI.resolveInquiry(id);
      // Close modal if open and refresh
      setSelectedInquiry(null);
      setResponseText('');
      fetchData();
    } catch (error) {
      console.error('Error resolving inquiry:', error);
    }
  };

  // Open Manage/Expand modal helper (centralized for logging + notification)
  const openManageModal = (e?: React.MouseEvent) => {
    try {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    } catch (err) {}
    try {
      console.debug('[StaffDashboard] openManageModal clicked');
      notification.info({ message: 'Opening Inquiries', description: 'Loading inquiries into the table...', duration: 1.5 });
    } catch (err) {}
    setManageTableData(sortByDateDesc(inquiries));
    setManageModalVisible(true);
  };

  // Format helpers
  // Helper to format document type for display
  function formatDocumentType(type?: string) {
    if (!type) return 'Unknown';
    // If you have a typeToCategory mapping, use it here
    // let name = typeToCategory[type] || type;
    let name = type;
    // Remove 'Other' prefix and extra spaces
    name = name.replace(/^Other\s*/i, '').trim();
    // Replace underscores with spaces and capitalize each word
    return name
      .split('_')
      .map(word => {
        const w = word || '';
        return w.length > 0 ? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()) : '';
      })
      .filter(Boolean)
      .join(' ');
  }

  // Helper to format date for display
  function formatDate(dateString?: string) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString();
  }

  // Sort an array of inquiries/documents by createdAt descending (newest first)
  const sortByDateDesc = (arr: any[] = []) => {
    return (arr || []).slice().sort((a: any, b: any) => {
      const ta = a && a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b && b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return tb - ta;
    });
  };

  // Only one List for Document Categories will be rendered below in the Card section
  // (Card/Col/Row structure continues below)

  const goWithState = (path: string, state?: any) => {
    navigate(path, { state });
  };

  const go = (path: string) => {
    try {
      navigate(path);
    } catch (e) {
      window.location.href = path;
    }
  };

  // No replacement needed - removing the duplicate function

  return (
    <Spin spinning={loading} tip="Loading...">
      <div>
        {/* KPI Cards Row */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card 
              hoverable 
              bordered={false}
              size="small"
              onClick={() => {
                // If there are pending requests, navigate to document processing and open the first one
                const pending = documentRequests.find(d => d.status === 'pending');
                if (pending && pending._id) {
                  goWithState('/document-processing', { openRequestId: pending._id });
                } else {
                  goWithState('/document-processing');
                }
              }} 
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: '#fff7e6', color: '#faad14' }}>
                      <HourglassOutlined style={{ fontSize: '14px' }} />
                    </Avatar>
                    <span>Pending Requests</span>
                  </Space>
                }
                value={stats.pendingRequests}
                valueStyle={{ color: '#faad14', fontSize: '28px', marginBottom: '4px' }}
                prefix={<CaretUpOutlined style={{ fontSize: '16px' }} />}
              />
              <Typography.Link style={{ fontSize: '13px', color: '#faad14' }}>
                View Pending Requests
                <RightOutlined style={{ fontSize: '11px', marginLeft: '4px' }} />
              </Typography.Link>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card 
              hoverable 
              bordered={false}
              size="small"
              onClick={() => fetchAllProcessedDocuments()} 
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: '#e6f7ff', color: '#1890ff' }}>
                      <FolderOutlined style={{ fontSize: '14px' }} />
                    </Avatar>
                    <span>Total Documents</span>
                  </Space>
                }
                value={stats.totalDocuments}
                valueStyle={{ color: '#1890ff', fontSize: '28px', marginBottom: '4px' }}
                prefix={<DatabaseOutlined style={{ fontSize: '16px' }} />}
              />
              <Typography.Link style={{ fontSize: '13px', color: '#1890ff' }}>
                Browse Documents
                <RightOutlined style={{ fontSize: '11px', marginLeft: '4px' }} />
              </Typography.Link>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card 
              hoverable 
              bordered={false}
              size="small"
              onClick={() => setCompletedModalVisible(true)} 
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: '#f6ffed', color: '#52c41a' }}>
                      <CheckCircleOutlined style={{ fontSize: '14px' }} />
                    </Avatar>
                    <span>Completed Requests</span>
                  </Space>
                }
                value={stats.completedRequests}
                valueStyle={{ color: '#52c41a', fontSize: '28px', marginBottom: '4px' }}
                prefix={<CheckOutlined style={{ fontSize: '16px' }} />}
              />
              <Typography.Link style={{ fontSize: '13px', color: '#52c41a' }}>
                View Completed
                <RightOutlined style={{ fontSize: '11px', marginLeft: '4px' }} />
              </Typography.Link>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card 
              hoverable 
              bordered={false}
              size="small"
              onClick={() => go('/staff/inbox')} 
              style={{ 
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Statistic
                title={
                  <Space>
                    <Avatar size="small" style={{ backgroundColor: '#f9f0ff', color: '#722ed1' }}>
                      <InboxOutlined style={{ fontSize: '14px' }} />
                    </Avatar>
                    <span>Staff Inbox</span>
                  </Space>
                }
                value={inboxInquiries.length}
                valueStyle={{ color: '#722ed1', fontSize: '28px', marginBottom: '4px' }}
                prefix={<MessageOutlined style={{ fontSize: '16px' }} />}
              />
              <Typography.Link style={{ fontSize: '13px', color: '#722ed1' }}>
                Open Inbox
                <RightOutlined style={{ fontSize: '11px', marginLeft: '4px' }} />
              </Typography.Link>
            </Card>
          </Col>
        </Row>
        {/* Main Content Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card 
              title={<Space><FileSearchOutlined /> Document Categories</Space>} 
              hoverable
              bordered={false}
              size="small"
              className="dashboard-card"
              style={{ 
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
              bodyStyle={{ 
                padding: '0',
                height: '400px',
                maxHeight: '400px',
                overflow: 'hidden'
              }}
            >
              <Collapse
                defaultActiveKey={['Certificates']}
                expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
                style={{ 
                  background: 'white',
                  height: '400px',
                  overflowY: 'auto'
                }}
              >
                {Object.entries(categorizeRequests(documentRequests)).map(([category, data]) => {
                  const pendingCount = data.items.filter((req: DocumentRequest) => req.status?.toLowerCase() === 'pending').length;
                  return (
                    <Collapse.Panel
                      key={category}
                      header={
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <Space align="center">
                            <Avatar size="small" style={{ backgroundColor: data.color + '15', color: data.color }}>
                              {data.icon}
                            </Avatar>
                            <span style={{ fontWeight: 500, fontSize: '14px' }}>{category}</span>
                          </Space>
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {pendingCount > 0 && (
                              <Tag color="gold" style={{ marginRight: 0 }}>
                                {pendingCount} pending
                              </Tag>
                            )}
                            <Badge 
                              count={data.items.length} 
                              style={{ backgroundColor: data.color }}
                              size="small"
                            />
                          </div>
                        </div>
                      }
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                          {data.description}
                        </Typography.Text>
                      </div>
                      
                      <List
                        size="small"
                        dataSource={data.items.slice(0, 5)}
                        split={true}
                        renderItem={request => {
                          const statusColors = {
                            PENDING: { color: '#faad14', bg: '#fff7e6' },
                            APPROVED: { color: '#52c41a', bg: '#f6ffed' },
                            REJECTED: { color: '#ff4d4f', bg: '#fff1f0' },
                            DEFAULT: { color: '#8c8c8c', bg: '#f5f5f5' }
                          };
                          
                          const status = request.status?.toUpperCase() || 'DEFAULT';
                          const statusStyle = statusColors[status as keyof typeof statusColors] || statusColors.DEFAULT;

                          return (
                            <List.Item
                              onClick={() => navigate('/document-processing', { state: { openRequestId: request._id } })}
                              actions={[
                                request.status === 'PENDING' && (
                                  <Space size={4}>
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                                      onClick={(e) => { e.stopPropagation(); setSelectedDocument(request); setDocumentStatus('APPROVED'); }}
                                    />
                                    <Button
                                      type="text"
                                      size="small"
                                      icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                                      onClick={(e) => { e.stopPropagation(); setSelectedDocument(request); setDocumentStatus('REJECTED'); }}
                                    />
                                  </Space>
                                )
                              ].filter(Boolean)}
                              style={{ padding: '12px 0' }}
                            >
                              <List.Item.Meta
                                avatar={
                                  <Avatar
                                    size={36}
                                    style={{ 
                                      backgroundColor: statusStyle.bg,
                                      color: statusStyle.color
                                    }}
                                    icon={<FileTextOutlined />}
                                  />
                                }
                                title={
                                  <Space size={8} style={{ marginBottom: 4 }}>
                                    <Typography.Text strong style={{ fontSize: '14px' }}>
                                      {formatDocumentType(request.type || request.title)}
                                    </Typography.Text>
                                    <Tag
                                      color={statusStyle.color}
                                      style={{ 
                                        margin: 0,
                                        padding: '0 6px',
                                        fontSize: '12px',
                                        lineHeight: '18px'
                                      }}
                                    >
                                      {status}
                                    </Tag>
                                  </Space>
                                }
                                description={
                                  <Space direction="vertical" size={0}>
                                    <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                                      Requested by: {request.username || 'Unknown'}
                                    </Typography.Text>
                                    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                      {formatDate(request.dateRequested || '')}
                                    </Typography.Text>
                                  </Space>
                                }
                              />
                            </List.Item>
                          );
                        }}
                        locale={{ 
                          emptyText: (
                            <Empty 
                              image={Empty.PRESENTED_IMAGE_SIMPLE} 
                              description={
                                <Typography.Text type="secondary">
                                  No {category.toLowerCase()} requests
                                </Typography.Text>
                              }
                            />
                          )
                        }}
                      />
                      {data.items.length > 0 && (
                        <div style={{ 
                          textAlign: 'center', 
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid #f0f0f0'
                        }}>
                          <Button
                            type="link"
                            size="small"
                            icon={data.icon}
                            onClick={() => go('/documents')}
                          >
                            View All {category}
                          </Button>
                        </div>
                      )}
                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
              <Card 
              title={
                <Space>
                  <MailOutlined />
                  <span>Inquiries Inbox</span>
                  <Badge 
                    count={inboxInquiries.filter(i => i.status === 'open' || i.status === 'PENDING').length} 
                    style={{ backgroundColor: '#722ed1' }}
                  />
                </Space>
              }
              extra={
                <Space>
                  <Statistic
                    value={inboxInquiries.length}
                    suffix="total"
                    valueStyle={{ fontSize: '14px', color: '#8c8c8c' }}
                  />
                </Space>
              }
              hoverable
              bordered={false}
              size="small"
              className="dashboard-card"
              style={{ 
                transition: 'all 0.3s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                position: 'relative'
              }}
              bodyStyle={{ 
                height: '400px',
                maxHeight: '400px',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '0 12px' }}>
                <Collapse
                  accordion={false}
                  defaultActiveKey={[ 'open' ]}
                  expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
                  style={{ background: 'white' }}
                >
                  <Collapse.Panel
                    key="open"
                    header={
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Space align="center">
                          <MailOutlined style={{ color: '#722ed1', fontSize: '16px' }} />
                          <Typography.Text strong>Open Inquiries</Typography.Text>
                          <Badge count={inboxInquiries.filter(i => i.status === 'PENDING' || i.status === 'open').length} style={{ backgroundColor: '#722ed1' }} />
                        </Space>
                      </div>
                    }
                  >
                    <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 8 }}>
                      {inboxInquiries.filter(i => i.status === 'PENDING' || i.status === 'open').length === 0 ? (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">No open inquiries</Typography.Text>} />
                      ) : (
            <List
                size="large"
              dataSource={sortByDateDesc(inboxInquiries.filter(i => i.status === 'PENDING' || i.status === 'open'))}
                          renderItem={inquiry => {
                  const isOpen = inquiry.status === 'PENDING' || inquiry.status === 'open';
          const avatarColor = isOpen ? '#722ed1' : '#8c8c8c';
          const avatarBg = isOpen ? '#f9f0ff' : '#f5f5f5';
          const isViewed = inquiry._id && viewedInquiryIds.has(String(inquiry._id));

          const displayName = inquiry.username || inquiry.residentName || inquiry.subject || 'Unknown';
          const letter = (displayName && displayName !== 'Unknown' && displayName.length > 0) ? displayName.charAt(0).toUpperCase() : '?';

                      return (
                        <List.Item
                      style={{ 
                        padding: '18px 20px',
                        minHeight: 72,
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer',
                        backgroundColor: 'white'
                      }}
                      onClick={() => {
                        // mark as viewed locally so the dot color changes (persisted)
                        if (inquiry._id) markInquiryViewed(String(inquiry._id));
                        navigate('/staff/inbox', { state: { openInquiryId: inquiry._id } });
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#fafafa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                      }}
                      
                      >
                      <List.Item.Meta
                        avatar={
                          <Badge dot={isOpen} color={isOpen && !isViewed ? '#faad14' : '#722ed1'} offset={[-6, 6]}>
                            <Avatar
                              size={40}
                              style={{
                                backgroundColor: avatarBg,
                                color: avatarColor,
                                fontSize: '15px',
                                fontWeight: 600
                              }}
                            >
                              {letter}
                            </Avatar>
                          </Badge>
                        }
                        title={
                          <div style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: 0
                          }}>
                            <div style={{ 
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'rgba(0, 0, 0, 0.85)'
                            }}>
                              {inquiry.username || 'Unknown User'}
                            </div>
                            <Tag 
                              color={isOpen ? 'gold' : 'success'}
                              style={{ 
                                margin: 0,
                                fontSize: '12px',
                                lineHeight: '20px',
                                height: '22px',
                                padding: '0 10px',
                                fontWeight: 'normal',
                                borderRadius: '4px'
                              }}
                            >
                              {isOpen ? 'PENDING' : 'RESOLVED'}
                            </Tag>
                            {isOpen && !isViewed && (
                              <Tag
                                color="default"
                                onClick={(e) => { e.stopPropagation(); if (inquiry._id) markInquiryViewed(String(inquiry._id)); }}
                                style={{ marginLeft: 8, cursor: 'pointer', background: '#fff7e6', color: '#d48806', border: '1px solid #ffd591' }}
                              >
                                UNREAD
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                            <Typography.Text
                              style={{ 
                                fontSize: '13px',
                                color: 'rgba(0, 0, 0, 0.65)',
                                flexGrow: 1,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                lineHeight: '1.5'
                              }}
                            >
                              {inquiry.message}
                            </Typography.Text>
                            <Typography.Text 
                              type="secondary" 
                              style={{ 
                                fontSize: '12px', 
                                flexShrink: 0,
                                color: '#8c8c8c'
                              }}
                            >
                              {formatDate(inquiry.createdAt)}
                            </Typography.Text>
                          </div>
                        }
                      />
                    </List.Item>
                          );
                        }}
                      />
                    )}
                  </div>
                </Collapse.Panel>
                <Collapse.Panel
                  key="resolved"
                  header={
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <Space align="center">
                        <MailOutlined style={{ color: '#52c41a', fontSize: '16px' }} />
                        <Typography.Text strong>Resolved Inquiries</Typography.Text>
                        <Badge count={inboxInquiries.filter(i => !(i.status === 'PENDING' || i.status === 'open')).length} style={{ backgroundColor: '#52c41a' }} />
                      </Space>
                    </div>
                  }
                >
                  <div style={{ maxHeight: 220, overflowY: 'auto', paddingRight: 8 }}>
                    {inboxInquiries.filter(i => !(i.status === 'PENDING' || i.status === 'open')).length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Typography.Text type="secondary">No resolved inquiries</Typography.Text>} />
                    ) : (
                      <List
                        size="small"
                        dataSource={sortByDateDesc(inboxInquiries.filter(i => !(i.status === 'PENDING' || i.status === 'open')))}
                        renderItem={inquiry => {
                          const isOpen = false;
                          const avatarColor = '#8c8c8c';
                          const avatarBg = '#f5f5f5';

                          return (
                            <List.Item
                              style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}
                            onClick={() => {
                              if (inquiry._id) markInquiryViewed(String(inquiry._id));
                              setSelectedInquiry(inquiry);
                            }}
                            >
                              <List.Item.Meta
                                avatar={<Avatar size={40} style={{ backgroundColor: avatarBg, color: avatarColor, fontSize: 14 }}>{(inquiry.username || 'Unknown').charAt(0).toUpperCase()}</Avatar>}
                                title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inquiry.username || 'Unknown User'}</div>
                                  <Tag color="success" style={{ margin: 0, fontSize: 12 }}>{'RESOLVED'}</Tag>
                                </div>}
                                description={<div style={{ fontSize: 12, color: '#888' }}>{inquiry.message}</div>}
                              />
                            </List.Item>
                          );
                        }}
                      />
                    )}
                  </div>
                </Collapse.Panel>
              </Collapse>
              {/* Manage button positioned at bottom-right of the card */}
              <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 40 }}>
                <Button
                  type="link"
                  style={{ position: 'absolute', right: 16, bottom: 0, fontSize: 13, color: '#1890ff', zIndex: 50, pointerEvents: 'auto' }}
                  onClick={(e) => { try { e.stopPropagation(); } catch (err) {} ; navigate('/inquiry-tracker'); }}
                >
                  Expand
                </Button>
              </div>
            </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title={<Space><FileTextOutlined /> Announcements</Space>}
              style={{ marginTop: 0, background: '#fafbfc', borderRadius: 12, boxShadow: '0 2px 8px #d9d9d933', border: '1px solid #f0f0f0', position: 'relative' }}
              styles={{ body: { padding: 12 } }}
              size="small"
              hoverable={false}
            >
              {miniAnns.length === 0 ? (
                <Empty
                  image={<FileTextOutlined style={{ fontSize: 42, color: '#d9d9d9' }} />}
                  description={<span style={{ color: '#888' }}>No announcements</span>}
                />
              ) : (
                <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 6 }}>
                  <List
                    loading={miniLoading}
                    dataSource={miniAnns}
                    renderItem={(item) => (
                      <List.Item style={{ cursor: 'pointer', padding: '10px 8px', alignItems: 'center' }} onClick={() => { setMiniSelected(item); setDrawerVisible(true); }}>
                        <List.Item.Meta
                          title={<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.2em' }}>{item.text || 'Untitled'}</div>
                              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{new Date(item.createdAt).toLocaleString()}</div>
                            </div>
                          </div>}
                          description={null}
                        />
                        {item.imagePath && (
                          <div style={{ marginLeft: 12, width: 92, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <img loading="lazy" className="rounded-img" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${item._id}/image`} alt="ann" style={{ width: 92, height: 60, objectFit: 'cover', borderRadius: 6, background: '#f0f0f0' }} />
                          </div>
                        )}
                      </List.Item>
                    )}
                    size="small"
                  />
                </div>
              )}
              <Button type="link" style={{ position: 'absolute', right: 16, bottom: 0, fontSize: 13, color: '#1890ff' }} onClick={() => navigate('/admin/announcements')}>Manage</Button>

              <Drawer open={drawerVisible} onClose={() => { setDrawerVisible(false); setMiniSelected(null); }} title="Announcement" width={720} placement="right">
                {miniSelected && (
                  <div>
                    <Typography.Text style={{ display: 'block', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{miniSelected.text}</Typography.Text>
                    {miniSelected.imagePath && (
                      <img loading="lazy" className="rounded-img rounded-img-lg" src={`${process.env.REACT_APP_API_URL || ''}/api/announcements/${miniSelected._id}/image`} alt="announcement" style={{ width: '100%', height: 'auto', borderRadius: 8, background: '#f6f6f6' }} />
                    )}
                    <div style={{ marginTop: 8, color: '#888' }}>{new Date(miniSelected.createdAt).toLocaleString()}</div>
                  </div>
                )}
              </Drawer>
            </Card>

            {/* Completed Requests card removed per user request */}
          </Col>
        </Row>
        {/* Documents Modal - shows processed documents from documents collection */}
        <Modal
          open={docsModalVisible}
          title={`Processed Documents (${allDocuments.length})`}
          onCancel={() => { setDocsModalVisible(false); }}
          footer={null}
          width={900}
        >
          <Spin spinning={docsLoading}>
            <Table
              dataSource={allDocuments}
              rowKey={(r: any) => r._id || r.id || r.filename}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: 'Title', dataIndex: 'title', key: 'title', render: (t: any, r: any) => t || r.filename || r.name || 'Untitled' },
                { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (d: any) => formatDate(d) },
                {
                  title: 'Action',
                  key: 'action',
                  width: 120,
                  render: (_: any, rec: any) => (
                    <Button type="link" onClick={() => handleDownloadProcessed(rec)}>Download</Button>
                  )
                }
              ]}
            />
          </Spin>
          <Modal
            title="Manage Inquiries"
            open={manageModalVisible}
            onCancel={() => { setManageModalVisible(false); setManageTableData(null); }}
            footer={null}
            width={900}
          >
            <Table
              dataSource={manageTableData !== null ? manageTableData : sortByDateDesc(inquiries)}
              rowKey={(r: any) => r._id}
              pagination={{ pageSize: 10 }}
              onRow={(record) => ({
                onClick: () => {
                  // mark viewed and navigate to the thread
                  if (record && record._id) markInquiryViewed(String(record._id));
                  setManageModalVisible(false);
                  navigate('/staff/inbox', { state: { openInquiryId: record._id } });
                }
              })}
            >
              <Table.Column
                title="Name"
                dataIndex="username"
                key="username"
                render={(v: any, r: any) => v || r.residentName || r.subject || 'Unknown'}
              />
              <Table.Column
                title="Type of Inquiry"
                dataIndex="type"
                key="type"
                render={(t: any) => (t ? String(t) : 'General')}
              />
              <Table.Column
                title="Status"
                dataIndex="status"
                key="status"
                render={(s: any) => getStatusTag(s)}
              />
              <Table.Column
                title="Date Inquired"
                dataIndex="createdAt"
                key="createdAt"
                render={(d: any) => formatDate(d)}
              />
            </Table>
          </Modal>
        </Modal>

        {/* Document Response Modal */}
        <Modal
          open={!!selectedDocument}
          title={selectedDocument ? `${documentStatus} Document Request` : ''}
          onCancel={() => { setSelectedDocument(null); setResponseText(''); setDocumentStatus(''); }}
          footer={selectedDocument ? [
            <Input.TextArea
              key="notes"
              rows={4}
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Type notes..."
            />,
            <Button
              key="submit"
              type="primary"
              disabled={!responseText.trim()}
              onClick={handleDocumentAction}
            >Submit</Button>
          ] : null}
        >
          {selectedDocument && (
            <div>
              <Typography.Text strong>Type:</Typography.Text> {formatDocumentType(selectedDocument.type || selectedDocument.title)}<br />
              <Typography.Text strong>Description:</Typography.Text> {selectedDocument.description || ''}<br />
              <Typography.Text strong>Requested by:</Typography.Text> {selectedDocument.username || 'Unknown'}<br />
              <Typography.Text strong>Barangay ID:</Typography.Text> {selectedDocument.barangayID || 'Unknown'}<br />
              <Typography.Text strong>Date:</Typography.Text> {formatDate(selectedDocument.dateRequested || '')}<br />
            </div>
          )}
        </Modal>
        {/* Inquiry Response Modal */}
        <Modal
          open={!!selectedInquiry}
          title={selectedInquiry ? `Respond to Inquiry: ${selectedInquiry.subject}` : ''}
          onCancel={() => { setSelectedInquiry(null); setResponseText(''); }}
          footer={selectedInquiry ? [
            <Input.TextArea
              key="response"
              rows={4}
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              placeholder="Type your response..."
              disabled={responding}
            />,
            <Button
              key="send"
              type="primary"
              loading={responding}
              disabled={!responseText.trim()}
              onClick={handleInquiryResponse}
            >Send Response</Button>
          ] : null}
        >
          {selectedInquiry && (
            <div>
              <Typography.Text strong>Type:</Typography.Text> {selectedInquiry.type}<br />
              <Typography.Text strong>Message:</Typography.Text> {selectedInquiry.message}<br />
              <Typography.Text strong>From:</Typography.Text> {selectedInquiry.username ? `${selectedInquiry.username} (Barangay ID: ${selectedInquiry.barangayID || 'Unknown'})` : 'Unknown'}<br />
              <Typography.Text strong>Date:</Typography.Text> {formatDate(selectedInquiry.createdAt)}<br />
            </div>
          )}
        </Modal>
        {/* Completed Requests Modal */}
        <Modal
          open={completedModalVisible}
          title={`Completed Requests (${stats.completedRequests || 0})`}
          onCancel={() => setCompletedModalVisible(false)}
          footer={null}
          width={1100}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ overflowX: 'auto' }}>
            {/* Table of completed document requests (horizontally scrollable) */}
            <Table
              dataSource={documentRequests.filter(d => (d.status || '').toLowerCase() === 'approved' || (d.status || '').toLowerCase() === 'completed')}
              rowKey={(record: any) => record._id}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
              columns={[
                {
                  title: 'Requester',
                  dataIndex: 'username',
                  key: 'username',
                  width: 200,
                  render: (val: any, rec: any) => val || rec.requesterId?.fullName || 'Unknown'
                },
                {
                  title: 'Document',
                  dataIndex: 'type',
                  key: 'type',
                  width: 220,
                  render: (val: any, rec: any) => formatDocumentType(val || rec.title)
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  key: 'description',
                  width: 300,
                  render: (val: any) => val || '-'
                },
                {
                  title: 'Date Requested',
                  dataIndex: 'dateRequested',
                  key: 'dateRequested',
                  width: 180,
                  render: (val: any) => formatDate(val)
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  width: 120,
                  render: (val: any) => getStatusTag(val)
                },
                {
                  title: 'Action',
                  key: 'action',
                  width: 120,
                  render: (_: any, rec: any) => (
                    <Button type="link" onClick={() => { setSelectedDocument(rec); setCompletedModalVisible(false); setDocumentStatus(''); }}>
                      View
                    </Button>
                  )
                }
              ]}
            />
          </div>
        </Modal>
      </div>
    </Spin>

  );
}

export default StaffDashboard;
