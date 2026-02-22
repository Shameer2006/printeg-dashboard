
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

export interface Client {
  id: string;
  shopName: string;
  location: string;
  deviceId: string;
  planType: PlanType;
  status: StatusType;
  lastActive: string;
  iconType: 'storefront' | 'school' | 'print' | 'hub';
  history?: JobHistory[];
  reports?: ClientReport[];
  printers?: Printer[];
  phoneNumber?: string;
  email?: string;
}

export interface StatItem {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down';
}
