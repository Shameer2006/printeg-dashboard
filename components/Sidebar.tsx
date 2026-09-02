
import React from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart3,
  Users,
  MessageSquare,
  LogOut,
  Receipt,
  LayoutGrid,
  ShieldCheck
} from 'lucide-react';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active
      ? 'bg-slate-100 text-black font-semibold'
      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
  >
    <span className="w-5 h-5">{icon}</span>
    <span className="text-sm">{label}</span>
  </button>
);

interface SidebarProps {
  activeView: 'dashboard' | 'customers' | 'reports' | 'transactions' | 'superuser';
  setActiveView: (view: 'dashboard' | 'customers' | 'reports' | 'transactions' | 'superuser') => void;
  onSignOut?: () => void;
  userRole?: 'admin' | 'merchant';
  merchantName?: string;
  merchantUsername?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  onSignOut,
  userRole = 'admin',
  merchantName,
  merchantUsername,
}) => {
  const [showSignOutConfirm, setShowSignOutConfirm] = React.useState(false);

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = () => {
    if (onSignOut) {
      onSignOut();
    }
    setShowSignOutConfirm(false);
  };

  const cancelSignOut = () => {
    setShowSignOutConfirm(false);
  };

  const isMerchant = userRole === 'merchant';

  return (
    <>
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col h-screen sticky top-0">
        <div className="p-6">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 bg-black flex items-center justify-center rounded-xl shadow-lg mb-3">
              <span className="text-white font-display font-bold text-2xl">
                {isMerchant && merchantName ? merchantName.charAt(0).toUpperCase() : 'P'}
              </span>
            </div>
            <div>
              <h1 className="font-display font-bold text-xl leading-tight text-slate-900 truncate max-w-[200px]">
                {isMerchant && merchantName ? merchantName : 'PrintEG'}
              </h1>
              <p className="text-[12px] text-slate-600 font-medium mt-1">
                {isMerchant ? 'Merchant Portal' : 'Print. Easy. Go'}
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {isMerchant ? (
              <>
                <SidebarItem
                  icon={<LayoutGrid size={20} />}
                  label="Live Orders & Stats"
                  active={true}
                  onClick={() => {}}
                />
              </>
            ) : (
              <>
                <SidebarItem
                  icon={<LayoutGrid size={20} />}
                  label="Dashboard Overview"
                  active={activeView === 'dashboard'}
                  onClick={() => setActiveView('dashboard')}
                />
                <SidebarItem
                  icon={<Users size={20} />}
                  label="Customers"
                  active={activeView === 'customers'}
                  onClick={() => setActiveView('customers')}
                />
                <SidebarItem
                  icon={<MessageSquare size={20} />}
                  label="Reports & Help"
                  active={activeView === 'reports'}
                  onClick={() => setActiveView('reports')}
                />
                <SidebarItem
                  icon={<ShieldCheck size={20} />}
                  label="Superuser"
                  active={activeView === 'superuser'}
                  onClick={() => setActiveView('superuser')}
                />
              </>
            )}
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-6 p-2">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700">
              {isMerchant && merchantName ? merchantName.slice(0, 2).toUpperCase() : 'PE'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {isMerchant ? (merchantUsername ? `@${merchantUsername}` : merchantName) : 'PrintEG Master'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                {isMerchant ? 'Shop Owner' : 'Admin Access'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOutClick}
            className="flex items-center gap-3 px-4 py-2 w-full text-slate-500 hover:text-rose-600 transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={cancelSignOut} />
          <div className="relative bg-white w-full max-w-sm rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-6">
                <LogOut size={32} />
              </div>
              <h3 className="text-2xl font-display font-bold text-slate-900 mb-2">Sign Out?</h3>
              <p className="text-slate-500 mb-8 max-w-[200px] leading-relaxed">Are you sure you want to end your current session?</p>

              <div className="flex gap-3 w-full">
                <button
                  onClick={cancelSignOut}
                  className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded-2xl transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSignOut}
                  className="flex-1 py-4 px-6 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-rose-600/20 active:scale-95"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
