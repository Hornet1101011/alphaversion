import { useRef } from 'react';
import React, { useEffect, useState } from 'react';
import './DocumentProcessingHighlight.css';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, Typography, Row, Col, Modal, Spin, Table, Input, Tooltip, Tag, Space, Button, Radio, Select, DatePicker, notification } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { FileWordOutlined, FilePdfOutlined, FileImageOutlined, EyeOutlined } from '@ant-design/icons';
import { documentsAPI, API_URL } from '../services/api';
import { formatDate as formatDateUtil } from '../utils/formatDate';
import { generateFilledDocx } from '../services/generateFilledDocx';

const DocumentProcessing: React.FC = () => {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [requestedTypes, setRequestedTypes] = useState<string[]>([]);
  const [fileRequestMap, setFileRequestMap] = useState<Record<string, any>>({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRequests, setPreviewRequests] = useState<any[]>([]);
  const [previewTemplateHtml, setPreviewTemplateHtml] = useState<string>('');
  const [previewSelectedRequestId, setPreviewSelectedRequestId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const highlightTimeoutRef = useRef<number | null>(null);
  const [residentInfo, setResidentInfo] = useState<any>(null);
  const [requestFieldValues, setRequestFieldValues] = useState<Record<string, string>>({});
  const [prioritizeModalVisible, setPrioritizeModalVisible] = useState(false);
  const [prioritizeCandidates, setPrioritizeCandidates] = useState<any[]>([]);
  const [selectedPriorityRequest, setSelectedPriorityRequest] = useState<string | null>(null);
  const [prioritizeTargetFileId, setPrioritizeTargetFileId] = useState<string | null>(null);
  const [generatedCopyId, setGeneratedCopyId] = useState<string | null>(null);
  const [generatedModalVisible, setGeneratedModalVisible] = useState(false);
  const [processedDocId, setProcessedDocId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterRange, setFilterRange] = useState<any | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const openRequestIdFromNav = (location && (location.state as any) && (location.state as any).openRequestId) ? (location.state as any).openRequestId : null;

  // Helpers to work with fileRequestMap which stores arrays per file id
  const getRequestsForFile = (fileId: string) => {
    const v = fileRequestMap[fileId];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };

  const getPrimaryRequest = (fileId: string) => {
    const arr = getRequestsForFile(fileId);
    return arr.length ? arr[0] : null;
  };

  const getPrioritizedRequest = (fileId: string) => {
    const arr = getRequestsForFile(fileId);
    if (!arr || !arr.length) return null;
    const found = arr.find((r: any) => ((r.notes && r.notes.toString().toLowerCase().includes('priority')) || r.priority === true));
    return found || arr[0];
  };
  // Fetch files and requests and build fileRequestMap. Extracted so we can call it after prioritization.
  const fetchFilesAndRequests = async () => {
    setLoading(true);
    try {
      // Fetch all GridFS files
      const fileList = await documentsAPI.listFiles();
      // Fetch document requests (all, for staff/admin; use getMyDocuments for user)
      const requests = await documentsAPI.getDocumentRecords();
      // Extract unique requested types (normalize to lowercase for matching)
      const types: string[] = Array.from(new Set((requests || []).map((r: any) => (r.type || '').toLowerCase()).filter(Boolean)));
      setRequestedTypes(types);
      // Map files to their matching requests (by type in filename)
      // We store an array per file id to support multiple requests for the same template/file
      const fileRequestMapLocal: Record<string, any> = {};
      // Helper to normalize strings: remove all non-alphanumeric chars, lowercase
      const normalize = (str: string) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      fileList.forEach((file: any) => {
        if (!file || !file.filename) return;
        const normalizedFilename = normalize(file.filename);
        // Find all requests whose type matches filename (robust normalization)
        const matchedRequests = (requests || []).filter((req: any) =>
          req.type && normalizedFilename.includes(normalize(req.type))
        );
        if (matchedRequests && matchedRequests.length) fileRequestMapLocal[file._id] = matchedRequests;
      });
      // Filter files to only those matching requested types
      const filteredFiles = fileList.filter((file: any) => {
        if (!file || !file.filename) return false;
        if (types.length === 0) return true; // If no requests, show all
        const normalizedFilename = file.filename.replace(/[_\s]/g, '').toLowerCase();
        return types.some((type: string) => normalizedFilename.includes(type.replace(/[_\s]/g, '')));
      });
      setFiles(filteredFiles);
      setFileRequestMap(fileRequestMapLocal);
    } catch (err) {
      setFileRequestMap({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFilesAndRequests();
    const onResize = () => setIsMobile(window.innerWidth <= 720);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // After files and mapping are fetched, if navigation included an openRequestId, open the preview
  useEffect(() => {
    if (!openRequestIdFromNav) return;
    // Find the file that contains this request
    const fileId = Object.keys(fileRequestMap).find(fid => {
      const arr = Array.isArray(fileRequestMap[fid]) ? fileRequestMap[fid] : (fileRequestMap[fid] ? [fileRequestMap[fid]] : []);
      return arr.some((r: any) => (r._id || r.requestId) === openRequestIdFromNav);
    });
    if (fileId) {
      const file = files.find(f => f._id === fileId);
      if (file) {
        // open preview for that file and request
        setSelectedFile(file);
        handleProcessClick(file).then(() => {
          setPreviewSelectedRequestId(openRequestIdFromNav);
          renderPreviewForRequest(openRequestIdFromNav);
          setPreviewVisible(true);
        }).catch(() => {});
      }
    }
    else {
      // No matching file found in the mapping. Try fetching the request directly and open a lightweight preview
      (async () => {
        try {
          if ((documentsAPI as any).getDocumentById) {
            const req = await (documentsAPI as any).getDocumentById(openRequestIdFromNav);
            if (req) {
              // Ensure previewRequests contains this request and open the preview modal
              setPreviewRequests([req]);
              setPreviewSelectedRequestId(openRequestIdFromNav);
              // Build a simple previewHtml from the request.fieldValues if template HTML isn't available
              try {
                const fieldValues = req.fieldValues || {};
                const keys = Object.keys(fieldValues);
                if (keys.length) {
                  const tableHtml = `
                    <table style="width:100%;border-collapse:collapse;">
                      <thead>
                        <tr>
                          <th style='border:1px solid #ccc;padding:8px;text-align:left;'>Field</th>
                          <th style='border:1px solid #ccc;padding:8px;text-align:left;'>Submitted Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${keys.map(k => `<tr><td style='border:1px solid #ccc;padding:8px;'>${k}</td><td style='border:1px solid #ccc;padding:8px;'>${(fieldValues[k] || '')}</td></tr>`).join('')}
                      </tbody>
                    </table>
                    // when we open a preview for a request that wasn't tied to a specific file in mapping,
                    // attempt to scroll to and highlight the request's entry if present in the UI
                    setTimeout(() => {
                      try {
                        const el = rowRefs.current[openRequestIdFromNav];
                        if (el && el.scrollIntoView) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          el.classList.add('cv-highlight');
                          if (highlightTimeoutRef.current) window.clearTimeout(highlightTimeoutRef.current);
                          // remove highlight after 2s
                          // @ts-ignore - window.setTimeout returns number in browser
                          highlightTimeoutRef.current = window.setTimeout(() => el.classList.remove('cv-highlight'), 2000);
                        }
                      } catch (e) {}
                    }, 120);
                  `;
                  setPreviewHtml(tableHtml);
                } else {
                  setPreviewHtml('<div style="color:#666">No submitted field values available.</div>');
                }
              } catch (e) {
                setPreviewHtml('<div style="color:red">Failed to build preview.</div>');
              }
              setPreviewVisible(true);
            }
          }
        } catch (e) {
          // ignore — best effort
        }
      })();
    }
    // clear navigation state so it doesn't re-open repeatedly
    try { navigate(location.pathname, { replace: true, state: {} }); } catch (e) {}
  }, [fileRequestMap, files]);

  const handleCardClick = (file: any) => {
    setSelectedFile(file);
    setModalVisible(true);
  };

  // Prioritize flow: open modal with candidates of same type
  const openPrioritizeModal = async (record: any) => {
    // Show only requests associated with this file
    const requestsForFile = Array.isArray(fileRequestMap[record._id]) ? fileRequestMap[record._id] : (fileRequestMap[record._id] ? [fileRequestMap[record._id]] : []);
    // Only include candidates that have a concrete request id (avoid using file ids)
    const candidates = (requestsForFile || [])
      .map((r: any) => ({
        fileId: record._id,
        requesterName: r.username || r.requesterName || 'Unknown',
        createdAt: r.createdAt || r._created || null,
        requestId: r._id || r.requestId
      }))
      .filter((c: any) => !!(c.requestId));

    setPrioritizeCandidates(candidates);
    setSelectedPriorityRequest(candidates.length ? candidates[0].requestId : null);
    setPrioritizeTargetFileId(record._id);
    setPrioritizeModalVisible(true);
  };

  const confirmPrioritize = async () => {
    if (!selectedPriorityRequest) {
      alert('Select a request to prioritize');
      return;
    }
    try {
      if ((documentsAPI as any).prioritize) {
        await (documentsAPI as any).prioritize(selectedPriorityRequest);
      } else if (documentsAPI.updateDocumentStatus) {
        // updateDocumentStatus requires a status; use current request status or 'pending' and add notes flag
        let currentReq: any = null;
        for (const v of Object.values(fileRequestMap)) {
          const arr = Array.isArray(v) ? v : [v];
          const found = arr.find((r: any) => (r._id || r.requestId) === selectedPriorityRequest);
          if (found) {
            currentReq = found;
            break;
          }
        }
        const currentStatus = currentReq?.status || 'pending';
        await documentsAPI.updateDocumentStatus(selectedPriorityRequest, { status: currentStatus, notes: 'PRIORITY' });
      }

      setPrioritizeModalVisible(false);
      // Refresh files and request mapping so UI reflects priority changes
      await fetchFilesAndRequests();

      // Update only the specific file mapping if possible
      if (prioritizeTargetFileId) {
        try {
          const refreshed = getRequestsForFile(prioritizeTargetFileId);
          let updated: any = refreshed.find((r: any) => (r._id || r.requestId) === selectedPriorityRequest) || null;

          if (!updated && (documentsAPI as any).getDocumentById) {
            try {
              const fetched = await (documentsAPI as any).getDocumentById(selectedPriorityRequest);
              updated = fetched;
            } catch (e) {
              updated = null;
            }
          }

          if (updated) {
            setFileRequestMap(prev => {
              const cloned: Record<string, any> = { ...prev };
              cloned[prioritizeTargetFileId] = Array.isArray(refreshed) ? refreshed : (refreshed ? [refreshed] : []);
              return cloned;
            });
          } else {
            // fallback: mark the selected request as prioritized in the specific file mapping
            setFileRequestMap(prev => {
              try {
                const cloned: Record<string, any> = { ...prev };
                const v = cloned[prioritizeTargetFileId];
                const arr = Array.isArray(v) ? v.slice() : (v ? [v] : []);
                const idx = arr.findIndex((r: any) => (r._id || r.requestId) === selectedPriorityRequest);
                if (idx !== -1) {
                  arr[idx] = { ...arr[idx], priority: true, notes: (arr[idx].notes || '') + ' PRIORITY' };
                }
                cloned[prioritizeTargetFileId] = arr;
                return cloned;
              } catch (e) {
                return prev;
              }
            });
          }
        } catch (e) {
          // ignore and leave UI refreshed from fetchFilesAndRequests
        }
      }

      // If preview modal is open for this file, update previewRequests and selection so modal reflects the change
      if (selectedFile && prioritizeTargetFileId && selectedFile._id === prioritizeTargetFileId) {
        const updatedRequests = getRequestsForFile(prioritizeTargetFileId);
        setPreviewRequests(updatedRequests);
        setPreviewSelectedRequestId(selectedPriorityRequest);
        // re-render preview for the newly prioritized request
        if (selectedPriorityRequest) {
          await renderPreviewForRequest(selectedPriorityRequest);
        }
      }

      alert('Prioritization saved');
      setPrioritizeTargetFileId(null);
    } catch (err) {
      console.error(err);
      alert('Failed to prioritize');
    }
  };

  const handleProcessClick = async (file: any) => {
    setPreviewVisible(true);
    setPreviewLoading(true);
    setPreviewHtml('');
    try {
      // Populate preview-related state: all requests for file and template HTML
  const requests = getRequestsForFile(file._id) || [];
  // Only show pending requests in the preview selector
  const pendingRequests = requests.filter((r: any) => ((r.status || '').toString().toLowerCase() === 'pending'));
  setPreviewRequests(pendingRequests);
  const prioritized = getPrioritizedRequest(file._id);
  // Prefer prioritized request if it is pending, otherwise fall back to the first pending request
  const firstPending = pendingRequests[0] || null;
  const prioritizedPending = prioritized && ((prioritized.status || '').toString().toLowerCase() === 'pending') ? prioritized : null;
  setPreviewSelectedRequestId(prioritizedPending ? (prioritizedPending._id || prioritizedPending.requestId) : (firstPending?._id || firstPending?.requestId || null));
      // Fetch template preview HTML once for this file
      const res = await fetch(`/api/documents/preview/${file._id}?format=html`);
      const html = await res.text();
      setPreviewTemplateHtml(html);
      // Render preview for the selected/prioritized request
  const selectedReqId = prioritizedPending ? (prioritizedPending._id || prioritizedPending.requestId) : (firstPending?._id || firstPending?.requestId || null);
      if (selectedReqId) await renderPreviewForRequest(selectedReqId);
    } catch (err) {
      setPreviewHtml('<div style="color:red">Failed to load preview.</div>');
    }
    setPreviewLoading(false);
  };

  // Render previewHtml for a specific request id using cached previewTemplateHtml
  const renderPreviewForRequest = async (requestId: string) => {
    try {
      const req = Object.values(fileRequestMap).flat().find((r: any) => (r._id || r.requestId) === requestId) || null;
  const fieldValues = req?.fieldValues || {};
      // If template html not present, nothing to render
      const html = previewTemplateHtml || '';
      const regex = /\{(.*?)\}/g;
      let match;
      const fields: string[] = [];
      while ((match = regex.exec(html)) !== null) {
        fields.push(match[1].trim());
      }
      if (fields.length > 0) {
        const tableHtml = `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style='border:1px solid #ccc;padding:8px;text-align:left;'>Field</th>
                <th style='border:1px solid #ccc;padding:8px;text-align:left;'>Submitted Value</th>
              </tr>
            </thead>
            <tbody>
              ${fields.map(f => {
                const value = fieldValues[f] || '';
                return `<tr><td style='border:1px solid #ccc;padding:8px;'>${f}</td><td style='border:1px solid #ccc;padding:8px;'>${value}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        `;
        setPreviewHtml(tableHtml);
      } else {
        setPreviewHtml('<div style="color:red">No { ... } content found.</div>');
      }
    } catch (err) {
      setPreviewHtml('<div style="color:red">Failed to load preview.</div>');
    }
  };

  // Open preview for a selected record (used by table Actions)
  const openPreview = async (record: any) => {
    setSelectedFile(record);
    await handleProcessClick(record);
  };

  // (Removed download and status update helpers — preview-only workflow)
 
  if (loading) {
    return (
      <div style={{ width: '100%', minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 2000, margin: '12px auto', padding: '16px 24px' }}>
  <Typography.Title level={3} style={{ marginBottom: 12, marginTop: 0 }}></Typography.Title>
      {/* Document Processing Table */}
      <Card title="Document Processing" extra={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search documents"
            style={{ width: 420 }}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onPressEnter={() => {}}
          />
          <Select allowClear placeholder="Document Type" style={{ width: 160 }} value={filterType} onChange={(v) => setFilterType(v)}>
            {requestedTypes.map((t) => <Select.Option key={t} value={t}>{t}</Select.Option>)}
          </Select>
          <Select allowClear placeholder="Status" style={{ width: 140 }} value={filterStatus} onChange={(v) => setFilterStatus(v)}>
            <Select.Option value="pending">Pending</Select.Option>
            <Select.Option value="approved">Approved</Select.Option>
            <Select.Option value="rejected">Rejected</Select.Option>
          </Select>
          <DatePicker.RangePicker onChange={(vals) => setFilterRange(vals)} />
        </div>
      }>
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {files.filter((file: any) => {
              // client-side filtering
              if (filterQuery && !(file.filename || '').toLowerCase().includes(filterQuery.toLowerCase())) return false;
              if (filterType && ((file.type || '').toLowerCase() !== filterType.toLowerCase())) return false;
              const primary = getPrimaryRequest(file._id);
              const status = primary?.status || '';
              if (filterStatus && status.toLowerCase() !== filterStatus.toLowerCase()) return false;
              if (filterRange && filterRange[0] && filterRange[1] && file.uploadDate) {
                const d = new Date(file.uploadDate);
                const start = filterRange[0].toDate();
                const end = filterRange[1].toDate();
                if (d < start || d > end) return false;
              }
              return true;
            }).map((file: any) => {
              const name = file.filename || '';
              const ext = (name.split('.').pop() || '').toLowerCase();
              let icon = <FileWordOutlined style={{ color: '#2B6CB0', fontSize: 20 }} />;
              if (ext === 'pdf') icon = <FilePdfOutlined style={{ color: '#E53E3E', fontSize: 20 }} />;
              if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'].includes(ext)) icon = <FileImageOutlined style={{ color: '#319795', fontSize: 20 }} />;
              const primary = getPrimaryRequest(file._id);
              const status = primary?.status || '';
              return (
                <Card key={file._id} size="small" ref={(el: any) => { /* mobile cards keyed by primary request id if exists */
                  const primary = getPrimaryRequest(file._id);
                  const rid = primary && (primary._id || primary.requestId);
                  if (rid) rowRefs.current[rid] = el;
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      {icon}
                      <div>
                        <Tooltip title={name}><div style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{name.replace(/\.docx$/i, '')}</div></Tooltip>
                        <div style={{ fontSize: 12, color: '#666' }}>{file.type || 'Unknown'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                      <Tag color={status === 'pending' ? 'orange' : status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'default'}>{(status || '').toUpperCase()}</Tag>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(file)}>Preview</Button>
                      </div>
                      <div style={{ fontSize: 11, color: '#999' }}>{file.uploadDate ? formatDateUtil(file.uploadDate) : ''}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Table
            rowKey={(record) => record._id}
            dataSource={files.filter((file: any) => {
              if (filterQuery && !(file.filename || '').toLowerCase().includes(filterQuery.toLowerCase())) return false;
              if (filterType && ((file.type || '').toLowerCase() !== filterType.toLowerCase())) return false;
              const primary = getPrimaryRequest(file._id);
              const status = primary?.status || '';
              if (filterStatus && status.toLowerCase() !== filterStatus.toLowerCase()) return false;
              if (filterRange && filterRange[0] && filterRange[1] && file.uploadDate) {
                const d = new Date(file.uploadDate);
                const start = filterRange[0].toDate();
                const end = filterRange[1].toDate();
                if (d < start || d > end) return false;
              }
              return true;
            })}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: 'File',
                dataIndex: 'filename',
                key: 'filename',
                sorter: (a: any, b: any) => (a.filename || '').localeCompare(b.filename || ''),
                render: (text: string, rec: any) => {
                  // derive icon by extension
                  const name = text || '';
                  const ext = (name.split('.').pop() || '').toLowerCase();
                  let icon = <FileWordOutlined style={{ color: '#2B6CB0' }} />;
                  if (ext === 'pdf') icon = <FilePdfOutlined style={{ color: '#E53E3E' }} />;
                  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp'].includes(ext)) icon = <FileImageOutlined style={{ color: '#319795' }} />;
                      return (
                    <Tooltip title={name}>
                      <span style={{ maxWidth: 280, display: 'inline-block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Space align="center">
                          {icon}
                          <span>{name.replace(/\.docx$/i, '')}</span>
                        </Space>
                      </span>
                    </Tooltip>
                  );
                }
              },
              // Type column removed per request
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (_: any, record: any) => {
                  // Show document availability (online/offline) based on GridFS file metadata
                  // Prefer explicit flags if present, otherwise infer from contentType/length
                  const file = record || {};
                  const isOnline = (file.metadata && file.metadata.online === true) || (typeof file.length === 'number' ? file.length > 0 : Boolean(file.contentType));
                  const label = isOnline ? 'ONLINE' : 'OFFLINE';
                  const color = isOnline ? 'green' : 'red';
                  return (<Tag color={color}>{label}</Tag>);
                }
              },
              {
                title: 'Uploaded On',
                dataIndex: 'uploadDate',
                key: 'uploadDate',
                sorter: (a: any, b: any) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime(),
                render: (d: any) => d ? formatDateUtil(d) : ''
              },
              {
                title: 'Actions',
                key: 'actions',
                render: (_: any, record: any) => (
                  <Space>
                    <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(record)}>Preview</Button>
                  </Space>
                )
              }
            ]}
            // Attach a rowClassName and onRow so we can populate rowRefs for direct scrolling/highlighting
            rowClassName={(record) => {
              // Attach a data attribute later via onRow
              return '';
            }}
            onRow={(record) => {
              const primary = getPrimaryRequest(record._id);
              const rid = primary && (primary._id || primary.requestId);
              return {
                ref: (el: HTMLDivElement | null) => {
                  if (rid) rowRefs.current[rid] = el;
                }
              } as any;
            }}
          />
        )}
      </Card>

      <Modal
        title={selectedFile ? selectedFile.filename.replace(/\.docx$/i, '') : ''}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedFile ? (
          <div style={{ minWidth: 700 }}>
            <Table
              dataSource={[
                      {
                        ...selectedFile,
                        requesterName: getPrimaryRequest(selectedFile._id)?.username || getPrimaryRequest(selectedFile._id)?.requesterName || 'Unknown',
                        barangayID: getPrimaryRequest(selectedFile._id)?.barangayID || 'Unknown',
                        status: getPrimaryRequest(selectedFile._id)?.status || 'Unknown',
                      },
              ]}
              pagination={false}
              rowKey="_id"
              columns={[
                {
                  title: 'Requester Name',
                  dataIndex: 'requesterName',
                  key: 'requesterName',
                  render: (text: string) => text || 'Unknown',
                },
                {
                  title: 'Barangay ID',
                  dataIndex: 'barangayID',
                  key: 'barangayID',
                  render: (text: string) => text || 'Unknown',
                },
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (text: string) => text || 'Unknown',
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_: any, record: any) => (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={{ background: '#2196F3', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => handleProcessClick(record)}
                      >Process</button>
                      <button style={{ background: '#43D96B', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>Complete</button>
                      <button style={{ background: '#FF3B3B', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontWeight: 600 }}>Reject</button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <Spin />
        )}
      </Modal>

      <Modal
        title="Generated / Processed Copy Saved"
        open={generatedModalVisible}
        onCancel={() => setGeneratedModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setGeneratedModalVisible(false)}>Close</Button>
        ]}
      >
        <div>
          <div style={{ marginBottom: 8 }}>A copy of the generated document was saved.</div>
          {generatedCopyId ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ marginBottom: 6 }}><strong>Generated metadata ID:</strong> <code>{generatedCopyId}</code></div>
              <div>
                <a href={`${API_URL.replace(/\/$/, '')}/generated-documents/${generatedCopyId}/raw`} target="_blank" rel="noreferrer">Open generated copy (generated_documents)</a>
              </div>
            </div>
          ) : null}

          {processedDocId ? (
            <div>
              <div style={{ marginBottom: 6 }}><strong>Processed document ID:</strong> <code>{processedDocId}</code></div>
              <div>
                <a href={`${API_URL.replace(/\/$/, '')}/processed-documents/${processedDocId}/raw`} target="_blank" rel="noreferrer">Open processed copy (processed_documents)</a>
              </div>
            </div>
          ) : null}

          {(!generatedCopyId && !processedDocId) ? <div>No saved copy id available.</div> : null}
        </div>
      </Modal>

      {/* Prioritize Modal */}
      <Modal
        title="Prioritize Request"
        open={prioritizeModalVisible}
        onCancel={() => setPrioritizeModalVisible(false)}
        onOk={confirmPrioritize}
        okText="Save Priority"
        cancelText="Cancel"
        okButtonProps={{ disabled: prioritizeCandidates.length === 0 || !selectedPriorityRequest }}
      >
        {prioritizeCandidates.length === 0 ? (
          <div>No other requests found for this document type.</div>
        ) : (
          <Radio.Group
            onChange={(e) => setSelectedPriorityRequest(e.target.value)}
            value={selectedPriorityRequest}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            {prioritizeCandidates.map((c: any) => (
              <Radio key={c.requestId || c.fileId} value={c.requestId || c.fileId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong>{c.requesterName}</strong>
                  <small style={{ color: '#666' }}>{c.createdAt ? formatDateUtil(c.createdAt) : ''}</small>
                </div>
                <div style={{ marginLeft: 12 }}>
                  {/* show a small hint if this candidate is currently selected as priority */}
                  {selectedPriorityRequest === (c.requestId || c.fileId) ? <Tag color="red">Selected</Tag> : null}
                </div>
              </Radio>
            ))}
          </Radio.Group>
        )}
      </Modal>

      {/* Preview Modal for Process */}
      <Modal
        title={selectedFile ? `Preview: ${selectedFile.filename.replace(/\.docx$/i, '')}` : 'Preview'}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={900}
      >
        {previewLoading ? (
          <Spin />
        ) : (
          <>
            <div style={{ minHeight: 300 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
            {/* Request selector inside preview (select which request to render) */}
            <div style={{ marginTop: 12, padding: 8, border: '1px solid #eee', borderRadius: 6 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>Select Request to Preview</div>
              <div style={{ maxHeight: 300, overflowY: 'auto', paddingRight: 6 }}>
                <Radio.Group
                  value={previewSelectedRequestId}
                  onChange={async (e) => {
                    const newId = e.target.value as string;
                    setPreviewSelectedRequestId(newId);
                    // re-render preview for selected request
                    await renderPreviewForRequest(newId);
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {previewRequests && previewRequests.length ? previewRequests.map((r: any) => (
                    <Radio key={(r._id || r.requestId)} value={(r._id || r.requestId)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{r.username || r.requesterName || 'Unknown'}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>{r.createdAt ? formatDateUtil(r.createdAt) : ''}</div>
                        </div>
                        <div style={{ alignSelf: 'center' }}>{(r.notes && r.notes.toString().toLowerCase().includes('priority')) || r.priority ? <Tag color="red">PRIORITY</Tag> : null}</div>
                      </div>
                    </Radio>
                  )) : <div style={{ color: '#666' }}>No pending requests available for this file.</div>}
                </Radio.Group>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, gap: 12 }}>
                      {/* Complete button removed; Generate will also mark request complete after successful generation */}
              <button
                style={{ background: '#43D96B', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 24px', cursor: 'pointer', fontWeight: 600 }}
                onClick={async () => {
                  if (!selectedFile) return;
                  try {
                    // Prefer the currently previewed request if available
                    let request: any = null;
                    if (previewSelectedRequestId) {
                      // find in mapping
                      const requestsForFile = getRequestsForFile(selectedFile._id);
                      request = requestsForFile.find((r: any) => (r._id || r.requestId) === previewSelectedRequestId) || null;
                    }
                    // fallback to prioritized or primary
                    if (!request) request = getPrioritizedRequest(selectedFile._id) || getPrimaryRequest(selectedFile._id);

                    if (!request || !request.fieldValues) {
                      alert('No document request or field values found for this file.');
                      return;
                    }

                    // Generate filled docx via server endpoint (returns blob). Server may save the generated file and return X-Filled-File-Id header.
                    const result = await generateFilledDocx(selectedFile._id, request.fieldValues, (request._id || request.requestId));
                    const blob = result.blob;
                    // Use the transaction/request id as the downloaded filename when available.
                    // Prefer explicit transaction identifiers if present to avoid using resident/user ids.
                    // Prefer transactionCode fields (server uses 'transactionCode'), fallback to older keys and finally server headers/ids
                    const txId = (request && (request.transactionCode || request.transactionId || request.txId || request.transaction_id || request._id || request.requestId)) || result.transactionCode || result.generatedCopyId || result.processedDocId || null;
                    const safeId = txId ? String(txId).replace(/[^a-zA-Z0-9-_.]/g, '_') : null;
                    // Prefer transactionCode (returned in header) for filename, then request.transactionCode, then server filename, then safe id, then fallback
                    const preferredCode = result.transactionCode || (request && request.transactionCode) || safeId || null;
                    const serverFilename = preferredCode ? `${String(preferredCode).replace(/[^a-zA-Z0-9-_.]/g, '_')}.docx` : (result.filename || `filled_${selectedFile.filename || 'document'}.docx`);

                    // Trigger download using server filename
                    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', serverFilename);
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode?.removeChild(link);
                    window.URL.revokeObjectURL(url);

                    // If server returned a saved id header, we assume it's already saved to GridFS; refresh listing
                    const savedId = result.savedId || null;
                    if (savedId) {
                      // Refresh list so uploaded/generated file appears
                      await fetchFilesAndRequests();
                      const processedId = result.processedDocId || null;
                      if (processedId) {
                        notification.open({
                          message: 'Generated copy saved',
                          description: (
                            <div>Saved to processed documents. <a href={`${API_URL.replace(/\/$/, '')}/processed-documents/${processedId}/raw`} target="_blank" rel="noreferrer">Open processed copy</a></div>
                          ),
                          duration: 8,
                        });
                        setProcessedDocId(processedId);
                        setGeneratedModalVisible(true);
                      } else {
                        notification.open({ message: 'Generated document saved', description: 'Saved to server processed documents.', duration: 6 });
                      }
                      if (result.generatedCopyId) {
                        setGeneratedCopyId(result.generatedCopyId);
                        setGeneratedModalVisible(true);
                      }
                    } else {
                      // Attempt to upload the generated file to the documents endpoint so the backend will store .files and .chunks (GridFS)
                      try {
                        const form = new FormData();
                        form.append('file', new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), serverFilename);
                        // include source metadata if helpful
                        form.append('sourceTemplateId', selectedFile._id || '');
                        form.append('requestId', (request._id || request.requestId) || '');
                        // try a couple of likely endpoints
                        const base = API_URL.replace(/\/$/, '');
                        let uploaded = false;
                        // Prefer uploading directly into the processed_documents bucket if available on the server
                        const tryUrls = [ `${base}/processed-documents/upload`, `${base}/documents/upload-inline`, `${base}/documents/upload`, `${base}/documents`, `${base}/admin/documents/upload` ];
                        for (const u of tryUrls) {
                          try {
                            const resp = await fetch(u, { method: 'POST', body: form, credentials: 'include' });
                            if (resp.ok) {
                              uploaded = true;
                              break;
                            }
                          } catch (e) {
                            // continue
                          }
                        }
                        if (uploaded) {
                          await fetchFilesAndRequests();
                          // show a non-blocking toast with a direct link to the processed copy when available
                          const processedId = result.processedDocId || null;
                          if (processedId) {
                            notification.open({
                              message: 'Generated copy saved',
                              description: (
                                <div>Saved to processed documents. <a href={`${API_URL.replace(/\/$/, '')}/processed-documents/${processedId}/raw`} target="_blank" rel="noreferrer">Open processed copy</a></div>
                              ),
                              duration: 8,
                            });
                            setProcessedDocId(processedId);
                            setGeneratedModalVisible(true);
                          } else {
                            notification.open({ message: 'Generated document uploaded', description: 'Uploaded to server processed documents.', duration: 6 });
                          }
                        } else {
                          console.warn('Upload fallback failed; generated file was downloaded but not uploaded to documents collection.');
                          alert('Generated document downloaded. Server-side save not confirmed.');
                        }
                      } catch (uploadErr) {
                        console.error('Upload fallback error', uploadErr);
                        alert('Generated document downloaded but upload to server failed.');
                      }
                    }
                    // After successful generation (and attempted save), also mark the associated request as completed
                    try {
                      // Determine request id to mark as approved
                      let requestId: string | null = previewSelectedRequestId;
                      if (!requestId) {
                        const r = getPrioritizedRequest(selectedFile._id) || getPrimaryRequest(selectedFile._id);
                        requestId = (r && (r._id || r.requestId)) || null;
                      }
                      if (requestId) {
                        if (documentsAPI.updateDocumentStatus) {
                          await documentsAPI.updateDocumentStatus(requestId, { status: 'approved' });
                        } else {
                          await fetch(`/api/document-requests/${requestId}/process`, { method: 'PATCH' });
                        }
                        // Refresh mapping/UI after marking complete
                        await fetchFilesAndRequests();
                        setPreviewVisible(false);
                        alert('Request marked as completed.');
                      }
                    } catch (markErr) {
                      console.warn('Failed to mark request complete after generation', (markErr as any)?.message || markErr);
                    }
                  } catch (err) {
                    console.error('Generation error', err);
                    alert('Failed to generate filled document.');
                  }
                  setPreviewVisible(false);
                }}
              >Generate</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default DocumentProcessing;
