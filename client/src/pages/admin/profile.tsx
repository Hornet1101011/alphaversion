import React, { useEffect, useState } from 'react';
import Profile from '../../components/Profile';
import { useAuth } from '../../contexts/AuthContext';

const AdminProfilePage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Replace with your actual API call for admin profile
    fetch('/api/admin/profile')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then(data => {
        setProfile(data);
        setError(null);
      })
      .catch(() => setError('Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading profile...</div>;
  if (error) return <div className="p-8 text-center text-red-400">{error}</div>;
  if (!profile) return <div className="p-8 text-center text-gray-400">No profile data.</div>;

  return <Profile profile={profile} onProfileUpdate={setProfile} />;
};

export default AdminProfilePage;
