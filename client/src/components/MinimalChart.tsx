import React from 'react';
import { Line } from '@ant-design/charts';

const data = [
  { year: '1991', value: 3 },
  { year: '1992', value: 4 },
  { year: '1993', value: 3.5 },
  { year: '1994', value: 5 },
  { year: '1995', value: 4.9 },
  { year: '1996', value: 6 },
  { year: '1997', value: 7 },
  { year: '1998', value: 9 },
  { year: '1999', value: 13 },
];

const config = {
  data,
  xField: 'year',
  yField: 'value',
  height: 300,
  autoFit: true,
};

const MinimalChart: React.FC = () => {
  return (
    <div style={{ border: '2px solid red', background: '#fffbe6', padding: 24, minHeight: 400 }}>
      <div style={{ marginBottom: 16, fontWeight: 'bold', color: '#d46b08' }}>MinimalChart Debug: If you see this, the component is rendering.</div>
      <Line {...config} />
    </div>
  );
};

export default MinimalChart;
