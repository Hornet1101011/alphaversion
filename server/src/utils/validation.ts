// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Password validation (min 6 chars, 1 number, 1 uppercase, 1 special char)
export const validatePassword = (password: string): boolean => {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/;
  return passwordRegex.test(password);
};

// Username validation (alphanumeric, 4-20 chars)
export const validateUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9]{4,20}$/;
  return usernameRegex.test(username);
};

// Barangay ID validation (new format: brgyparian-YYYY-######)
export const validateBarangayID = (barangayID: string): boolean => {
  // Allow case-insensitive match (brgyparian-2025-ABC123) — last segment now alphanumeric (6 chars)
  const barangayIDRegex = /^brgyparian-\d{4}-[A-Za-z0-9]{6}$/i;
  return barangayIDRegex.test(barangayID);
};

// Phone number validation (PH format)
export const validatePhoneNumber = (phoneNumber: string): boolean => {
  const phoneRegex = /^(\+63|0)[0-9]{10}$/;
  return phoneRegex.test(phoneNumber);
};
