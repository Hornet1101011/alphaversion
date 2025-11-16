
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, Row, Col, Divider, Skeleton, Empty, Form, Select, DatePicker, Space, Typography, Checkbox, Drawer, Button, Switch, Modal, message, Alert, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { QueryClient, QueryClientProvider, useQueries } from '@tanstack/react-query';
import { Pie, Bar, Line, Area } from '@ant-design/charts';
import axios from 'axios';
import type { Moment } from 'moment'; // Add this import at the top if using moment
import jsPDF from 'jspdf';

const { RangePicker } = DatePicker;
const { Option } = Select;

// Chart definitions (top-level so hooks depending on them stay stable)
// Only include charts backed by server endpoints to avoid 404s
const CHARTS: Record<string, { title: string; chartType: 'pie'|'bar'|'line'|'area'; endpoint: string; colors?: string[] }> = {
  gender: { title: 'Sex Distribution', chartType: 'pie', endpoint: '/api/analytics/gender', colors: ['#1890ff', '#00bcd4', '#888888'] },
  age: { title: 'Age Groups', chartType: 'bar', endpoint: '/api/analytics/age', colors: ['#1890ff'] },
  'civil-status': { title: 'Civil Status', chartType: 'bar', endpoint: '/api/analytics/civil-status', colors: ['#1890ff'] },
  education: { title: 'Education', chartType: 'bar', endpoint: '/api/analytics/education', colors: ['#13c2c2'] },
  'documents-monthly': { title: 'Monthly Document Requests', chartType: 'line', endpoint: '/api/analytics/documents-monthly', colors: ['#722ed1'] },
};

// stable array of chart ids (top-level so it's stable across renders)
const CHART_IDS = Object.keys(CHARTS);

// default QueryClient shared for this module
const defaultQueryClient = new QueryClient({ defaultOptions: { queries: { retry: 2, staleTime: 60_000, refetchOnWindowFocus: false } } });

