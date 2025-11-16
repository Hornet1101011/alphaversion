
import axios from 'axios';
// Get resident inbox (inquiries)
export async function getInbox() {
  return axios.get('/inbox');
}

// Set base URL only once
axios.defaults.baseURL = '/api';

// Get resident personal info
export async function getPersonalInfo() {
  return axios.get('/residents/personal-info');
}

// Update resident personal info
export async function updatePersonalInfo(data: any) {
  return axios.put('/residents/personal-info', data);
}

// Get resident profile
export async function getResidentProfile() {
  return axios.get('/residents/profile');
}

// Get resident document requests
export async function getResidentRequests() {
  return axios.get('/residents/requests');
}

// Request staff access
export async function requestStaffAccess() {
  return axios.post('/residents/request-staff-access');
}

// ...add other API functions as needed...