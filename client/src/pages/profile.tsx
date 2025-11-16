import React from 'react';
import Profile from '../components/Profile';

const ResidentProfilePage: React.FC = () => {
  // The Profile component already fetches and manages its own data for residents
  return <Profile profile={null} onProfileUpdate={() => {}} />;
};

export default ResidentProfilePage;