const StatisticsInner: React.FC = () => {
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [summary, setSummary] = useState<any>(null);

  // chart data keyed by chart id
  const [chartData, setChartData] = useState<Record<string, any[]>>({});
  const [chartLoading, setChartLoading] = useState<Record<string, boolean>>({});

  // (removed unused genderCounts state)

  const [filters, setFilters] = useState<{ dateRange: Moment[]; residentType: string }>({ dateRange: [], residentType: '' });

  // selected chart ids
  const [selectedCharts, setSelectedCharts] = useState<string[]>(['gender', 'age', 'occupation', 'education', 'civil-status']);
  // Toggle: when enabled, automatically show only charts that have data
  const [autoEnableWhenData, setAutoEnableWhenData] = useState<boolean>(false);
  // store previous selection to restore when toggle is disabled
  const prevSelectionRef = useRef<string[] | null>(null);
  // Chart settings persisted in localStorage
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartSettings, setChartSettings] = useState<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem('statsChartSettings');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });
  const [settingsChartId, setSettingsChartId] = useState<string>('gender');
  // Dropdown controlled open state and pending selection for Apply/Cancel behavior
  const [chartsDropdownOpen, setChartsDropdownOpen] = useState<boolean>(false);
  const [pendingSelectedCharts, setPendingSelectedCharts] = useState<string[]>(selectedCharts);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await axios.get('/api/analytics/summary', {
        params: {
          startDate: filters.dateRange?.[0]?.format?.('YYYY-MM-DD'),
          endDate: filters.dateRange?.[1]?.format?.('YYYY-MM-DD'),
          residentType: filters.residentType,
        }
      });
      setSummary(res.data || null);
    } catch (err) {
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [filters]);

  // call summary on mount and whenever filters change (fetchSummary is stable via useCallback)
  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  // Fetch gender distribution separately
  // We'll fetch gender via the unified endpoints below when needed

  // Fetch server-side pre-bucketed age groups
  // pre-bucketed age groups handled via the /age endpoint

  // Fetch age distributions and bucket them into age groups for the Age Groups chart
  // age bucketing will be performed by server-side /api/analytics/age endpoint

  


  // Fetch one chart's data
  const fetchChart = useCallback(async (chartId: string) => {
    const def = CHARTS[chartId];
    if (!def) return;
    setChartLoading(c => ({ ...c, [chartId]: true }));
    try {
      // choose date range from chart-specific settings if provided, otherwise use global filters
      const cs = chartSettings[chartId] || {};
      const start = cs.dateRange?.[0]?.format?.('YYYY-MM-DD') || filters.dateRange?.[0]?.format?.('YYYY-MM-DD');
      const end = cs.dateRange?.[1]?.format?.('YYYY-MM-DD') || filters.dateRange?.[1]?.format?.('YYYY-MM-DD');
      const res = await axios.get(def.endpoint, { params: { startDate: start, endDate: end } });
      let payload = res.data?.data || [];
      // server returns { name, value } for sex endpoint; map to { type, value } expected by charts
      if (chartId === 'gender') {
        payload = payload.map((p: any) => ({ type: p.name ?? p.type ?? 'N/A', value: p.value ?? 0 }));
      }
      setChartData(d => ({ ...d, [chartId]: payload }));
      // (removed unused genderCounts population)
    } catch (err) {
      console.error('Error fetching chart', chartId, err);
      setChartData(d => ({ ...d, [chartId]: [] }));
    } finally {
      setChartLoading(c => ({ ...c, [chartId]: false }));
    }
  }, [filters, chartSettings]);

  // persist chartSettings to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('statsChartSettings', JSON.stringify(chartSettings));
    } catch (e) {
      // ignore
    }
  }, [chartSettings]);

  // When selection changes, trigger refetch for selected charts (chartQueriesMap is memoized below)
  // NOTE: effect is declared later after chartQueriesMapMemo is created to avoid using it before initialization

  // Example data mapping (adjust to your backend response)
  // Prefer explicit totalResidents from analytics/gender endpoint if present, otherwise fall back to monthly aggregation
  const totalResidents = summary?.totalResidents ?? 0;
  const totalDocuments = summary?.totalDocumentRequests ?? 0;

  const ageBarData = chartData['age'] || [];
  const ageMax = ageBarData && ageBarData.length ? Math.max(...ageBarData.map((d: any) => Number(d.value) || 0)) : 0;
  const ageAxisMax = Math.ceil(ageMax / 5) * 5 || 5;

  const monthlyDocData = chartData['documents-monthly'] || [];

  // ChartCard component
  const ChartCard: React.FC<{ id?: string; title: string; chartType: 'pie'|'bar'|'line'|'area'; data?: any[]; loading?: boolean; colors?: string[] }> = ({ id, title, chartType, data = [], loading, colors }) => {
    const hasData = Array.isArray(data) && data.length > 0;
    // apply per-chart settings overrides
    const cs = id ? (chartSettings[id] || {}) : {};
    const effectiveChartType = cs.chartType || chartType;
    const showLabels = cs.showLabels ?? true;
    const showTooltips = cs.showTooltips ?? true;
    const showLegend = cs.showLegend ?? true;

    return (
      <Card
        title={title}
        style={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(15,15,15,0.06)' }}
        styles={{ body: { padding: 16 } }}
      >
        {loading ? <Skeleton active /> : hasData ? (
          effectiveChartType === 'pie' ? (
            <div ref={(el) => { if (id) chartRefs.current[id] = el; }} style={{ background: '#ffffff' }}>
              {
                // normalize pie data to fixed fields to avoid AntV passing wrapper objects without type/value
              }
              {(() => {
                const pieData = (data || []).map((d: any) => {
                  const rawLabel = (d?.type ?? d?.name ?? d?.group ?? d?._id ?? 'Unknown').toString();
                  const norm = rawLabel.trim();
                  return { label: norm, valueNumber: Number(d?.value ?? d?.count ?? 0) };
                });
                return (
                  <Pie
                    data={pieData}
                    angleField="valueNumber"
                    colorField="label"
                    radius={0.9}
                    label={showLabels ? { formatter: (datum: any) => {
                      const p = datum?.data || datum || {};
                      const label = p?.label ?? p?.type ?? 'Unknown';
                      const val = Number(p?.valueNumber ?? p?.value ?? p?.count ?? 0) || 0;
                      return `${label} (${val})`;
                    } } : false}
                    tooltip={showTooltips ? { formatter: (datum: any) => {
                      const p = datum?.data || datum || {};
                      return { name: p?.label ?? p?.type ?? 'Unknown', value: Number(p?.valueNumber ?? p?.value ?? p?.count ?? 0) || 0 };
                    } } : false}
                    color={colors}
                    statistic={{ title: { formatter: () => title }, content: { formatter: () => `${(pieData || []).reduce((s: number, d: any) => s + (Number(d.valueNumber) || 0), 0)} total` } }}
                    legend={showLegend ? { position: 'bottom', formatter: (text: any) => {
                      // append count to legend label
                      const item = (pieData || []).find((p: any) => p.label === text);
                      const val = item ? Number(item.valueNumber || 0) : 0;
                      return `${text} (${val})`;
                    } } : false}
                    height={220}
                  />
                );
              })()}
            </div>
          ) : effectiveChartType === 'bar' ? (
            <div ref={(el) => { if (id) chartRefs.current[id] = el; }} style={{ background: '#ffffff' }}>
              <Bar data={data} xField="type" yField="value" color={colors && colors[0]} label={showLabels ? undefined : false} legend={showLegend ? undefined : false} tooltip={showTooltips ? undefined : false} yAxis={{ min: 0, max: ageAxisMax, tickInterval: 5 }} height={220} />
            </div>
          ) : effectiveChartType === 'line' ? (
            <div ref={(el) => { if (id) chartRefs.current[id] = el; }} style={{ background: '#ffffff' }}>
              <Line data={data} xField="type" yField="value" legend={showLegend ? undefined : false} tooltip={showTooltips ? undefined : false} height={220} />
            </div>
          ) : (
            <div ref={(el) => { if (id) chartRefs.current[id] = el; }} style={{ background: '#ffffff' }}>
              <Area data={data} xField="type" yField="value" legend={showLegend ? undefined : false} tooltip={showTooltips ? undefined : false} height={220} />
            </div>
          )
        ) : <Empty description="No data" />}
      </Card>
    );
  };


  // refs for chart containers to capture DOM for PDF
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // ref for the whole dashboard area
  const dashboardRef = useRef<HTMLDivElement | null>(null);

  const chartIds = Object.keys(CHARTS);

  // create queries for each chart using useQueries (keeps hooks rules safe)
  const chartQueryResults = useQueries({
    queries: chartIds.map((id) => {
      return {
        queryKey: [
          'chart',
          id,
          filters.dateRange?.[0]?.format?.('YYYY-MM-DD') || null,
          filters.dateRange?.[1]?.format?.('YYYY-MM-DD') || null,
          (chartSettings[id]?.dateRange?.[0]?.format?.('YYYY-MM-DD')) || null,
          (chartSettings[id]?.dateRange?.[1]?.format?.('YYYY-MM-DD')) || null,
          filters.residentType || null
        ],
        queryFn: async () => {
          const cs = chartSettings[id] || {};
          const start = cs.dateRange?.[0]?.format?.('YYYY-MM-DD') || filters.dateRange?.[0]?.format?.('YYYY-MM-DD');
          const end = cs.dateRange?.[1]?.format?.('YYYY-MM-DD') || filters.dateRange?.[1]?.format?.('YYYY-MM-DD');
          const res = await axios.get(CHARTS[id].endpoint, { params: { startDate: start, endDate: end, residentType: filters.residentType } });
          return res.data?.data || [];
        },
        retry: 2
      };
    })
  });
  // build a stable key from query result data to use in deps and memoization
  const chartQueryDataKey = chartQueryResults.map(r => JSON.stringify(r?.data || '')).join('|');

  const chartQueriesMapMemo = useMemo(() => {
    const m: Record<string, any> = {};
    CHART_IDS.forEach((id, idx) => { m[id] = chartQueryResults[idx]; });
    return m;
  }, [chartQueryDataKey]);

  // sync query results into local chartData / loading state for compatibility with existing code paths
  useEffect(() => {
    const newData: Record<string, any[]> = {};
    const newLoading: Record<string, boolean> = {};
    chartIds.forEach((id) => {
      const q = chartQueriesMapMemo[id];
      // debug: inspect query result for gender
      if (id === 'gender') {
        // eslint-disable-next-line no-console
        console.debug('chart query gender raw data:', q?.data);
      }
      // map server-side name/value into chart-friendly type/value for sex distribution
      if (id === 'gender') {
        // Normalize server-provided gender labels to canonical Male/Female/Other
        newData[id] = (q?.data || []).map((p: any) => {
          const rawType = (p?.name ?? p?.type ?? p?._id ?? '').toString().trim();
          const lower = (rawType || '').toLowerCase();
          let norm = 'Other';
          if (/^m/.test(lower)) norm = 'Male';
          else if (/^f/.test(lower)) norm = 'Female';
          return { type: norm, value: Number(p?.value ?? p?.count ?? 0) };
        })
        // Aggregate any duplicate normalized labels (in case server returned multiple spellings)
        .reduce((acc: any[], cur: any) => {
          const found = acc.find(a => a.type === cur.type);
          if (found) found.value += cur.value; else acc.push({ ...cur });
          return acc;
        }, [] as any[]);
      } else {
        newData[id] = q?.data || [];
      }
      newLoading[id] = q?.isFetching || q?.isLoading || false;
    });
    setChartData(newData);
    setChartLoading(newLoading);
  }, [chartQueryDataKey, chartQueriesMapMemo]);

  // When selection changes, trigger refetch for selected charts (chartQueriesMap is memoized above)
  useEffect(() => {
    if (!selectedCharts || !selectedCharts.length) return;
    selectedCharts.forEach(id => chartQueriesMapMemo[id]?.refetch && chartQueriesMapMemo[id].refetch());
  }, [selectedCharts, chartQueriesMapMemo]);

  // compute which charts currently have non-empty data
  const chartsWithData = useMemo(() => {
    const keys = Object.keys(chartData || {}).filter(k => Array.isArray(chartData[k]) && chartData[k].length > 0);
    return new Set(keys);
  }, [chartData]);

  // When autoEnableWhenData is turned on, reduce selectedCharts to only those with data.
  useEffect(() => {
    if (autoEnableWhenData) {
      // save previous selection
      prevSelectionRef.current = selectedCharts;
      const available = Array.from(chartsWithData);
      // keep the ordering of CHART_IDS but filter
      const newSel = CHART_IDS.filter(id => available.includes(id)).slice(0, 6); // limit to 6 by default
      if (newSel.length) setSelectedCharts(newSel);
    } else {
      // restore previous selection if present
      if (prevSelectionRef.current) {
        setSelectedCharts(prevSelectionRef.current);
        prevSelectionRef.current = null;
      }
    }
  }, [autoEnableWhenData, chartsWithData]);

  // Report generation
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  // responsive helper to make action buttons stack on small screens
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 700 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 700);
    try {
      window.addEventListener('resize', onResize);
    } catch (e) {}
    return () => { try { window.removeEventListener('resize', onResize); } catch (e) {} };
  }, []);

  // (removed unused helper 'median')

  const generateNarrativeReport = (state: { summary?: any; charts?: Record<string, any[]> }) => {
    const s = state.summary || summary || {};
    const charts = state.charts || chartData || {};

    const totalResidents = Number(s.totalResidents ?? 0);
    const gender = charts['gender'] || [];
    const age = charts['age'] || [];
    const cs = charts['civil-status'] || [];
    const ed = charts['education'] || [];
    const monthly = charts['documents-monthly'] || [];
  const occupation = charts['occupation'] || [];
  const nationality = charts['nationality'] || [];
  const bloodType = charts['bloodType'] || [];
  const disability = charts['disability'] || [];
  const children = charts['children'] || [];
  const businessType = charts['businessType'] || [];
  const businessSize = charts['businessSize'] || [];
  const incomeBrackets = charts['incomeBrackets'] || [];

    // Gender counts
    const maleCount = Number(gender.find((g:any) => (g.type||'').toLowerCase().startsWith('m'))?.value || 0);
    const femaleCount = Number(gender.find((g:any) => (g.type||'').toLowerCase().startsWith('f'))?.value || 0);
    const otherCount = Math.max(0, (gender || []).reduce((sum:number, g:any) => sum + (Number(g.value)||0), 0) - maleCount - femaleCount);

    // Top age group
    let topAgeGroup = '';
    if (age.length) {
      const sorted = [...age].sort((a:any,b:any) => (Number(b.value)||0) - (Number(a.value)||0));
      topAgeGroup = sorted[0]?.type || sorted[0]?.group || '';
    }

    // civil and education top items
    const topCivil = cs.length ? cs.slice(0,3).map((c:any) => `${c.type} (${c.value})`).join(', ') : '';
    const topEducation = ed.length ? ed.slice(0,3).map((c:any) => `${c.type} (${c.value})`).join(', ') : '';

    // monthly totals and peak
    const monthlyTotal = monthly.length ? monthly.reduce((sum:number,m:any) => sum + (Number(m.value)||0), 0) : 0;
    let peakMonth = '';
    let peakVal = 0;
    if (monthly.length) {
      const peak = monthly.reduce((best:any, m:any) => (Number(m.value)||0) > (Number(best.value)||0) ? m : best, monthly[0]);
      peakMonth = peak?.type || '';
      peakVal = Number(peak?.value || 0);
    }

    // Build templated sentences with conditionals
    const parts: string[] = [];

    if (totalResidents > 0) {
      const genderPart = (maleCount || femaleCount || otherCount)
        ? `There are currently ${totalResidents} residents, with ${maleCount} males, ${femaleCount} females${otherCount ? `, and ${otherCount} identifying as other` : ''}.`
        : `There are currently ${totalResidents} residents.`;
      parts.push(genderPart);
    } else {
      parts.push('Resident count is not available.');
    }

    if (topAgeGroup) {
      parts.push(`The most common age group is ${topAgeGroup}.`);
    } else if (age.length) {
      parts.push('Age distribution is available but no dominant age group could be determined.');
    } else {
      parts.push('Age distribution data is not available.');
    }

    // Occupation summary
    if (occupation.length) {
      const topOcc = occupation.slice().sort((a:any,b:any) => Number(b.value||0) - Number(a.value||0)).slice(0,3).map((o:any) => `${o.type || o.name} (${o.value})`).join(', ');
      parts.push(`Top occupations: ${topOcc}.`);
    } else {
      parts.push('Occupation distribution is not available.');
    }

    // Nationality summary
    if (nationality.length) {
      const topNat = nationality.slice().sort((a:any,b:any) => Number(b.value||0) - Number(a.value||0)).slice(0,3).map((n:any) => `${n.type || n.name} (${n.value})`).join(', ');
      parts.push(`Nationality distribution (top): ${topNat}.`);
    }

    if (topCivil) {
      parts.push(`Civil status (top): ${topCivil}.`);
    } else {
      parts.push('Civil status breakdown is not available.');
    }

    // Blood type and disability
    if (bloodType.length) {
      const bt = bloodType.map((b:any) => `${b.type || b.name} (${b.value})`).join(', ');
      parts.push(`Blood type breakdown: ${bt}.`);
    }
    if (disability.length) {
      const disabledCount = disability.reduce((s:number, d:any) => s + (Number(d.value)||0), 0);
      parts.push(`Disability reported for ${disabledCount} residents.`);
    }

    if (topEducation) {
      parts.push(`Educational attainment (top): ${topEducation}.`);
    } else {
      parts.push('Educational attainment data is not available.');
    }

    // Children distribution
    if (children.length) {
      // children chart should be buckets like 0,1,2,3+
      const avgChildren = children.reduce((sum:any, c:any, idx:any) => sum + (Number(c.value)||0) * (Number(c.type) || idx), 0) / Math.max(1, children.reduce((sum:any, c:any) => sum + (Number(c.value)||0), 0));
      parts.push(`Average reported children per household (approx): ${Number(avgChildren).toFixed(2)}.`);
    }

    if (monthly.length) {
      parts.push(`During the selected period there were ${monthlyTotal} document requests. The busiest month was ${peakMonth} with ${peakVal} requests.`);
    } else {
      parts.push('Document request trends are not available for the selected period.');
    }

    // Business stats
    if (businessType.length) {
      const topBiz = businessType.slice().sort((a:any,b:any) => Number(b.value||0) - Number(a.value||0)).slice(0,3).map((b:any) => `${b.type || b.name} (${b.value})`).join(', ');
      parts.push(`Top business types: ${topBiz}.`);
    }
    if (businessSize.length) {
      const totalBusinesses = businessSize.reduce((s:any, b:any) => s + (Number(b.value)||0), 0);
      parts.push(`Business size distribution available for ${totalBusinesses} businesses.`);
    }

    // Income summary
    if (incomeBrackets.length) {
      const totalReported = incomeBrackets.reduce((s:any, b:any) => s + (Number(b.value)||0), 0);
      const topBracket = incomeBrackets.slice().sort((a:any,b:any) => Number(b.value||0) - Number(a.value||0))[0];
      if (topBracket) parts.push(`Most residents fall into the ${topBracket.type || topBracket.name} income bracket (${topBracket.value}). Total reported incomes: ${totalReported}.`);
    }

    return parts.join(' ');
  };

  const openReport = () => {
    const text = generateNarrativeReport({ summary, charts: chartData });
    setReportText(text);
    setReportModalOpen(true);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      message.success('Report copied to clipboard');
    } catch (e) {
      message.error('Failed to copy');
    }
  };

  const downloadPdf = async () => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const title = 'Analytics Report';
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(11);
    const split = doc.splitTextToSize(reportText, 180);
    doc.text(split, 14, 30);
    
    // Try to capture currently visible charts and append images
    try {
      const html2canvas = (await import('html2canvas')).default;
      let y = 40 + (split.length * 6);
      for (const id of selectedCharts) {
        const el = chartRefs.current[id];
        if (!el) continue;
        // capture element to canvas
        // @ts-ignore
        const canvas = await html2canvas(el, { background: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const pdfWidth = doc.internal.pageSize.getWidth() - 28; // margins
        const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
        if (y + pdfHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(imgData, 'PNG', 14, y, pdfWidth, pdfHeight);
        y += pdfHeight + 8;
      }
    } catch (err) {
      console.warn('html2canvas not available or capture failed, exporting text only', err);
      message.warning('Chart capture failed; exporting text-only PDF. To include images, install html2canvas.');
    }
    
    doc.save('analytics-report.pdf');
  };

  // Download full analytics (dashboard + narrative) as styled A4 PDF
  const downloadFullAnalytics = async () => {
    if (!dashboardRef.current) {
      message.error('Dashboard not available for capture');
      return;
    }

    message.loading({ content: 'Preparing full report...', key: 'report' });

    try {
      const html2canvas = (await import('html2canvas')).default;
      // capture the dashboard DOM
      const el = dashboardRef.current;
  // increase scale for better resolution
  const canvas = await html2canvas(el, { background: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');

      // A4 dimensions in pt at 72 DPI: 595.28 x 841.89; jsPDF default unit is 'pt'
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

      // cover page
      const title = 'Barangay Analytics Report';
      pdf.setFontSize(24);
      pdf.text(title, 40, 80);
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleString()}`, 40, 110);
      pdf.addPage();

      // add dashboard image scaling to page width with margins
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 40;
      const usableWidth = pageWidth - margin * 2;
      // compute image size in PDF points based on natural image dimensions
      const tmpImg = new Image();
      tmpImg.src = imgData;
      await new Promise((res) => (tmpImg.onload = res));

      const imgWidthPts = usableWidth; // target width in PDF points
      const imgHeightPts = (tmpImg.height * imgWidthPts) / tmpImg.width;

      // convert pixels to PDF points ratio
      const pxPerPt = tmpImg.height / imgHeightPts; // pixels per PDF point
      const sliceHeightPt = pageHeight - margin * 2; // available height in PDF points
      const sliceHeightPx = Math.floor(sliceHeightPt * pxPerPt);

      // draw the full image into offscreen canvas at natural size, then slice vertically
      const offCanvas = document.createElement('canvas');
      offCanvas.width = tmpImg.width;
      offCanvas.height = tmpImg.height;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,offCanvas.width, offCanvas.height);
      ctx.drawImage(tmpImg, 0, 0);

      let yOffset = 0;
      while (yOffset < offCanvas.height) {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = offCanvas.width;
        sliceCanvas.height = Math.min(sliceHeightPx, offCanvas.height - yOffset);
        const sctx = sliceCanvas.getContext('2d');
        if (!sctx) break;
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0,0,sliceCanvas.width, sliceCanvas.height);
        sctx.drawImage(offCanvas, 0, yOffset, sliceCanvas.width, sliceCanvas.height, 0, 0, sliceCanvas.width, sliceCanvas.height);
        const sliceData = sliceCanvas.toDataURL('image/png');
        const drawHeightPts = sliceCanvas.height / pxPerPt; // convert slice pixels back to PDF points
        pdf.addImage(sliceData, 'PNG', margin, margin, imgWidthPts, drawHeightPts);
        yOffset += sliceHeightPx;
        if (yOffset < offCanvas.height) pdf.addPage();
      }

      pdf.save('barangay-analytics-report.pdf');
      message.success({ content: 'Report ready', key: 'report' });
    } catch (err) {
      console.error('Full report export failed', err);
      message.error({ content: 'Failed to export full report (see console).', key: 'report' });
    }
  };

  return (
    <Card
      title={<Typography.Title level={4} style={{ margin: 0 }}>Statistics & Analytics</Typography.Title>}
      style={{ borderRadius: 16, boxShadow: '0 2px 16px #40c9ff11' }}
      styles={{ body: { padding: 24 } }}
    >
      <div ref={dashboardRef} style={{ background: '#ffffff', padding: 8 }}>
      {/* Filters */}
  <Form layout={isMobile ? "vertical" : "inline"} style={{ marginBottom: 24, width: '100%', boxSizing: 'border-box' }}>
        <Form.Item label="Date Range">
          <RangePicker
            value={filters.dateRange as any}
            onChange={dates => setFilters(f => ({ ...f, dateRange: (dates ? dates.filter(Boolean) : []) as Moment[] }))}
            allowClear
          />
        </Form.Item>
        <Form.Item label="Resident Type">
          <Select
            value={filters.residentType}
            onChange={val => setFilters(f => ({ ...f, residentType: val }))}
            style={{ minWidth: 140 }}
            allowClear
            placeholder="All Types"
          >
            <Option value="">All</Option>
            <Option value="active">Active</Option>
            <Option value="inactive">Inactive</Option>
          </Select>
        </Form.Item>

        <Form.Item label="Charts">
          <Dropdown
            open={chartsDropdownOpen}
            onOpenChange={(open) => {
              if (open) {
                // initialize pending selection from current selection
                setPendingSelectedCharts(selectedCharts.slice());
              } else {
                // when closing without apply, reset pending to current
                setPendingSelectedCharts(selectedCharts.slice());
              }
              setChartsDropdownOpen(open);
            }}
            popupRender={() => (
              <div style={{ padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 6px 20px rgba(0,0,0,0.08)', minWidth: 340 }}>
                {/* Tidy vertical list with scroll when content overflows */}
                <div style={{ maxHeight: 260, overflowY: 'auto', paddingRight: 8 }} onWheel={(e) => { /* allow native wheel scrolling */ }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.keys(CHARTS).map(k => {
                      const checked = (pendingSelectedCharts || []).includes(k);
                      return (
                        <Checkbox key={k} checked={checked} onChange={(ev) => {
                          const next = new Set(pendingSelectedCharts || []);
                          if ((ev.target as HTMLInputElement).checked) next.add(k); else next.delete(k);
                          setPendingSelectedCharts(Array.from(next));
                        }}>
                          <span style={{ fontSize: 13 }}>{CHARTS[k].title}</span>
                        </Checkbox>
                      );
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                  <Button size="small" onClick={() => { setPendingSelectedCharts(selectedCharts.slice()); setChartsDropdownOpen(false); }}>Cancel</Button>
                  <Button size="small" type="primary" onClick={() => { setSelectedCharts(pendingSelectedCharts.slice()); setChartsDropdownOpen(false); }}>Apply</Button>
                </div>
              </div>
            )}
            trigger={['click']}
          >
            <Button>
              Charts <DownOutlined />
            </Button>
          </Dropdown>
        </Form.Item>
        <Form.Item style={{ width: '100%', boxSizing: 'border-box' }}>
          {/* Use a wrapping flex container so buttons stack/wrap on narrow screens */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
              <Switch checked={autoEnableWhenData} onChange={v => setAutoEnableWhenData(!!v)} />
              <span style={{ fontSize: 13 }}>Enable when data exists</span>
            </div>
            {/* Buttons container: on mobile take full row so buttons don't overflow */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: isMobile ? '0 0 100%' : '0 1 auto', alignItems: 'center', width: isMobile ? '100%' : undefined, boxSizing: 'border-box', paddingRight: 8 }}>
              <Button onClick={() => { setSettingsOpen(true); setSettingsChartId(selectedCharts[0] || 'gender'); }} block={isMobile} style={isMobile ? { width: '100%', marginBottom: 8 } : undefined}>Chart Settings</Button>
              <Button type="primary" onClick={openReport} block={isMobile} style={isMobile ? { width: '100%', marginBottom: 8 } : undefined}>Generate Report</Button>
              <Button onClick={async () => { await downloadFullAnalytics(); }} block={isMobile} style={isMobile ? { width: '100%' } : undefined}>Download Full Analytics</Button>
            </div>
          </div>
        </Form.Item>
      </Form>

      <Drawer title="Chart Settings" placement="right" onClose={() => setSettingsOpen(false)} open={settingsOpen} width={420}>
        <Form layout="vertical">
          <Form.Item label="Select chart">
            <Select value={settingsChartId} onChange={(v) => setSettingsChartId(v)}>
              {Object.keys(CHARTS).map(k => <Select.Option key={k} value={k}>{CHARTS[k].title}</Select.Option>)}
            </Select>
          </Form.Item>

          <Form.Item label="Chart type">
            <Select value={(chartSettings[settingsChartId] && chartSettings[settingsChartId].chartType) || CHARTS[settingsChartId].chartType} onChange={(val) => setChartSettings(s => ({ ...s, [settingsChartId]: { ...(s[settingsChartId] || {}), chartType: val } }))}>
              <Select.Option value="pie">Pie</Select.Option>
              <Select.Option value="bar">Bar</Select.Option>
              <Select.Option value="line">Line</Select.Option>
              <Select.Option value="area">Area</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Date range for this chart">
            <RangePicker value={(chartSettings[settingsChartId] && chartSettings[settingsChartId].dateRange) || filters.dateRange} onChange={(dates) => setChartSettings(s => ({ ...s, [settingsChartId]: { ...(s[settingsChartId] || {}), dateRange: dates ? dates.filter(Boolean) : [] } }))} allowClear />
          </Form.Item>

          <Form.Item label="Show labels">
            <Switch checked={(chartSettings[settingsChartId] && chartSettings[settingsChartId].showLabels) ?? true} onChange={(v) => setChartSettings(s => ({ ...s, [settingsChartId]: { ...(s[settingsChartId] || {}), showLabels: v } }))} />
          </Form.Item>

          <Form.Item label="Show tooltips">
            <Switch checked={(chartSettings[settingsChartId] && chartSettings[settingsChartId].showTooltips) ?? true} onChange={(v) => setChartSettings(s => ({ ...s, [settingsChartId]: { ...(s[settingsChartId] || {}), showTooltips: v } }))} />
          </Form.Item>

          <Form.Item label="Show legend">
            <Switch checked={(chartSettings[settingsChartId] && chartSettings[settingsChartId].showLegend) ?? true} onChange={(v) => setChartSettings(s => ({ ...s, [settingsChartId]: { ...(s[settingsChartId] || {}), showLegend: v } }))} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={() => { setSettingsOpen(false); fetchChart(settingsChartId); }}>Apply</Button>
              <Button onClick={() => { setChartSettings(s => ({ ...s, [settingsChartId]: {} })); }}>Reset</Button>
            </Space>
          </Form.Item>
        </Form>
      </Drawer>

      <Modal title="Analytics Report" open={reportModalOpen} onCancel={() => setReportModalOpen(false)} footer={[
        <Button key="copy" onClick={copyReport}>Copy</Button>,
        <Button key="download" type="primary" onClick={downloadPdf}>Download as PDF</Button>
      ]}>
        <Typography.Paragraph>{reportText || 'No data available for report.'}</Typography.Paragraph>
      </Modal>

      {/* Top Metrics */}
      <Row gutter={[24, 24]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 8px 20px rgba(15,15,15,0.04)', textAlign: 'left' }} styles={{ body: { padding: 16 } }}>
            {loadingSummary ? <Skeleton active paragraph={false} /> : (
              <div>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total Residents</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>{totalResidents}</Typography.Title>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} md={8}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 8px 20px rgba(15,15,15,0.04)', textAlign: 'left' }} styles={{ body: { padding: 16 } }}>
            {loadingSummary ? <Skeleton active paragraph={false} /> : (
              <div>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total Documents</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>{totalDocuments}</Typography.Title>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={24} md={8}>
          <Card style={{ borderRadius: 12, boxShadow: '0 8px 20px rgba(15,15,15,0.04)', textAlign: 'left' }} styles={{ body: { padding: 16 } }}>
            {loadingSummary ? <Skeleton active paragraph={false} /> : (
              <div>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Requests (selected period)</Typography.Text>
                <Typography.Title level={3} style={{ margin: 0 }}>{monthlyDocData ? monthlyDocData.reduce((s:any,m:any)=>s + (Number(m.value)||0), 0) : 0}</Typography.Title>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 6 }}>{monthlyDocData && monthlyDocData.length ? `Latest: ${monthlyDocData[monthlyDocData.length-1].type} (${monthlyDocData[monthlyDocData.length-1].value})` : ''}</Typography.Text>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Divider />
      {/* Charts */}
      {/* Show Alerts for failed chart queries */}
      {chartIds.map(id => {
    const q = chartQueriesMapMemo[id];
        if (q?.isError) {
          return (
            <Alert
              key={`alert-${id}`}
              message={`Failed to load ${CHARTS[id].title}`}
              description={<div>{String(q.error?.message || q.error)} <Button size="small" onClick={() => q.refetch()}>Retry</Button></div>}
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
            />
          );
        }
        return null;
      })}
      <Row gutter={[24, 24]}>
        {selectedCharts.includes('gender') && (
          <Col xs={24} md={12} lg={12}>
            <ChartCard id="gender" title={CHARTS['gender'].title} chartType={CHARTS['gender'].chartType} data={chartData['gender']} loading={chartLoading['gender']} colors={CHARTS['gender'].colors} />
          </Col>
        )}

        {selectedCharts.includes('age') && (
          <Col xs={24} md={12} lg={12}>
            <ChartCard id="age" title={CHARTS['age'].title} chartType={CHARTS['age'].chartType} data={chartData['age']} loading={chartLoading['age']} colors={CHARTS['age'].colors} />
          </Col>
        )}

        {selectedCharts.includes('documents-monthly') && (
          <Col xs={24} md={12} lg={12}>
            <ChartCard id="documents-monthly" title={CHARTS['documents-monthly'].title} chartType={CHARTS['documents-monthly'].chartType} data={chartData['documents-monthly']} loading={chartLoading['documents-monthly']} colors={CHARTS['documents-monthly'].colors} />
          </Col>
        )}

        {selectedCharts.includes('civil-status') && (
          <Col xs={24} md={12} lg={12}>
            <ChartCard id="civil-status" title={CHARTS['civil-status'].title} chartType={CHARTS['civil-status'].chartType} data={chartData['civil-status']} loading={chartLoading['civil-status']} colors={CHARTS['civil-status'].colors} />
          </Col>
        )}

        {selectedCharts.includes('education') && (
          <Col xs={24} md={12} lg={12}>
            <ChartCard id="education" title={CHARTS['education'].title} chartType={CHARTS['education'].chartType} data={chartData['education']} loading={chartLoading['education']} colors={CHARTS['education'].colors} />
          </Col>
        )}
      </Row>
      
      </div>
  </Card>
  );
};

const Statistics: React.FC = () => {
  return (
    <QueryClientProvider client={defaultQueryClient}>
      <StatisticsInner />
    </QueryClientProvider>
  );
};

export default Statistics;
