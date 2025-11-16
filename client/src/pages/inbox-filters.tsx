import React from 'react';
import { Input, Select, Space } from 'antd';

const { Option } = Select;

export type FilterState = {
  status: 'all' | 'pending' | 'responded' | 'closed';
  search: string;
};

export const defaultFilterState: FilterState = {
  status: 'all',
  search: '',
};

export const InboxFilters: React.FC<{
  filter: FilterState;
  setFilter: (f: FilterState) => void;
}> = ({ filter, setFilter }) => (
  <Space style={{ marginBottom: 24, width: '100%' }} direction="horizontal" size={16}>
    <Select
      value={filter.status}
      style={{ width: 160 }}
      onChange={status => setFilter({ ...filter, status })}
    >
      <Option value="all">All</Option>
      <Option value="pending">⏳ Pending</Option>
      <Option value="responded">✅ Responded</Option>
      <Option value="closed">🛑 Closed</Option>
    </Select>
    <Input.Search
      allowClear
      placeholder="Search by date, name, or category"
      style={{ width: 320 }}
      value={filter.search}
      onChange={e => setFilter({ ...filter, search: e.target.value })}
    />
  </Space>
);
