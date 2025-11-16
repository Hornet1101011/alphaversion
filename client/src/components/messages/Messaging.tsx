import React from 'react';
import { Tabs, Badge } from 'antd';
import MessageInbox from '../admin/MessageInbox';
import MessageSent from './MessageSent';
import MessageCompose from './MessageCompose';

const Messaging: React.FC<{ unreadCount: number }> = ({ unreadCount }) => (
  <Tabs defaultActiveKey="inbox">
    <Tabs.TabPane
      tab={<span>Inbox <Badge count={unreadCount} offset={[8, 0]} /></span>}
      key="inbox"
    >
      <MessageInbox />
    </Tabs.TabPane>
    <Tabs.TabPane tab="Sent" key="sent">
      <MessageSent />
    </Tabs.TabPane>
    <Tabs.TabPane tab="Compose" key="compose">
      <MessageCompose />
    </Tabs.TabPane>
  </Tabs>
);

export default Messaging;
