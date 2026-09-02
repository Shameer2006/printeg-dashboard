import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Filter,
  Download,
  Printer,
  Users,
  AlertCircle,
  Menu,
  X,
  CheckCircle2,
  MessageSquare,
  Clock,
  ArrowRight,
  LayoutGrid,
  ArrowLeft,
  Calendar,
  Layers,
  FileText,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Store,
  MapPin,
  Settings,
  Trash2,
  Receipt,
  AlertTriangle,
  Phone,
  Mail,
  Pencil,
  QrCode,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  Wallet,
  TrendingUp,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ClientCard } from './components/ClientCard';
import { Client, StatusType, PrintPrices, VendorPricing, PriceTier, BindingPricing, BindingItemConfig, SpiralRangeTier } from './types';
import { db } from './src/lib/firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, updateDoc, doc, setDoc } from 'firebase/firestore';

const DEFAULT_PRICE_TIERS: PriceTier[] = [
  { id: '1', minPages: 1, maxPages: 10, bwRate: 1.5, doubleSidedRate: 2.0, colorRate: 10.0 },
  { id: '2', minPages: 11, maxPages: 40, bwRate: 1.2, doubleSidedRate: 1.8, colorRate: 8.0 },
  { id: '3', minPages: 41, maxPages: null, bwRate: 1.0, doubleSidedRate: 1.5, colorRate: 6.0 },
];

const DEFAULT_BINDING_CONFIG: BindingPricing = {
  enabled: true,
  items: [
    {
      id: 'spiral',
      name: 'Spiral Binding',
      description: 'Plastic coil with transparent protective front & back covers',
      enabled: true,
      type: 'tiered',
      tiers: [
        { id: '1', minSheets: 1, maxSheets: 49, price: 20 },
        { id: '2', minSheets: 50, maxSheets: 80, price: 25 },
        { id: '3', minSheets: 81, maxSheets: null, price: 30 },
      ],
    },
    {
      id: 'soft',
      name: 'Soft Binding',
      description: 'Booklet / thermal softcover wrap binding',
      enabled: true,
      type: 'flat',
      flatPrice: 15,
    },
    {
      id: 'calico',
      name: 'Calico Binding',
      description: 'Hardcover cloth binding with gold lettering',
      enabled: true,
      type: 'with_without_print',
      withPrintPrice: 40,
      withoutPrintPrice: 30,
    },
    {
      id: 'chart',
      name: 'Chart Bind',
      description: 'Thick chart paper binding with strip',
      enabled: true,
      type: 'with_without_print',
      withPrintPrice: 30,
      withoutPrintPrice: 25,
    },
  ],
};

// Define the number of items to display per page for pagination
const ITEMS_PER_PAGE = 5;

/**
 * LOGIN PAGE COMPONENT
 * Defined outside App to ensure it is stable and doesn't remount on App state changes.
 */
