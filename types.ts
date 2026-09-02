import React from 'react';

export type PlanType = 'Annual' | 'Monthly' | 'Starter';
export type StatusType = 'active' | 'expired';

export interface JobHistory {
  id: string;
  timestamp: string;
  pages: number;
  type: 'B/W' | 'Color';
  status: 'Completed' | 'Failed';
  userPhoneNumber: string;
  printerName: string;
  paymentStatus: 'Paid' | 'Pending' | 'Failed' | 'Refunded';
  cost: string;
  errorDetails?: string;
}

export interface ClientReport {
  id: string;
  issue: string;
  timestamp: string;
  status: 'pending' | 'resolved';
}

export interface Printer {
  id: string;
  name: string;
  configuration: string; // required
  location: string;
  requirements?: string;
  status: 'active' | 'offline';
}

export interface PrintPrices {
  singleSide: { bw: number; color: number };
  doubleSide: { bw: number; color: number };
  twoInOne: { bw: number; color: number };
}

export interface PriceTier {
  id?: string;
  minPages: number;         // e.g., 1
  maxPages: number | null;  // e.g., 10 (null for 41+)
  bwRate: number;           // Single side B&W (₹)
  doubleSidedRate: number;  // Double sided B&W (₹)
  colorRate?: number;       // Color (₹)
}

export interface PageRangeTier {
  id?: string;
  minPages: number;         // e.g., 1
  maxPages: number | null;  // e.g., 10 (null for 41+)
  rate: number;             // Price per page/sheet (₹)
}

export interface SpiralRangeTier {
  id?: string;
  minSheets: number;        // e.g. 1
  maxSheets: number | null; // e.g. 49 (null for 81+)
  price: number;            // e.g. 20
}

export interface BindingItemConfig {
  id: string;               // 'spiral' | 'soft' | 'calico' | 'chart' | custom
  name: string;             // e.g. 'Spiral Binding'
  description?: string;     // e.g. 'Plastic coil with transparent protective covers'
  enabled: boolean;         // Shopkeeper can turn ON/OFF to add/remove
  type: 'tiered' | 'flat' | 'with_without_print';
  tiers?: SpiralRangeTier[]; // For 'tiered' (Spiral)
  flatPrice?: number;       // For 'flat' (Soft)
  withPrintPrice?: number;  // For 'with_without_print' (Calico, Chart)
  withoutPrintPrice?: number;// For 'with_without_print' (Calico, Chart)
}

export interface BindingPricing {
  enabled: boolean;         // Global toggle for store binding services
  items: BindingItemConfig[];
}

export interface VendorPricing {
  bw: number;               // B&W Single Sided (Xerox)
  doubleSided: number;      // B&W Double Sided
  color: number;            // Color Print
  a4Sheet: number;          // Blank A4 Sheet
  enableTiers?: boolean;    // Whether range-based tiered pricing is enabled
  singleSideTiers?: PageRangeTier[]; // Independent ranges for Single Side B&W
  doubleSideTiers?: PageRangeTier[]; // Independent ranges for Double Side B&W
  colorTiers?: PageRangeTier[];      // Independent ranges for Colour
  tiers?: PriceTier[];      // Legacy range-based pricing tiers
  binding?: BindingPricing; // Fully customizable binding configuration
}

export interface Superuser {
  id: string;
  username: string;
  password: string;
  name?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MerchantCredentials {
  username: string;
  password: string;
  createdAt?: string;
}

export interface Client {
  id: string;
  slug?: string;
  shopName: string;
  storeName?: string;
  ownerName?: string;
  location: string;
  address?: string;
  deviceId: string;
  planType: PlanType;
  status: StatusType;
  isActive?: boolean;
  themeColor?: string;
  lastActive: string;
  iconType: 'storefront' | 'school' | 'print' | 'hub';
  history?: JobHistory[];
  reports?: ClientReport[];
  printers?: Printer[];
  phoneNumber?: string;
  phone?: string;
  email?: string;
  merchantCredentials?: MerchantCredentials;
  pricing?: VendorPricing;
  printingPrices?: PrintPrices;
  shopInfo?: string;
  customWebsiteName?: string;
}

export interface StatItem {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down';
}
