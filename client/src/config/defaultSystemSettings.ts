const defaultSystemSettings = {
  siteName: 'Barangay Portal',
  barangayName: 'Barangay Uno',
  barangayAddress: '123 Main St, City, Province',
  contactEmail: 'info@barangayuno.local',
  contactPhone: '+63 912 345 6789',
  maintainanceMode: false,
  allowNewRegistrations: true,
  requireEmailVerification: true,
  maxDocumentRequests: 5,
  documentProcessingDays: 3,
  // Allow creation of multiple accounts from the same IP and the maximum allowed
  allowMultipleAccountsPerIP: false,
  maxAccountsPerIP: 1,
  systemNotice: '',
  smtp: {
    host: '',
    port: 587,
    user: '',
    password: '',
  },
};

export default defaultSystemSettings;
