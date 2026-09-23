import React, { useState, useMemo } from "react";
import {
  Wallet, CheckCircle2, Clock, Receipt, Search, X,
  Building2, Calendar, CreditCard, Zap,
} from "lucide-react";
import { FinancePayout } from "../types";

export interface VendorWalletInfo {
  vendorSlug: string;
  vendorName: string;
  balance: number;
  lastUpdated?: string;
}

export interface PendingPayout {
  vendorSlug: string;
  vendorName: string;
  date: string;
  amount: number;
  orderCodes: string[];
  orderCount: number;
}

interface FinancePageProps {
  pendingPayouts: PendingPayout[];
  financePayouts: FinancePayout[];
  walletBalances: VendorWalletInfo[];
  currentFinanceUser: string;
  onMarkPaid: (payout: PendingPayout, referenceId: string) => Promise<void>;
}

const STATUS_COLORS: Record<string, string> = {
  processed:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  auto_credited:"bg-blue-50 text-blue-700 border-blue-200",
  pending:      "bg-amber-50 text-amber-700 border-amber-200",
};
const STATUS_LABELS: Record<string, string> = {
  processed:    "Manually Paid",
  auto_credited:"Auto-Credited",
  pending:      "Pending",
};

export const FinancePage: React.FC<FinancePageProps> = ({
  pendingPayouts,
  financePayouts,
  walletBalances,
  onMarkPaid,
}) => {
  const [activeTab, setActiveTab] = useState<"pending" | "history" | "wallets">("pending");
  const [showModal, setShowModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<PendingPayout | null>(null);
  const [referenceId, setReferenceId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "processed" | "auto_credited">("all");

  const totalPendingAmount = useMemo(() => pendingPayouts.reduce((s, p) => s + p.amount, 0), [pendingPayouts]);
  const totalWalletBalance = useMemo(() => walletBalances.reduce((s, w) => s + w.balance, 0), [walletBalances]);

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayProcessed = financePayouts
    .filter(p => p.date === todayIST && p.status === "processed")
    .reduce((s, p) => s + p.amount, 0);

  const filteredHistory = useMemo(() =>
    financePayouts
      .filter(p => {
        const q = historySearch.toLowerCase();
        const matchSearch = !q || p.vendorName.toLowerCase().includes(q) || (p.referenceId || "").toLowerCase().includes(q);
        const matchStatus = historyFilter === "all" || p.status === historyFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  [financePayouts, historySearch, historyFilter]);

  const openModal = (p: PendingPayout) => { setSelectedPayout(p); setReferenceId(""); setShowModal(true); };

  const confirmPaid = async () => {
    if (!selectedPayout) return;
    setIsProcessing(true);
    try { await onMarkPaid(selectedPayout, referenceId.trim()); setShowModal(false); }
    finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-400">

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:"Pending Payouts", value:`?${totalPendingAmount.toFixed(2)}`, sub:`${pendingPayouts.length} vendors`, icon:<Clock size={16}/>, color:"text-amber-600", bg:"bg-amber-50", border:"border-amber-200" },
          { label:"Total Wallet Balance", value:`?${totalWalletBalance.toFixed(2)}`, sub:`${walletBalances.length} wallets`, icon:<Wallet size={16}/>, color:"text-blue-600", bg:"bg-blue-50", border:"border-slate-200" },
          { label:"Processed Today", value:`?${todayProcessed.toFixed(2)}`, sub:"Auto-credit at 7 PM IST", icon:<CheckCircle2 size={16}/>, color:"text-emerald-600", bg:"bg-emerald-50", border:"border-emerald-200" },
        ].map(c => (
          <div key={c.label} className={`bg-white border ${c.border} rounded-2xl p-5 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-full ${c.bg} flex items-center justify-center ${c.color}`}>{c.icon}</div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{c.label}</span>
            </div>
            <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-sm font-bold w-full max-w-md">
        {(["pending","history","wallets"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 rounded-xl transition-all capitalize ${activeTab===t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-black"}`}>
            {t==="pending" ? `Pending (${pendingPayouts.length})` : t==="history" ? "History" : "Wallets"}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {activeTab==="pending" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {pendingPayouts.length===0 ? (
            <div className="py-20 text-center">
              <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3"/>
              <p className="font-bold text-slate-700">All payouts cleared!</p>
              <p className="text-slate-400 text-sm mt-1">No pending vendor payouts.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  {["Vendor","Date","Amount","Orders",""].map(h => (
                    <th key={h} className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wide ${h==="Amount"||h==="Orders" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPayouts.map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><Building2 size={14} className="text-slate-500"/></div>
                          <div><p className="font-bold text-slate-900">{p.vendorName}</p><p className="text-xs text-slate-400">{p.vendorSlug}</p></div>
                        </div>
                      </td>
                      <td className="px-6 py-4"><div className="flex items-center gap-1.5 text-slate-600"><Calendar size={13}/><span className="font-medium">{p.date}</span></div></td>
                      <td className="px-6 py-4 text-right font-black text-slate-900 text-base">?{p.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right"><span className="bg-slate-100 text-slate-700 font-bold text-xs px-2.5 py-1 rounded-lg">{p.orderCount}</span></td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => openModal(p)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors ml-auto">
                          <CheckCircle2 size={13}/> Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {activeTab==="history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
              <input className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" placeholder="Search vendor or reference…" value={historySearch} onChange={e => setHistorySearch(e.target.value)}/>
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(["all","processed","auto_credited"] as const).map(s => (
                <button key={s} onClick={() => setHistoryFilter(s)} className={`px-3 py-2 rounded-lg transition-all ${historyFilter===s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                  {s==="all"?"All":s==="processed"?"Manual":"Auto"}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            {filteredHistory.length===0 ? (
              <div className="py-16 text-center"><Receipt size={32} className="mx-auto text-slate-300 mb-2"/><p className="text-slate-500 text-sm">No records found</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-50 border-b border-slate-200">
                    {["Vendor","Date","Amount","Status","Reference"].map(h => (
                      <th key={h} className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wide ${h==="Amount"?"text-right":"text-left"}`}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredHistory.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4"><p className="font-bold text-slate-900">{p.vendorName}</p><p className="text-xs text-slate-400">{p.vendorSlug}</p></td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{p.date}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">?{p.amount.toFixed(2)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[p.status]}`}>
                            {p.status==="auto_credited"?<Zap size={11}/>:<CheckCircle2 size={11}/>}
                            {STATUS_LABELS[p.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs font-mono">{p.referenceId||(p.status==="auto_credited"?"Auto":"—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wallets tab */}
      {activeTab==="wallets" && (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          {walletBalances.length===0 ? (
            <div className="py-16 text-center"><Wallet size={32} className="mx-auto text-slate-300 mb-2"/><p className="text-slate-500 text-sm">No wallet data yet</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  {["Vendor","Wallet Balance","Last Updated"].map(h => (
                    <th key={h} className={`px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wide ${h==="Wallet Balance"?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {[...walletBalances].sort((a,b)=>b.balance-a.balance).map(w => (
                    <tr key={w.vendorSlug} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Building2 size={14}/></div>
                          <div><p className="font-bold text-slate-900">{w.vendorName}</p><p className="text-xs text-slate-400">{w.vendorSlug}</p></div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right"><span className={`text-lg font-black ${w.balance>0?"text-emerald-700":"text-slate-400"}`}>?{w.balance.toFixed(2)}</span></td>
                      <td className="px-6 py-4 text-slate-500 text-xs">{w.lastUpdated ? new Date(w.lastUpdated).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"short",timeStyle:"short"}) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mark as Paid Modal */}
      {showModal && selectedPayout && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}/>
          <div className="relative bg-white rounded-3xl p-7 shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <button onClick={() => setShowModal(false)} className="absolute top-5 right-5 text-slate-400 hover:text-black"><X size={20}/></button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600"><CreditCard size={18}/></div>
              <div><h2 className="text-lg font-bold text-slate-900">Confirm Payout</h2><p className="text-slate-400 text-xs">Mark vendor payout as processed</p></div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 mb-5 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Vendor</span><span className="font-bold">{selectedPayout.vendorName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><span className="font-medium">{selectedPayout.date}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Orders</span><span className="font-medium">{selectedPayout.orderCount}</span></div>
              <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-bold text-slate-500">Amount</span><span className="font-black text-emerald-700 text-base">?{selectedPayout.amount.toFixed(2)}</span></div>
            </div>
            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">UPI / Bank Reference <span className="text-slate-300 font-normal">(optional)</span></label>
              <input type="text" placeholder="e.g. UTR123456789012" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black bg-slate-50 font-mono" value={referenceId} onChange={e => setReferenceId(e.target.value)}/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={confirmPaid} disabled={isProcessing} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {isProcessing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <><CheckCircle2 size={15}/> Confirm Paid</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
