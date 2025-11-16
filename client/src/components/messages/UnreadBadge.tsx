import React, { useEffect, useState, useContext } from 'react';
import { Badge } from 'antd';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';

const UnreadBadge: React.FC = () => {
  const { user } = useContext(AuthContext)!;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (user) {
      axios.get('/api/messages/unread/count').then(res => setCount(res.data.count));
    }
  }, [user]);

  return <Badge count={count} />;
};

export default UnreadBadge;
