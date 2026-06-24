export type UserRole =
  | "admin"
  | "staff"
  | "parent"
  | "driver"
  | "teacher"
  | "librarian";

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

export interface Book {
  id: string;
  bookCode: string;
  title: string;
  author?: string;
  category?: string;
  totalCopies: number;
  availableCopies: number;
  addedBy: string;
  createdAt: any;
  bookClass?: string;
  price?: number;
}

export interface BookIssue {
  id: string;
  bookId: string;
  bookCode: string;
  bookTitle: string;
  issuedToId: string; // studentId or teacherId
  issuedToName: string;
  issuedToType: "student" | "teacher";
  issueDate: any;
  dueDate: any;
  returnDate?: any;
  status: "issued" | "returned" | "overdue";
  issuedBy: string;
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
  phoneNumber?: string;
  fatherName?: string;
  fatherPhotoUrl?: string;
  motherName?: string;
  motherPhotoUrl?: string;
  driverName?: string;
  driverPhotoUrl?: string;
  otherName?: string;
  otherPhotoUrl?: string;
  familyId?: string;
}

export interface StoreProduct {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  currentStock: number;
  unit: string;
  price?: number;
}

export interface StorePurchase {
  id: string;
  type: "in" | "out" | "purchase";
  category: "Store" | "Canteen";
  productName: string;
  quantity: number;
  costPrice?: number;
  totalCost?: number;
  supplier?: string;
  billNumber?: string;
  purchaseDate: any;
  recordedBy: string;
}

export interface StoreUnusedItem {
  id: string;
  productName: string;
  note?: string;
  addedAt: string;
  addedBy: string;
}

// Keeping Transaction if it's used elsewhere, but we might not need Meal anymore

export interface StoreSupplier {
  id: string;
  name: string;
}

export interface Transaction {
  id: string;
  studentId: string;
  amount: number;
  type: "credit" | "debit";
  items: string[];
  timestamp: any;
  processedBy: string;
}

export interface Vehicle {
  id: string;
  busNumber: string;
  plateNumber: string;
  capacity: number;
  status: "active" | "maintenance" | "inactive";
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
  type: "boarding" | "alighting";
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
  status: "present" | "absent";
  timestamp: any;
  markedBy: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: any;
  readBy: string[];
}

export interface GatePass {
  id: string;
  studentId: string;
  studentName: string;
  reason: string;
  departureTime: any;
  arrivalTime?: any;
  status: "active" | "returned" | "cancelled";
  authorizedBy: string;
  createdAt: any;
}
