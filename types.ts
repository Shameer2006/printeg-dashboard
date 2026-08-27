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

export interface VendorPricing {
  bw: number;          // B&W Single Sided (Xerox)
  doubleSided: number; // B&W Double Sided
  color: number;       // Color Print
  a4Sheet: number;     // Blank A4 Sheet
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
