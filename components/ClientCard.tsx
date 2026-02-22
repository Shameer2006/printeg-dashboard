
import React from 'react';
import {
  ChevronRight,
  Store,
  GraduationCap,
  Printer,
  Share2,
  MapPin,
  Trash2
} from 'lucide-react';
import { Client } from '../types';

interface ClientCardProps {
  client: Client;
  onClick?: (client: Client) => void;
  onDelete?: (id: string) => void;
}

const IconMap = {
  storefront: Store,
  school: GraduationCap,
  print: Printer,
  hub: Share2
};

export const ClientCard: React.FC<ClientCardProps> = ({ client, onClick, onDelete }) => {
  const Icon = IconMap[client.iconType] || Store;
  const isActive = client.status === 'active';

  return (
    <div
      onClick={() => onClick?.(client)}
      className="bg-white border border-slate-200 p-4 rounded-2xl hover:shadow-lg hover:border-black/10 transition-all group cursor-pointer relative overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-3">
        {/* Shop Details */}
        <div className="col-span-12 lg:col-span-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-colors">
            <Icon size={20} />
          </div>
          <div>
            <h4 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
              {client.shopName}
              {client.history?.some(h => h.status === 'Failed' || h.paymentStatus === 'Pending') && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="Requires Attention"></span>
              )}
            </h4>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <MapPin size={12} className="text-slate-400" />
              {client.location}
            </p>
          </div>
        </div>

        {/* Device ID */}
        <div className="col-span-6 lg:col-span-3">
          <span className="bg-slate-50 text-slate-600 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border border-slate-100">
            {client.deviceId}
          </span>
        </div>

        {/* Plan */}
        <div className="col-span-6 lg:col-span-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${client.planType === 'Annual'
            ? 'bg-blue-50 text-blue-600'
            : 'bg-slate-100 text-slate-600'
            }`}>
            {client.planType} Plan
          </span>
        </div>

        {/* Status */}
        <div className="col-span-10 lg:col-span-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
            <span className={`text-xs font-semibold ${isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isActive ? 'Active - Online' : 'Expired / Offline'}
            </span>
          </div>
        </div>

        {/* Action */}
        <div className="col-span-2 lg:col-span-1 text-right flex items-center justify-end gap-2">
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(client.id);
              }}
              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
              title="Delete Client"
            >
              <Trash2 size={18} />
            </button>
          )}
          <ChevronRight className="inline-block text-slate-300 group-hover:text-black transition-colors" />
        </div>
      </div>
    </div>
  );
};
