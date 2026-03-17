export type UserRole = 'admin' | 'staff' | 'parent' | 'driver' | 'teacher';

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  allowedTabs?: string[];
}

export interface StaffInvite {
  id?: string;
  name: string;
  phoneNumber: string;
  role: UserRole;
  allowedTabs: string[];
}

export interface Student {
  id: string;
  studentId?: string;
  name: string;
  photoUrl?: string;
  medicalInfo?: string;
  allergies: string[];
  balance: number;
  routeId?: string;
  parentId?: string;
  grade: string;
  section: string;
}

export interface Meal {
  id: string;
  name: string;
  category: string;
  items?: string;
  calories?: number;
  inventory?: number;
  available: boolean;
}

export interface Transaction {
  id: string;
  studentId: string;
  amount: number;
  type: 'credit' | 'debit';
  items: string[];
  timestamp: any;
  processedBy: string;
}

export interface Vehicle {
  id: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  currentLat?: number;
  currentLng?: number;
  lastUpdate?: any;
  gpsTrackerId?: string;
}

export interface Route {
  id: string;
  name: string;
  driverId?: string;
  vehicleId?: string;
  stops: { name: string; lat: number; lng: number }[];
}

export interface BoardingLog {
  id: string;
  studentId: string;
  routeId: string;
  vehicleId: string;
  type: 'boarding' | 'alighting';
  timestamp: any;
  location?: { lat: number; lng: number };
}

export interface MealPlan {
  id: string;
  day: string;
  mealName: string;
  mealId?: string;
}

export interface TransportAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  routeId: string;
  studentId: string;
  status: 'present' | 'absent';
  timestamp: any;
  markedBy: string;
}
