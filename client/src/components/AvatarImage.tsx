import React from 'react';

type AvatarSource = {
  profileImage?: string | null;
  profileImageId?: string | null;
  profilePicture?: string | null; // legacy
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
};

type Props = {
  user?: AvatarSource | null;
  src?: string | null;
  profileImageId?: string | null;
  size?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
};

const AvatarImage: React.FC<Props> = ({ user, src, profileImageId, size = 40, alt = '', className, style }) => {
  const u = user as any;
  const id = profileImageId || u?.profileImageId || null;
  const imageSrc = src || u?.profileImage || u?.profilePicture || null;

  if (id) {
    // Use GridFS streaming endpoint
    return (
      <img
        src={`/api/resident/personal-info/avatar/${id}`}
        alt={alt || u?.fullName || u?.username || u?.email || 'avatar'}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
        className={className}
      />
    );
  }

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={alt || u?.fullName || u?.username || u?.email || 'avatar'}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
        className={className}
      />
    );
  }

  // Fallback to ui-avatars
  const name = (u?.fullName || u?.username || u?.email || '').toString();
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2196F3&color=fff&size=${Math.max(Math.min(size, 256), 32)}`;
  return (
    <img
      src={avatarUrl}
      alt={alt || name || 'avatar'}
      width={size}
      height={size}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', ...style }}
      className={className}
    />
  );
};

export default AvatarImage;
