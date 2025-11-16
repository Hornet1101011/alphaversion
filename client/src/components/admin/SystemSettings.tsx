import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import TestEmailModal from '../TestEmailModal';
import { adminAPI } from '../../services/api';
import axios from 'axios';
import { API_URL } from '../../services/api';
import { UploadOutlined, UsergroupAddOutlined, DeleteOutlined } from '@ant-design/icons';
import { Upload as AntdUpload, message as antdMessage, Row, Col, Card, Form as AntdForm, Input as AntdInput, Avatar, Carousel, Divider as AntdDivider, notification, Button as AntdButton } from 'antd';
// framer-motion removed to avoid dependency conflicts; use CSS transitions for preview
import defaultSystemSettings from '../../config/defaultSystemSettings';
import getOfficialPhotoSrc from '../../utils/officials';

interface SystemSettings {
  siteName: string;
  barangayName: string;
  barangayAddress: string;
  contactEmail: string;
  contactPhone: string;
  maintainanceMode: boolean;
  allowNewRegistrations: boolean;
  requireEmailVerification: boolean;
  maxDocumentRequests: number;
  documentProcessingDays: number;
  // new rate-limiting settings
  allowMultipleAccountsPerIP?: boolean;
  maxAccountsPerIP?: number;
  systemNotice: string;
  smtp?: {
    host?: string;
    port?: number;
    user?: string;
    password?: string;
  };
}

interface Official {
  _id?: string;
  name: string;
  title: string;
  term: string;
  photoUrl?: string;
  photoPath?: string;
  previewUrl?: string; // client-side temporary preview for selected file
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>(() => ({ ...defaultSystemSettings } as SystemSettings));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  // Officials state
  const [officials, setOfficials] = useState<Official[]>([]);
  const [officialsLoading, setOfficialsLoading] = useState(false);
  const [savingOfficials, setSavingOfficials] = useState(false);
  const [manualSaveError, setManualSaveError] = useState<string | null>(null);
  const autoSaveTimers = useRef<Record<string, number>>({});
  const [officialSaveStatus, setOfficialSaveStatus] = useState<Record<string, 'idle'|'saving'|'saved'|'error'>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const prevOfficialsCountRef = useRef(0);
  const [highlightedIds, setHighlightedIds] = useState<string[]>([]);
  const highlightTimeouts = useRef<Record<string, number>>({});
  const originalSettingsRef = useRef<SystemSettings | null>(null);
  const [dirty, setDirty] = useState(false);

  // helper to make MUI InputLabel shrink when the field has content or a non-empty value
  const inputLabelShrink = (val: any) => ({ InputLabelProps: { shrink: val !== undefined && val !== null && val !== '' } });

  useEffect(() => {
    const ac = new AbortController();
    fetchSettings(ac.signal);
    return () => {
      // cancel pending fetch
      try { ac.abort(); } catch (e) {}
      // revoke any created object URLs
      try {
        Object.values(previewUrlsRef.current).forEach(u => {
          try { URL.revokeObjectURL(u); } catch (e) {}
        });
      } catch (e) {}
    };
  }, []);

  // Scroll preview container to the right when items are appended
  useEffect(() => {
    try {
      const container = previewContainerRef.current;
      if (!container) return;
      if (officials.length > prevOfficialsCountRef.current) {
        container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
      }
      prevOfficialsCountRef.current = officials.length;
    } catch (e) {}
  }, [officials.length]);

  // Detect newly added temp officials and highlight them briefly
  useEffect(() => {
    try {
      const newTemp = officials.filter(o => o._id && o._id.toString().startsWith('new-')).map(o => o._id as string);
      // highlight any temp ids that are new and not already highlighted
      newTemp.forEach(id => {
        if (!highlightedIds.includes(id)) {
          setHighlightedIds(prev => [...prev, id]);
          // remove highlight after 2.5s
          const t = window.setTimeout(() => {
            setHighlightedIds(prev => prev.filter(x => x !== id));
            delete highlightTimeouts.current[id];
          }, 2500);
          highlightTimeouts.current[id] = t;
        }
      });
    } catch (e) {}
    // cleanup when unmounting
    return () => {
      Object.values(highlightTimeouts.current).forEach((tid) => { try { clearTimeout(tid); } catch (e) {} });
      highlightTimeouts.current = {};
    };
  }, [officials, highlightedIds]);

