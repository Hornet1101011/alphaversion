
// Activity logs temporarily disabled per request.
// The original implementation was removed to prevent the system from using activity logs.
import React from 'react';

const ActivityLogs: React.FC = () => {
  // Return a minimal placeholder so the route/component can remain mounted safely.
  return (
    <div style={{ padding: 20 }}>
      <h3>Activity Logs Disabled</h3>
      <p>The Activity Logs feature has been temporarily disabled in the system.</p>
    </div>
  );
};

export default ActivityLogs;
