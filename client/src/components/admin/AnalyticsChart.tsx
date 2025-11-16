import React from 'react';
// import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { Box, Paper, Typography } from '@mui/material';

export interface AnalyticsChartProps {
  monthlyTrends: Array<{ month: string; documentRequests: number; inquiries: number; residents: number }>;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ monthlyTrends }) => {
  return (
    <Paper sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Monthly Trends (Document Requests, Inquiries, Residents)
      </Typography>
      {/* Chart removed: Recharts dependency is no longer available. Replace with SVG or another charting solution. */}
      <Box sx={{ p: 4, textAlign: 'center', color: 'gray' }}>
        <Typography variant="body1">Chart unavailable: Recharts has been removed. Please implement with SVG or another library.</Typography>
      </Box>
    </Paper>
  );
};

export default AnalyticsChart;
