import React, { useState, useEffect, useMemo, memo } from 'react';
import JSZip from 'jszip';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from './src/lib/firebase';

// Icons
import {
  Search, Plus, Filter, Download, Printer, Users, AlertCircle, Menu, X,
  CheckCircle2, MessageSquare, Clock, ArrowRight, LayoutGrid, ArrowLeft,
  Calendar, Layers, FileText, Lock, User as UserIcon, Eye, EyeOff, Store,
  MapPin, Settings, Trash2, Receipt, AlertTriangle, Phone, Mail, Pencil
} from 'lucide-react';

// Components & Types
import { Sidebar } from './components/Sidebar';
import { StatCard } from './components/StatCard';
import { ClientCard } from './components/ClientCard';
import { Client, StatusType } from './types';

// Constants
const ITEMS_PER_PAGE = 5;

const PYTHON_SCRIPT_TEMPLATE = `import time
import sys
import os
import json
import requests
import subprocess
import firebase_admin
from firebase_admin import credentials, firestore
from pad4pi import rpi_gpio
from luma.core.interface.serial import i2c
from luma.core.render import canvas
from luma.oled.device import ssd1306
from PIL import ImageFont

# ==========================================
# 1. CONFIGURATION & SETUP
# ==========================================

# --- Load Identity from config.json ---
try:
    with open('config.json', 'r') as f:
        config = json.load(f)
        SHOP_ID = config['shop_id']
        PRINTER_ID = config['printer_id']
        PRINTER_NAME = config.get('printer_name', 'Xerox_B215') # Default fallback
        SHOP_NAME = config.get('shop_name', 'Unknown Shop')
except Exception as e:
    print(f"CRITICAL ERROR: Could not load config.json. {e}")
    sys.exit(1)

# --- Initialize Firebase ---
# This looks for the key in the same folder
cred_path = 'serviceAccountKey.json'
if not os.path.exists(cred_path):
    print(f"CRITICAL ERROR: {cred_path} not found.")
    sys.exit(1)

cred = credentials.Certificate(cred_path)
firebase_admin.initialize_app(cred)
db = firestore.client()

# --- Hardware Setup (OLED & Keypad) ---
# OLED
serial = i2c(port=1, address=0x3C)
device = ssd1306(serial)

# Keypad (4x4 Matrix)
KEYPAD_ROWS = [5, 6, 13, 19]
KEYPAD_COLS = [26, 16, 20, 21]
factory = rpi_gpio.KeypadFactory()
keypad = factory.create_keypad(keypad=KEYPAD_ROWS, col_pins=KEYPAD_COLS)

# Global Variables
current_code = ""
is_processing = False

# ==========================================
# 2. HELPER FUNCTIONS
# ==========================================

def display_message(line1, line2="", font_size=12):
    """Draws text to the OLED screen"""
    with canvas(device) as draw:
        # You can load a custom font if you have a .ttf file, otherwise use default
        draw.text((5, 10), line1, fill="white")
        draw.text((5, 30), line2, fill="white")
    print(f"[DISPLAY] {line1} | {line2}")

def reset_screen():
    """Resets the screen to waiting mode"""
    global current_code
    current_code = ""
    display_message("Print-E Ready", "Enter Code: ____")

def download_file(url, save_path):
    """Downloads the PDF from Firebase Storage URL"""
    try:
        response = requests.get(url, stream=True)
        if response.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return True
        return False
    except Exception as e:
        print(f"Download Error: {e}")
        return False

# ==========================================
# 3. CORE PRINT LOGIC
# ==========================================

def process_print_job(doc_ref, data):
    global is_processing
    is_processing = True
    
    code = doc_ref.id
    file_url = data.get('fileUrl')
    
    display_message("Found Order!", "Downloading...")
    
    # 1. Download PDF
    local_filename = f"/tmp/{code}.pdf"
    if not download_file(file_url, local_filename):
        display_message("Error", "Download Failed")
        time.sleep(2)
        is_processing = False
        reset_screen()
        return

    # 2. Send to Printer
    display_message("Printing...", "Please Wait")
    try:
        # CUPS Command: lp -d [PRINTER_NAME] [FILE_PATH]
        # Adding options to fit page is usually safer
        cmd = ["lp", "-d", PRINTER_NAME, "-o", "media=A4", "-o", "fit-to-page", local_filename]
        subprocess.run(cmd, check=True)
        print("Sent to printer successfully.")
        
        # 3. THE DUAL-WRITE DATABASE UPDATE (Batch Write)
        # This updates the global order AND adds to the shop's history safely
        batch = db.batch()
        
        # A. Update Global Order
        batch.update(doc_ref, {
            'status': 'completed',
            'printedAt': firestore.SERVER_TIMESTAMP,
            'shopId': SHOP_ID,
            'shopName': SHOP_NAME,
            'printerId': PRINTER_ID,
            'printedStatus': 'Success'
        })
        
        # B. Add to Client's History Subcollection
        # We create a new doc inside clients/{SHOP_ID}/history/{ORDER_ID}
        history_ref = db.collection('clients').document(SHOP_ID).collection('history').document(code)
        
        # Copy relevant data to history
        batch.set(history_ref, {
            'orderId': code,
            'timestamp': firestore.SERVER_TIMESTAMP,
            'pages': data.get('totalPages', 1),
            'cost': data.get('amount', 0),
            'type': 'Color' if data.get('isColor') else 'B/W',
            'status': 'Completed',
            'userPhoneNumber': data.get('mobileNumber', 'Unknown'),
            'printerName': PRINTER_NAME,
            'paymentStatus': 'Paid' # Assuming prepaid
        })
        
        # Commit the batch
        batch.commit()
        
        display_message("SUCCESS!", "Collect Paper")
        time.sleep(3)
        
    except subprocess.CalledProcessError as e:
        display_message("Printer Error", "Check Tray")
        print(f"CUPS Error: {e}")
        time.sleep(2)
    except Exception as e:
        display_message("System Error", "Update Failed")
        print(f"Logic Error: {e}")
        time.sleep(2)
    finally:
        # Cleanup
        if os.path.exists(local_filename):
            os.remove(local_filename)
        is_processing = False
        reset_screen()

def verify_code():
    """Checks the entered code against Firebase"""
    display_message("Verifying...", current_code)
    
    try:
        # Direct lookup - fast and cheap
        doc_ref = db.collection('orders').document(current_code)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            status = data.get('status')
            
            if status == 'pending':
                process_print_job(doc_ref, data)
            elif status == 'completed':
                display_message("Used Code", "Already Printed")
                time.sleep(2)
                reset_screen()
            else:
                display_message("Error", f"Status: {status}")
                time.sleep(2)
                reset_screen()
        else:
            display_message("Invalid Code", "Try Again")
            time.sleep(2)
            reset_screen()
            
    except Exception as e:
        display_message("Net Error", "Check WiFi")
        print(f"Firebase Error: {e}")
        time.sleep(2)
        reset_screen()

# ==========================================
# 4. KEYPAD INPUT LOOP
# ==========================================

def key_pressed(key):
    global current_code
    
    if is_processing:
        return # Ignore input while printing
        
    print(f"Key Pressed: {key}")
    
    if key == '#':
        # Confirm Code
        if len(current_code) > 0:
            verify_code()
        else:
            reset_screen()
            
    elif key == '*':
        # Clear/Backspace
        current_code = ""
        reset_screen()
        
    else:
        # Type Number
        # Limit code length to avoid overflow
        if len(current_code) < 6: 
            current_code += str(key)
            display_message("Enter Code:", current_code)

# --- STARTUP ---
if __name__ == "__main__":
    try:
        print("Starting Kiosk...")
        display_message("Booting...", "Connecting...")
        
        # Setup Keypad Listener
        keypad.registerKeyPressHandler(key_pressed)
        
        reset_screen()
        
        # Keep the script running
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        display_message("Shutting Down", "Goodbye")
        print("\nExiting...")
        sys.exit(0)
`;

