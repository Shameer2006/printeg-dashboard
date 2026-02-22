
import { Client } from './types';

const generateMockHistory = () => {
  const statuses = ['Completed', 'Failed'] as const;
  const paymentStatuses = ['Paid', 'Pending', 'Failed', 'Refunded'] as const;
  const printerNames = ['Main Hall Xerox', 'Reception Desk', 'Library Printer', 'Color Station'];

  return Array.from({ length: 5 }).map((_, i) => ({
    id: `J${Math.floor(Math.random() * 10000)}`,
    timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
    pages: Math.floor(Math.random() * 50) + 1,
    type: Math.random() > 0.7 ? 'Color' as const : 'B/W' as const,
    status: Math.random() > 0.8 ? 'Failed' as const : 'Completed' as const,
    userPhoneNumber: `+91 ${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    printerName: printerNames[Math.floor(Math.random() * printerNames.length)],
    paymentStatus: paymentStatuses[Math.floor(Math.random() * paymentStatuses.length)],
    cost: `₹${(Math.floor(Math.random() * 100) + 10).toFixed(2)}`,
    errorDetails: Math.random() > 0.8 ? 'Paper Jam' : undefined
  }));
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: '1',
    shopName: 'Danal Miter Prints',
    location: 'Kochi, Kerala',
    deviceId: '40922-8771720a',
    planType: 'Annual',
    status: 'active',
    lastActive: '2 mins ago',
    iconType: 'storefront',
    history: [
      { id: 'J1001', timestamp: '10 mins ago', pages: 15, type: 'B/W', cost: '₹15.00', status: 'Completed', printerName: 'Main Hall Xerox', paymentStatus: 'Pending', userPhoneNumber: '+91 9876543210' },
      { id: 'J1002', timestamp: '1 hour ago', pages: 5, type: 'Color', cost: '₹50.00', status: 'Completed', printerName: 'Reception Desk', paymentStatus: 'Paid', userPhoneNumber: '+91 9876543211' },
      { id: 'J1003', timestamp: 'Yesterday', pages: 30, type: 'B/W', cost: '₹30.00', status: 'Failed', printerName: 'Library Printer', paymentStatus: 'Failed', userPhoneNumber: '+91 9876543212', errorDetails: 'Paper Jam' },
      { id: 'J1004', timestamp: '2 days ago', pages: 10, type: 'B/W', cost: '₹10.00', status: 'Completed', printerName: 'Main Hall Xerox', paymentStatus: 'Refunded', userPhoneNumber: '+91 9876543213' }
    ],
    reports: [{ id: 'R1', issue: 'Paper jam in tray 2 persisting after restart.', timestamp: '10 mins ago', status: 'pending' }]
  },
  {
    id: '2',
    shopName: 'Sharin Duann Tech',
    location: 'Bangalore, KA',
    deviceId: '40202-87717236',
    planType: 'Monthly',
    status: 'active',
    lastActive: '15 mins ago',
    iconType: 'school',
    history: generateMockHistory(),
    reports: [{ id: 'R3', issue: 'Ink levels reporting 0% despite new cartridge.', timestamp: '5 hours ago', status: 'resolved' }]
  },
  {
    id: '3',
    shopName: 'Milal Tnndi Copiers',
    location: 'Mumbai, MH',
    deviceId: '40267-86911235',
    planType: 'Starter',
    status: 'expired',
    lastActive: '2 days ago',
    iconType: 'print',
    history: [],
    reports: [{ id: 'R2', issue: 'Cloud sync failed for last 3 jobs.', timestamp: '1 hour ago', status: 'pending' }]
  },
  {
    id: '4',
    shopName: 'Kavin Name Hub',
    location: 'Chennai, TN',
    deviceId: '40267-88911206',
    planType: 'Annual',
    status: 'active',
    lastActive: 'Just now',
    iconType: 'hub',
    history: generateMockHistory(),
    reports: []
  },
  {
    id: '5',
    shopName: 'Express Copy Center',
    location: 'Delhi, NCR',
    deviceId: '40311-99821101',
    planType: 'Monthly',
    status: 'active',
    lastActive: '1 hour ago',
    iconType: 'storefront',
    history: generateMockHistory(),
    reports: []
  },
  {
    id: '6',
    shopName: 'Academic Print Solutions',
    location: 'Pune, MH',
    deviceId: '40552-77122390',
    planType: 'Annual',
    status: 'expired',
    lastActive: '1 week ago',
    iconType: 'school',
    history: [],
    reports: []
  }
];