  // Accept an optional AbortSignal so caller can cancel when unmounting
  const fetchSettings = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // primary attempt using adminAPI (uses axiosInstance and auth interceptors)
      let sys: SystemSettings | null = null;
      try {
        sys = await adminAPI.getSystemSettings();
      } catch (err) {
        // fallback: call backend directly at configured API_URL (avoid client origin)
        try {
          const res = await axios.get(`${API_URL}/admin/settings`, { withCredentials: true, signal } as any);
          if (res?.data) sys = res.data;
        } catch (err2) {
          console.warn('Failed to load system settings via adminAPI and API_URL fallback', err, err2);
        }
      }
      if (sys) {
        setSettings(sys);
        originalSettingsRef.current = sys;
      }

      // officials: try adminAPI then API_URL fallback
      setOfficialsLoading(true);
      try {
        const offs = await adminAPI.getOfficials();
        if (Array.isArray(offs)) {
          setOfficials(offs);
        } else {
          const r = await axios.get(`${API_URL}/admin/officials`, { withCredentials: true, signal } as any);
          if (r?.data) setOfficials(r.data);
        }
      } catch (err) {
        try {
          const r = await axios.get(`${API_URL}/admin/officials`, { withCredentials: true, signal } as any);
          if (r?.data) setOfficials(r.data);
        } catch (err2) {
          console.warn('Failed to load officials via adminAPI and API_URL fallback', err, err2);
        }
      } finally {
        setOfficialsLoading(false);
      }
    } catch (err) {
      if ((err as any)?.name === 'CanceledError' || (err as any)?.name === 'AbortError') {
        // fetch canceled, ignore
        return;
      }
      console.error('Unexpected error in fetchSettings', err);
      antdMessage.error('Unexpected error while loading settings');
    } finally {
      setLoading(false);
    }
  };

  // Save system settings (used by Save Changes button)
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      // Normalize numeric fields
      // Normalize numeric fields and map client keys to server-side field names
      const payload: any = {
        ...settings,
        // compatibility: server uses 'maintenanceMode' while client uses 'maintainanceMode' (typo)
        maintenanceMode: (settings as any).maintainanceMode,
        // server expects allowRegistrations and maxDocumentRequestsPerUser
        allowRegistrations: (settings as any).allowNewRegistrations,
        maxDocumentRequestsPerUser: Number((settings as any).maxDocumentRequests) || 1,
        documentProcessingDays: Number(settings.documentProcessingDays) || 1,
        ...(typeof (settings as any).maxAccountsPerIP !== 'undefined'
          ? { maxAccountsPerIP: Number((settings as any).maxAccountsPerIP) || 1 }
          : {}),
      } as SystemSettings;

      await adminAPI.updateSystemSettings(payload);
      // optimistic: update original copy and clear dirty flag
      originalSettingsRef.current = payload;
      setDirty(false);
      setSuccess(true);
      antdMessage.success('Settings saved');
    } catch (err) {
      console.error('Failed to save settings', err);
      setError('Failed to save settings');
      antdMessage.error('Failed to save settings');
    } finally {
      setSaving(false);
      window.setTimeout(() => setSuccess(false), 2000);
    }
  }

  // Manual save for officials (fallback)
  const handleManualSaveOfficials = async () => {
    if (!officials || officials.length === 0) return;
    setSavingOfficials(true);
    setManualSaveError(null);
    try {
      const updatedOfficials: Official[] = [];
      for (const off of officials) {
        if (!off._id || off._id.toString().startsWith('new-')) {
          // create
          const created = await adminAPI.createOfficial({ name: off.name, title: off.title, term: off.term });
          updatedOfficials.push(created);
        } else {
          try {
            const updated = await adminAPI.updateOfficial(off._id!, { name: off.name, title: off.title, term: off.term });
            updatedOfficials.push(updated);
          } catch (e) {
            // if update failed, keep local copy so user can retry
            updatedOfficials.push(off);
          }
        }
      }
      // replace list with refreshed items from server if possible
      try {
        const refreshed = await adminAPI.getOfficials();
        if (Array.isArray(refreshed)) setOfficials(refreshed);
        else setOfficials(updatedOfficials);
      } catch (e) {
        setOfficials(updatedOfficials);
      }
      antdMessage.success('Officials saved');
    } catch (err) {
      console.error('Manual save officials failed', err);
      setManualSaveError('Manual save failed');
      antdMessage.error('Manual save failed');
    } finally {
      setSavingOfficials(false);
    }
  }

  // Combined save used by floating action button: save system settings first, then officials
  const saveAll = async () => {
    // prefer existing saving flags inside the individual handlers
    try {
      await handleSave();
    } catch (e) {
      // handleSave already logs and reports errors
    }
    try {
      await handleManualSaveOfficials();
    } catch (e) {
      // manual save already reports errors
    }
  }

  // Track whether settings are different from the original copy loaded from server
  useEffect(() => {
    try {
      if (!originalSettingsRef.current) {
        setDirty(false);
        return;
      }
      setDirty(JSON.stringify(originalSettingsRef.current) !== JSON.stringify(settings));
    } catch (e) {
      setDirty(false);
    }
  }, [settings]);

  const handleDeleteOfficial = async (id?: string) => {
    if (!id) return;
    setSavingOfficials(true);
    try {
      await adminAPI.deleteOfficial(id);
      setOfficials(prev => prev.filter(p => p._id !== id));
      antdMessage.success('Official deleted');
    } catch (err) {
      console.error('Delete official failed', err);
      antdMessage.error('Failed to delete official');
    } finally {
      setSavingOfficials(false);
    }
  }

  return (
    <Box sx={{
      // ensure content is pushed below the app header which writes its height to --app-header-height
      pt: 'calc(var(--app-header-height, 64px) + 24px)',
      px: 3,
      pb: 3,
    }}>
      <Paper sx={{ p: 3 }}>
        {/* Barangay Information */}
        <Typography variant="subtitle1" gutterBottom>
          Barangay Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <TextField
            label="Site Name"
            value={settings.siteName}
            onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Barangay Name"
            value={settings.barangayName}
            onChange={(e) => setSettings({ ...settings, barangayName: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Barangay Address"
            value={settings.barangayAddress}
            onChange={(e) => setSettings({ ...settings, barangayAddress: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
            multiline
            rows={2}
          />
        </Box>

        <Divider sx={{ my: 3 }} />
        {/* SMTP / Email Settings */}
        <Typography variant="subtitle1" gutterBottom>
          SMTP / Email Settings
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <TextField
            label="SMTP Host"
            value={(settings as any).smtp?.host || ''}
            onChange={(e) => setSettings((prev) => ({ ...(prev as any), smtp: { ...(prev as any).smtp, host: e.target.value } }) as SystemSettings)}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="SMTP Port"
            type="number"
            value={(settings as any).smtp?.port || ''}
            onChange={(e) => setSettings((prev) => ({ ...(prev as any), smtp: { ...(prev as any).smtp, port: parseInt(e.target.value || '0') } }) as SystemSettings)}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="SMTP User"
            value={(settings as any).smtp?.user || ''}
            onChange={(e) => setSettings((prev) => ({ ...(prev as any), smtp: { ...(prev as any).smtp, user: e.target.value } }) as SystemSettings)}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => setTestModalOpen(true)}>Send Test Email</Button>
            <Button variant="text" onClick={() => setSettings((prev) => ({ ...(prev as any), smtp: { ...(prev as any).smtp, password: '' } }) as SystemSettings)}>Clear SMTP Password</Button>
          </Box>
        </Box>

        <TestEmailModal open={testModalOpen} onClose={() => setTestModalOpen(false)} contactEmail={settings.contactEmail} />

          <Divider sx={{ my: 3 }} />
          {/* Barangay Officials Section */}
          <Typography variant="subtitle1" gutterBottom>
            Barangay Officials
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
            {/* Left column: header + scrollable list */}
            <Box sx={{ flex: 1, width: '100%' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body1">Manage officials (auto-saves changes)</Typography>
                <Button onClick={() => {
                  // add new (append to end so preview shows on the right)
                  const temp: Official = { _id: `new-${Date.now()}`, name: '', title: '', term: '' };
                  setOfficials(prev => [...prev, temp]);
                }} startIcon={<UsergroupAddOutlined />}>Add Official</Button>
              </Box>

              {/* Scrollable list area */}
              <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 1, border: '1px solid rgba(0,0,0,0.04)', borderRadius: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)' }}>
                {officialsLoading ? <CircularProgress size={24} /> : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {officials.map((off, idx) => (
                      <Paper key={off._id || idx} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Box sx={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '3px solid rgba(0,0,0,0.04)', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                        <img
                          src={getOfficialPhotoSrc(off as any)}
                          alt={off.name || 'photo'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform .2s', display: 'block' }}
                        />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <TextField label="Full name" value={off.name} onChange={(e) => {
                          const v = e.target.value;
                          setOfficials(prev => prev.map(o => o._id === off._id ? { ...o, name: v } : o));
                          // schedule autosave
                          if (autoSaveTimers.current[off._id || '']) clearTimeout(autoSaveTimers.current[off._id || '']);
                          autoSaveTimers.current[off._id || ''] = window.setTimeout(async () => {
                            try {
                              setSavingOfficials(true);
                              if (off._id && !off._id.toString().startsWith('new-')) {
                                await adminAPI.updateOfficial(off._id, { ...off, name: v });
                              } else {
                                const created = await adminAPI.createOfficial({ ...off, name: v });
                                setOfficials(prev => prev.map(p => p._id === off._id ? created : p));
                              }
                              setManualSaveError(null);
                            } catch (err) {
                              console.error('auto-save failed', err);
                              setManualSaveError('Auto-save failed');
                            } finally {
                              setSavingOfficials(false);
                            }
                          }, 900);
                        }} fullWidth size="small" sx={{ mb: 1 }} variant="outlined" InputLabelProps={{ shrink: true }} />
                        <TextField label="Title/Position" value={off.title} onChange={(e) => {
                          const v = e.target.value;
                          setOfficials(prev => prev.map(o => o._id === off._id ? { ...o, title: v } : o));
                          if (autoSaveTimers.current[off._id || '']) clearTimeout(autoSaveTimers.current[off._id || '']);
                          autoSaveTimers.current[off._id || ''] = window.setTimeout(async () => {
                            try {
                              setSavingOfficials(true);
                              if (off._id && !off._id.toString().startsWith('new-')) {
                                await adminAPI.updateOfficial(off._id, { ...off, title: v });
                              } else {
                                const created = await adminAPI.createOfficial({ ...off, title: v });
                                setOfficials(prev => prev.map(p => p._id === off._id ? created : p));
                              }
                              setManualSaveError(null);
                            } catch (err) {
                              console.error('auto-save failed', err);
                              setManualSaveError('Auto-save failed');
                            } finally {
                              setSavingOfficials(false);
                            }
                          }, 900);
                        }} fullWidth size="small" sx={{ mb: 1 }} variant="outlined" InputLabelProps={{ shrink: true }} />
                        <TextField label="Term" value={off.term} onChange={(e) => {
                          const v = e.target.value;
                          setOfficials(prev => prev.map(o => o._id === off._id ? { ...o, term: v } : o));
                          if (autoSaveTimers.current[off._id || '']) clearTimeout(autoSaveTimers.current[off._id || '']);
                          autoSaveTimers.current[off._id || ''] = window.setTimeout(async () => {
                            try {
                              setSavingOfficials(true);
                              if (off._id && !off._id.toString().startsWith('new-')) {
                                await adminAPI.updateOfficial(off._id, { ...off, term: v });
                              } else {
                                const created = await adminAPI.createOfficial({ ...off, term: v });
                                setOfficials(prev => prev.map(p => p._id === off._id ? created : p));
                              }
                              setManualSaveError(null);
                            } catch (err) {
                              console.error('auto-save failed', err);
                              setManualSaveError('Auto-save failed');
                            } finally {
                              setSavingOfficials(false);
                            }
                          }, 900);
                        }} fullWidth size="small" variant="outlined" InputLabelProps={{ shrink: true }} />
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                          <AntdUpload showUploadList={false} beforeUpload={(file) => {
                            // Client-side file size limit: 2MB (match server multer limit)
                            const MAX_BYTES = 2 * 1024 * 1024;
                            if (file.size > MAX_BYTES) {
                              antdMessage.warning('File is too large. Maximum allowed size is 2 MB.');
                              return false;
                            }
                            // create local preview immediately
                            try {
                              const url = URL.createObjectURL(file);
                              previewUrlsRef.current[off._id || `temp-${Date.now()}`] = url;
                              setOfficials(prev => prev.map(o => o._id === off._id ? { ...o, previewUrl: url } : o));
                            } catch (e) {}

                            // upload file
                            (async () => {
                              try {
                                if (!off._id || off._id.toString().startsWith('new-')) {
                                  antdMessage.warning('Please save official first by entering name/title/term');
                                  return;
                                }
                                await adminAPI.uploadOfficialPhoto(off._id, file as File);
                                // refresh list
                                const refreshed = await adminAPI.getOfficials();
                                setOfficials(Array.isArray(refreshed) ? refreshed : officials);
                                antdMessage.success('Photo uploaded');
                                // revoke preview for this official if any
                                try {
                                  const key = off._id || '';
                                  const u = previewUrlsRef.current[key];
                                  if (u) { URL.revokeObjectURL(u); delete previewUrlsRef.current[key]; }
                                } catch (e) {}
                              } catch (err) {
                                console.error('upload failed', err);
                                antdMessage.error('Upload failed');
                              }
                            })();
                            return false; }}>

                            <Button startIcon={<UploadOutlined />}>Upload Photo</Button>
                          </AntdUpload>
                          <Button color="error" startIcon={<DeleteOutlined />} onClick={() => {
                            if (off._id && !off._id.toString().startsWith('new-')) {
                              handleDeleteOfficial(off._id);
                            } else {
                              setOfficials(prev => prev.filter(p => p._id !== off._id));
                            }
                          }}>Delete</Button>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>
          </Box>

            <Box sx={{ width: { xs: '100%', md: 360 }, position: { xs: 'relative', md: 'sticky' }, top: { md: 24 }, alignSelf: 'flex-start', mt: { xs: 2, md: 0 } }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Officials Preview</Typography>
              <Box sx={{ background: 'white', borderRadius: 2, p: 2 }}>
                {officials.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No officials to preview</Typography>
                ) : (
                  (() => {
                    const stable = officials.filter(o => !(o._id && o._id.toString().startsWith('new-')));
                    const newly = officials.filter(o => o._id && o._id.toString().startsWith('new-'));
                    const previewOrder = [...stable, ...newly];
                    return (
                      <div
                        ref={previewContainerRef}
                        style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '6px 4px', scrollSnapType: 'x mandatory' }}
                        aria-label="Officials preview"
                      >
                        {previewOrder.map(off => {
                          const id = off._id || '';
                          const isHighlighted = highlightedIds.includes(id);
                          return (
                            <div
                              key={id || Math.random()}
                              style={{
                                minWidth: 140,
                                textAlign: 'center',
                                padding: 8,
                                scrollSnapAlign: 'center' as const,
                                transition: 'box-shadow .25s, transform .18s',
                                boxShadow: isHighlighted ? '0 10px 30px rgba(25,118,210,0.18)' : undefined,
                                transform: isHighlighted ? 'translateY(-4px)' : undefined,
                                borderRadius: 8,
                                background: isHighlighted ? 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(250,250,255,0.98))' : undefined,
                                flex: '0 0 auto'
                              }}
                            >
                              <Avatar size={80} src={getOfficialPhotoSrc(off as any)} style={{ margin: '0 auto', boxShadow: '0 6px 18px rgba(0,0,0,0.06)' }} />
                              <div style={{ marginTop: 8 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{off.name || '—'}</div>
                                <div style={{ color: '#888', fontSize: 12 }}>{off.title}</div>
                                <div style={{ color: '#888', fontSize: 12 }}>{off.term}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
                )}
              </Box>
            </Box>
          </Box>

          {/* Manual Save handled via floating action button — errors still shown inline */}
          {manualSaveError && <Typography color="error" sx={{ mt: 1 }}>{manualSaveError}</Typography>}

        {/* Contact Information */}
        <Typography variant="subtitle1" gutterBottom>
          Contact Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <TextField
            label="Contact Email"
            type="email"
            value={settings.contactEmail}
            onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Contact Phone"
            value={settings.contactPhone}
            onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* System Configuration */}
        <Typography variant="subtitle1" gutterBottom>
          System Configuration
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          <FormControlLabel
            control={
              <Switch
                checked={settings.maintainanceMode}
                onChange={(e) => setSettings({ ...settings, maintainanceMode: e.target.checked })}
              />
            }
            label="Maintenance Mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={settings.allowNewRegistrations}
                onChange={(e) => setSettings({ ...settings, allowNewRegistrations: e.target.checked })}
              />
            }
            label="Allow New Registrations"
          />
          {/* Allow multiple accounts per IP toggle and limit */}
          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={(settings as any).allowMultipleAccountsPerIP}
                  onChange={(e) => setSettings({ ...settings, allowMultipleAccountsPerIP: e.target.checked } as SystemSettings)}
                />
              }
              label="Allow multiple accounts per IP"
            />
            <Box sx={{ mt: 1, ml: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                label="Max accounts per IP"
                type="number"
                size="small"
                value={(settings as any).maxAccountsPerIP ?? 1}
                onChange={(e) => setSettings({ ...settings, maxAccountsPerIP: parseInt(e.target.value || '1') } as SystemSettings)}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: 1, max: 100 }}
                sx={{ width: 140 }}
              />
              <Typography variant="caption" color="text.secondary">
                Current limit: {(settings as any).maxAccountsPerIP ?? 1}
              </Typography>
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings({ ...settings, requireEmailVerification: e.target.checked })}
              />
            }
            label="Require Email Verification"
          />
          <TextField
            label="Maximum Document Requests per User"
            type="number"
            value={settings.maxDocumentRequests}
            onChange={(e) => setSettings({ ...settings, maxDocumentRequests: parseInt(e.target.value) })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 1, max: 20 }}
          />
          <TextField
            label="Document Processing Days"
            type="number"
            value={settings.documentProcessingDays}
            onChange={(e) => setSettings({ ...settings, documentProcessingDays: parseInt(e.target.value) })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: 1, max: 30 }}
            helperText="Standard number of days to process document requests"
          />
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* System Notice */}
        <Typography variant="subtitle1" gutterBottom>
          System Notice
        </Typography>
        <Box sx={{ mb: 3 }}>
          <TextField
            label="System-wide Notice"
            value={settings.systemNotice}
            onChange={(e) => setSettings({ ...settings, systemNotice: e.target.value })}
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            fullWidth
            multiline
            rows={3}
            helperText="This notice will be displayed to all users"
          />
        </Box>

        {/* Save button relocated to floating action button */}

        {/* Floating Manual Save button (bottom-right) */}
        <Box sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 1300,
        }}>
          <Button
            variant="contained"
            onClick={() => saveAll()}
            disabled={saving || savingOfficials}
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              minWidth: 64,
              boxShadow: '0 8px 24px rgba(25,118,210,0.24)',
              backgroundColor: '#1976d2',
              color: '#fff',
              '&:hover': {
                boxShadow: '0 12px 32px rgba(25,118,210,0.32)',
                backgroundColor: '#1565c0',
              },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
            }}
            aria-label="Save Settings and Officials"
          >
            {(saving || savingOfficials) ? '...' : 'Save'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default SystemSettings;