/**
 * LOGIN PAGE COMPONENT
 * Wrapped in memo to prevent unnecessary re-renders.
 */
const LoginPage = memo(({ onLogin }: { onLogin: () => void }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<'idle' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulated Auth logic
    setTimeout(() => {
      if (userId.trim() === 'printeg.online' && password === 'printeg') {
        onLogin();
      } else {
        setError('Invalid credentials. Hint: printeg.online / printeg');
        setIsLoading(false);
      }
    }, 600);
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
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-black flex items-center justify-center rounded-2xl shadow-2xl mb-6">
            <span className="text-white font-display font-bold text-3xl">P</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">PrintEG</h1>
          <p className="text-slate-500 font-medium mt-2">Print. Easy. Go</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50">
          <h2 className="text-xl font-bold text-slate-900 mb-8">{isRecovering ? 'Account Recovery' : 'Admin Console Login'}</h2>

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
            <>
              {!isRecovering ? (
                <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <label htmlFor="userId" className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">User ID</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                      <input
                        id="userId"
                        name="userId"
                        type="text"
                        placeholder="e.g. name.online"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all text-sm font-medium text-slate-900"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                      <input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter secret key"
                        className="w-full pl-12 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all text-sm font-medium text-slate-900"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black transition-colors"
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
                      <AlertCircle size={16} />
                      {error}
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
                <form onSubmit={handleRecovery} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <div className="p-4 bg-blue-50 text-blue-800 text-xs font-medium rounded-2xl mb-4 leading-relaxed">
                    Verify your identity to reset access. We will send a secure link to your registered contact methods.
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Registered Email ID</label>
                    <input
                      type="email"
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all text-sm font-medium text-slate-900"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Registered Phone Number</label>
                    <input
                      type="tel"
                      className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none transition-all text-sm font-medium text-slate-900"
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
                    <button type="submit" disabled={isLoading} className="w-full bg-black text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : 'Verify Identity'}
                    </button>
                    <button type="button" disabled={isLoading} onClick={() => { setIsRecovering(false); setError(''); }} className="w-full text-slate-400 hover:text-black font-bold text-sm py-2 transition-colors">
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
});

LoginPage.displayName = 'LoginPage';

/**
 * MAIN APPLICATION COMPONENT
 */
const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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

  // Forms State
  const [newShopName, setNewShopName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isInstitution, setIsInstitution] = useState(false);
  const [emailId, setEmailId] = useState('');
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  // Printer Forms State
  const [showAddPrinterModal, setShowAddPrinterModal] = useState(false);
  const [printerName, setPrinterName] = useState('');
  const [printerConfig, setPrinterConfig] = useState('');
  const [printerLocation, setPrinterLocation] = useState('');
  const [printerRequirements, setPrinterRequirements] = useState('');
  const [printerToDelete, setPrinterToDelete] = useState<string | null>(null);
  const [printerToEdit, setPrinterToEdit] = useState<any | null>(null);
  const [printerToView, setPrinterToView] = useState<any | null>(null);

  // --- FIRESTORE LISTENERS ---

  useEffect(() => {
    const qClients = query(collection(db, "clients"));
    const unsubscribeClients = onSnapshot(qClients, (snap) => {
      const data: Client[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() } as Client));
      setClients(data);
      setDbStatus('connected');
    }, (err) => {
      console.error("Clients listener error:", err);
      setDbStatus('error');
    });

    const qOrders = query(collection(db, "orders"));
    const unsubscribeOrders = onSnapshot(qOrders, (snap) => {
      const data: any[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setAllOrders(data);
    });

    const qPrinters = query(collection(db, "printers"));
    const unsubscribePrinters = onSnapshot(qPrinters, (snap) => {
      const data: any[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setAllPrinterDocs(data);
    });

    const qReports = query(collection(db, "reports"));
    const unsubscribeReports = onSnapshot(qReports, (snap) => {
      const data: any[] = [];
      snap.forEach((d) => data.push({ id: d.id, ...d.data() }));
      setAllReportDocs(data);
    });

    return () => {
      unsubscribeClients();
      unsubscribeOrders();
      unsubscribePrinters();
      unsubscribeReports();
    };
  }, []);

  // Sync selectedClient if clients data updates
  useEffect(() => {
    if (selectedClient) {
      const updated = clients.find(c => c.id === selectedClient.id);
      if (updated) setSelectedClient(updated);
    }
  }, [clients]);

  // --- DATA MERGING ---

  const allReports = useMemo(() => {
    const fromCollection = allReportDocs.map(r => ({
      id: String(r.id),
      issue: String(r.issue || r.message || r.description || ''),
      timestamp: String(r.timestamp || r.createdAt || ''),
      status: String(r.status || 'pending'),
      shopName: String(r.shopName || r.shop || clients.find(c => c.id === r.clientId)?.shopName || 'Unknown Shop'),
      clientId: String(r.clientId || ''),
      _source: 'collection' as const
    }));
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
    const collectionIds = new Set(fromCollection.map(r => r.id));
    const merged = [...fromCollection, ...fromNested.filter(r => !collectionIds.has(r.id))];
    return merged.sort((a, b) => (a.status === 'pending' ? -1 : 1));
  }, [clients, allReportDocs]);

  const allTransactions = useMemo(() => {
    const fromCollection = allOrders.map(order => ({
      id: String(order.id),
      timestamp: String(order.timestamp || order.createdAt || ''),

      // 🛑 FIX 1: Map your database's 'totalPages' field
      pages: Number(order.totalPages || order.pages || order.pageCount || 0),

      // 🛑 FIX 2: Map your boolean 'isColor' to a readable string
      type: String(order.isColor ? 'Color' : 'B/W'),

      status: String(order.status || 'Completed'),

      // 🛑 FIX 3: Map your 'mobileNumber' field
      userPhoneNumber: String(order.mobileNumber || order.userPhoneNumber || order.phone || 'Web Order'),

      printerName: String(order.printerName || order.printer || ''),
      paymentStatus: String(order.paymentStatus || order.payment || 'Pending'),

      // 🛑 FIX 4: Map your 'amount' field and format with ₹
      cost: String(order.amount ? `₹${order.amount}` : order.cost || '₹0'),

      errorDetails: order.errorDetails ? String(order.errorDetails) : undefined,
      printedStatus: String(order.printedStatus || 'Not Printed'),

      // 🛑 FIX 5: Fallback to 'Legacy Web Order' instead of 'Unknown Shop'
      shopName: String(order.shopName || order.shop || clients.find(c => c.id === order.clientId)?.shopName || 'Legacy Web Order'),

      clientId: String(order.clientId || ''),
      _source: 'collection' as const
    }));
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
    const collectionIds = new Set(fromCollection.map(tx => tx.id));
    const merged = [...fromCollection, ...fromNested.filter(tx => !collectionIds.has(tx.id))];
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [clients, allOrders]);

  const selectedClientTransactions = useMemo(() => {
    if (!selectedClient) return [];
    return allTransactions.filter(tx => tx.clientId === selectedClient.id);
  }, [selectedClient, allTransactions]);

  const selectedClientReports = useMemo(() => {
    if (!selectedClient) return [];
    return allReports.filter(r => r.clientId === selectedClient.id);
  }, [selectedClient, allReports]);

  const selectedClientPrinters = useMemo(() => {
    if (!selectedClient) return [];
    const fromNested = selectedClient.printers || [];
    const fromCollection = allPrinterDocs.filter(p => p.clientId === selectedClient.id);
    const collectionIds = new Set(fromCollection.map(p => p.id));
    return [...fromCollection, ...fromNested.filter(p => !collectionIds.has(p.id))];
  }, [selectedClient, allPrinterDocs]);

  // Stats
  const totalPrinters = useMemo(() => {
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

  // Filtering & Pagination
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = (client.shopName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.location || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.deviceId || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || client.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // --- HANDLERS ---

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    if (!newShopName || !newLocation) return;
    if (!/^\d{10}$/.test(phoneNumber)) {
      setPhoneError('Please enter a valid 10-digit phone number');
      return;
    }
    const safeName = newShopName.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const safeShopId = `${safeName}-${randomSuffix}`;
    const newClient = {
      id: safeShopId,
      shopName: newShopName,
      location: newLocation,
      deviceId: `40${Math.floor(Math.random() * 900) + 100}-${Math.random().toString(36).substr(2, 8)}`,
      planType: 'Monthly',
      status: 'active',
      lastActive: 'Just now',
      iconType: 'storefront',
      history: [],
      reports: [],
      printers: [],
      phoneNumber: phoneNumber,
      ...(isInstitution && emailId ? { email: emailId } : {})
    };
    try {
      await setDoc(doc(db, 'clients', safeShopId), newClient);
      setShowOnboardModal(false);
      setNewShopName('');
      setNewLocation('');
      setPhoneNumber('');
      setIsInstitution(false);
      setEmailId('');
    } catch (err) {
      console.error('Error adding client:', err);
    }
  };

  const handleDeleteClient = (clientId: string) => setClientToDelete(clientId);

  const confirmDeleteClient = async () => {
    if (clientToDelete) {
      try {
        await deleteDoc(doc(db, 'clients', clientToDelete));
        if (selectedClient?.id === clientToDelete) {
          setSelectedClient(null);
          setShowDetailsPanel(false);
        }
      } catch (err) { console.error('Error deleting client:', err); }
      setClientToDelete(null);
    }
  };

  const handleResolveReport = async (clientId: string, reportId: string) => {
    const reportInCollection = allReportDocs.find(r => r.id === reportId);
    if (reportInCollection) {
      try { await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' }); }
      catch (err) { console.error('Error resolving report collection:', err); }
    }
    const client = clients.find(c => c.id === clientId);
    if (client && (client.reports || []).some(r => r.id === reportId)) {
      const updatedReports = (client.reports || []).map(r => r.id === reportId ? { ...r, status: 'resolved' } : r);
      try { await updateDoc(doc(db, 'clients', clientId), { reports: updatedReports }); }
      catch (err) { console.error('Error resolving report nested:', err); }
    }
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setSelectedClient(null);
    setActiveView('dashboard');
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert('Data exported as CSV');
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

  const handleAddPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !printerConfig) return;

    let updatedPrinters;
    if (printerToEdit) {
      const updatedPrinter = { ...printerToEdit, name: printerName, configuration: printerConfig, location: printerLocation, requirements: printerRequirements };
      updatedPrinters = (selectedClient.printers || []).map(p => p.id === printerToEdit.id ? updatedPrinter : p);
      if (allPrinterDocs.find(p => p.id === printerToEdit.id)) {
        try { await updateDoc(doc(db, 'printers', printerToEdit.id), { name: printerName, configuration: printerConfig, location: printerLocation, requirements: printerRequirements }); }
        catch (err) { console.error('Err update collection printer:', err); }
      }
      setPrinterToEdit(null);
    } else {
      const safePrinterId = `${printerName.toLowerCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newPrinterData = {
        id: safePrinterId,
        name: printerName || `Printer ${Math.floor(Math.random() * 100)}`,
        configuration: printerConfig,
        location: printerLocation || selectedClient.location,
        requirements: printerRequirements,
        status: 'active',
        clientId: selectedClient.id,
        shopName: selectedClient.shopName,
        createdAt: new Date().toISOString()
      };
      try {
        await setDoc(doc(db, 'printers', safePrinterId), newPrinterData);
      } catch (err) { console.error('Err add collection printer:', err); }
      updatedPrinters = [...(selectedClient.printers || []), newPrinterData];
    }

    try {
      await updateDoc(doc(db, 'clients', selectedClient.id), { printers: updatedPrinters });
      setShowAddPrinterModal(false);
      setPrinterName(''); setPrinterConfig(''); setPrinterLocation(''); setPrinterRequirements('');
    } catch (err) { console.error('Err saving printer nested:', err); }
  };

  const handleEditPrinter = (printer: any) => {
    setPrinterToEdit(printer);
    setPrinterName(printer.name);
    setPrinterConfig(printer.configuration);
    setPrinterLocation(printer.location);
    setPrinterRequirements(printer.requirements || '');
    setShowAddPrinterModal(true);
  };

  const handleViewPrinter = (printer: any) => setPrinterToView(printer);
  const handleDeletePrinter = (printerId: string) => setPrinterToDelete(printerId);

  const confirmDeletePrinter = async () => {
    if (!selectedClient || !printerToDelete) return;
    const updatedPrinters = (selectedClient.printers || []).filter(p => p.id !== printerToDelete);
    try {
      await updateDoc(doc(db, 'clients', selectedClient.id), { printers: updatedPrinters });
    } catch (err) { console.error('Error delete printer:', err); }
    setPrinterToDelete(null);
  };

  const handleUpdateTransactionStatus = async (clientId: string, jobId: string, newStatus: 'Paid' | 'Refunded') => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    const updatedHistory = (client.history || []).map(job => job.id === jobId ? { ...job, paymentStatus: newStatus } : job);
    try {
      await updateDoc(doc(db, 'clients', clientId), { history: updatedHistory });
    } catch (err) { console.error('Error update tx status:', err); }
  };

  const handleDownloadConfig = async (client: Client, printer: any) => {
    const zip = new JSZip();
    const config = {
      shop_id: client.id,
      printer_id: printer.id,
      shop_name: client.shopName,
      printer_name: printer.name
    };
    zip.file("config.json", JSON.stringify(config, null, 2));
    zip.file("kiosk_pi.py", PYTHON_SCRIPT_TEMPLATE);
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${printer.id}-setup.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- RENDER ---

  if (!isAuthenticated) return <LoginPage onLogin={() => setIsAuthenticated(true)} />;

  return (
    <div className="flex min-h-screen technical-grid">
      {isExporting && (
        <div className="fixed top-6 right-6 z-[100] bg-black text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Download size={18} />
          <span className="text-sm font-bold">Preparing CSV Export...</span>
        </div>
      )}

      {/* MODALS */}
      {showAddPrinterModal && selectedClient && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddPrinterModal(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowAddPrinterModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black"><X size={24} /></button>
            <h3 className="text-2xl font-display font-bold mb-2">Add New Printer</h3>
            <p className="text-slate-500 mb-6">Register a machine at <span className="font-bold text-slate-900">{selectedClient.shopName}</span></p>
            <form onSubmit={handleAddPrinter} className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Printer Name</label><input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={printerName} onChange={(e) => setPrinterName(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Configuration *</label><input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={printerConfig} onChange={(e) => setPrinterConfig(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Location</label><input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={printerLocation} onChange={(e) => setPrinterLocation(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Requirements</label><textarea className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none resize-none" value={printerRequirements} onChange={(e) => setPrinterRequirements(e.target.value)} rows={3} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddPrinterModal(false)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                <button type="submit" className="flex-1 bg-black text-white py-3 rounded-xl font-bold shadow-lg">{printerToEdit ? 'Save Changes' : 'Add Printer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printerToView && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrinterToView(null)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div><h3 className="text-2xl font-display font-bold text-slate-900">{printerToView.name}</h3><span className={`inline-block mt-2 px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${printerToView.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{printerToView.status}</span></div>
              <button onClick={() => setPrinterToView(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Configuration</label><p className="font-medium text-slate-900">{printerToView.configuration}</p></div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Location</label><p className="font-medium text-slate-900 flex items-center gap-2"><MapPin size={14} className="text-slate-400" />{printerToView.location}</p></div>
              {printerToView.requirements && <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><label className="block text-xs font-bold text-slate-400 uppercase mb-1">Requirements</label><p className="font-medium text-slate-900 text-sm whitespace-pre-wrap">{printerToView.requirements}</p></div>}
              <div className="pt-4 flex justify-end"><button onClick={() => { setPrinterToView(null); handleEditPrinter(printerToView); }} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold">Edit Printer</button></div>
            </div>
          </div>
        </div>
      )}

      {printerToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPrinterToDelete(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 flex items-center justify-center rounded-2xl mb-4"><Trash2 size={32} /></div>
              <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Remove Printer?</h3>
              <p className="text-slate-500 mb-8">This action cannot be undone.</p>
              <div className="flex gap-3 w-full">
                <button onClick={() => setPrinterToDelete(null)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
                <button onClick={confirmDeletePrinter} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {clientToDelete && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setClientToDelete(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 flex items-center justify-center rounded-2xl mx-auto mb-4"><Trash2 size={32} /></div>
            <h3 className="text-xl font-display font-bold text-slate-900 mb-2">Remove Client?</h3>
            <p className="text-slate-500 mb-8">This will permanently remove the shop and all data.</p>
            <div className="flex gap-3">
              <button onClick={() => setClientToDelete(null)} className="flex-1 py-3 font-bold text-slate-500">Cancel</button>
              <button onClick={confirmDeleteClient} className="flex-1 bg-rose-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-rose-200">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showOnboardModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowOnboardModal(false)} />
          <div className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <button onClick={() => setShowOnboardModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-black"><X size={24} /></button>
            <h3 className="text-2xl font-display font-bold mb-2">Onboard New Shop</h3>
            <p className="text-slate-500 mb-6">Register a new IoT printer node.</p>
            <form onSubmit={handleOnboard} className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Shop Name *</label><input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. Metro Print Hub" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Location *</label><input required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. Bangalore, KA" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} /></div>
              <div><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Phone Number *</label><input required type="tel" className={`w-full px-4 py-3 bg-slate-50 border rounded-xl ${phoneError ? 'border-rose-500' : 'border-slate-200'}`} placeholder="9876543210" value={phoneNumber} onChange={(e) => { setPhoneNumber(e.target.value); if (phoneError) setPhoneError(''); }} />{phoneError && <p className="text-rose-500 text-xs mt-1 font-bold">{phoneError}</p>}</div>
              <div><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isInstitution} onChange={(e) => setIsInstitution(e.target.checked)} /><span className="text-sm font-medium text-slate-700">This is an institution</span></label></div>
              {isInstitution && <div className="animate-in fade-in duration-300"><label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email ID *</label><input required type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" value={emailId} onChange={(e) => setEmailId(e.target.value)} /></div>}
              <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-bold mt-6 shadow-lg">Complete Registration</button>
            </form>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <div className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar activeView={activeView} setActiveView={(v) => { setActiveView(v); setSelectedClient(null); }} onSignOut={handleSignOut} />
      </div>

      <div className="flex flex-1 min-w-0">
        <main className={`flex-1 min-w-0 p-4 lg:p-10 transition-all ${showDetailsPanel && selectedClient && activeView === 'customers' ? 'lg:mr-96' : ''}`}>
          <div className="flex lg:hidden items-center justify-between mb-6">
            <div className="w-8 h-8 bg-black flex items-center justify-center rounded-lg"><span className="text-white font-bold">P</span></div>
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 border rounded-lg"><Menu size={20} /></button>
          </div>

          <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
            <div className="max-w-xl">
              {selectedClient && <button onClick={() => setSelectedClient(null)} className="flex items-center gap-2 text-slate-500 hover:text-black mb-4 font-bold"><ArrowLeft size={18} /> Back to Directory</button>}
              <div className="flex flex-col gap-1">
                <h2 className="text-4xl font-display font-bold text-slate-900 mb-2">{selectedClient ? selectedClient.shopName : (activeView === 'customers' ? 'Client Directory' : activeView === 'reports' ? 'Support Inbox' : activeView === 'transactions' ? 'Transaction Logs' : 'Network Overview')}</h2>
                {selectedClient && <div className="flex items-center gap-4 text-sm font-medium text-slate-500 mt-2"><span className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg"><Printer size={14} /> {selectedClient.printers?.length || 0} Printers</span></div>}
                <p className="text-slate-500 text-lg mt-2">{selectedClient ? `Full audit log for ID: ${selectedClient.deviceId}` : 'Manage and monitor all printer IoT deployments.'}</p>
                <div className="flex items-center gap-2 mt-3">
                  <div className={`w-2 h-2 rounded-full ${dbStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse'}`} />
                  <span className={`text-xs font-bold ${dbStatus === 'connected' ? 'text-emerald-600' : 'text-amber-600'}`}>{dbStatus === 'connected' ? 'Firestore Connected' : 'Connecting...'}</span>
                </div>
              </div>
            </div>
            {activeView === 'customers' && !selectedClient && <button onClick={() => setShowOnboardModal(true)} className="flex items-center justify-center gap-2 bg-black text-white px-8 py-4 rounded-full font-bold shadow-xl active:scale-95"><Plus size={20} /> Onboard Shop</button>}
            {activeView === 'customers' && selectedClient && <button onClick={() => setShowAddPrinterModal(true)} className="flex items-center justify-center gap-2 bg-black text-white px-6 py-3 rounded-full font-bold shadow-xl active:scale-95"><Plus size={18} /> Add Printer</button>}
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            <StatCard label="Total Prints" value={selectedClient ? (selectedClient.history?.reduce((acc, curr) => acc + curr.pages, 0) || 0).toString() : totalPrints.toLocaleString()} icon={<Printer size={16} />} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <StatCard label={selectedClient ? "Deployed Units" : "Total Printers"} value={selectedClient ? selectedClientPrinters.length.toString() : totalPrinters.toString()} icon={<LayoutGrid size={16} />} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
            <StatCard label={selectedClient ? "Tickets" : "Open Reports"} value={selectedClient ? selectedClientReports.filter(r => r.status === 'pending').length.toString() : allReports.filter(r => r.status === 'pending').length.toString()} icon={<MessageSquare size={16} />} iconBg="bg-amber-50" iconColor="text-amber-600" highlight />
          </div>

          {activeView === 'customers' && !selectedClient && (
            <>
              <div className="glass-header border border-slate-200 p-4 rounded-3xl mb-8 flex flex-col md:flex-row gap-4 items-center shadow-sm sticky top-4 z-30 bg-white/80 backdrop-blur-md">
                <div className="relative flex-1 w-full"><Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-full outline-none font-medium text-slate-900" placeholder="Search Directory..." type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={toggleFilter} className={`flex-1 md:flex-none p-4 border rounded-2xl flex items-center justify-center gap-2 font-medium ${statusFilter !== 'all' ? 'bg-black text-white' : 'bg-white text-slate-600'}`}>{statusFilter.toUpperCase()}</button>
                  <button onClick={handleExport} className="p-4 border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors text-slate-600"><Download size={18} /></button>
                </div>
              </div>
              <div className="space-y-4">
                {paginatedClients.map(client => <ClientCard key={client.id} client={client} onClick={handleSelectClient} onDelete={handleDeleteClient} />)}
              </div>
              {totalPages > 1 && (
                <div className="mt-12 flex items-center justify-center gap-4">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 border rounded-xl disabled:opacity-50"><ArrowLeft size={18} /></button>
                  <span className="text-sm font-bold">Page {currentPage} of {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 border rounded-xl disabled:opacity-50"><ArrowRight size={18} /></button>
                </div>
              )}
            </>
          )}

          {activeView === 'customers' && selectedClient && (
            <div className="space-y-10">
              <div>
                <h3 className="text-2xl font-display font-bold mb-6">Connected Printers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {selectedClientPrinters.map(printer => (
                    <div key={printer.id} className="bg-white border p-3 rounded-2xl relative group">
                      <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur rounded-bl-xl border">
                        <button onClick={() => handleDownloadConfig(selectedClient, printer)} title="Download Config" className="p-1.5 text-blue-500 hover:text-blue-700"><Download size={14} /></button>
                        <button onClick={() => handleViewPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Eye size={14} /></button>
                        <button onClick={() => handleEditPrinter(printer)} className="p-1.5 text-slate-500 hover:text-black"><Pencil size={14} /></button>
                        <button onClick={() => handleDeletePrinter(printer.id)} className="p-1.5 text-rose-500"><Trash2 size={14} /></button>
                      </div>
                      <div className="pr-16"><h4 className="font-bold text-slate-900">{printer.name}</h4><p className="text-xs text-slate-500 line-clamp-1">{printer.configuration}</p></div>
                      <div className="pt-2 border-t mt-2 text-xs text-slate-400 flex items-center gap-1.5"><MapPin size={12} /> {printer.location}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-2xl font-display font-bold mb-6">Transaction History</h3>
                <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">ID / Time</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Details</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Cost</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedClient.history?.map(job => (
                        <tr key={job.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4"><span className="font-mono text-sm font-bold text-blue-600">#{job.id}</span><br /><span className="text-xs text-slate-400">{job.timestamp}</span></td>
                          <td className="px-6 py-4 text-sm font-medium">{job.pages} pgs • {job.type}</td>
                          <td className="px-6 py-4 font-bold text-slate-900">{job.cost}</td>
                          <td className="px-6 py-4 text-right">
                            {job.paymentStatus === 'Pending' ? <button onClick={() => handleUpdateTransactionStatus(selectedClient.id, job.id, 'Paid')} className="px-2 py-1 bg-black text-white text-[10px] font-bold rounded">Mark Paid</button> : <span className="text-[10px] font-bold text-emerald-600">PAID</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'reports' && (
            <div className="space-y-4">
              {allReports.map(report => (
                <div key={report.id} className="bg-white border rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${report.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`} /><span className="text-xs font-bold text-slate-400 uppercase">{report.shopName}</span></div>
                    <h4 className="text-lg font-bold">{report.issue}</h4>
                    <p className="text-xs text-slate-400">{report.timestamp}</p>
                  </div>
                  {report.status === 'pending' && <button onClick={() => handleResolveReport(report.clientId || '', report.id)} className="bg-black text-white px-6 py-2 rounded-xl font-bold">Resolve</button>}
                </div>
              ))}
            </div>
          )}

          {activeView === 'transactions' && (
            <div className="space-y-6">
              <div className="bg-white border rounded-3xl overflow-hidden shadow-sm">
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 border-b">
                    <tr><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Shop / Printer</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Job</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Status</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 text-right">Payment</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {allTransactions.slice(0, 20).map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4"><span className="font-bold">{tx.shopName}</span><br /><span className="text-xs text-slate-400">{tx.printerName}</span></td>
                        <td className="px-6 py-4 text-sm">{tx.pages} pgs • {tx.type}<br /><span className="font-bold">{tx.cost}</span></td>
                        <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${tx.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{tx.status}</span></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{tx.paymentStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'dashboard' && (
            <div className="space-y-8 animate-in zoom-in-95 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard label="Total Revenue" value={`₹${totalRevenue}`} icon={<Receipt size={24} />} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
                <StatCard label="Total Printers" value={totalPrinters.toString()} icon={<Printer size={24} />} iconBg="bg-blue-50" iconColor="text-blue-600" />
                <StatCard label="Total Prints Processed" value={totalPrints.toLocaleString()} icon={<FileText size={24} />} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
              </div>
              <div className="bg-white border rounded-3xl p-8 shadow-sm">
                <h3 className="text-2xl font-display font-bold mb-6">Recent Transactions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Shop</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400">Status</th><th className="px-6 py-4 text-xs font-bold uppercase text-slate-400 text-right">Goal</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {allTransactions.slice(0, 5).map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4"><span className="font-bold">{tx.shopName}</span><br /><span className="text-xs text-slate-400">{tx.userPhoneNumber}</span></td>
                          <td className="px-6 py-4"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold 
  ${tx.status.toLowerCase() === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                              tx.status.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-600' :
                                'bg-rose-50 text-rose-600'}`}>

                            {/* Show Check for success, Clock for pending, Alert for error */}
                            {tx.status.toLowerCase() === 'completed' ? <CheckCircle2 size={12} /> :
                              tx.status.toLowerCase() === 'pending' ? <Clock size={12} /> :
                                <AlertTriangle size={12} />}

                            {/* Capitalize the first letter for display */}
                            {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                          </span></td>
                          <td className="px-6 py-4 text-right font-bold text-slate-900">{tx.cost}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>

        {showDetailsPanel && selectedClient && activeView === 'customers' && (
          <div className="fixed lg:fixed right-0 top-0 bottom-0 w-full lg:w-96 bg-white border-l shadow-2xl z-50 overflow-y-auto p-6 animate-in slide-in-from-right">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Details</h3>
              <button onClick={() => setShowDetailsPanel(false)}><X size={20} /></button>
            </div>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center text-white"><Store size={24} /></div>
              <div><h4 className="font-bold text-lg">{selectedClient.shopName}</h4><p className="text-xs text-slate-500">{selectedClient.location}</p></div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Status</span><span className={`font-bold ${selectedClient.status === 'active' ? 'text-emerald-500' : 'text-rose-500'}`}>{selectedClient.status.toUpperCase()}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Device ID</span><span className="font-mono bg-slate-100 px-2 py-1 rounded">{selectedClient.deviceId}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Plan</span><span className="font-bold">{selectedClient.planType}</span></div>
              <div className="flex justify-between items-center text-sm"><span className="text-slate-500 font-medium">Phone</span><span className="font-bold">{selectedClient.phoneNumber}</span></div>
            </div>
            <div className="mt-8 pt-8 border-t">
              <button onClick={() => handleDeleteClient(selectedClient.id)} className="w-full py-3 text-rose-500 font-bold border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"><Trash2 size={18} /> Delete Shop</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
