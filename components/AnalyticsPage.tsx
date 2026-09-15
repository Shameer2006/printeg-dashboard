import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Download,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Printer,
  ChevronDown,
  Sparkles,
  Layers,
  HelpCircle,
  BarChart3,
  RefreshCw,
  Eye,
  CheckSquare,
  Square,
  TrendingUp,
  Store,
} from 'lucide-react';
import { Client } from '../types';

export interface AnalyticsPageProps {
  allOrders: any[];
  clients: Client[];
  selectedClient: Client | null;
  userRole: 'admin' | 'merchant';
  onSelectClient?: (client: Client | null) => void;
}

type DatePreset = 'today' | 'yesterday' | '7days' | '28days' | 'all_time' | 'custom';
type TimeWindowPreset = 'all' | 'rush' | 'morning' | 'evening' | 'custom';
type DimensionTab = 'hours' | 'formats' | 'binding' | 'orders';

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  allOrders,
  clients,
  selectedClient,
  userRole,
  onSelectClient,
}) => {
  // --- Filter State ---
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [timeWindow, setTimeWindow] = useState<TimeWindowPreset>('all');
  const [customStartHour, setCustomStartHour] = useState(13); // 1 PM default
  const [customEndHour, setCustomEndHour] = useState(16);   // 4 PM default

  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid_only'>('paid_only');
  const [enableCompare, setEnableCompare] = useState(false);

  // --- Scorecard Line Visibility Toggles (Google Search Console Style) ---
  const [showPrintsLine, setShowPrintsLine] = useState(true);
  const [showRevenueLine, setShowRevenueLine] = useState(true);
  const [showRushRateLine, setShowRushRateLine] = useState(false);
  const [showAovLine, setShowAovLine] = useState(false);

  // --- Dimension Table State ---
  const [activeTab, setActiveTab] = useState<DimensionTab>('hours');
  const [tableSearch, setTableSearch] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // --- Chart Hover Tooltip State ---
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Resolve active shop slug
  const activeSlug = selectedClient?.slug || selectedClient?.id || '';

  // Determine hour boundaries based on timeWindow preset
  const { startHour, endHour, timeLabel } = useMemo(() => {
    switch (timeWindow) {
      case 'rush':
        return { startHour: 13, endHour: 16, timeLabel: 'Rush Hours (1:00 PM – 4:00 PM)' };
      case 'morning':
        return { startHour: 9, endHour: 13, timeLabel: 'Morning Shift (9:00 AM – 1:00 PM)' };
      case 'evening':
        return { startHour: 16, endHour: 21, timeLabel: 'Evening Shift (4:00 PM – 9:00 PM)' };
      case 'custom':
        const s = Math.min(customStartHour, customEndHour);
        const e = Math.max(customStartHour, customEndHour);
        const formatH = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
        return { startHour: s, endHour: e, timeLabel: `Custom (${formatH(s)} – ${formatH(e)})` };
      case 'all':
      default:
        return { startHour: 0, endHour: 24, timeLabel: 'All Day (12:00 AM – 11:59 PM)' };
    }
  }, [timeWindow, customStartHour, customEndHour]);

  // 1. Filter raw orders for the selected shop (or all shops if admin has selected "all")
  const shopOrders = useMemo(() => {
    return allOrders.filter(order => {
      if (!selectedClient) {
        // Admin view with "All Stores" selected
        return true;
      }
      const isMatch =
        order.vendorSlug === activeSlug ||
        order.vendorSlug === selectedClient.id ||
        order.clientId === selectedClient.id ||
        order.shopName === selectedClient.shopName ||
        order.storeName === selectedClient.shopName ||
        (selectedClient.storeName && (order.shopName === selectedClient.storeName || order.storeName === selectedClient.storeName)) ||
        (typeof order._docPath === 'string' && (
          order._docPath.startsWith(`vendors/${activeSlug}/`) ||
          order._docPath.startsWith(`vendors/${selectedClient.id}/`) ||
          order._docPath.startsWith(`clients/${selectedClient.id}/`)
        ));
      return isMatch;
    });
  }, [allOrders, selectedClient, activeSlug]);

  // Helper to check if an order matches the date range
  const filterByDate = (order: any, preset: DatePreset, offsetDays: number = 0) => {
    const ts = order.createdAt || order.timestamp || order.paid_at;
    if (!ts) return false;
    const d = new Date(ts);
    const now = new Date();

    if (preset === 'today') {
      const target = new Date(now);
      target.setDate(target.getDate() - offsetDays);
      return (
        d.getDate() === target.getDate() &&
        d.getMonth() === target.getMonth() &&
        d.getFullYear() === target.getFullYear()
      );
    }
    if (preset === 'yesterday') {
      const target = new Date(now);
      target.setDate(target.getDate() - 1 - offsetDays);
      return (
        d.getDate() === target.getDate() &&
        d.getMonth() === target.getMonth() &&
        d.getFullYear() === target.getFullYear()
      );
    }
    if (preset === '7days') {
      const end = new Date(now.getTime() - offsetDays * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return d >= start && d <= end;
    }
    if (preset === '28days') {
      const end = new Date(now.getTime() - offsetDays * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000);
      return d >= start && d <= end;
    }
    if (preset === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate).setHours(0, 0, 0, 0);
      const end = new Date(customEndDate).setHours(23, 59, 59, 999);
      const t = d.getTime();
      return t >= start && t <= end;
    }
    return true;
  };

  // Helper to check if an order matches the hour range
  const filterByHour = (order: any, startH: number, endH: number) => {
    if (startH === 0 && endH >= 24) return true;
    const ts = order.createdAt || order.timestamp || order.paid_at;
    if (!ts) return false;
    const hour = new Date(ts).getHours();
    return hour >= startH && hour < endH;
  };

  // Filtered orders for the current active period & time-window
  const currentPeriodOrders = useMemo(() => {
    return shopOrders.filter(o => {
      if (paymentFilter === 'paid_only') {
        const isPaid = o.payment_status === 'PAID' || o.paymentStatus === 'Paid';
        if (!isPaid) return false;
      }
      return filterByDate(o, datePreset, 0) && filterByHour(o, startHour, endHour);
    });
  }, [shopOrders, datePreset, customStartDate, customEndDate, startHour, endHour, paymentFilter]);

  // Comparison period orders (e.g. yesterday or previous 7 days)
  const comparePeriodOrders = useMemo(() => {
    if (!enableCompare) return [];
    const offset = datePreset === 'today' || datePreset === 'yesterday' ? 1 : datePreset === '7days' ? 7 : 28;
    return shopOrders.filter(o => {
      if (paymentFilter === 'paid_only') {
        const isPaid = o.payment_status === 'PAID' || o.paymentStatus === 'Paid';
        if (!isPaid) return false;
      }
      return filterByDate(o, datePreset, offset) && filterByHour(o, startHour, endHour);
    });
  }, [shopOrders, datePreset, enableCompare, startHour, endHour, paymentFilter]);

  // 2. Aggregate Core Metric Totals
  const currentMetrics = useMemo(() => {
    let totalPages = 0;
    let totalSheets = 0;
    let totalGrossRevenue = 0;
    let totalShopEarnings = 0;
    let singleSided = 0;
    let doubleSided = 0;
    let bwPages = 0;
    let colorPages = 0;

    let paidNet = 0;
    let paidGross = 0;
    let paidOrdersCount = 0;
    let paidPages = 0;

    let pendingNet = 0;
    let pendingGross = 0;
    let pendingOrdersCount = 0;
    let pendingPages = 0;

    currentPeriodOrders.forEach(o => {
      const p = Number(o.totalPages || o.pages || 1);
      const c = Number(o.copies || 1);
      const jobPages = p * c;
      const isDouble = o.printSide === 'double';
      const sheets = Math.ceil(p / (isDouble ? 2 : 1)) * c;

      totalPages += jobPages;
      totalSheets += sheets;

      if (o.isColor) colorPages += jobPages;
      else bwPages += jobPages;

      if (isDouble) doubleSided += sheets;
      else singleSided += sheets;

      const gross = Number(o.amount || o.cost || 0);
      const net = typeof o.vendorAmount === 'number'
        ? o.vendorAmount
        : (typeof o.subtotal === 'number' ? o.subtotal : gross / 1.08);

      totalGrossRevenue += gross;
      totalShopEarnings += net;

      const isPaid = o.payment_status === 'PAID' || o.paymentStatus === 'Paid';
      if (isPaid) {
        paidNet += net;
        paidGross += gross;
        paidOrdersCount += 1;
        paidPages += jobPages;
      } else {
        pendingNet += net;
        pendingGross += gross;
        pendingOrdersCount += 1;
        pendingPages += jobPages;
      }
    });

    const activeHoursCount = Math.max(1, endHour - startHour);
    const avgPrintsPerHour = Math.round(totalPages / activeHoursCount);
    const avgOrderValue = currentPeriodOrders.length > 0 ? totalGrossRevenue / currentPeriodOrders.length : 0;

    return {
      orderCount: currentPeriodOrders.length,
      totalPages,
      totalSheets,
      totalGrossRevenue,
      totalShopEarnings,
      singleSided,
      doubleSided,
      bwPages,
      colorPages,
      avgPrintsPerHour,
      avgOrderValue,
      paidNet,
      paidGross,
      paidOrdersCount,
      paidPages,
      pendingNet,
      pendingGross,
      pendingOrdersCount,
      pendingPages,
    };
  }, [currentPeriodOrders, startHour, endHour]);

  // Comparison period metrics for % delta calculation
  const compareMetrics = useMemo(() => {
    let totalPages = 0;
    let totalShopEarnings = 0;

    comparePeriodOrders.forEach(o => {
      const p = Number(o.totalPages || o.pages || 1);
      const c = Number(o.copies || 1);
      totalPages += (p * c);

      const gross = Number(o.amount || o.cost || 0);
      const net = typeof o.vendorAmount === 'number'
        ? o.vendorAmount
        : (typeof o.subtotal === 'number' ? o.subtotal : gross);
      totalShopEarnings += net;
    });

    return { totalPages, totalShopEarnings };
  }, [comparePeriodOrders]);

  // % Deltas
  const printsDelta = useMemo(() => {
    if (!enableCompare || compareMetrics.totalPages === 0) return null;
    const diff = ((currentMetrics.totalPages - compareMetrics.totalPages) / compareMetrics.totalPages) * 100;
    return Math.round(diff);
  }, [currentMetrics.totalPages, compareMetrics.totalPages, enableCompare]);

  const earningsDelta = useMemo(() => {
    if (!enableCompare || compareMetrics.totalShopEarnings === 0) return null;
    const diff = ((currentMetrics.totalShopEarnings - compareMetrics.totalShopEarnings) / compareMetrics.totalShopEarnings) * 100;
    return Math.round(diff);
  }, [currentMetrics.totalShopEarnings, compareMetrics.totalShopEarnings, enableCompare]);

  // 3. Time Series Data for the GSC Line Chart
  // If viewing "today" or "yesterday" or custom rush window: group by HOUR.
  // If viewing 7 days or 28 days: group by DAY.
  const chartData = useMemo(() => {
    const isDailyView = datePreset === 'today' || datePreset === 'yesterday';

    if (isDailyView) {
      // Create buckets for each hour between startHour and endHour
      const hoursCount = endHour - startHour;
      const buckets: {
        key: string;
        label: string;
        subLabel: string;
        pages: number;
        revenue: number;
        orders: number;
        comparePages: number;
        compareRevenue: number;
      }[] = [];

      for (let h = startHour; h < endHour; h++) {
        const hLabel = `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
        const nextH = h + 1;
        const nextHLabel = `${nextH % 12 || 12} ${nextH >= 12 ? 'PM' : 'AM'}`;
        buckets.push({
          key: `hour-${h}`,
          label: hLabel,
          subLabel: `${hLabel} – ${nextHLabel}`,
          pages: 0,
          revenue: 0,
          orders: 0,
          comparePages: 0,
          compareRevenue: 0,
        });
      }

      currentPeriodOrders.forEach(o => {
        const ts = o.createdAt || o.timestamp || o.paid_at;
        if (!ts) return;
        const h = new Date(ts).getHours();
        const index = h - startHour;
        if (index >= 0 && index < buckets.length) {
          const p = Number(o.totalPages || o.pages || 1) * Number(o.copies || 1);
          const rev = typeof o.vendorAmount === 'number' ? o.vendorAmount : Number(o.amount || 0);
          buckets[index].pages += p;
          buckets[index].revenue += rev;
          buckets[index].orders += 1;
        }
      });

      if (enableCompare) {
        comparePeriodOrders.forEach(o => {
          const ts = o.createdAt || o.timestamp || o.paid_at;
          if (!ts) return;
          const h = new Date(ts).getHours();
          const index = h - startHour;
          if (index >= 0 && index < buckets.length) {
            const p = Number(o.totalPages || o.pages || 1) * Number(o.copies || 1);
            const rev = typeof o.vendorAmount === 'number' ? o.vendorAmount : Number(o.amount || 0);
            buckets[index].comparePages += p;
            buckets[index].compareRevenue += rev;
          }
        });
      }

      return buckets;
    } else {
      // Group by Day (last 7 or 28 days or all time)
      let days = 28;
      if (datePreset === '7days') days = 7;
      else if (datePreset === '28days') days = 28;
      else if (datePreset === 'all_time') {
        let earliest = Date.now();
        currentPeriodOrders.forEach(o => {
          const t = new Date(o.createdAt || o.timestamp || o.paid_at || Date.now()).getTime();
          if (t && t < earliest) earliest = t;
        });
        const diffDays = Math.max(7, Math.ceil((Date.now() - earliest) / (24 * 3600 * 1000)) + 1);
        days = Math.min(diffDays, 60);
      }
      const buckets: any[] = [];
      const now = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        const dateKey = d.toISOString().slice(0, 10);
        buckets.push({
          key: dateKey,
          label: dayStr,
          subLabel: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
          pages: 0,
          revenue: 0,
          orders: 0,
          comparePages: 0,
          compareRevenue: 0,
        });
      }

      currentPeriodOrders.forEach(o => {
        const ts = o.createdAt || o.timestamp || o.paid_at;
        if (!ts) return;
        const key = new Date(ts).toISOString().slice(0, 10);
        const b = buckets.find(item => item.key === key);
        if (b) {
          const p = Number(o.totalPages || o.pages || 1) * Number(o.copies || 1);
          const rev = typeof o.vendorAmount === 'number' ? o.vendorAmount : Number(o.amount || 0);
          b.pages += p;
          b.revenue += rev;
          b.orders += 1;
        }
      });

      return buckets;
    }
  }, [currentPeriodOrders, comparePeriodOrders, datePreset, startHour, endHour, enableCompare]);

  // Find peak bucket
  const peakBucket = useMemo(() => {
    if (chartData.length === 0) return null;
    return [...chartData].sort((a, b) => b.pages - a.pages)[0];
  }, [chartData]);

  // 4. SVG Smooth Bezier Curve Calculation
  const svgMetrics = useMemo(() => {
    const width = 800;
    const height = 240;
    const paddingX = 40;
    const paddingTop = 20;
    const paddingBottom = 40;

    const maxPages = Math.max(...chartData.map(d => Math.max(d.pages, d.comparePages || 0)), 5);
    const maxRevenue = Math.max(...chartData.map(d => Math.max(d.revenue, d.compareRevenue || 0)), 10);

    const pointsCount = chartData.length;
    const stepX = pointsCount > 1 ? (width - paddingX * 2) / (pointsCount - 1) : 0;

    // Coordinate generators
    const getPointX = (index: number) => paddingX + index * stepX;
    const getPageY = (val: number) =>
      height - paddingBottom - (val / maxPages) * (height - paddingTop - paddingBottom);
    const getRevY = (val: number) =>
      height - paddingBottom - (val / maxRevenue) * (height - paddingTop - paddingBottom);

    // Build smooth Bezier path string
    const buildBezierPath = (getY: (v: number) => number, key: 'pages' | 'revenue' | 'comparePages') => {
      if (chartData.length === 0) return '';
      if (chartData.length === 1) {
        const x = getPointX(0);
        const y = getY(chartData[0][key]);
        return `M ${x - 20} ${y} L ${x + 20} ${y}`;
      }

      const points = chartData.map((d, i) => ({ x: getPointX(i), y: getY(d[key]) }));
      let path = `M ${points[0].x} ${points[0].y}`;

      for (let i = 0; i < points.length - 1; i++) {
        const current = points[i];
        const next = points[i + 1];
        const controlX = (current.x + next.x) / 2;
        path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
      }

      return path;
    };

    const printsPath = buildBezierPath(getPageY, 'pages');
    const revenuePath = buildBezierPath(getRevY, 'revenue');
    const comparePrintsPath = enableCompare ? buildBezierPath(getPageY, 'comparePages') : '';

    // Area path for gradient fill below blue prints curve
    let printsArea = '';
    if (chartData.length > 0) {
      const firstX = getPointX(0);
      const lastX = getPointX(chartData.length - 1);
      const baseY = height - paddingBottom;
      printsArea = `${printsPath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
    }

    return {
      width,
      height,
      paddingX,
      paddingTop,
      paddingBottom,
      maxPages,
      maxRevenue,
      getPointX,
      getPageY,
      getRevY,
      printsPath,
      revenuePath,
      comparePrintsPath,
      printsArea,
    };
  }, [chartData, enableCompare]);

  // 5. Dimension Breakdown Computations for Bottom Table
  // Tab 1: Hourly breakdown
  const hoursTableData = useMemo(() => {
    const maxP = Math.max(...chartData.map(b => b.pages), 1);
    return chartData.map(b => ({
      slot: b.subLabel,
      pages: b.pages,
      pct: Math.round((b.pages / maxP) * 100),
      revenue: b.revenue,
      orders: b.orders,
      avgPages: b.orders > 0 ? (b.pages / b.orders).toFixed(1) : '0',
    }));
  }, [chartData]);

  // Tab 2: Print specs breakdown
  const specsTableData = useMemo(() => {
    let bwSingle = 0;
    let bwDouble = 0;
    let colorSingle = 0;
    let colorDouble = 0;
    let a4Only = 0;

    currentPeriodOrders.forEach(o => {
      const p = Number(o.totalPages || o.pages || 1) * Number(o.copies || 1);
      if (o.isA4SheetsOnly) {
        a4Only += Number(o.a4Sheets || 1);
      } else if (o.isColor) {
        if (o.printSide === 'double') colorDouble += p;
        else colorSingle += p;
      } else {
        if (o.printSide === 'double') bwDouble += p;
        else bwSingle += p;
      }
    });

    const total = Math.max(1, currentMetrics.totalPages);
    return [
      { name: 'B&W Single Sided (Xerox)', pages: bwSingle, pct: Math.round((bwSingle / total) * 100), type: 'B/W' },
      { name: 'B&W Double Sided', pages: bwDouble, pct: Math.round((bwDouble / total) * 100), type: 'B/W' },
      { name: 'Color Single Sided', pages: colorSingle, pct: Math.round((colorSingle / total) * 100), type: 'Color' },
      { name: 'Color Double Sided', pages: colorDouble, pct: Math.round((colorDouble / total) * 100), type: 'Color' },
      ...(a4Only > 0 ? [{ name: 'Blank A4 Sheets', pages: a4Only, pct: 0, type: 'Blank' }] : []),
    ];
  }, [currentPeriodOrders, currentMetrics.totalPages]);

  // Tab 3: Binding services breakdown
  const bindingTableData = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenue: number }>();

    currentPeriodOrders.forEach(o => {
      if (o.bindingId && o.bindingId !== 'none') {
        const key = o.bindingId;
        const name = o.bindingName || 'Binding';
        const price = Number(o.bindingPrice || 0);
        if (!map.has(key)) {
          map.set(key, { name, count: 0, revenue: 0 });
        }
        const curr = map.get(key)!;
        curr.count += 1;
        curr.revenue += price;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [currentPeriodOrders]);

  // Tab 4: Orders Log
  const ordersLogData = useMemo(() => {
    const q = tableSearch.toLowerCase();
    return currentPeriodOrders
      .filter(o => {
        if (!q) return true;
        const code = String(o.orderCode || o.id || '').toLowerCase();
        const phone = String(o.mobileNumber || o.userPhoneNumber || '').toLowerCase();
        return code.includes(q) || phone.includes(q);
      })
      .sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() - new Date(a.createdAt || a.timestamp || 0).getTime());
  }, [currentPeriodOrders, tableSearch]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (currentPeriodOrders.length === 0) {
      alert('No orders found in the selected period to export.');
      return;
    }

    const headers = ['Order Code', 'Created At', 'Mobile', 'Pages', 'Copies', 'Color', 'Sides', 'Binding', 'Net Payout (₹)', 'Gross (₹)', 'Payment', 'Status'];
    const rows = currentPeriodOrders.map(o => [
      o.orderCode || o.id,
      o.createdAt || o.timestamp || '',
      o.mobileNumber || o.userPhoneNumber || 'Walk-in',
      o.totalPages || o.pages || 1,
      o.copies || 1,
      o.isColor ? 'Color' : 'B/W',
      o.printSide || 'single',
      o.bindingName || 'None',
      typeof o.vendorAmount === 'number' ? o.vendorAmount : o.amount || 0,
      o.amount || 0,
      o.payment_status || 'PENDING',
      o.status || 'pending',
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(val => `"${val}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const shopName = selectedClient?.shopName?.replace(/\s+/g, '_') || 'Store';
    link.href = url;
    link.setAttribute('download', `${shopName}_${datePreset}_${timeWindow}_analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* 1. Header Banner & Store Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-6 lg:p-8 rounded-3xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 size={20} />
            </span>
            <h2 className="text-2xl font-display font-bold text-slate-900">Performance &amp; Stacks Analytics</h2>
            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
              GSC Engine
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multi-dimensional stacks for print counts, rush-hour velocity, and store earnings.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Admin Shop Switcher */}
          {userRole === 'admin' && onSelectClient && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl">
              <Store size={14} className="text-slate-500" />
              <select
                value={selectedClient?.id || 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'all') onSelectClient(null);
                  else {
                    const c = clients.find(item => item.id === val);
                    if (c) onSelectClient(c);
                  }
                }}
                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="all">All Network Stores</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.shopName || c.storeName || c.id}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Store Indicator */}
          {selectedClient && (
            <div className="px-3.5 py-2 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {selectedClient.shopName || selectedClient.id}
            </div>
          )}

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* 2. Top GSC Filter Chips Bar */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter size={13} /> Filters:
          </span>

          {/* Date Range Selector Chip */}
          <div className="flex items-center bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition-colors">
            <Calendar size={13} className="mr-1.5 text-slate-500" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="bg-transparent outline-none cursor-pointer pr-1"
            >
              <option value="today">Date: Today</option>
              <option value="yesterday">Date: Yesterday</option>
              <option value="7days">Date: Last 7 Days</option>
              <option value="28days">Date: Last 28 Days</option>
              <option value="all_time">Date: All Time</option>
              <option value="custom">Date: Custom Range</option>
            </select>
          </div>

          {/* Time Window / Rush-Hour Chip (1 PM - 4 PM) */}
          <div className="flex items-center bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition-colors">
            <Clock size={13} className="mr-1.5 text-slate-500" />
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindowPreset)}
              className="bg-transparent outline-none cursor-pointer pr-1"
            >
              <option value="all">Hours: All Day (24h)</option>
              <option value="rush">Hours: 1:00 PM – 4:00 PM (Rush Shift)</option>
              <option value="morning">Hours: 9:00 AM – 1:00 PM (Morning)</option>
              <option value="evening">Hours: 4:00 PM – 9:00 PM (Evening)</option>
              <option value="custom">Hours: Custom Time Slot</option>
            </select>
          </div>

          {/* Payment Filter Chip */}
          <div className="flex items-center bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 transition-colors">
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as any)}
              className="bg-transparent outline-none cursor-pointer pr-1"
            >
              <option value="paid_only">Orders: Paid Only (Realized Payouts)</option>
              <option value="all">Orders: All Activity (Paid + Pending Drafts)</option>
            </select>
          </div>

          {/* Compare Toggle Chip */}
          <button
            onClick={() => setEnableCompare(!enableCompare)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              enableCompare
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
            }`}
          >
            <TrendingUp size={13} />
            {enableCompare ? 'Compare: ON' : '+ Compare'}
          </button>
        </div>

        {/* Custom Date / Time inputs when 'custom' is active */}
        {(datePreset === 'custom' || timeWindow === 'custom') && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2">
                <span>Date Range:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none"
                />
                <span>to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-medium outline-none"
                />
              </div>
            )}

            {timeWindow === 'custom' && (
              <div className="flex items-center gap-2">
                <span>Hours:</span>
                <select
                  value={customStartHour}
                  onChange={(e) => setCustomStartHour(Number(e.target.value))}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i % 12 || 12}:00 {i >= 12 ? 'PM' : 'AM'}
                    </option>
                  ))}
                </select>
                <span>to</span>
                <select
                  value={customEndHour}
                  onChange={(e) => setCustomEndHour(Number(e.target.value))}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i % 12 || 12}:00 {i >= 12 ? 'PM' : 'AM'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Google Search Console Multi-Line Scorecard Container */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Top 4 Scorecard Tabs (Interactive Line Toggles) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          {/* Card 1: Total Prints (Blue) */}
          <button
            onClick={() => setShowPrintsLine(!showPrintsLine)}
            className={`p-6 text-left transition-all relative ${
              showPrintsLine ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50/60 opacity-60'
            }`}
          >
            {showPrintsLine && <div className="absolute top-0 left-0 right-0 h-1 bg-[#1a73e8]" />}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1a73e8] flex items-center gap-1.5">
                {showPrintsLine ? <CheckSquare size={14} /> : <Square size={14} />} Total Prints
              </span>
              {printsDelta !== null && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  printsDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {printsDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(printsDelta)}%
                </span>
              )}
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {currentMetrics.totalPages.toLocaleString()} <span className="text-base font-medium text-slate-400">pgs</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {paymentFilter === 'all'
                ? `${currentMetrics.paidPages} pgs paid • ${currentMetrics.pendingPages} pgs draft/pending`
                : `${currentMetrics.totalSheets} sheets (${currentMetrics.bwPages} B&W • ${currentMetrics.colorPages} Color)`}
            </p>
          </button>

          {/* Card 2: Total Revenue (Violet) */}
          <button
            onClick={() => setShowRevenueLine(!showRevenueLine)}
            className={`p-6 text-left transition-all relative ${
              showRevenueLine ? 'bg-purple-50/40' : 'bg-white hover:bg-slate-50/60 opacity-60'
            }`}
          >
            {showRevenueLine && <div className="absolute top-0 left-0 right-0 h-1 bg-[#8430ce]" />}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8430ce] flex items-center gap-1.5">
                {showRevenueLine ? <CheckSquare size={14} /> : <Square size={14} />} Shop Revenue
              </span>
              {earningsDelta !== null && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                  earningsDelta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {earningsDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(earningsDelta)}%
                </span>
              )}
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              ₹{currentMetrics.totalShopEarnings.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {paymentFilter === 'all'
                ? `Paid: ₹${currentMetrics.paidNet.toFixed(2)} (${currentMetrics.paidOrdersCount}) • Pending: ₹${currentMetrics.pendingNet.toFixed(2)} (${currentMetrics.pendingOrdersCount})`
                : `Verified Net Payout • ${currentMetrics.orderCount} paid orders (Gross: ₹${currentMetrics.totalGrossRevenue.toFixed(2)})`}
            </p>
          </button>

          {/* Card 3: Rush Rate (Teal) */}
          <button
            onClick={() => setShowRushRateLine(!showRushRateLine)}
            className={`p-6 text-left transition-all relative ${
              showRushRateLine ? 'bg-teal-50/40' : 'bg-white hover:bg-slate-50/60 opacity-60'
            }`}
          >
            {showRushRateLine && <div className="absolute top-0 left-0 right-0 h-1 bg-[#00897b]" />}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00897b] flex items-center gap-1.5">
                {showRushRateLine ? <CheckSquare size={14} /> : <Square size={14} />} Rush Velocity
              </span>
              <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                Pace
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {currentMetrics.avgPrintsPerHour} <span className="text-base font-medium text-slate-400">pgs/hr</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 truncate">
              Peak: {peakBucket ? `${peakBucket.label} (${peakBucket.pages} pgs)` : 'None'}
            </p>
          </button>

          {/* Card 4: Avg Order Value (Amber) */}
          <button
            onClick={() => setShowAovLine(!showAovLine)}
            className={`p-6 text-left transition-all relative ${
              showAovLine ? 'bg-amber-50/40' : 'bg-white hover:bg-slate-50/60 opacity-60'
            }`}
          >
            {showAovLine && <div className="absolute top-0 left-0 right-0 h-1 bg-[#e37400]" />}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#e37400] flex items-center gap-1.5">
                {showAovLine ? <CheckSquare size={14} /> : <Square size={14} />} Avg Order Value
              </span>
              <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                Ticket
              </span>
            </div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              ₹{currentMetrics.avgOrderValue.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Avg {(currentMetrics.orderCount > 0 ? (currentMetrics.totalPages / currentMetrics.orderCount).toFixed(1) : 0)} pages/order
            </p>
          </button>
        </div>

        {/* The GSC Smooth Curve Chart (SVG) */}
        <div className="p-6 lg:p-8 relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-4 font-medium">
            <span>{timeLabel}</span>
            <div className="flex items-center gap-4 text-xs font-bold">
              {showPrintsLine && (
                <span className="flex items-center gap-1.5 text-[#1a73e8]">
                  <span className="w-3 h-1 bg-[#1a73e8] rounded-full" /> Total Prints (pages)
                </span>
              )}
              {showRevenueLine && (
                <span className="flex items-center gap-1.5 text-[#8430ce]">
                  <span className="w-3 h-1 bg-[#8430ce] rounded-full" /> Shop Net Revenue (₹)
                </span>
              )}
              {enableCompare && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3 h-0.5 border-t border-dashed border-slate-400" /> Previous Period
                </span>
              )}
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-sm">
              No print activity recorded in this selected period and hour range.
            </div>
          ) : (
            <div className="relative w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgMetrics.width} ${svgMetrics.height}`}
                className="w-full h-64 select-none overflow-visible"
              >
                <defs>
                  {/* Soft Blue Gradient for Area Fill */}
                  <linearGradient id="gscPrintsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1a73e8" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1a73e8" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="gscRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8430ce" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#8430ce" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((factor, idx) => {
                  const y =
                    svgMetrics.height -
                    svgMetrics.paddingBottom -
                    factor * (svgMetrics.height - svgMetrics.paddingTop - svgMetrics.paddingBottom);
                  return (
                    <g key={idx}>
                      <line
                        x1={svgMetrics.paddingX}
                        y1={y}
                        x2={svgMetrics.width - svgMetrics.paddingX}
                        y2={y}
                        stroke="#f1f5f9"
                        strokeWidth="1"
                      />
                    </g>
                  );
                })}

                {/* Comparison Curve (Dotted) */}
                {enableCompare && svgMetrics.comparePrintsPath && (
                  <path
                    d={svgMetrics.comparePrintsPath}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                    opacity="0.8"
                  />
                )}

                {/* Prints Area Gradient */}
                {showPrintsLine && svgMetrics.printsArea && (
                  <path d={svgMetrics.printsArea} fill="url(#gscPrintsGradient)" />
                )}

                {/* Revenue Curve */}
                {showRevenueLine && svgMetrics.revenuePath && (
                  <path
                    d={svgMetrics.revenuePath}
                    fill="none"
                    stroke="#8430ce"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Prints Curve */}
                {showPrintsLine && svgMetrics.printsPath && (
                  <path
                    d={svgMetrics.printsPath}
                    fill="none"
                    stroke="#1a73e8"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Interactive Points and Vertical Hover Guide */}
                {chartData.map((d, idx) => {
                  const cx = svgMetrics.getPointX(idx);
                  const cyPrints = svgMetrics.getPageY(d.pages);
                  const cyRev = svgMetrics.getRevY(d.revenue);
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <g key={d.key}>
                      {/* Vertical Guideline on Hover */}
                      {isHovered && (
                        <line
                          x1={cx}
                          y1={svgMetrics.paddingTop}
                          x2={cx}
                          y2={svgMetrics.height - svgMetrics.paddingBottom}
                          stroke="#cbd5e1"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                      )}

                      {/* Points */}
                      {showPrintsLine && (
                        <circle
                          cx={cx}
                          cy={cyPrints}
                          r={isHovered ? 6 : 3.5}
                          fill="#1a73e8"
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          className="transition-all"
                        />
                      )}
                      {showRevenueLine && (
                        <circle
                          cx={cx}
                          cy={cyRev}
                          r={isHovered ? 5.5 : 3}
                          fill="#8430ce"
                          stroke="#ffffff"
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          className="transition-all"
                        />
                      )}

                      {/* Transparent Hover Hitbox */}
                      <rect
                        x={cx - 15}
                        y={svgMetrics.paddingTop}
                        width={30}
                        height={svgMetrics.height - svgMetrics.paddingTop - svgMetrics.paddingBottom}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPointIndex(idx)}
                        onMouseLeave={() => setHoveredPointIndex(null)}
                      />

                      {/* X-Axis Label */}
                      <text
                        x={cx}
                        y={svgMetrics.height - 12}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isHovered ? 'bold' : '500'}
                        fill={isHovered ? '#0f172a' : '#64748b'}
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Google-Style Floating Tooltip */}
              {hoveredPointIndex !== null && chartData[hoveredPointIndex] && (
                <div
                  className="absolute z-30 pointer-events-none bg-slate-900 text-white rounded-2xl p-3 shadow-xl text-xs space-y-1 -translate-x-1/2 -translate-y-full border border-slate-800 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    left: `${(svgMetrics.getPointX(hoveredPointIndex) / svgMetrics.width) * 100}%`,
                    top: `${svgMetrics.getPageY(chartData[hoveredPointIndex].pages) - 10}px`,
                  }}
                >
                  <div className="font-bold text-slate-200 border-b border-slate-700/60 pb-1 mb-1">
                    {chartData[hoveredPointIndex].subLabel}
                  </div>
                  {showPrintsLine && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-blue-400 font-medium">Prints:</span>
                      <span className="font-black text-white">{chartData[hoveredPointIndex].pages} pgs</span>
                    </div>
                  )}
                  {showRevenueLine && (
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-purple-400 font-medium">Revenue:</span>
                      <span className="font-black text-white">₹{chartData[hoveredPointIndex].revenue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 text-[11px] text-slate-400">
                    <span>Orders:</span>
                    <span className="font-bold text-slate-300">{chartData[hoveredPointIndex].orders} jobs</span>
                  </div>
                  {enableCompare && (
                    <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                      Prev: {chartData[hoveredPointIndex].comparePages} pgs • ₹{chartData[hoveredPointIndex].compareRevenue.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. GSC Bottom Dimension Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Dimension Tabs Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 p-4 lg:px-8 gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => { setActiveTab('hours'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'hours' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-black hover:bg-slate-100'
              }`}
            >
              Time Slots / Hours
            </button>
            <button
              onClick={() => { setActiveTab('formats'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'formats' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-black hover:bg-slate-100'
              }`}
            >
              Print Formats
            </button>
            <button
              onClick={() => { setActiveTab('binding'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'binding' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-black hover:bg-slate-100'
              }`}
            >
              Binding &amp; Finishing
            </button>
            <button
              onClick={() => { setActiveTab('orders'); setCurrentPage(1); }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'orders' ? 'bg-black text-white shadow-sm' : 'text-slate-500 hover:text-black hover:bg-slate-100'
              }`}
            >
              Orders Log ({ordersLogData.length})
            </button>
          </div>

          {/* Table Search Filter */}
          {activeTab === 'orders' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Filter code or phone..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-black w-48 sm:w-60"
              />
            </div>
          )}
        </div>

        {/* Tab 1: Hours Table */}
        {activeTab === 'hours' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Time Slot</th>
                  <th className="px-6 py-4">Print Volume</th>
                  <th className="px-6 py-4 text-right">Shop Net (₹)</th>
                  <th className="px-6 py-4 text-right">Orders</th>
                  <th className="px-6 py-4 text-right">Avg Pgs / Order</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {hoursTableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{row.slot}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            style={{ width: `${row.pct}%` }}
                            className="bg-[#1a73e8] h-full rounded-full"
                          />
                        </div>
                        <span className="font-bold text-slate-900">{row.pages} pgs</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">₹{row.revenue.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right">{row.orders}</td>
                    <td className="px-6 py-4 text-right">{row.avgPages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Formats Table */}
        {activeTab === 'formats' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Format / Paper Type</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Pages Printed</th>
                  <th className="px-6 py-4 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {specsTableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{row.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.type === 'Color' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            style={{ width: `${row.pct}%` }}
                            className="bg-[#1a73e8] h-full rounded-full"
                          />
                        </div>
                        <span className="font-bold text-slate-900">{row.pages}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">{row.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Binding Table */}
        {activeTab === 'binding' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Service Name</th>
                  <th className="px-6 py-4">Quantity Done</th>
                  <th className="px-6 py-4 text-right">Revenue Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {bindingTableData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      No binding services ordered in this period.
                    </td>
                  </tr>
                ) : (
                  bindingTableData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">📘 {row.name}</td>
                      <td className="px-6 py-4 font-bold">{row.count} units</td>
                      <td className="px-6 py-4 text-right font-black text-emerald-700">₹{row.revenue.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Orders Log */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Order Code</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Job Specs</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4 text-right">Shop Net</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {ordersLogData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No orders found matching this filter.
                    </td>
                  </tr>
                ) : (
                  ordersLogData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage).map((order) => {
                    const isPaid = order.payment_status === 'PAID' || order.paymentStatus === 'Paid';
                    const earnings = typeof order.vendorAmount === 'number'
                      ? order.vendorAmount
                      : (typeof order.subtotal === 'number' ? order.subtotal : Number(order.amount || 0));

                    return (
                      <tr key={order.orderCode || order.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-slate-900">
                          #{order.orderCode || order.id}
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-800">
                          {order.mobileNumber || order.userPhoneNumber || 'Walk-in'}
                        </td>
                        <td className="px-6 py-4">
                          {order.totalPages || order.pages || 1} pgs • {order.isColor ? 'Color' : 'B&W'} • {order.printSide === 'double' ? '2-Sided' : '1-Sided'}
                          {order.bindingName ? ` • 📘 ${order.bindingName}` : ''}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {isPaid ? 'PAID' : 'PENDING'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">
                          ₹{earnings.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {order.fileUrl ? (
                            <a
                              href={order.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-slate-100 hover:bg-black hover:text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <Eye size={12} /> PDF
                            </a>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No file</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {ordersLogData.length > rowsPerPage && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, ordersLogData.length)} of {ordersLogData.length} orders
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 font-bold"
                  >
                    Prev
                  </button>
                  <span className="font-bold text-slate-700">
                    Page {currentPage} of {Math.ceil(ordersLogData.length / rowsPerPage)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(ordersLogData.length / rowsPerPage), p + 1))}
                    disabled={currentPage === Math.ceil(ordersLogData.length / rowsPerPage)}
                    className="px-3 py-1.5 border rounded-lg disabled:opacity-40 hover:bg-slate-50 font-bold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
