import React, { useState, useEffect } from 'react';
import { Modal, Button, TextField, Box, CircularProgress, Snackbar, Alert } from '@mui/material';
import { adminAPI } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  contactEmail?: string;
}

const TestEmailModal: React.FC<Props> = ({ open, onClose, contactEmail }) => {
  const [to, setTo] = useState(contactEmail || '');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setTo(contactEmail || '');
  }, [contactEmail, open]);

  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [snackSeverity, setSnackSeverity] = useState<'success' | 'error'>('success');

  const handleSend = async () => {
    try {
      setSending(true);
      // Check SMTP settings first to provide a clearer error if not configured
      try {
        const settings: any = await adminAPI.getSystemSettings();
        if (!settings || !settings.smtp || !settings.smtp.host) {
          setSnackMessage('SMTP is not configured. Please configure SMTP settings before sending a test email.');
          setSnackSeverity('error');
          setSnackOpen(true);
          setSending(false);
          return;
        }
      } catch (e) {
        // couldn't fetch settings; continue and let testSmtp surface server message
      }

      const res = await adminAPI.testSmtp(to);
      const message = res && res.message ? res.message : 'Test email sent successfully';
      setSnackMessage(message);
      setSnackSeverity('success');
      setSnackOpen(true);
      setSending(false);
      // close modal shortly after showing success
      setTimeout(() => {
        setSnackOpen(false);
        onClose();
      }, 900);
    } catch (err: any) {
      setSending(false);
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to send test email';
      setSnackMessage(message);
      setSnackSeverity('error');
      setSnackOpen(true);
    }
  };

  return (
    <>
      <Modal open={open} onClose={() => { if (!sending) onClose(); }}>
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, bgcolor: 'background.paper', boxShadow: 24, p: 3 }}>
          <h3>Send Test Email</h3>
          <TextField
            label="Recipient Email"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            fullWidth
            margin="normal"
          />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            <Button onClick={onClose} disabled={sending}>Cancel</Button>
            <Button variant="contained" onClick={handleSend} disabled={sending || !to}>
              {sending ? <CircularProgress size={20} /> : 'Send Test Email'}
            </Button>
          </Box>
        </Box>
      </Modal>
      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)}>
        <Alert onClose={() => setSnackOpen(false)} severity={snackSeverity} sx={{ width: '100%' }}>
          {snackMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default TestEmailModal;
