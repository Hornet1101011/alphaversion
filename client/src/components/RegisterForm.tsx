import React from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { TextField, Button, Box, Link, Paper, Container, InputAdornment, Alert, MenuItem } from '@mui/material';
import { Email, Lock, Home, Phone, Badge, Person, Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

// Server requires: min 6 chars, at least one number, one uppercase letter, and one special character
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const validationSchema = Yup.object({
  username: Yup.string()
    .matches(/^[a-zA-Z0-9]{4,20}$/, 'Username must be 4-20 characters and contain only letters and numbers')
    .required('Username is required'),
  email: Yup.string().email('Invalid email address').required('Email is required'),
  password: Yup.string()
    .matches(PASSWORD_REGEX, 'Password must be at least 6 characters long and contain at least one number, one uppercase letter, and one special character')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), undefined], 'Passwords must match')
    .required('Confirm Password is required'),
  address: Yup.string().required('Address is required'),
  contactNumber: Yup.string().required('Contact Number is required'),
  barangayID: Yup.string().required('Barangay ID is required'),
});

const RegisterForm = () => {
  const navigate = useNavigate();
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [adminPassword, setAdminPassword] = React.useState('');
  const [adminUnlocked, setAdminUnlocked] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<{ [key: string]: string }>({});

  // Helper to generate a random unique Barangay ID
  function generateBarangayID() {
    // New format: brgyparian-<YEAR>-<6 chars alphanumeric mixed case>
    const year = new Date().getFullYear();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 6; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    return `brgyparian-${year}-${rand}`;
  }

  const formik = useFormik({
    initialValues: {
      firstName: '',
      middleName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      address: '',
      contactNumber: '',
      barangayID: generateBarangayID(),
      role: 'resident',
    },
    validationSchema: validationSchema.shape({
      firstName: Yup.string().required('First name is required'),
      lastName: Yup.string().required('Last name is required'),
      role: Yup.string().oneOf(['resident']).required('Role is required'),
    }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
  setError('');
  setFieldErrors({});

      // Prevent submission if there are validation errors
      const formErrors = await formik.validateForm();
      if (Object.keys(formErrors).length > 0) {
        setError('Please correct the highlighted errors before submitting.');
        setSubmitting(false);
        return;
      }

      // role is constrained to 'resident' on the client; admin/staff registration is not exposed here
      try {
        const fullName = [values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ');

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            firstName: values.firstName,
            middleName: values.middleName,
            lastName: values.lastName,
            username: values.username,
            email: values.email,
            password: values.password,
            address: values.address,
            contactNumber: values.contactNumber,
            barangayID: values.barangayID,
            role: values.role,
          })
        });
        let data: any = {};
        try {
          data = await res.json();
        } catch (jsonErr) {
          setError('Server error: Could not parse response');
          return;
        }
        if (res.ok) {
          setSuccess('Registration successful! You may now log in.');
          resetForm();
          setTimeout(() => navigate('/login'), 1500);
        } else {
          // Try to extract field-specific errors if present
          if (data.errors && typeof data.errors === 'object') {
            setFieldErrors(data.errors);
            setError('Please correct the highlighted errors before submitting.');
            setSubmitting(false);
            return;
          } else if (data.message) {
            setError(data.message);
          } else if (data.error) {
            setError(data.error);
          } else {
            setError('Registration failed');
          }
        }
      } catch (err) {
        setError('Network or server error. Please try again later.');
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <Box sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #40c9ff 0%, #e81cff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      py: 6,
    }}>
      <Container maxWidth="sm">
        <Paper elevation={6} sx={{
          borderRadius: 5,
          p: 4,
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 8px 32px 0 rgba(64,201,255,0.15)',
        }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{
              fontWeight: 800,
              fontSize: 32,
              letterSpacing: 1,
              background: 'linear-gradient(90deg, #40c9ff, #e81cff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block',
            }}>
              Create Account
            </Box>
          </Box>
          <form onSubmit={formik.handleSubmit}>
            {/* ...existing fields... */}
            <TextField
              fullWidth
              margin="normal"
              label="First Name"
              name="firstName"
              value={formik.values.firstName}
              onChange={formik.handleChange}
              error={formik.touched.firstName && Boolean(formik.errors.firstName)}
              helperText={formik.touched.firstName && formik.errors.firstName}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Middle Name (optional)"
              name="middleName"
              value={formik.values.middleName}
              onChange={formik.handleChange}
              error={formik.touched.middleName && Boolean(formik.errors.middleName)}
              helperText={formik.touched.middleName && formik.errors.middleName}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Last Name"
              name="lastName"
              value={formik.values.lastName}
              onChange={formik.handleChange}
              error={formik.touched.lastName && Boolean(formik.errors.lastName)}
              helperText={formik.touched.lastName && formik.errors.lastName}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Username"
              name="username"
              value={formik.values.username}
              onChange={formik.handleChange}
              error={
                (formik.touched.username && Boolean(formik.errors.username)) ||
                Boolean(fieldErrors.username)
              }
              helperText={
                (formik.touched.username && formik.errors.username) ||
                fieldErrors.username ||
                'Username must be at least 4 characters long and contain only letters and numbers.'
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Email"
              name="email"
              value={formik.values.email}
              onChange={formik.handleChange}
              error={
                (formik.touched.email && Boolean(formik.errors.email)) ||
                Boolean(fieldErrors.email)
              }
              helperText={
                (formik.touched.email && formik.errors.email) ||
                fieldErrors.email
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            {/* Password Field with Show/Hide */}
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              value={formik.values.password}
              onChange={formik.handleChange}
              error={formik.touched.password && Boolean(formik.errors.password)}
              helperText={
                (formik.touched.password && formik.errors.password) ||
                fieldErrors.password ||
                'Password must be at least 6 characters long and contain at least one number, one uppercase letter, and one special character.'
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      onClick={() => setShowPassword((prev) => !prev)}
                      tabIndex={-1}
                      sx={{ minWidth: 0, p: 0, color: 'inherit' }}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            {/* Confirm Password Field with Show/Hide */}
            <TextField
              fullWidth
              margin="normal"
              label="Confirm Password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={formik.values.confirmPassword}
              onChange={formik.handleChange}
              error={formik.touched.confirmPassword && Boolean(formik.errors.confirmPassword)}
              helperText={formik.touched.confirmPassword && formik.errors.confirmPassword}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="primary" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <Button
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      tabIndex={-1}
                      sx={{ minWidth: 0, p: 0, color: 'inherit' }}
                    >
                      {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                    </Button>
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Address"
              name="address"
              value={formik.values.address}
              onChange={formik.handleChange}
              error={formik.touched.address && Boolean(formik.errors.address)}
              helperText={formik.touched.address && formik.errors.address}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Home color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Contact Number"
              name="contactNumber"
              value={formik.values.contactNumber}
              onChange={formik.handleChange}
              error={formik.touched.contactNumber && Boolean(formik.errors.contactNumber)}
              helperText={formik.touched.contactNumber && formik.errors.contactNumber}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Phone color="primary" />
                  </InputAdornment>
                ),
              }}
              sx={{ borderRadius: 3, background: '#f4f6fa', mb: 2 }}
            />
            {/* Keep Barangay ID out of the visible form but include it as a hidden field so it's submitted */}
            <input type="hidden" name="barangayID" value={formik.values.barangayID} />

            {/* Role Dropdown */}
            <Box sx={{ mb: 2 }}>
              <TextField
                select
                fullWidth
                label="Role"
                name="role"
                value={formik.values.role}
                onChange={e => {
                  formik.handleChange(e);
                  if (e.target.value !== 'admin') setAdminPassword('');
                }}
                error={formik.touched.role && Boolean(formik.errors.role)}
                helperText={
                  formik.touched.role && formik.errors.role ? formik.errors.role : ''
                }
                sx={{ borderRadius: 3, background: '#f4f6fa' }}
              >
                  <MenuItem value="resident">Resident</MenuItem>
              </TextField>
            </Box>
              {/* admin/staff registration is not available through this public form */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{
                mt: 3, mb: 2, borderRadius: 3, fontWeight: 700, fontSize: '1.1rem',
                background: 'linear-gradient(90deg, #e81cff 0%, #40c9ff 100%)',
                color: '#fff',
                boxShadow: '0 2px 8px #e81cff44',
                transition: 'background 0.3s',
                '&:hover': {
                  background: 'linear-gradient(90deg, #40c9ff 0%, #e81cff 100%)',
                },
              }}
              disabled={formik.isSubmitting}
            >
              Register
            </Button>
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
            {/* Show field-specific errors in a list if present and not already shown in helperText */}
            {Object.keys(fieldErrors).length > 0 && !error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {Object.entries(fieldErrors).map(([field, msg]) => (
                  <div key={field}>{msg}</div>
                ))}
              </Alert>
            )}
            {/* Optionally, show a message or unlock admin features if adminUnlocked is true */}
            {adminUnlocked && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Admin access is now unlocked! Redirecting to admin dashboard...
              </Alert>
            )}
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Link component={RouterLink} to="/login" variant="body2" sx={{ color: '#e81cff', fontWeight: 600 }}>
                Already have an account? <span style={{ textDecoration: 'underline' }}>Sign In</span>
              </Link>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  );
};

export default RegisterForm;