const LoginPage: React.FC<{
  onLogin: (role: 'admin' | 'merchant', merchant?: Client) => void;
  clients: Client[];
}> = ({ onLogin, clients }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Recovery State
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      const cleanUser = userId.trim().toLowerCase();
      const cleanPass = password.trim();

      // 1. Super Admin Authentication Check
      if (cleanUser === 'printeg.online' && cleanPass === 'printeg') {
        setIsLoading(false);
        onLogin('admin');
        return;
      }

      // 2. Merchant Authentication Check
      const matchedClient = clients.find(c => {
        const creds = c.merchantCredentials;
        if (!creds) {
          // Fallback if no credentials explicitly saved: check slug/id with password "printeg" or shop phone
          const matchesSlug = (c.slug || c.id || '').toLowerCase() === cleanUser;
          return matchesSlug && (cleanPass === 'printeg' || cleanPass === (c.phoneNumber || c.phone || ''));
        }
        const matchesUsername =
          (creds.username || '').trim().toLowerCase() === cleanUser ||
          (c.slug || '').trim().toLowerCase() === cleanUser ||
          (c.id || '').trim().toLowerCase() === cleanUser ||
          (c.phoneNumber || c.phone || '').trim() === cleanUser;
        return matchesUsername && (creds.password || '').trim() === cleanPass;
      });

      if (matchedClient) {
        setIsLoading(false);
        onLogin('merchant', matchedClient);
        return;
      }

      setError('Invalid User ID or Password. For Super Admin use printeg.online, or enter your shop\'s Merchant User ID & Password.');
      setIsLoading(false);
    }, 500);
  };

  const handleRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    setTimeout(() => {
      if (recoveryEmail && recoveryPhone) {
        setRecoveryStatus('success');
        setIsLoading(false);
        setTimeout(() => {
          setIsRecovering(false);
          setRecoveryStatus('idle');
          setRecoveryEmail('');
          setRecoveryPhone('');
        }, 3000);
      } else {
        setError('Please enter both Email and Phone Number.');
        setIsLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center technical-grid p-6 relative z-10">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-black flex items-center justify-center rounded-2xl shadow-2xl mb-4">
            <span className="text-white font-display font-bold text-3xl">P</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">PrintEG Portal</h1>
          <p className="text-slate-500 font-medium mt-1">Admin Console & Merchant Store Desk</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">
              {isRecovering ? 'Account Recovery' : 'Sign In'}
            </h2>
          </div>

          {/* SUCCESS MESSAGE */}
          {recoveryStatus === 'success' ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="font-bold text-slate-900 text-lg mb-2">Recovery Sent!</h3>
              <p className="text-slate-500 text-sm">
                Login credentials have been sent to <br />
                <span className="font-bold text-slate-900">{recoveryEmail}</span> and <span className="font-bold text-slate-900">{recoveryPhone}</span>
              </p>
            </div>
          ) : (
            /* FORM CONTAINER */
            <>
              {!isRecovering ? (
                /* LOGIN FORM */
                <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <label htmlFor="userId" className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      User ID / Merchant Username
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                      <input
                        id="userId"
                        name="userId"
                        type="text"
                        placeholder="printeg.online or shop_username"
                        autoComplete="username"
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all text-sm font-medium text-slate-900"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        required
                      />
                    </div>

                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        autoComplete="current-password"
                        className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all text-sm font-medium text-slate-900"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className="mt-2 text-right">
                      <button type="button" onClick={() => { setIsRecovering(true); setError(''); }} className="text-xs font-bold text-slate-400 hover:text-black transition-colors">
                        Forgot Password?
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-in fade-in duration-300">
                      <AlertCircle size={16} className="shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>Enter Dashboard <ArrowRight size={18} /></>
                    )}
                  </button>
                </form>
              ) : (
                /* RECOVERY FORM */
                <form onSubmit={handleRecovery} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="p-4 bg-blue-50 text-blue-800 text-xs font-medium rounded-2xl mb-4 leading-relaxed">
                    Verify your identity to reset access. We will send a secure link to your registered contact methods.
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Registered Email ID
                    </label>
                    <input
                      type="email"
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all text-sm font-medium text-slate-900"
                      placeholder="e.g. admin@printeg.online"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                      Registered Phone Number
                    </label>
                    <input
                      type="tel"
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black focus:bg-white outline-none transition-all text-sm font-medium text-slate-900"
                      placeholder="e.g. +91 98765 43210"
                      value={recoveryPhone}
                      onChange={(e) => setRecoveryPhone(e.target.value)}
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-rose-600 text-xs font-bold bg-rose-50 p-4 rounded-2xl border border-rose-100 animate-in fade-in duration-300">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}

                  <div className="pt-2 space-y-3">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Verify Identity'
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => { setIsRecovering(false); setError(''); }}
                      className="w-full text-slate-400 hover:text-black font-bold text-sm py-2 transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <p className="text-center text-slate-400 text-[11px] mt-8 font-medium italic">
            Secure admin access restricted to authorized personnel.
          </p>
        </div>
      </div>
    </div>
  );
};
/**
 * MAIN APPLICATION COMPONENT
 */
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'merchant'>('admin');
  const [loggedInMerchant, setLoggedInMerchant] = useState<Client | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'customers' | 'reports' | 'transactions'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [allPrinterDocs, setAllPrinterDocs] = useState<any[]>([]);
  const [allReportDocs, setAllReportDocs] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | StatusType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [transactionsSearchQuery, setTransactionsSearchQuery] = useState('');

  // New Client Form State
  const [newShopName, setNewShopName] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [merchantUsername, setMerchantUsername] = useState('');
  const [merchantPassword, setMerchantPassword] = useState('');
  const [showMerchantPassword, setShowMerchantPassword] = useState(false);
  const [merchantUsernameTouched, setMerchantUsernameTouched] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);
  const [emailId, setEmailId] = useState('');
  const [onboardBw, setOnboardBw] = useState(1.5);
  const [onboardDouble, setOnboardDouble] = useState(2.0);
  const [onboardColor, setOnboardColor] = useState(10.0);
  const [onboardA4, setOnboardA4] = useState(1.0);

  // Credentials View / Edit Modal State (Admin & Merchant)
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [credentialsCopied, setCredentialsCopied] = useState<'user' | 'pass' | null>(null);
  const [editMerchantUser, setEditMerchantUser] = useState('');
  const [editMerchantPass, setEditMerchantPass] = useState('');
  const [showEditPass, setShowEditPass] = useState(false);

  // Onboard Success & QR Code Popup State
  const [newlyOnboardedShop, setNewlyOnboardedShop] = useState<any | null>(null);
  const [showOnboardSuccessModal, setShowOnboardSuccessModal] = useState(false);

  // Merchant Live Queue Search & Filters
  const [merchantOrderSearch, setMerchantOrderSearch] = useState('');
  const [merchantOrderStatusFilter, setMerchantOrderStatusFilter] = useState<'all' | 'queued' | 'completed'>('all');

  // Delete Client State
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  // Add Printer Form State
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [printerConfig, setPrinterConfig] = useState('');
  const [printerLocation, setPrinterLocation] = useState('');
  const [printerRequirements, setPrinterRequirements] = useState('');
  const [printerToDelete, setPrinterToDelete] = useState<string | null>(null);

  // Printer Actions State
  const [printerToEdit, setPrinterToEdit] = useState<any | null>(null);
  const [printerToView, setPrinterToView] = useState<any | null>(null);
  const [activeSettingsMenu, setActiveSettingsMenu] = useState<string | null>(null);

  // Shop Settings State
  const defaultPrices: PrintPrices = {
    singleSide: { bw: 1.5, color: 10 },
    doubleSide: { bw: 2.0, color: 18 },
    twoInOne: { bw: 1.5, color: 10 }
  };
  const [showShopSettingsModal, setShowShopSettingsModal] = useState(false);
  const [printingPrices, setPrintingPrices] = useState<PrintPrices>(defaultPrices);
  const [vendorPricing, setVendorPricing] = useState<VendorPricing>({
    bw: 1.5,
    doubleSided: 2.0,
    color: 10.0,
    a4Sheet: 1.0,
    enableTiers: true,
    tiers: DEFAULT_PRICE_TIERS,
  });
  const [showPricingDetails, setShowPricingDetails] = useState(true);
  const [shopInfo, setShopInfo] = useState('');
  const [customWebsiteName, setCustomWebsiteName] = useState('');
  const [copiedStoreUrl, setCopiedStoreUrl] = useState(false);


  // Extract all reports for the global "Reports & Help" view
  // Merges top-level `reports` collection with any nested client.reports[]
  const allReports = useMemo(() => {
    // From top-level `reports` collection
    const fromCollection = allReportDocs.map(r => ({
      id: String(r.id),
      issue: String(r.issue || r.message || r.description || ''),
      timestamp: String(r.timestamp || r.createdAt || ''),
      status: String(r.status || 'pending'),
      shopName: String(r.shopName || r.shop || clients.find(c => c.id === r.clientId)?.shopName || 'Unknown Shop'),
      clientId: String(r.clientId || ''),
      _source: 'collection' as const
    }));
    // From nested client.reports[]
    const fromNested = clients.flatMap(client =>
      (client.reports || []).map(r => ({
        ...r,
        id: String(r.id),
        issue: String(r.issue || ''),
        shopName: String(client.shopName),
        clientId: String(client.id),
        status: String(r.status || 'pending'),
        _source: 'nested' as const
      }))
    );
    // Merge: prefer collection docs, avoid duplicates by id
    const collectionIds = new Set(fromCollection.map(r => r.id));
    const merged = [...fromCollection, ...fromNested.filter(r => !collectionIds.has(r.id))];
    return merged
      .sort((a, b) => (a.status === 'pending' ? -1 : 1));
  }, [clients, allReportDocs]);

  // Extract all transactions for the global "Transactions" view
  // Merges top-level `orders` collection with any nested client.history[]
  const allTransactions = useMemo(() => {
    // From top-level `orders` collection
    const fromCollection = allOrders.map(order => ({
      id: String(order.id),
      timestamp: String(order.timestamp || order.createdAt || ''),
      pages: Number(order.pages || order.pageCount || 0),
      type: String(order.type || order.printType || 'B/W'),
      status: String(order.status || 'Completed'),
      userPhoneNumber: String(order.userPhoneNumber || order.phone || order.userId || ''),
      printerName: String(order.printerName || order.printer || ''),
      paymentStatus: String(order.paymentStatus || order.payment || 'Pending'),
      cost: String(order.cost || order.amount || '₹0'),
      errorDetails: order.errorDetails ? String(order.errorDetails) : undefined,
      printedStatus: String(order.printedStatus || 'Not Printed'),
      shopName: String(order.shopName || order.shop || clients.find(c => c.id === order.clientId)?.shopName || 'Unknown Shop'),
      clientId: String(order.clientId || ''),
      _source: 'collection' as const
    }));
    // From nested client.history[]
    const fromNested = clients.flatMap(client =>
      (client.history || []).map(job => ({
        ...job,
        id: String(job.id),
        shopName: String(client.shopName),
        clientId: String(client.id),
        userPhoneNumber: String(job.userPhoneNumber || ''),
        _source: 'nested' as const
      }))
    );
    // Merge: prefer collection docs, avoid duplicates by id
    const collectionIds = new Set(fromCollection.map(tx => tx.id));
    const merged = [...fromCollection, ...fromNested.filter(tx => !collectionIds.has(tx.id))];
    return merged
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [clients, allOrders]);

  // Unified data for the selected client (merges collection and nested data)
  const selectedClientTransactions = useMemo(() => {
    if (!selectedClient) return [];
    const slug = selectedClient.slug || selectedClient.id;
    return allTransactions.filter(
      tx => tx.clientId === selectedClient.id || tx.clientId === slug || tx.shopName === selectedClient.shopName
    );
  }, [selectedClient, allTransactions]);

  // Daily Stats calculation for the selected shop
  const selectedShopDailyStats = useMemo(() => {
    if (!selectedClient) return null;
    const slug = selectedClient.slug || selectedClient.id;

    const isTodayDate = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    };

    // Filter raw orders for this shop
    const shopOrders = allOrders.filter((order) => {
      const isThisShop =
        order.vendorSlug === slug ||
        order.vendorSlug === selectedClient.id ||
        order.clientId === selectedClient.id ||
        order.shopName === selectedClient.shopName ||
        order.storeName === selectedClient.shopName;
      const isPaid = order.payment_status === "PAID" || order.paymentStatus === "Paid";
      return isThisShop && isPaid;
    });

    const todayOrders = shopOrders.filter((o) =>
      isTodayDate(o.createdAt || o.paid_at || o.timestamp)
    );

    const todayRevenue = todayOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.cost) || 0), 0);
    const todayPages = todayOrders.reduce((sum, o) => {
      const p = Number(o.totalPages || o.pages || 0);
      const c = Number(o.copies || 1);
      return sum + (p * c);
    }, 0);
    const todayVendorPayout = todayOrders.reduce((sum, o) => {
      const v = typeof o.vendorAmount === "number"
        ? o.vendorAmount
        : (typeof o.subtotal === "number" ? o.subtotal : (Number(o.amount) || 0) / 1.08);
      return sum + v;
    }, 0);
    const todayPlatformMargin = todayOrders.reduce((sum, o) => {
      const fee = typeof o.platformFee === "number"
        ? o.platformFee
        : (typeof o.subtotal === "number" ? Math.max(0, (Number(o.amount) || 0) - o.subtotal) : (Number(o.amount || 0) * 0.08 / 1.08));
      return sum + fee;
    }, 0);

    const allTimeRevenue = shopOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.cost) || 0), 0);
    const allTimePages = shopOrders.reduce((sum, o) => {
      const p = Number(o.totalPages || o.pages || 0);
      const c = Number(o.copies || 1);
      return sum + (p * c);
    }, 0);
    const allTimeVendorPayout = shopOrders.reduce((sum, o) => {
      const v = typeof o.vendorAmount === "number"
        ? o.vendorAmount
        : (typeof o.subtotal === "number" ? o.subtotal : (Number(o.amount) || 0) / 1.08);
      return sum + v;
    }, 0);
    const allTimePlatformMargin = shopOrders.reduce((sum, o) => {
      const fee = typeof o.platformFee === "number"
        ? o.platformFee
        : (typeof o.subtotal === "number" ? Math.max(0, (Number(o.amount) || 0) - o.subtotal) : (Number(o.amount || 0) * 0.08 / 1.08));
      return sum + fee;
    }, 0);

    return {
      today: {
        revenue: todayRevenue,
        pages: todayPages,
        vendorPayout: todayVendorPayout,
        platformMargin: todayPlatformMargin,
        orderCount: todayOrders.length,
      },
      allTime: {
        revenue: allTimeRevenue,
        pages: allTimePages,
        vendorPayout: allTimeVendorPayout,
        platformMargin: allTimePlatformMargin,
        orderCount: shopOrders.length,
      }
    };
  }, [selectedClient, allOrders]);

  const selectedClientReports = useMemo(() => {
    if (!selectedClient) return [];
    return allReports.filter(r => r.clientId === selectedClient.id);
  }, [selectedClient, allReports]);

  const selectedClientPrinters = useMemo(() => {
    if (!selectedClient) return [];
    // Merge nested printers with top-level collection printers linked by clientId
    const fromNested = selectedClient.printers || [];
    const fromCollection = allPrinterDocs.filter(p => p.clientId === selectedClient.id);
    const collectionIds = new Set(fromCollection.map(p => p.id));
    return [...fromCollection, ...fromNested.filter(p => !collectionIds.has(p.id))];
  }, [selectedClient, allPrinterDocs]);

  // Global Platform Financials (Super Admin 8% Margin Tracking)
  const platformFinancials = useMemo(() => {
    const isTodayDate = (dateStr: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      );
    };

    const paidOrders = allOrders.filter(
      (o) => o.payment_status === "PAID" || o.paymentStatus === "Paid"
    );

    const totalGMV = paidOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.cost) || 0), 0);

    const totalPlatformMargin = paidOrders.reduce((sum, o) => {
      const fee = typeof o.platformFee === "number"
        ? o.platformFee
        : (typeof o.subtotal === "number" ? Math.max(0, (Number(o.amount) || 0) - o.subtotal) : (Number(o.amount || 0) * 0.08 / 1.08));
      return sum + fee;
    }, 0);

    const totalMerchantPayout = paidOrders.reduce((sum, o) => {
      const v = typeof o.vendorAmount === "number"
        ? o.vendorAmount
        : (typeof o.subtotal === "number" ? o.subtotal : (Number(o.amount) || 0) / 1.08);
      return sum + v;
    }, 0);

    const todayOrders = paidOrders.filter((o) => isTodayDate(o.createdAt || o.paid_at || o.timestamp));
    const todayGMV = todayOrders.reduce((sum, o) => sum + (Number(o.amount) || Number(o.cost) || 0), 0);
    const todayPlatformMargin = todayOrders.reduce((sum, o) => {
      const fee = typeof o.platformFee === "number"
        ? o.platformFee
        : (typeof o.subtotal === "number" ? Math.max(0, (Number(o.amount) || 0) - o.subtotal) : (Number(o.amount || 0) * 0.08 / 1.08));
      return sum + fee;
    }, 0);

    return {
      totalGMV,
      totalPlatformMargin,
      totalMerchantPayout,
      todayGMV,
      todayPlatformMargin,
      paidOrderCount: paidOrders.length,
    };
  }, [allOrders]);


  // Dashboard Stats Calculations
  const totalPrinters = useMemo(() => {
    // Prefer top-level `printers` collection count; fallback to nested
    if (allPrinterDocs.length > 0) return allPrinterDocs.length;
    return clients.reduce((acc, client) => acc + (client.printers?.length || 0), 0);
  }, [clients, allPrinterDocs]);

  const totalRevenue = useMemo(() => {
    return allTransactions.reduce((acc, tx) => {
      const costStr = String(tx.cost || '0');
      const amount = parseFloat(costStr.replace('₹', '').replace(',', ''));
      return acc + (isNaN(amount) ? 0 : amount);
    }, 0).toFixed(2);
  }, [allTransactions]);

  const totalPrints = useMemo(() => {
    return allTransactions.reduce((acc, tx) => acc + tx.pages, 0);
  }, [allTransactions]);

  // Filtering Logic
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = (client.shopName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Fetch Clients from Firestore
  useEffect(() => {
    const q = query(collection(db, "clients"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const clientsData: Client[] = [];
      querySnapshot.forEach((docSnap) => {
        clientsData.push({ id: docSnap.id, ...docSnap.data() } as Client);
      });
      setClients(clientsData);
      setDbStatus('connected');
    }, (error) => {
      console.error("Error fetching clients:", error);
      setDbStatus('error');
    });

    return () => unsubscribe();
  }, []);

  // Fetch Orders from top-level `orders` collection
  useEffect(() => {
    const q = query(collection(db, "orders"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: any[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllOrders(data);
    }, (error) => {
      console.error("Error fetching orders:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Printers from top-level `printers` collection
  useEffect(() => {
    const q = query(collection(db, "printers"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: any[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllPrinterDocs(data);
    }, (error) => {
      console.error("Error fetching printers:", error);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Reports from top-level `reports` collection
  useEffect(() => {
    const q = query(collection(db, "reports"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const data: any[] = [];
      querySnapshot.forEach((docSnap) => {
        data.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllReportDocs(data);
    }, (error) => {
      console.error("Error fetching reports:", error);
    });
    return () => unsubscribe();
  }, []);

  // Keep selectedClient in sync with live Firestore data
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find(c => c.id === selectedClient.id);
      if (updated) setSelectedClient(updated);
    }
  }, [clients]);

  // Global Stats
  const activeCount = clients.filter(c => c.status === 'active').length;
  const pendingReportsCount = allReports.filter(r => r.status === 'pending').length;

  // Web Audio API Chime for incoming paid orders
  const playOrderChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // safe fallback
    }
  };

  const seenPaidOrderIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialOrdersLoad = React.useRef(true);

  useEffect(() => {
    if (!allOrders || allOrders.length === 0) return;
    const paidIds = new Set<string>();
    let hasNewPaidForCurrentShop = false;

    const currentShopSlug = selectedClient?.slug || selectedClient?.id;

    allOrders.forEach((o: any) => {
      const isPaid = o.payment_status === "PAID" || o.paymentStatus === "Paid";
      if (isPaid) {
        paidIds.add(o.id);
        if (
          !isInitialOrdersLoad.current &&
          !seenPaidOrderIdsRef.current.has(o.id) &&
          selectedClient &&
          (o.vendorSlug === currentShopSlug || o.clientId === selectedClient.id || o.shopName === selectedClient.shopName)
        ) {
          hasNewPaidForCurrentShop = true;
        }
      }
    });

    if (hasNewPaidForCurrentShop) {
      playOrderChime();
    }

    seenPaidOrderIdsRef.current = paidIds;
    isInitialOrdersLoad.current = false;
  }, [allOrders, selectedClient]);

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!newShopName || !newLocation) return;

    // Validate Phone Number (Exactly 10 Digits)
    if (!/^\d{10}$/.test(phoneNumber)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }

    // Generate URL-friendly slug
    const cleanSlug = newShopName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `shop-${Date.now().toString(36)}`;

    const pricingObj: VendorPricing = {
      bw: parseFloat(String(onboardBw)) || 1.5,
      doubleSided: parseFloat(String(onboardDouble)) || 2.0,
      color: parseFloat(String(onboardColor)) || 10.0,
      a4Sheet: parseFloat(String(onboardA4)) || 1.0,
      enableTiers: true,
      tiers: [
        { id: '1', minPages: 1, maxPages: 10, bwRate: parseFloat(String(onboardBw)) || 1.5, doubleSidedRate: parseFloat(String(onboardDouble)) || 2.0, colorRate: parseFloat(String(onboardColor)) || 10.0 },
        { id: '2', minPages: 11, maxPages: 40, bwRate: Math.max(0.5, (parseFloat(String(onboardBw)) || 1.5) - 0.3), doubleSidedRate: Math.max(1, (parseFloat(String(onboardDouble)) || 2.0) - 0.2), colorRate: Math.max(2, (parseFloat(String(onboardColor)) || 10.0) - 2) },
        { id: '3', minPages: 41, maxPages: null, bwRate: Math.max(0.5, (parseFloat(String(onboardBw)) || 1.5) - 0.5), doubleSidedRate: Math.max(1, (parseFloat(String(onboardDouble)) || 2.0) - 0.5), colorRate: Math.max(2, (parseFloat(String(onboardColor)) || 10.0) - 4) },
      ],
      binding: DEFAULT_BINDING_CONFIG,
    };

    const finalMerchantUsername = (merchantUsername || cleanSlug.replace(/-/g, '_')).toLowerCase().trim();
    const finalMerchantPassword = merchantPassword.trim() || `print@${Math.floor(1000 + Math.random() * 9000)}`;

    const creds: MerchantCredentials = {
      username: finalMerchantUsername,
      password: finalMerchantPassword,
      createdAt: new Date().toISOString()
    };

    const newClientData: any = {
      id: cleanSlug,
      slug: cleanSlug,
      shopName: newShopName,
      storeName: newShopName,
      ownerName: newOwnerName || newShopName,
      location: newLocation,
      address: newLocation,
      deviceId: `40${Math.floor(Math.random() * 900) + 100}-${Math.random().toString(36).substr(2, 8)}`,
      planType: 'Monthly',
      status: 'active',
      isActive: true,
      themeColor: '#000000',
      lastActive: 'Just now',
      iconType: 'storefront',
      history: [],
      reports: [],
      printers: [],
      phoneNumber: phoneNumber,
      phone: phoneNumber,
      merchantCredentials: creds,
      ...(isInstitution && emailId ? { email: emailId } : {}),
      pricing: pricingObj,
      printingPrices: {
        singleSide: { bw: pricingObj.bw, color: pricingObj.color },
        doubleSide: { bw: pricingObj.doubleSided, color: pricingObj.color * 1.8 },
        twoInOne: { bw: pricingObj.bw, color: pricingObj.color }
      }
    };

    try {
      // 1. Write to clients collection in Firestore
      await setDoc(doc(db, 'clients', cleanSlug), newClientData);

      // 2. Write to vendors collection so customer website immediately recognizes the shop
      await setDoc(doc(db, 'vendors', cleanSlug), {
        slug: cleanSlug,
        storeName: newShopName,
        ownerName: newOwnerName || newShopName,
        phone: phoneNumber,
        email: emailId || '',
        address: newLocation,
        themeColor: '#000000',
        isActive: true,
        merchantCredentials: creds,
        createdAt: new Date().toISOString(),
        pricing: pricingObj
      }, { merge: true });
    } catch (err) {
      console.error('Error adding client / vendor:', err);
    }

    const onboardedResult = {
      ...newClientData,
      id: cleanSlug,
      slug: cleanSlug,
      qrUrl: `https://printeg.in/store/${cleanSlug}`,
      merchantCredentials: creds,
    };

    setNewlyOnboardedShop(onboardedResult);
    setShowOnboardModal(false);
    setShowOnboardSuccessModal(true);

    // Reset form
    setNewShopName('');
    setNewOwnerName('');
    setNewLocation('');
    setPhoneNumber('');
    setPhoneError('');
    setMerchantUsername('');
    setMerchantPassword('');
    setMerchantUsernameTouched(false);
    setIsInstitution(false);
    setEmailId('');
    setOnboardBw(1.5);
    setOnboardDouble(2.0);
    setOnboardColor(10.0);
    setOnboardA4(1.0);
  };

  const handleDownloadNewlyGeneratedQR = () => {
    const canvas = document.getElementById('new-shop-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `${newlyOnboardedShop?.slug || 'shop'}-printeg-qr.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleOpenCredentialsModal = (client: Client) => {
    setSelectedClient(client);
    setEditMerchantUser(client.merchantCredentials?.username || (client.slug || client.id).replace(/-/g, '_'));
    setEditMerchantPass(client.merchantCredentials?.password || 'printeg123');
    setShowCredentialsModal(true);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const cleanUser = editMerchantUser.trim().toLowerCase();
    const cleanPass = editMerchantPass.trim();
    if (!cleanUser || !cleanPass) return;

    const creds: MerchantCredentials = {
      username: cleanUser,
      password: cleanPass,
      createdAt: selectedClient.merchantCredentials?.createdAt || new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'clients', selectedClient.id), {
        merchantCredentials: creds,
      });
      const slug = selectedClient.slug || selectedClient.id;
      await setDoc(doc(db, 'vendors', slug), {
        merchantCredentials: creds,
      }, { merge: true });
      setShowCredentialsModal(false);
      alert('Merchant credentials saved successfully!');
    } catch (err) {
      console.error('Error updating merchant credentials:', err);
    }
  };

  const handleMarkOrderPrinted = async (orderId: string, currentStatus: string) => {
    const isCurrentlyDone = currentStatus === 'completed' || currentStatus === 'Printed' || currentStatus === 'COMPLETED';
    const nextStatus = isCurrentlyDone ? 'pending' : 'completed';
    const nextPrintedStatus = isCurrentlyDone ? 'Not Printed' : 'Printed';
    const nextPrintStatus = isCurrentlyDone ? 'QUEUED' : 'COMPLETED';

    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: nextStatus,
        printedStatus: nextPrintedStatus,
        print_status: nextPrintStatus,
        printed_at: !isCurrentlyDone ? new Date().toISOString() : null,
      });
    } catch (err) {
      console.error('Error updating order print status:', err);
    }
  };

  const handleDeleteClient = (clientId: string) => {
    setClientToDelete(clientId);
  };

  const confirmDeleteClient = async () => {
    if (clientToDelete) {
      try {
        await deleteDoc(doc(db, 'clients', clientToDelete));
        if (selectedClient?.id === clientToDelete) {
          setSelectedClient(null);
          setShowDetailsPanel(false);
        }
      } catch (err) {
        console.error('Error deleting client:', err);
      }
      setClientToDelete(null);
    }
  };

  const handleResolveReport = async (clientId: string, reportId: string) => {
    const reportInCollection = allReportDocs.find(r => r.id === reportId);
    if (reportInCollection) {
      try {
        await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
      } catch (err) {
        console.error('Error resolving report in collection:', err);
      }
    }
    const client = clients.find(c => c.id === clientId);
    if (client && (client.reports || []).some(r => r.id === reportId)) {
      const updatedReports = (client.reports || []).map(r =>
        r.id === reportId ? { ...r, status: 'resolved' } : r
      );
      try {
        await updateDoc(doc(db, 'clients', clientId), { reports: updatedReports });
      } catch (err) {
        console.error('Error resolving report in client doc:', err);
      }
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUserRole('admin');
    setLoggedInMerchant(null);
    setSelectedClient(null);
    setActiveView('dashboard');
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Data exported successfully as CSV');
    }, 1500);
  };

  const toggleFilter = () => {
    if (statusFilter === 'all') setStatusFilter('active');
    else if (statusFilter === 'active') setStatusFilter('expired');
    else setStatusFilter('all');
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setShowDetailsPanel(true);
  };

  const handleOpenShopSettings = () => {
    const rawPricing = selectedClient?.pricing;
    const initialTiers: PriceTier[] = rawPricing?.tiers && rawPricing.tiers.length > 0
      ? rawPricing.tiers
      : [
          { id: '1', minPages: 1, maxPages: 10, bwRate: rawPricing?.bw || 1.5, doubleSidedRate: rawPricing?.doubleSided || 2.0, colorRate: rawPricing?.color || 10.0 },
          { id: '2', minPages: 11, maxPages: 40, bwRate: Math.max(0.5, (rawPricing?.bw || 1.5) - 0.3), doubleSidedRate: Math.max(1, (rawPricing?.doubleSided || 2.0) - 0.2), colorRate: Math.max(2, (rawPricing?.color || 10.0) - 2) },
          { id: '3', minPages: 41, maxPages: null, bwRate: Math.max(0.5, (rawPricing?.bw || 1.5) - 0.5), doubleSidedRate: Math.max(1, (rawPricing?.doubleSided || 2.0) - 0.5), colorRate: Math.max(2, (rawPricing?.color || 10.0) - 4) },
        ];

    const currentPricing: VendorPricing = {
      bw: rawPricing?.bw || selectedClient?.printingPrices?.singleSide?.bw || 1.5,
      doubleSided: rawPricing?.doubleSided || selectedClient?.printingPrices?.doubleSide?.bw || 2.0,
      color: rawPricing?.color || selectedClient?.printingPrices?.singleSide?.color || 10.0,
      a4Sheet: rawPricing?.a4Sheet || 1.0,
      enableTiers: rawPricing?.enableTiers !== undefined ? rawPricing.enableTiers : true,
      tiers: initialTiers,
      binding: rawPricing?.binding || DEFAULT_BINDING_CONFIG,
    };
    setVendorPricing(currentPricing);
    setPrintingPrices(selectedClient?.printingPrices || defaultPrices);
    setShowPricingDetails(true);
    setShopInfo(selectedClient?.shopInfo || '');
    setCustomWebsiteName(selectedClient?.customWebsiteName || selectedClient?.shopName || '');
    setShowShopSettingsModal(true);
  };

  const handleToggleBindingGlobal = (enabled: boolean) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    setVendorPricing({
      ...vendorPricing,
      binding: { ...currentBinding, enabled },
    });
  };

  const handleToggleBindingItem = (itemId: string, enabled: boolean) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const items = (currentBinding.items || []).map((item) =>
      item.id === itemId ? { ...item, enabled } : item
    );
    setVendorPricing({
      ...vendorPricing,
      binding: { ...currentBinding, items },
    });
  };

  const handleUpdateBindingItem = (itemId: string, updates: Partial<BindingItemConfig>) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const items = (currentBinding.items || []).map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    setVendorPricing({
      ...vendorPricing,
      binding: { ...currentBinding, items },
    });
  };

  const handleUpdateSpiralTier = (tierIndex: number, field: keyof SpiralRangeTier, value: any) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const spiralItem = (currentBinding.items || []).find((i) => i.id === 'spiral');
    if (!spiralItem || !spiralItem.tiers) return;
    const tiers = [...spiralItem.tiers];
    tiers[tierIndex] = { ...tiers[tierIndex], [field]: value };
    handleUpdateBindingItem('spiral', { tiers });
  };

  const handleAddSpiralTier = () => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const spiralItem = (currentBinding.items || []).find((i) => i.id === 'spiral');
    const tiers = spiralItem?.tiers ? [...spiralItem.tiers] : [];
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier && lastTier.maxSheets ? lastTier.maxSheets + 1 : 1;
    if (lastTier && lastTier.maxSheets === null) {
      tiers[tiers.length - 1] = { ...lastTier, maxSheets: newMin - 1 };
    }
    tiers.push({
      id: String(Date.now()),
      minSheets: newMin,
      maxSheets: null,
      price: (lastTier?.price || 25) + 5,
    });
    handleUpdateBindingItem('spiral', { tiers });
  };

  const handleDeleteSpiralTier = (tierIndex: number) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const spiralItem = (currentBinding.items || []).find((i) => i.id === 'spiral');
    if (!spiralItem || !spiralItem.tiers) return;
    const tiers = spiralItem.tiers.filter((_, i) => i !== tierIndex);
    handleUpdateBindingItem('spiral', { tiers });
  };

  const handleAddCustomBinding = () => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const newId = `custom_${Date.now()}`;
    const newItem: BindingItemConfig = {
      id: newId,
      name: 'New Custom Binding',
      description: 'Custom binding service',
      enabled: true,
      type: 'flat',
      flatPrice: 20,
    };
    setVendorPricing({
      ...vendorPricing,
      binding: {
        ...currentBinding,
        items: [...(currentBinding.items || []), newItem],
      },
    });
  };

  const handleDeleteCustomBinding = (itemId: string) => {
    const currentBinding = vendorPricing.binding || DEFAULT_BINDING_CONFIG;
    const items = (currentBinding.items || []).filter((i) => i.id !== itemId);
    setVendorPricing({
      ...vendorPricing,
      binding: { ...currentBinding, items },
    });
  };

  const handleAddTier = () => {
    const currentTiers = vendorPricing.tiers || [];
    const lastTier = currentTiers[currentTiers.length - 1];
    const newMin = lastTier && lastTier.maxPages ? lastTier.maxPages + 1 : (lastTier ? lastTier.minPages + 10 : 1);
    const newTier: PriceTier = {
      id: String(Date.now()),
      minPages: newMin,
      maxPages: null,
      bwRate: Math.max(0.5, (lastTier?.bwRate || vendorPricing.bw) - 0.2),
      doubleSidedRate: Math.max(1, (lastTier?.doubleSidedRate || vendorPricing.doubleSided) - 0.2),
      colorRate: Math.max(2, (lastTier?.colorRate || vendorPricing.color) - 1),
    };
    let updatedTiers = [...currentTiers];
    if (lastTier && lastTier.maxPages === null) {
      updatedTiers[updatedTiers.length - 1] = {
        ...lastTier,
        maxPages: newMin - 1
      };
    }
    updatedTiers.push(newTier);
    setVendorPricing({ ...vendorPricing, tiers: updatedTiers });
  };

  const handleUpdateTier = (index: number, field: keyof PriceTier, value: any) => {
    const currentTiers = [...(vendorPricing.tiers || [])];
    if (!currentTiers[index]) return;
    currentTiers[index] = {
      ...currentTiers[index],
      [field]: value
    };
    setVendorPricing({ ...vendorPricing, tiers: currentTiers });
  };

  const handleDeleteTier = (index: number) => {
    const currentTiers = (vendorPricing.tiers || []).filter((_, i) => i !== index);
    setVendorPricing({ ...vendorPricing, tiers: currentTiers });
  };

  const handleResetStandardTiers = () => {
    const baseBw = vendorPricing.bw || 1.5;
    const baseDouble = vendorPricing.doubleSided || 2.0;
    const baseColor = vendorPricing.color || 10.0;
    setVendorPricing({
      ...vendorPricing,
      enableTiers: true,
      tiers: [
        { id: '1', minPages: 1, maxPages: 10, bwRate: baseBw, doubleSidedRate: baseDouble, colorRate: baseColor },
        { id: '2', minPages: 11, maxPages: 40, bwRate: Math.max(0.5, baseBw - 0.3), doubleSidedRate: Math.max(1, baseDouble - 0.2), colorRate: Math.max(2, baseColor - 2) },
        { id: '3', minPages: 41, maxPages: null, bwRate: Math.max(0.5, baseBw - 0.5), doubleSidedRate: Math.max(1, baseDouble - 0.5), colorRate: Math.max(2, baseColor - 4) },
      ]
    });
  };

  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const slug = selectedClient.slug || selectedClient.id;
      const payload: Partial<Client> = {
        pricing: vendorPricing,
        printingPrices: {
          singleSide: { bw: vendorPricing.bw, color: vendorPricing.color },
          doubleSide: { bw: vendorPricing.doubleSided, color: vendorPricing.color * 1.8 },
          twoInOne: { bw: vendorPricing.bw, color: vendorPricing.color }
        },
        shopInfo: shopInfo,
        customWebsiteName: customWebsiteName,
        storeName: customWebsiteName || selectedClient.shopName
      };

      // Update clients collection
      await updateDoc(doc(db, 'clients', selectedClient.id), payload);

      // Sync to vendors collection for print website
      await setDoc(doc(db, 'vendors', slug), {
        slug,
        storeName: customWebsiteName || selectedClient.shopName,
        ownerName: selectedClient.ownerName || selectedClient.shopName,
        phone: selectedClient.phoneNumber || selectedClient.phone || '',
        email: selectedClient.email || '',
        address: selectedClient.location || selectedClient.address || '',
        themeColor: selectedClient.themeColor || '#000000',
        isActive: true,
        pricing: vendorPricing
      }, { merge: true });

      setShowShopSettingsModal(false);
    } catch (err) {
      console.error('Error saving shop settings:', err);
    }
  };

  const handleDownloadQR = () => {
    const canvas = document.getElementById('shop-qr-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = pngUrl;
    downloadLink.download = `PrintEG_Store_QR_${(selectedClient?.shopName || 'shop').replace(/\s+/g, '_')}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleCopyStoreUrl = () => {
    if (!selectedClient) return;
    const slug = selectedClient.slug || selectedClient.id;
    const url = `https://printeg.in/store/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedStoreUrl(true);
    setTimeout(() => setCopiedStoreUrl(false), 2000);
  };

  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !printerConfig) return;

    let updatedPrinters;

    if (printerToEdit) {
      // Edit Mode
      const updatedPrinter = {
        ...printerToEdit,
        name: printerName,
        configuration: printerConfig,
        location: printerLocation,
        requirements: printerRequirements
      };
      updatedPrinters = (selectedClient.printers || []).map(p =>
        p.id === printerToEdit.id ? updatedPrinter : p
      );
      // Also update in top-level `printers` collection if it exists there
      const printerDocInCollection = allPrinterDocs.find(p => p.id === printerToEdit.id);
      if (printerDocInCollection) {
        try {
          await updateDoc(doc(db, 'printers', printerToEdit.id), {
            name: printerName,
            configuration: printerConfig,
            location: printerLocation,
            requirements: printerRequirements
          });
        } catch (err) {
          console.error('Error updating printer in collection:', err);
        }
      }
      setPrinterToEdit(null);
    } else {
      // Add Mode — write to top-level `printers` collection first
      const newPrinterData: any = {
        name: printerName || `Printer ${Math.floor(Math.random() * 100)}`,
        configuration: printerConfig,
        location: printerLocation || selectedClient.location,
        requirements: printerRequirements,
        status: 'active',
        clientId: selectedClient.id,
        shopName: selectedClient.shopName,
        createdAt: new Date().toISOString()
      };
      let newPrinterId = Math.random().toString(36).substr(2, 9);
      try {
        const docRef = await addDoc(collection(db, 'printers'), newPrinterData);
        newPrinterId = docRef.id;
      } catch (err) {
        console.error('Error adding printer to collection:', err);
      }
      const newPrinter = { id: newPrinterId, ...newPrinterData };
      updatedPrinters = [...(selectedClient.printers || []), newPrinter];
    }

    try {
      // Also keep the nested array on the client doc in sync
      await updateDoc(doc(db, 'clients', selectedClient.id), { printers: updatedPrinters });
    } catch (err) {
      console.error('Error saving printer to client doc:', err);
    }

    setShowAddPrinterModal(false);
    // Reset form
    setPrinterName('');
    setPrinterConfig('');
    setPrinterLocation('');
    setPrinterRequirements('');
  };

  const handleEditPrinter = (printer: any) => {
    setPrinterToEdit(printer);
    setPrinterName(printer.name);
    setPrinterConfig(printer.configuration);
    setPrinterLocation(printer.location);
    setPrinterRequirements(printer.requirements || '');
    setShowAddPrinterModal(true);
    setActiveSettingsMenu(null);
  };

  const handleViewPrinter = (printer: any) => {
    setPrinterToView(printer);
    setActiveSettingsMenu(null);
  };

  const handleDeletePrinter = (printerId: string) => {
    setPrinterToDelete(printerId);
  };

  const confirmDeletePrinter = async () => {
    if (!selectedClient || !printerToDelete) return;
    const updatedPrinters = (selectedClient.printers || []).filter(p => p.id !== printerToDelete);
    try {
      await updateDoc(doc(db, 'clients', selectedClient.id), { printers: updatedPrinters });
    } catch (err) {
      console.error('Error deleting printer:', err);
    }
    setPrinterToDelete(null);
  };

  const handleUpdateTransactionStatus = async (clientId: string, jobId: string, newStatus: 'Paid' | 'Refunded') => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const updatedHistory = (client.history || []).map(job =>
      job.id === jobId ? { ...job, paymentStatus: newStatus } : job
    );
    try {
      await updateDoc(doc(db, 'clients', clientId), { history: updatedHistory });
    } catch (err) {
      console.error('Error updating transaction status:', err);
    }
  };



  if (!isAuthenticated) {
    return (
      <LoginPage
        clients={clients}
        onLogin={(role, merchant) => {
          setUserRole(role);
          if (role === 'merchant' && merchant) {
            setLoggedInMerchant(merchant);
            setSelectedClient(merchant);
          } else {
            setLoggedInMerchant(null);
          }
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen technical-grid">
      {isExporting && (
        <div className="fixed top-6 right-6 z-[100] bg-black text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Download size={18} />
          <span className="text-sm font-bold">Preparing CSV Export...</span>
        </div>
      )}

      {/* Shop Settings Modal */}
      {showShopSettingsModal && selectedClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowShopSettingsModal(false)} />
          <div className="relative bg-white w-full max-w-3xl rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowShopSettingsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-display font-bold mb-2">Shop Settings</h3>
            <p className="text-slate-500 mb-6">Configure details and unique QR for <span className="font-bold text-slate-900">{selectedClient.shopName}</span></p>

            <div className="flex flex-col md:flex-row gap-8">
              <form onSubmit={handleSaveShopSettings} className="space-y-4 flex-1">
                <div>
                  <button
                    type="button"
                    onClick={() => setShowPricingDetails(!showPricingDetails)}
                    className="w-full flex justify-between items-center bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Configure Store Pricing
                    <ChevronDown size={18} className={`transform transition-transform ${showPricingDetails ? 'rotate-180' : ''}`} />
                  </button>

                  {showPricingDetails && (
                    <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                      {/* Base Rates */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-[11px] font-bold text-slate-400 uppercase">Standard / Base Rates</label>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div>
                            <span className="text-[10px] text-slate-500 mb-1 block font-medium">B&W Single (₹)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs focus:ring-2 focus:ring-black font-semibold text-center"
                              value={vendorPricing.bw}
                              onChange={(e) => setVendorPricing({ ...vendorPricing, bw: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 mb-1 block font-medium">B&W Double (₹)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs focus:ring-2 focus:ring-black font-semibold text-center"
                              value={vendorPricing.doubleSided}
                              onChange={(e) => setVendorPricing({ ...vendorPricing, doubleSided: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 mb-1 block font-medium">Color Print (₹)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs focus:ring-2 focus:ring-black font-semibold text-center"
                              value={vendorPricing.color}
                              onChange={(e) => setVendorPricing({ ...vendorPricing, color: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 mb-1 block font-medium">Blank A4 (₹)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs focus:ring-2 focus:ring-black font-semibold text-center"
                              value={vendorPricing.a4Sheet}
                              onChange={(e) => setVendorPricing({ ...vendorPricing, a4Sheet: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Tiered / Range-based Volume Pricing */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Page Range / Volume Pricing</span>
                            <span className="text-[10px] text-slate-500">Auto-discounts rate per page based on total order pages</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={vendorPricing.enableTiers !== false}
                              onChange={(e) => setVendorPricing({ ...vendorPricing, enableTiers: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {vendorPricing.enableTiers !== false && (
                          <div className="space-y-3 mt-3">
                            {(vendorPricing.tiers || []).map((tier, idx) => (
                              <div key={tier.id || idx} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Tier {idx + 1}: {tier.maxPages ? `${tier.minPages} to ${tier.maxPages} pages` : `${tier.minPages}+ pages (Bulk)`}
                                  </span>
                                  {(vendorPricing.tiers || []).length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTier(idx)}
                                      className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                                      title="Delete Tier"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                {/* Row 1: Page Range */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">From (Min Pages)</span>
                                    <input
                                      type="number"
                                      min="1"
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                      value={tier.minPages}
                                      onChange={(e) => handleUpdateTier(idx, 'minPages', parseInt(e.target.value) || 1)}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">To (Max Pages)</span>
                                    <input
                                      type="text"
                                      placeholder="No Limit (+)"
                                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                      value={tier.maxPages === null ? '' : (tier.maxPages ?? '')}
                                      onChange={(e) => {
                                        const val = e.target.value.trim();
                                        handleUpdateTier(idx, 'maxPages', val === '' ? null : (parseInt(val) || null));
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Row 2: Rates per Sheet */}
                                <div className="grid grid-cols-3 gap-2.5 pt-1">
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Single (₹)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                      value={tier.bwRate}
                                      onChange={(e) => handleUpdateTier(idx, 'bwRate', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Double (₹)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.1"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                      value={tier.doubleSidedRate}
                                      onChange={(e) => handleUpdateTier(idx, 'doubleSidedRate', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Color (₹)</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                      value={tier.colorRate ?? vendorPricing.color}
                                      onChange={(e) => handleUpdateTier(idx, 'colorRate', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            <div className="flex gap-2 pt-1">
                              <button
                                type="button"
                                onClick={handleAddTier}
                                className="flex-1 py-2 px-3 bg-white border border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                              >
                                <Plus size={13} /> Add Page Range Tier
                              </button>
                              <button
                                type="button"
                                onClick={handleResetStandardTiers}
                                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-medium rounded-xl transition-colors"
                              >
                                Reset Standard
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Book Binding & Finishing Services Editor */}
                      <div className="pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Book Binding &amp; Finishing Services</span>
                            <span className="text-[10px] text-slate-500">Shopkeeper can toggle ON/OFF, add, remove, and adjust prices</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={vendorPricing.binding?.enabled !== false}
                              onChange={(e) => handleToggleBindingGlobal(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                        </div>

                        {vendorPricing.binding?.enabled !== false && (
                          <div className="space-y-3 mt-3">
                            {(vendorPricing.binding?.items || DEFAULT_BINDING_CONFIG.items).map((item) => (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-xl border transition-all space-y-3 ${
                                  item.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-100/70 border-slate-200 opacity-60'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${item.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                    <div>
                                      <span className="text-xs font-bold text-slate-900 block">{item.name}</span>
                                      <span className="text-[10px] text-slate-500">{item.description}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {item.id.startsWith('custom_') && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCustomBinding(item.id)}
                                        className="text-rose-500 hover:text-rose-700 p-1"
                                        title="Delete custom binding"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    )}
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={item.enabled}
                                        onChange={(e) => handleToggleBindingItem(item.id, e.target.checked)}
                                        className="sr-only peer"
                                      />
                                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                  </div>
                                </div>

                                {item.enabled && (
                                  <div className="pt-2 border-t border-slate-100">
                                    {/* Flat Type (e.g. Soft Binding) */}
                                    {item.type === 'flat' && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-600 font-medium">Flat Rate Price:</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-slate-400 font-bold">₹</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                            value={item.flatPrice ?? 15}
                                            onChange={(e) => handleUpdateBindingItem(item.id, { flatPrice: parseFloat(e.target.value) || 0 })}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* With / Without Print (e.g. Calico, Chart) */}
                                    {item.type === 'with_without_print' && (
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">With Cover Print (₹)</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                            value={item.withPrintPrice ?? (item.id === 'calico' ? 40 : 30)}
                                            onChange={(e) => handleUpdateBindingItem(item.id, { withPrintPrice: parseFloat(e.target.value) || 0 })}
                                          />
                                        </div>
                                        <div>
                                          <span className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Without Print (₹)</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-xs outline-none focus:ring-1 focus:ring-black text-center"
                                            value={item.withoutPrintPrice ?? (item.id === 'calico' ? 30 : 25)}
                                            onChange={(e) => handleUpdateBindingItem(item.id, { withoutPrintPrice: parseFloat(e.target.value) || 0 })}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Tiered Range (e.g. Spiral Binding) */}
                                    {item.type === 'tiered' && (
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sheet Range Tiers</span>
                                        {(item.tiers || []).map((t, tIdx) => (
                                          <div key={t.id || tIdx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                                            <div className="flex-1 flex items-center gap-1.5">
                                              <input
                                                type="number"
                                                min="1"
                                                className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded text-center text-xs font-bold"
                                                value={t.minSheets}
                                                onChange={(e) => handleUpdateSpiralTier(tIdx, 'minSheets', parseInt(e.target.value) || 1)}
                                              />
                                              <span className="text-xs text-slate-400">to</span>
                                              <input
                                                type="text"
                                                placeholder="Max (+)"
                                                className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded text-center text-xs font-bold"
                                                value={t.maxSheets === null ? '' : (t.maxSheets ?? '')}
                                                onChange={(e) => {
                                                  const val = e.target.value.trim();
                                                  handleUpdateSpiralTier(tIdx, 'maxSheets', val === '' ? null : (parseInt(val) || null));
                                                }}
                                              />
                                              <span className="text-[10px] text-slate-500">sheets</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs font-bold text-slate-400">₹</span>
                                              <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                className="w-14 px-1.5 py-1 bg-white border border-slate-200 rounded text-center text-xs font-bold"
                                                value={t.price}
                                                onChange={(e) => handleUpdateSpiralTier(tIdx, 'price', parseFloat(e.target.value) || 0)}
                                              />
                                            </div>
                                            {(item.tiers || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteSpiralTier(tIdx)}
                                                className="text-rose-500 hover:text-rose-700 p-1"
                                              >
                                                <Trash2 size={12} />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={handleAddSpiralTier}
                                          className="w-full py-1.5 bg-white border border-dashed border-slate-300 hover:border-slate-400 text-slate-600 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors mt-1"
                                        >
                                          <Plus size={12} /> Add Spiral Tier
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={handleAddCustomBinding}
                              className="w-full py-2 bg-white border border-dashed border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Plus size={13} /> Add Custom Binding Service
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Custom Store Name</label>
                  <input
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                    placeholder="e.g. Metro Print Hub"
                    value={customWebsiteName}
                    onChange={(e) => setCustomWebsiteName(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">This will display as the store&apos;s title on the customer portal.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Shop Information / Address</label>
                  <textarea
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all min-h-[80px] resize-none"
                    placeholder="e.g. Near Reception, Open 9AM - 8PM..."
                    value={shopInfo}
                    onChange={(e) => setShopInfo(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShopSettingsModal(false)}
                    className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-black/20"
                  >
                    Save Changes
                  </button>
                </div>
              </form>

              {/* QR Code Standee Generator */}
              <div className="w-full md:w-72 flex flex-col items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="w-full text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Store Standee QR
                  </span>
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {selectedClient.shopName}
                  </p>
                </div>

                <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-4 shadow-sm">
                  <QRCodeCanvas
                    id="shop-qr-canvas"
                    value={`https://printeg.in/store/${selectedClient.slug || selectedClient.id}`}
                    size={170}
                    level="H"
                    includeMargin={true}
                  />
                </div>

                <div className="w-full space-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadQR}
                    className="w-full py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md shadow-black/10"
                  >
                    <Download size={14} /> Download QR PNG
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyStoreUrl}
                    className="w-full py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    {copiedStoreUrl ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        <span className="text-emerald-600">Link Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} className="text-slate-500" />
                        <span>Copy Store Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Printer Modal */}
      {showAddPrinterModal && selectedClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddPrinterModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowAddPrinterModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-display font-bold mb-2">Add New Printer</h3>
            <p className="text-slate-500 mb-6">Register a new machine at <span className="font-bold text-slate-900">{selectedClient.shopName}</span></p>

            <form onSubmit={handleAddPrinter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Printer Name</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                  placeholder="e.g. Main Hall Xerox"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Configuration <span className="text-rose-500">*</span></label>
                <input
                  required
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                  placeholder="e.g. Canon iR 2520, 2 Trays"
                  value={printerConfig}
                  onChange={(e) => setPrinterConfig(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Location</label>
                <input
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                  placeholder="e.g. Floor 1, Near Reception"
                  value={printerLocation}
                  onChange={(e) => setPrinterLocation(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Additional Requirements</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all min-h-[100px] resize-none"
                  placeholder="e.g. Needs A3 paper tray, specific network settings..."
                  value={printerRequirements}
                  onChange={(e) => setPrinterRequirements(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPrinterModal(false);
                    setPrinterToEdit(null);
                    setPrinterName('');
                    setPrinterConfig('');
                    setPrinterLocation('');
                    setPrinterRequirements('');
                  }}
                  className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-black/20"
                >
                  {printerToEdit ? 'Save Changes' : 'Add Printer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Printer Details Modal */}
      {printerToView && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrinterToView(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-display font-bold text-slate-900">{printerToView.name}</h3>
                <span className={`inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${printerToView.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                  {printerToView.status}
                </span>
              </div>
              <button onClick={() => setPrinterToView(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Configuration</label>
                <p className="font-medium text-slate-900">{printerToView.configuration}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location</label>
                <p className="font-medium text-slate-900 flex items-center gap-2">
                  <MapPin size={14} className="text-slate-400" />
                  {printerToView.location}
                </p>
              </div>

              {printerToView.requirements && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Requirements</label>
                  <p className="font-medium text-slate-900 text-sm whitespace-pre-wrap">{printerToView.requirements}</p>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => {
                    setPrinterToView(null);
                    handleEditPrinter(printerToView);
                  }}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors text-sm"
                >
                  Edit Printer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Printer Confirmation Modal */}
      {
        printerToDelete && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrinterToDelete(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 flex items-center justify-center rounded-2xl mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Remove Printer?</h3>
                <p className="text-slate-500 mb-8">This action cannot be undone. The printer configuration and history will be lost.</p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setPrinterToDelete(null)}
                    className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeletePrinter}
                    className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Client Confirmation Modal */}
      {
        clientToDelete && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClientToDelete(null)} />
            <div className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-rose-50 text-rose-500 flex items-center justify-center rounded-2xl mb-4">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Remove Client?</h3>
                <p className="text-slate-500 mb-8">This will permanently remove the shop and all its associated data from the directory.</p>

                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => setClientToDelete(null)}
                    className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteClient}
                    className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Merchant Credentials Modal for Super Admin */}
      {showCredentialsModal && selectedClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCredentialsModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowCredentialsModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
              <X size={24} />
            </button>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
                <Lock size={18} />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold">Merchant Credentials</h3>
                <p className="text-xs text-slate-500">{selectedClient.shopName}</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mb-6">Give these login credentials to the shopkeeper to access their store portal and live order queue.</p>

            <form onSubmit={handleSaveCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Merchant User ID</label>
                <div className="flex gap-2">
                  <input
                    required
                    type="text"
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                    value={editMerchantUser}
                    onChange={(e) => setEditMerchantUser(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editMerchantUser);
                      setCredentialsCopied('user');
                      setTimeout(() => setCredentialsCopied(null), 2000);
                    }}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"
                    title="Copy Username"
                  >
                    {credentialsCopied === 'user' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Merchant Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      required
                      type={showEditPass ? "text" : "password"}
                      className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                      value={editMerchantPass}
                      onChange={(e) => setEditMerchantPass(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPass(!showEditPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black"
                    >
                      {showEditPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editMerchantPass);
                      setCredentialsCopied('pass');
                      setTimeout(() => setCredentialsCopied(null), 2000);
                    }}
                    className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1 transition-colors"
                    title="Copy Password"
                  >
                    {credentialsCopied === 'pass' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCredentialsModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-black hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-black/10"
                >
                  Save Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {
        showOnboardModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOnboardModal(false)} />
            <div className="relative bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
              <button onClick={() => setShowOnboardModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
                <X size={24} />
              </button>
              <h3 className="text-2xl font-display font-bold mb-2">Onboard New Shop</h3>
              <p className="text-slate-500 mb-6">Register a new shop, assign merchant credentials, and set custom print pricing.</p>

              <form onSubmit={handleOnboard} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Shop Name *</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                    placeholder="e.g. Royal Xerox & Prints"
                    value={newShopName}
                    onChange={(e) => {
                      setNewShopName(e.target.value);
                      if (!merchantUsernameTouched) {
                        setMerchantUsername(e.target.value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, ''));
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Owner / Contact Name</label>
                  <input
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                    placeholder="e.g. Sarath Kumar"
                    value={newOwnerName}
                    onChange={(e) => setNewOwnerName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Location / Address *</label>
                  <input
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                    placeholder="e.g. Opposite College Gate, Chennai"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Phone Number *</label>
                  <input
                    required
                    type="tel"
                    className={`w-full px-4 py-3 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-black transition-all ${phoneError ? 'border-rose-500 focus:ring-rose-200' : 'border-slate-200'}`}
                    placeholder="e.g. 9876543210 (10 digits)"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (phoneError) setPhoneError('');
                    }}
                  />
                  {phoneError && (
                    <p className="text-rose-500 text-xs mt-1 font-bold flex items-center gap-1">
                      <AlertCircle size={12} /> {phoneError}
                    </p>
                  )}
                </div>

                {/* Merchant Login Credentials */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock size={13} className="text-slate-500" />
                      Merchant Login Credentials
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">For Shop Owner</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">Merchant User ID *</span>
                      <input
                        required
                        type="text"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                        placeholder="e.g. royal_prints"
                        value={merchantUsername}
                        onChange={(e) => {
                          setMerchantUsername(e.target.value);
                          setMerchantUsernameTouched(true);
                        }}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">Merchant Password *</span>
                      <div className="relative">
                        <input
                          required
                          type={showMerchantPassword ? "text" : "password"}
                          className="w-full px-3 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                          placeholder="e.g. Print@2026"
                          value={merchantPassword}
                          onChange={(e) => setMerchantPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowMerchantPassword(!showMerchantPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black"
                        >
                          {showMerchantPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing Fields */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Store Print & Xerox Pricing
                  </span>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">B&W Xerox (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                        value={onboardBw}
                        onChange={(e) => setOnboardBw(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">Double Sided (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                        value={onboardDouble}
                        onChange={(e) => setOnboardDouble(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">Color Print (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                        value={onboardColor}
                        onChange={(e) => setOnboardColor(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold mb-1 block">Blank A4 Sheet (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-black"
                        value={onboardA4}
                        onChange={(e) => setOnboardA4(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInstitution}
                      onChange={(e) => setIsInstitution(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-slate-700">This is an institution</span>
                  </label>
                </div>

                {isInstitution && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email ID *</label>
                    <input
                      required
                      type="email"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-black transition-all"
                      placeholder="e.g. admin@institution.edu"
                      value={emailId}
                      onChange={(e) => setEmailId(e.target.value)}
                    />
                  </div>
                )}

                <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all mt-4 shadow-lg shadow-black/10 flex items-center justify-center gap-2">
                  <QrCode size={18} /> Onboard & Generate QR Code
                </button>
              </form>
            </div>
          </div>
        )
      }

      {/* Onboard Success & QR Code Modal */}
      {showOnboardSuccessModal && newlyOnboardedShop && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOnboardSuccessModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowOnboardSuccessModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900">Shop Onboarded & QR Ready!</h3>
              <p className="text-slate-500 text-sm mt-1">
                <span className="font-bold text-slate-800">{newlyOnboardedShop.shopName}</span> is now active on PrintEG.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-200 mb-6">
              <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 mb-4">
                <QRCodeCanvas
                  id="new-shop-qr-canvas"
                  value={newlyOnboardedShop.qrUrl}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <span className="text-xs font-mono font-bold text-slate-600 mb-4 text-center break-all">
                {newlyOnboardedShop.qrUrl}
              </span>

              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={handleDownloadNewlyGeneratedQR}
                  className="flex-1 py-2.5 bg-black text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-md shadow-black/10"
                >
                  <Download size={14} /> Download QR PNG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(newlyOnboardedShop.qrUrl);
                    setCopiedStoreUrl(true);
                    setTimeout(() => setCopiedStoreUrl(false), 2000);
                  }}
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                >
                  {copiedStoreUrl ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copiedStoreUrl ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Merchant Credentials Card */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-6 space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Shop Merchant Login Credentials
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Username</span>
                  <span className="font-bold text-slate-900 font-mono">{newlyOnboardedShop.merchantCredentials?.username}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Password</span>
                  <span className="font-bold text-slate-900 font-mono">{newlyOnboardedShop.merchantCredentials?.password}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowOnboardSuccessModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOnboardSuccessModal(false);
                  setSelectedClient(newlyOnboardedShop);
                }}
                className="flex-1 py-3 bg-black hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-black/10"
              >
                Open Shop Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <div className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar
          activeView={activeView}
          setActiveView={(v) => {
            setActiveView(v);
            if (userRole !== 'merchant') {
              setSelectedClient(null);
            }
          }}
          onSignOut={handleSignOut}
          userRole={userRole}
          merchantName={selectedClient?.shopName || 'Shop'}
          merchantUsername={selectedClient?.merchantCredentials?.username || selectedClient?.slug}
        />
      </div>

      <div className="flex flex-1 min-w-0">
        <main className={`flex-1 min-w-0 p-4 lg:p-10 transition-all ${showDetailsPanel && selectedClient && activeView === 'customers' ? 'lg:mr-96' : ''}`}>
          <div className="flex lg:hidden items-center justify-between mb-6">
            <div className="w-8 h-8 bg-black flex items-center justify-center rounded-lg">
              <span className="text-white font-bold">P</span>
            </div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-white rounded-lg border border-slate-200">
              <Menu size={20} />
            </button>
          </div>

          <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div className="max-w-xl">
              {selectedClient && userRole === 'admin' && (
                <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-slate-500 hover:text-black mb-4 font-bold">
                  <ArrowLeft size={18} /> Back to Directory
                </button>
              )}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-display font-bold text-slate-900 mb-1">
                    {selectedClient ? selectedClient.shopName : (activeView === 'customers' ? 'Client Directory' : activeView === 'reports' ? 'Support Inbox' : activeView === 'transactions' ? 'Transaction Logs' : 'Network Overview')}
                  </h2>
                  {userRole === 'merchant' && (
                    <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live Shop
                    </span>
                  )}
                </div>
                {selectedClient && (
                  <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500 mt-1">
                    <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">
                      <Printer size={13} /> {selectedClient.printers?.length || 0} Printers
                    </span>
                    <span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg text-slate-600 text-xs">
                      <MapPin size={13} /> {selectedClient.location || 'Chennai'}
                    </span>
                    <a
                      href={`https://printeg.in/store/${selectedClient.slug || selectedClient.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-slate-600 hover:text-black hover:underline text-xs"
                    >
                      printeg.in/store/{selectedClient.slug || selectedClient.id} <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                <p className="text-slate-500 text-sm mt-2">
                  {selectedClient
                    ? (userRole === 'merchant' ? 'Live incoming orders queue, auto-refreshed with incoming sound chime.' : `Full audit log for Device ID: ${selectedClient.deviceId}`)
                    : (activeView === 'transactions' ? 'Real-time monitoring of all print jobs, payments, and system errors.' : 'Manage and monitor all printer IoT deployments across your network.')}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : dbStatus === 'error' ? 'bg-rose-500' : 'bg-amber-400 animate-pulse'}`} />
                  <span className={`text-xs font-bold ${dbStatus === 'connected' ? 'text-emerald-600' : dbStatus === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                    {dbStatus === 'connected' ? 'Firestore Connected' : dbStatus === 'error' ? 'Firestore Error — check Rules' : 'Connecting to Firestore...'}
                  </span>
                </div>
              </div>
            </div>
            {activeView === 'customers' && !selectedClient && userRole === 'admin' && (
              <button onClick={() => setShowOnboardModal(true)} className="flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-full font-bold hover:bg-slate-800 transition-all shadow-xl shadow-black/10 active:scale-95 w-full md:w-auto">
                <Plus size={20} /> Onboard Shop
              </button>
            )}
            {/* Header Actions for Selected Client / Merchant */}
            {selectedClient && (
              <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                <button
                  onClick={() => handleOpenCredentialsModal(selectedClient)}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-black transition-all shadow-sm text-xs"
                >
                  <Lock size={14} /> Credentials
                </button>
                <button
                  onClick={handleOpenShopSettings}
                  className="flex items-center justify-center gap-1.5 bg-white text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 transition-all shadow-sm text-xs"
                >
                  <Settings size={14} /> Rates & QR
                </button>
                {userRole === 'admin' && (
                  <button
                    onClick={() => setShowAddPrinterModal(true)}
                    className="flex items-center justify-center gap-1.5 bg-black text-white px-4 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-sm text-xs"
                  >
                    <Plus size={14} /> Add Printer
                  </button>
                )}
                <a
                  href={`https://printeg.in/store/${selectedClient.slug || selectedClient.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold transition-all text-xs"
                >
                  <ExternalLink size={14} /> Storefront
                </a>
              </div>
            )}
          </header>

          {/* Merged printer/report counts for the selected client */}
          {(() => {
            const clientPrintersFromCollection = selectedClient
              ? allPrinterDocs.filter(p => p.clientId === selectedClient.id || p.shopName === selectedClient.shopName)
              : [];
            const nestedPrinterIds = new Set((selectedClient?.printers || []).map((p: any) => p.id));
            const extraPrinters = clientPrintersFromCollection.filter(p => !nestedPrinterIds.has(p.id));
            const mergedPrinters = [...(selectedClient?.printers || []), ...extraPrinters];

            const clientReportsFromCollection = selectedClient
              ? allReportDocs.filter(r => r.clientId === selectedClient.id || r.shopName === selectedClient.shopName)
              : [];
            const nestedReportIds = new Set((selectedClient?.reports || []).map((r: any) => r.id));
            const extraReports = clientReportsFromCollection.filter(r => !nestedReportIds.has(r.id));
            const mergedReports = [...(selectedClient?.reports || []), ...extraReports];
            const pendingMergedReports = mergedReports.filter(r => r.status === 'pending');

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {selectedClient ? (
                  userRole === 'admin' ? (
                    <>
                      <StatCard
                        label="Shop Net Payout"
                        value={`₹${(selectedShopDailyStats?.allTime.vendorPayout || 0).toFixed(2)}`}
                        subValue={`Today: ₹${(selectedShopDailyStats?.today.vendorPayout || 0).toFixed(2)}`}
                        icon={<Receipt size={18} />}
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                      />
                      <StatCard
                        label="PrintEG Margin (8%)"
                        value={`₹${(selectedShopDailyStats?.allTime.platformMargin || 0).toFixed(2)}`}
                        subValue={`Today: +₹${(selectedShopDailyStats?.today.platformMargin || 0).toFixed(2)}`}
                        icon={<TrendingUp size={18} />}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                        highlight={true}
                      />
                      <StatCard
                        label="Total Prints"
                        value={`${(selectedShopDailyStats?.allTime.pages || 0).toLocaleString()} pgs`}
                        subValue={`Today: ${(selectedShopDailyStats?.today.pages || 0).toLocaleString()} pgs`}
                        icon={<Printer size={18} />}
                        iconBg="bg-purple-50"
                        iconColor="text-purple-600"
                      />
                      <StatCard
                        label="Deployed Printers"
                        value={mergedPrinters.length.toString()}
                        icon={<LayoutGrid size={18} />}
                        iconBg="bg-slate-100"
                        iconColor="text-slate-700"
                      />
                    </>
                  ) : (
                    <>
                      <StatCard
                        label="Today's Payout"
                        value={`₹${(selectedShopDailyStats?.today.vendorPayout || 0).toFixed(2)}`}
                        subValue={`${selectedShopDailyStats?.today.orderCount || 0} orders today`}
                        icon={<Receipt size={18} />}
                        iconBg="bg-emerald-50"
                        iconColor="text-emerald-600"
                      />
                      <StatCard
                        label="Today's Prints"
                        value={`${(selectedShopDailyStats?.today.pages || 0).toLocaleString()} pgs`}
                        subValue="Live queue active"
                        icon={<Printer size={18} />}
                        iconBg="bg-blue-50"
                        iconColor="text-blue-600"
                      />
                      <StatCard
                        label="All-Time Earnings"
                        value={`₹${(selectedShopDailyStats?.allTime.vendorPayout || 0).toFixed(2)}`}
                        subValue={`${(selectedShopDailyStats?.allTime.pages || 0).toLocaleString()} total pgs`}
                        icon={<TrendingUp size={18} />}
                        iconBg="bg-purple-50"
                        iconColor="text-purple-600"
                      />
                      <StatCard
                        label="Deployed Printers"
                        value={mergedPrinters.length.toString()}
                        icon={<LayoutGrid size={18} />}
                        iconBg="bg-slate-100"
                        iconColor="text-slate-700"
                      />
                    </>
                  )
                ) : (
                  <>
                    <StatCard
                      label="PrintEG Margin (8%)"
                      value={`₹${platformFinancials.totalPlatformMargin.toFixed(2)}`}
                      subValue={`Today: +₹${platformFinancials.todayPlatformMargin.toFixed(2)}`}
                      icon={<TrendingUp size={18} />}
                      iconBg="bg-emerald-50"
                      iconColor="text-emerald-600"
                      highlight={true}
                    />
                    <StatCard
                      label="Gross GMV Collected"
                      value={`₹${platformFinancials.totalGMV.toFixed(2)}`}
                      subValue={`Today: ₹${platformFinancials.todayGMV.toFixed(2)}`}
                      icon={<Receipt size={18} />}
                      iconBg="bg-purple-50"
                      iconColor="text-purple-600"
                    />
                    <StatCard
                      label="Merchant Payout Pool"
                      value={`₹${platformFinancials.totalMerchantPayout.toFixed(2)}`}
                      subValue="100% Base Subtotal"
                      icon={<LayoutGrid size={18} />}
                      iconBg="bg-blue-50"
                      iconColor="text-blue-600"
                    />
                    <StatCard
                      label="Total Prints"
                      value={`${totalPrints.toLocaleString()} pgs`}
                      subValue={`${platformFinancials.paidOrderCount} paid orders`}
                      icon={<Printer size={18} />}
                      iconBg="bg-slate-100"
                      iconColor="text-slate-700"
                    />
                  </>
                )}
              </div>
            );
          })()}

          {activeView === 'customers' && !selectedClient && (
            <>
              <div className="glass-header border border-slate-200 p-3 lg:p-4 rounded-3xl mb-8 flex flex-col md:flex-row gap-4 items-center shadow-sm sticky top-4 z-30">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-full focus:ring-2 focus:ring-black outline-none font-medium text-slate-900" placeholder="Search Directory..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button onClick={toggleFilter} className={`flex-1 md:flex-none p-4 border rounded-2xl flex items-center justify-center gap-2 font-medium ${statusFilter !== 'all' ? 'bg-black text-white' : 'bg-white text-slate-600'}`}>
                    <Filter size={18} /> {statusFilter.toUpperCase()}
                  </button>
                  <button onClick={handleExport} className="p-4 border border-slate-200 bg-white rounded-2xl hover:bg-slate-50 transition-colors text-slate-600">
                    <Download size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-4">
                  {paginatedClients.map(client => <ClientCard key={client.id} client={client} onClick={handleSelectClient} onDelete={handleDeleteClient} />)}
                </div>
                {clients.length === 0 && dbStatus === 'connected' && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-6">
                      <Layers size={36} className="text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Clients Yet</h3>
                    <p className="text-slate-500 max-w-sm">Connected to Firestore. Onboard your first shop using the button above.</p>
                  </div>
                )}
                {dbStatus === 'error' && (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mb-6">
                      <AlertCircle size={36} className="text-rose-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Firestore Connection Failed</h3>
                    <p className="text-slate-500 max-w-sm">Check your Firestore Rules — set them to allow read/write and try again.</p>
                  </div>
                )}
                {dbStatus === 'connecting' && (
                  <div className="flex items-center justify-center py-24">
                    <div className="w-8 h-8 border-2 border-slate-200 border-t-black rounded-full animate-spin" />
                    <span className="ml-3 text-slate-500 font-medium">Connecting to Firestore...</span>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-4">
                  <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-3 border rounded-xl disabled:opacity-50 hover:bg-white"><ArrowLeft size={18} /></button>
                  <span className="text-sm font-bold">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-3 border rounded-xl disabled:opacity-50 hover:bg-white"><ArrowRight size={18} /></button>
                </div>
              )}
            </>
          )}

          {selectedClient && (() => {
            // Merge printers from top-level `printers` collection + nested client.printers[]
            const fromCollection = allPrinterDocs.filter(
              p => p.clientId === selectedClient.id || p.shopName === selectedClient.shopName
            );
            const nestedIds = new Set((selectedClient.printers || []).map((p: any) => p.id));
            const merged = [
              ...(selectedClient.printers || []),
              ...fromCollection.filter(p => !nestedIds.has(p.id))
            ];

            // Filter real-time Firestore orders specifically for this shop
            const slug = selectedClient.slug || selectedClient.id;
            const shopRawOrders = allOrders.filter(order => {
              const isShopMatch =
                order.vendorSlug === slug ||
                order.vendorSlug === selectedClient.id ||
                order.clientId === selectedClient.id ||
                order.shopName === selectedClient.shopName ||
                order.storeName === selectedClient.shopName;
              return isShopMatch;
            });

            const queuedCount = shopRawOrders.filter(o => o.status !== 'completed' && o.printedStatus !== 'Printed' && o.print_status !== 'COMPLETED').length;
            const completedCount = shopRawOrders.filter(o => o.status === 'completed' || o.printedStatus === 'Printed' || o.print_status === 'COMPLETED').length;

            const filteredOrders = shopRawOrders.filter(order => {
              const code = (order.orderCode || order.id || '').toLowerCase();
              const phone = (order.mobileNumber || order.userPhoneNumber || order.phone || '').toLowerCase();
              const query = merchantOrderSearch.toLowerCase();
              const matchesSearch = !query || code.includes(query) || phone.includes(query);

              const isDone = order.status === 'completed' || order.printedStatus === 'Printed' || order.print_status === 'COMPLETED';
              if (merchantOrderStatusFilter === 'queued') return matchesSearch && !isDone;
              if (merchantOrderStatusFilter === 'completed') return matchesSearch && isDone;
              return matchesSearch;
            }).sort((a, b) => new Date(b.createdAt || b.timestamp || b.paid_at || 0).getTime() - new Date(a.createdAt || a.timestamp || a.paid_at || 0).getTime());

            const pricing = selectedClient.pricing || {
              bw: selectedClient.printingPrices?.singleSide?.bw || 1.5,
              doubleSided: selectedClient.printingPrices?.doubleSide?.bw || 2.0,
              color: selectedClient.printingPrices?.singleSide?.color || 10.0,
              a4Sheet: 1.0,
            };

            return (
              <div className="space-y-10 animate-in fade-in duration-500">

                {/* 1. Real-Time Live Print Orders Queue */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-2xl font-display font-bold text-slate-900">Live Print Orders Queue</h3>
                        {queuedCount > 0 && (
                          <span className="bg-amber-50 text-amber-700 font-bold text-xs px-2.5 py-0.5 rounded-full border border-amber-200">
                            {queuedCount} Queued
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">Customer orders arrive here in real-time. Click to view PDF and print.</p>
                    </div>

                    {/* Search and Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search order or phone..."
                          value={merchantOrderSearch}
                          onChange={(e) => setMerchantOrderSearch(e.target.value)}
                          className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-black w-44 md:w-56"
                        />
                      </div>

                      <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                        <button
                          onClick={() => setMerchantOrderStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${merchantOrderStatusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-black'}`}
                        >
                          All ({shopRawOrders.length})
                        </button>
                        <button
                          onClick={() => setMerchantOrderStatusFilter('queued')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${merchantOrderStatusFilter === 'queued' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-black'}`}
                        >
                          Queued ({queuedCount})
                        </button>
                        <button
                          onClick={() => setMerchantOrderStatusFilter('completed')}
                          className={`px-3 py-1.5 rounded-lg transition-all ${merchantOrderStatusFilter === 'completed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-black'}`}
                        >
                          Printed ({completedCount})
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="py-16 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Printer size={32} className="mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-700 text-sm">No orders in this view</p>
                      <p className="text-slate-400 text-xs mt-1">Orders placed by customers via your store URL will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredOrders.map(order => {
                        const isDone = order.status === 'completed' || order.printedStatus === 'Printed' || order.print_status === 'COMPLETED';
                        const isPaid = order.payment_status === 'PAID' || order.paymentStatus === 'Paid';
                        const shopEarnings = typeof order.vendorAmount === 'number'
                          ? order.vendorAmount
                          : (typeof order.subtotal === 'number' ? order.subtotal : Number(order.amount || 0));

                        return (
                          <div
                            key={order.id}
                            className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${isDone ? 'bg-slate-50/70 border-slate-200' : 'bg-white border-amber-200 shadow-md shadow-amber-500/5 ring-1 ring-amber-300/50'}`}
                          >
                            <div>
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-sm text-slate-900">
                                      #{order.orderCode || order.id.slice(0, 8).toUpperCase()}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                      {isPaid ? 'PAID' : 'PENDING'}
                                    </span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 block mt-0.5">
                                    {order.createdAt || order.timestamp ? new Date(order.createdAt || order.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                                  </span>
                                </div>

                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {isDone ? 'PRINTED' : 'QUEUED'}
                                </span>
                              </div>

                              {/* Specs */}
                              <div className="bg-slate-50 p-3 rounded-xl mb-3 space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Customer:</span>
                                  <span className="font-bold text-slate-800">{order.mobileNumber || order.userPhoneNumber || 'Walk-in'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Job Specs:</span>
                                  <span className="font-bold text-slate-800">
                                    {order.totalPages || order.pages || 1} pgs • {order.isColor ? 'Color' : 'B&W'} • {order.printSide === 'double' ? '2-Sided' : '1-Sided'} ({order.copies || 1}x)
                                  </span>
                                </div>
                                {order.bindingId && order.bindingId !== 'none' && (
                                  <div className="flex justify-between items-center bg-indigo-50/80 px-2.5 py-1.5 rounded-lg text-indigo-950 border border-indigo-100">
                                    <span className="font-medium text-[11px] text-indigo-700">Binding:</span>
                                    <span className="font-bold text-[11px] flex items-center gap-1">
                                      📘 {order.bindingName || 'Binding'}{order.bindingOption === 'with_print' ? ' (With Print)' : order.bindingOption === 'without_print' ? ' (No Print)' : ''}
                                      <span className="text-emerald-700 font-black">(+₹{order.bindingPrice || 0})</span>
                                    </span>
                                  </div>
                                )}
                                <div className="flex justify-between pt-1 border-t border-slate-200/60">
                                  <span className="text-slate-500">Shop Net Credit:</span>
                                  <span className="font-black text-emerald-700 text-sm">₹{shopEarnings.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-2">
                              {order.fileUrl ? (
                                <a
                                  href={order.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex-1 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                >
                                  <Download size={13} /> View / Print PDF
                                </a>
                              ) : (
                                <div className="flex-1 py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold text-center">
                                  No File Attached
                                </div>
                              )}

                              <button
                                onClick={() => handleMarkOrderPrinted(order.id, isDone ? 'completed' : 'pending')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors ${isDone ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                                title={isDone ? 'Re-open Order' : 'Mark as Printed'}
                              >
                                <CheckCircle2 size={14} />
                                {isDone ? 'Done' : 'Mark Printed'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Store Pricing Rate Card */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 lg:p-8 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-display font-bold text-slate-900">Current Print Rates</h3>
                      <p className="text-slate-500 text-xs">Customer charges configured for this shop (100% credited to shop).</p>
                    </div>
                    <button
                      onClick={handleOpenShopSettings}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                    >
                      <Settings size={13} /> Edit Rates
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">B&W Single Sided</span>
                      <span className="text-2xl font-black text-slate-900">₹{pricing.bw.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">B&W Double Sided</span>
                      <span className="text-2xl font-black text-slate-900">₹{pricing.doubleSided.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Color Print</span>
                      <span className="text-2xl font-black text-slate-900">₹{pricing.color.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Blank A4 Sheet</span>
                      <span className="text-2xl font-black text-slate-900">₹{(pricing.a4Sheet || 1.0).toFixed(2)}</span>
                    </div>
                  </div>

                  {pricing.enableTiers !== false && pricing.tiers && pricing.tiers.length > 0 && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Page Range Volume Rates</span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                          Tier Discounts Active
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {pricing.tiers.map((tier, idx) => (
                          <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-900 mb-2 pb-1.5 border-b border-slate-200/60">
                              <span>Tier {idx + 1}</span>
                              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 font-mono text-[11px]">
                                {tier.maxPages ? `${tier.minPages}–${tier.maxPages} pgs` : `${tier.minPages}+ pgs`}
                              </span>
                            </div>
                            <div className="space-y-1 text-slate-600">
                              <div className="flex justify-between">
                                <span>Single Sided:</span>
                                <span className="font-bold text-slate-900">₹{tier.bwRate.toFixed(2)}/pg</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Double Sided:</span>
                                <span className="font-bold text-slate-900">₹{tier.doubleSidedRate.toFixed(2)}/pg</span>
                              </div>
                              {tier.colorRate !== undefined && (
                                <div className="flex justify-between">
                                  <span>Color:</span>
                                  <span className="font-bold text-slate-900">₹{tier.colorRate.toFixed(2)}/pg</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pricing.binding?.enabled !== false && pricing.binding?.items && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Binding &amp; Finishing Rates</span>
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full font-bold border border-indigo-200">
                          {pricing.binding.items.filter(i => i.enabled).length} Services Active
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {pricing.binding.items.filter(i => i.enabled).map((bItem) => (
                          <div key={bItem.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                            <div className="flex items-center justify-between font-bold text-slate-900 mb-1.5 pb-1 border-b border-slate-200/60">
                              <span>{bItem.name}</span>
                            </div>
                            <div className="space-y-1 text-slate-600">
                              {bItem.type === 'flat' && (
                                <div className="flex justify-between font-bold text-slate-900">
                                  <span>Flat Rate:</span>
                                  <span>₹{bItem.flatPrice || 0}</span>
                                </div>
                              )}
                              {bItem.type === 'with_without_print' && (
                                <>
                                  <div className="flex justify-between">
                                    <span>With Print:</span>
                                    <span className="font-bold text-slate-900">₹{bItem.withPrintPrice || 0}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Without Print:</span>
                                    <span className="font-bold text-slate-900">₹{bItem.withoutPrintPrice || 0}</span>
                                  </div>
                                </>
                              )}
                              {bItem.type === 'tiered' && (bItem.tiers || []).map((t, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>{t.maxSheets ? `${t.minSheets}–${t.maxSheets} pgs:` : `${t.minSheets}+ pgs:`}</span>
                                  <span className="font-bold text-slate-900">₹{t.price}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Printers Section */}
                {merged.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-display font-bold mb-6 flex items-center gap-2"><Printer className="text-slate-900" /> Connected Printers</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {merged.map(printer => (
                        <div key={printer.id} className="bg-white border p-3 rounded-2xl flex flex-col gap-1.5 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/80 backdrop-blur-sm rounded-bl-xl border-b border-l border-slate-100">
                            <button
                              onClick={() => handleViewPrinter(printer)}
                              className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-black cursor-pointer hover:bg-slate-200 transition-colors"
                              title="View Details"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleEditPrinter(printer)}
                              className="bg-slate-100 p-1.5 rounded-lg text-slate-500 hover:text-black cursor-pointer hover:bg-slate-200 transition-colors"
                              title="Edit Printer"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeletePrinter(printer.id)}
                              className="bg-rose-50 p-1.5 rounded-lg text-rose-500 hover:text-rose-700 cursor-pointer hover:bg-rose-100 transition-colors"
                              title="Remove Printer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <div className="flex justify-between items-start">
                            <div className="pr-16">
                              <h4 className="font-bold text-base text-slate-900 leading-tight">{printer.name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{printer.configuration}</p>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${printer.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{printer.status}</span>
                          </div>
                          <div className="pt-2 border-t mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin size={12} /> {printer.location}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-2xl font-display font-bold mb-6 flex items-center gap-2"><Clock className="text-blue-500" /> Usage History</h3>
                  <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Time</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Type</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Volume</th><th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">State</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedClient.history?.map(job => (
                          <tr key={job.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-4 text-sm font-medium">{job.timestamp}</td>
                            <td className="px-6 py-4"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.type === 'Color' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>{job.type}</span></td>
                            <td className="px-6 py-4 text-sm">{job.pages} pages</td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-emerald-500">{job.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-2xl font-display font-bold mb-6 flex items-center gap-2"><AlertCircle className="text-amber-500" /> Maintenance Tickets</h3>
                  <div className="space-y-4">
                    {selectedClient.reports?.map(report => (
                      <div key={report.id} className="bg-white border p-6 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div><span className="text-[10px] font-bold text-slate-400 uppercase">{report.timestamp}</span></div>
                          <p className="font-medium">{report.issue}</p>
                        </div>
                        {report.status === 'pending' ? (
                          <button onClick={() => handleResolveReport(selectedClient.id, report.id)} className="bg-black text-white px-6 py-2 rounded-full text-xs font-bold">Resolve</button>
                        ) : <span className="text-emerald-600 bg-emerald-50 px-4 py-1.5 rounded-full text-xs font-bold">Resolved</span>}
                      </div>
                    )) || <div className="p-10 text-center bg-slate-50 border border-dashed rounded-3xl text-slate-400">No active tickets for this device.</div>}
                  </div>
                </div>


                {/* Transaction History Table */}
                {selectedClient.history && selectedClient.history.length > 0 && (
                  <div>
                    <h3 className="text-2xl font-display font-bold mb-6 flex items-center gap-2"><Receipt className="text-slate-900" /> Transaction History</h3>
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">ID / User</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Details</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Cost</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-center">Status</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedClient.history.map((job) => (
                              <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-mono font-bold text-slate-900 text-blue-600">#{job.id}</span>
                                    <span className="text-xs text-slate-400">{job.timestamp}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-900">{job.pages} pgs • {job.type}</span>
                                    <span className="text-xs text-slate-500 flex items-center gap-1"><Printer size={10} /> {job.printerName}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900">{job.cost}</span>
                                    <span className={`text-[10px] font-bold uppercase ${job.paymentStatus === 'Paid' ? 'text-emerald-600' : job.paymentStatus === 'Pending' ? 'text-amber-600' : 'text-rose-600'}`}>{job.paymentStatus}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  {job.status === 'Completed' ? (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></div>
                                  ) : (
                                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-50 text-rose-600"><AlertTriangle size={16} /></div>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    {job.paymentStatus === 'Pending' && (
                                      <button
                                        onClick={() => handleUpdateTransactionStatus(selectedClient.id, job.id, 'Paid')}
                                        className="px-3 py-1 bg-black text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-colors"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                    {job.paymentStatus === 'Paid' && (
                                      <button
                                        onClick={() => handleUpdateTransactionStatus(selectedClient.id, job.id, 'Refunded')}
                                        className="px-3 py-1 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                      >
                                        Refund
                                      </button>
                                    )}
                                    {job.paymentStatus !== 'Pending' && job.paymentStatus !== 'Paid' && (
                                      <button className="p-2 text-slate-400 hover:text-black transition-colors rounded-lg hover:bg-slate-50">
                                        <Eye size={16} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                )}
              </div>
            );
          })()}

          {activeView === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              {allReports.map(report => (
                <div key={report.id} className="bg-white border rounded-3xl p-8 hover:shadow-lg transition-all flex flex-col lg:flex-row gap-6 items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${report.status === 'pending' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{report.shopName}</span>
                    </div>
                    <h4 className="text-xl font-bold mb-4">{report.issue}</h4>
                    <p className="text-slate-400 text-sm">Log Entry: {report.timestamp}</p>
                  </div>
                  {report.status === 'pending' && <button onClick={() => { handleResolveReport(report.clientId || (clients.find(cl => cl.shopName === report.shopName)?.id || ''), report.id) }} className="bg-black text-white px-8 py-3 rounded-xl font-bold">Resolve Ticket</button>}
                </div>
              ))}
            </div>
          )
          }




          {
            activeView === 'transactions' && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-display font-bold text-slate-900">All Transactions</h3>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        className="pl-9 pr-4 py-2.5 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none font-medium text-slate-900 text-sm w-80 md:w-96 transition-all"
                        placeholder="Search transactions..."
                        type="text"
                        value={transactionsSearchQuery}
                        onChange={(e) => setTransactionsSearchQuery(e.target.value)}
                      />
                    </div>
                    <button onClick={handleExport} className="p-2.5 border border-slate-200 bg-white rounded-xl hover:bg-slate-50 transition-colors text-slate-600" title="Export CSV">
                      <Download size={18} />
                    </button>
                    <button onClick={() => setActiveView('dashboard')} className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors" title="Back to Dashboard">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Shop / Printer</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">User / Phone</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Job Details</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Payment</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allTransactions.filter(tx =>
                          tx.shopName.toLowerCase().includes(transactionsSearchQuery.toLowerCase()) ||
                          tx.userPhoneNumber.includes(transactionsSearchQuery) ||
                          tx.status.toLowerCase().includes(transactionsSearchQuery.toLowerCase()) ||
                          tx.paymentStatus.toLowerCase().includes(transactionsSearchQuery.toLowerCase())
                        ).map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-700">{tx.shopName}</span>
                                <span className="text-xs text-slate-400">{tx.printerName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900">{tx.userPhoneNumber}</span>
                                <span className="text-xs text-slate-400">{tx.timestamp}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">{tx.pages} pages • {tx.type}</span>
                                <span className="text-xs font-bold text-slate-900">{tx.cost}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {tx.status === 'Completed' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                {tx.status}
                              </span>
                              {tx.errorDetails && <div className="text-[10px] text-rose-500 mt-1 font-medium">{tx.errorDetails}</div>}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tx.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-600' :
                                tx.paymentStatus === 'Pending' ? 'bg-amber-50 text-amber-600' :
                                  tx.paymentStatus === 'Refunded' ? 'bg-blue-50 text-blue-600' : 'bg-rose-50 text-rose-600'
                                }`}>
                                {tx.paymentStatus}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {tx.paymentStatus === 'Pending' && (
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(tx.clientId, tx.id, 'Paid')}
                                    className="px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors"
                                  >
                                    Mark Paid
                                  </button>
                                )}
                                {tx.paymentStatus === 'Paid' && (
                                  <button
                                    onClick={() => handleUpdateTransactionStatus(tx.clientId, tx.id, 'Refunded')}
                                    className="px-3 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors"
                                  >
                                    Refund
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          }

          {
            activeView === 'dashboard' && !selectedClient && userRole === 'admin' && (
              <div className="space-y-8 animate-in zoom-in-95 duration-500">

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard
                    label="Total Revenue"
                    value={`₹${totalRevenue}`}
                    icon={<Receipt size={24} />}
                    iconBg="bg-emerald-50"
                    iconColor="text-emerald-600"
                  />
                  <StatCard
                    label="Total Printers"
                    value={totalPrinters.toString()}
                    icon={<Printer size={24} />}
                    iconBg="bg-blue-50"
                    iconColor="text-blue-600"
                  />
                  <StatCard
                    label="Total Prints Processed"
                    value={totalPrints.toLocaleString()}
                    icon={<FileText size={24} />}
                    iconBg="bg-indigo-50"
                    iconColor="text-indigo-600"
                  />
                </div>

                {/* Recent Transactions Preview */}
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-display font-bold text-slate-900">Recent Transactions</h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          className="pl-9 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-black outline-none font-medium text-slate-900 text-sm w-64 transition-all"
                          placeholder="Search transactions..."
                          type="text"
                          value={dashboardSearchQuery}
                          onChange={(e) => setDashboardSearchQuery(e.target.value)}
                        />
                      </div>
                      <button onClick={() => setActiveView('transactions')} className="text-sm font-bold text-slate-500 hover:text-black flex items-center gap-1">
                        View All <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Shop</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">User</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400">Status</th>
                          <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allTransactions.filter(tx =>
                          tx.shopName.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
                          tx.userPhoneNumber.includes(dashboardSearchQuery) ||
                          tx.status.toLowerCase().includes(dashboardSearchQuery.toLowerCase())
                        ).slice(0, 5).map(tx => (
                          <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-600">{tx.shopName}</td>
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-900">{tx.userPhoneNumber}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">{tx.cost}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>


            )
          }
        </main >


        {/* Customer Details Sidebar */}
        {
          showDetailsPanel && selectedClient && activeView === 'customers' && (
            <div className="fixed lg:fixed right-0 top-0 bottom-0 w-full lg:w-96 bg-white border-l border-slate-200 shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-6 z-10">
                <div className="flex justify-between items-center mb-0">
                  <h3 className="text-xl font-display font-bold text-slate-900">Customer Details</h3>
                  <button
                    onClick={() => setShowDetailsPanel(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Shop Info */}
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                      <Store size={24} />
                    </div>
                    <div>
                      {/* Client Name with Status Indicator */}
                      <div className="relative">
                        <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                          {selectedClient.shopName}
                          {/* Red Dot Indicator for Issued Transactions */}
                          {selectedClient.history?.some(h => h.status === 'Failed' || h.paymentStatus === 'Pending') && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Requires Attention"></span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin size={14} />
                          {selectedClient.location}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${selectedClient.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                        <span className={`text-sm font-bold ${selectedClient.status === 'active' ? 'text-slate-900' : 'text-slate-900'}`}>
                          {selectedClient.status === 'active' ? 'Active' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 my-6" />

                  {/* Contact Information */}
                  <div>
                    <div className="space-y-5">
                      {selectedClient.phoneNumber && (
                        <div className="flex justify-between items-center group">
                          <span className="text-sm text-slate-500 font-medium flex items-center gap-2 group-hover:text-slate-800 transition-colors">
                            <Phone size={16} className="text-slate-400 group-hover:text-slate-600" /> Phone Number
                          </span>
                          <span className="text-sm font-bold text-slate-900">{selectedClient.phoneNumber}</span>
                        </div>
                      )}
                      {selectedClient.email && (
                        <div className="flex justify-between items-center group">
                          <span className="text-sm text-slate-500 font-medium flex items-center gap-2 group-hover:text-slate-800 transition-colors">
                            <Mail size={16} className="text-slate-400 group-hover:text-slate-600" /> Email Address
                          </span>
                          <span className="text-sm font-bold text-slate-900">{selectedClient.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 my-6" />

                  {/* Device Information */}
                  <div>
                    <div className="space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Device ID</span>
                        <span className="text-sm font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{selectedClient.deviceId}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Subscription Plan</span>
                        <span className={`text-sm font-bold px-3 py-1 rounded-lg ${selectedClient.planType === 'Annual' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-700 border border-slate-100'}`}>
                          {selectedClient.planType}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500 font-medium">Last Active</span>
                        <span className="text-sm font-bold text-slate-900">{selectedClient.lastActive}</span>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100 my-6" />

                  {/* Quick Stats */}
                  <div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Printer size={16} className="text-blue-600" />
                          <span className="text-xs font-bold text-blue-600">Total Printers</span>
                        </div>
                        <p className="text-xl font-bold text-blue-900">{selectedClientPrinters.length}</p>
                      </div>
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText size={16} className="text-indigo-600" />
                          <span className="text-xs font-bold text-indigo-600">Total Prints</span>
                        </div>
                        <p className="text-xl font-bold text-indigo-900">{selectedClientTransactions.reduce((acc, curr) => acc + curr.pages, 0)}</p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare size={16} className="text-amber-600" />
                          <span className="text-xs font-bold text-amber-600">Open Tickets</span>
                        </div>
                        <p className="text-xl font-bold text-amber-900">{selectedClientReports.filter(r => r.status === 'pending').length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  {selectedClientTransactions.length > 0 && (
                    <div>
                      <h5 className="text-xs font-bold text-slate-400 uppercase mb-3">Recent Activity</h5>
                      <div className="space-y-2">
                        {selectedClientTransactions.slice(0, 3).map((job) => (
                          <div key={job.id} className="bg-slate-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-slate-900">{job.pages} pages</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${job.type === 'Color' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                                {job.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">{job.timestamp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 border-t">
                    <button
                      onClick={() => {
                        setShowDetailsPanel(false);
                        // Navigate to full details view
                      }}
                      className="w-full bg-black text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      View Full Details
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </div >
  );
};

export default App;
