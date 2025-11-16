import React, { useState } from 'react';
import { Button, Tooltip, Upload, message } from 'antd';
import { UploadOutlined, EyeOutlined, DownloadOutlined, DeleteOutlined, FileWordOutlined } from '@ant-design/icons';

const getLabel = (filename?: string) =>
  filename ? filename.replace(/_/g, " ").replace(/\.docx$/, "") : "Untitled";

const TemplatesManager: React.FC = () => {
  const [templateList, setTemplateList] = useState<any[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'html' | 'pdf' | null>(null);
  const [htmlContent, setHtmlContent] = useState<string>('');

  React.useEffect(() => {
    // Fetch files from Templates folder
    const fetchTemplatesFolderFiles = async () => {
      try {
        const res = await fetch('/api/templates/list');
        const data = await res.json();
      } catch (err) {
        // Ignore error for now
      }
    };
    const fetchTemplates = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/documents/list');
        if (!res.ok) throw new Error('Failed to fetch templates');
        const files = await res.json();
        setTemplateList(files);
      } catch (err) {
        setError('Could not load templates.');
      }
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  return (
    <div style={{
      padding: "2rem",
      background: "#f3f4f6",
      borderRadius: "16px",
      boxShadow: "0 2px 8px #e5e7eb",
      maxWidth: "2000px",
      margin: "2rem auto"
    }}>
      <h2 style={{ fontWeight: "bold", fontSize: "1.5rem", marginBottom: "1.5rem" }}>
        📂 Templates Manager
      </h2>
      {/* GridFS Files Section */}
      <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.5rem", color: '#374151' }}></h3>
        {loading && <div>Loading templates...</div>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
          {templateList.filter((file: any) => file && file.filename).map((file: any) => (
            <div key={file._id} style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              padding: "1.5rem 2rem",
              border: "1px solid #e5e7eb",
              borderRadius: "12px",
              background: "#fff",
              color: "#374151",
              width: "500px",
              minHeight: "100px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              marginBottom: "1rem",
              position: "relative"
            }}>
              <img src="/word.png" alt="Word Icon" style={{ width: 56, height: 56, marginRight: 24 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: 4, display: "block" }}>{getLabel(file.filename)}</span>
                <div style={{ display: "flex", gap: "1rem", marginTop: 8 }}>
                  <Tooltip title="Preview">
                    <Button
                      icon={<EyeOutlined />}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (previewId === file._id) {
                          setPreviewId(null);
                          setHtmlContent('');
                          return;
                        }
                        setPreviewId(file._id);
                        setHtmlContent('');
                        try {
                          const res = await fetch(`/api/documents/preview/${file._id}?format=html`);
                          const html = await res.text();
                          setHtmlContent(html);
                        } catch (err) {
                          setHtmlContent('<div style="color:red">Failed to load preview.</div>');
                        }
                      }}
                    >Preview</Button>
                  </Tooltip>
                  <Tooltip title="Download">
                    <Button
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={async () => {
                        setDownloadError(null);
                        try {
                          const res = await fetch(`/api/documents/original/${file._id}`);
                          if (!res.ok) throw new Error('Download failed');
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.filename;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          setDownloadError(`Failed to download ${file.filename} from MongoDB.`);
                        }
                      }}
                    >Download</Button>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={async () => {
                        setLoading(true);
                        setError(null);
                        try {
                          const res = await fetch(`/api/documents/file/${file._id}`, { method: 'DELETE' });
                          const data = await res.json();
                          if (data.success) {
                            // Refresh list
                            const resList = await fetch('/api/documents/list');
                            const files = await resList.json();
                            setTemplateList(files);
                          } else {
                            setError('Delete failed.');
                          }
                        } catch (err) {
                          setError('Delete failed.');
                        }
                        setLoading(false);
                      }}
                    >Remove</Button>
                  </Tooltip>
                </div>
                {previewId === file._id && htmlContent && (
                  <div
                    style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 12,
                      boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
                      padding: 32,
                      zIndex: 1000,
                      minWidth: 600,
                      maxWidth: 900,
                      maxHeight: 600,
                      overflow: 'auto',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Preview</span>
                      <button
                        style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
                        onClick={() => { setPreviewId(null); setHtmlContent(''); }}
                      >Close</button>
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      {downloadError && (
        <div style={{ color: 'red', marginBottom: 16 }}>{downloadError}</div>
      )}
      {/* Upload Section */}
      <div style={{ marginTop: 32 }}>
        <Upload
          accept=".docx"
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            setLoading(true);
            setError(null);
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res = await fetch('/api/documents/upload', {
                method: 'POST',
                body: formData,
              });
              const data = await res.json();
              if (data.success) {
                // Refresh list
                const resList = await fetch('/api/documents/list');
                const files = await resList.json();
                setTemplateList(files);
                message.success('Upload successful');
                onSuccess && onSuccess('ok');
              } else {
                setError('Upload failed.');
                message.error('Upload failed');
                onError && onError(new Error('Upload failed'));
              }
            } catch (err) {
              setError('Upload failed.');
              message.error('Upload failed');
              onError && onError(new Error('Upload failed'));
            }
            setLoading(false);
          }}
        >
          <Button icon={<UploadOutlined />} type="primary">Upload .docx</Button>
        </Upload>
      </div>
    </div>
  );
};

export default TemplatesManager;
