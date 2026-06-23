import React, { useState, useEffect, Component } from "react";
import {
  LayoutDashboard,
  Utensils,
  Bus,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu as MenuIcon,
  X,
  CreditCard,
  MapPin,
  ClipboardList,
  AlertCircle,
  TrendingUp,
  ChevronRight,
  BookOpen,
  Ticket,
  QrCode,
  School,
  Package,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { auth, db } from "./firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { StaffInvite, UserProfile, UserRole, AppNotification } from "./types";
import { MAIN_ADMIN_EMAIL } from "./constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

// Components
import StoreDashboard from "./components/StoreDashboard";
import TransportDashboard from "./components/TransportDashboard";
import AdminDashboard from "./components/AdminDashboard";
import LibraryDashboard from "./components/LibraryDashboard";
import GatePassDashboard from "./components/GatePassDashboard";
import { COUNTRY_CODES } from "./countryCodes";

// Firestore Error Handling
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  componentDidMount() {
    window.addEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );
    window.addEventListener("error", this.handleErrorEvent);
  }

  componentWillUnmount() {
    window.removeEventListener(
      "unhandledrejection",
      this.handleUnhandledRejection,
    );
    window.removeEventListener("error", this.handleErrorEvent);
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    this.setState({ hasError: true, error: event.reason });
  };

  handleErrorEvent = (event: ErrorEvent) => {
    event.preventDefault();
    this.setState({ hasError: true, error: event.error });
  };

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.error) errorMessage = `Firestore Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-white/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white/70 backdrop-blur-xl p-5 md:p-8 rounded-2xl md:rounded-[1.5rem] shadow-2xl shadow-gray-200/40 max-w-md w-full border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-[1rem] flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 mb-2">
              Application Error
            </h2>
            <p className="text-gray-500 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20 text-white border-none text-white rounded-xl font-bold hover:from-slate-800 hover:to-slate-950 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [impersonatingProfile, setImpersonatingProfile] =
    useState<UserProfile | null>(null);
  const activeProfile = impersonatingProfile || profile;

  const [activeTab, setActiveTab] = useState("dashboard");
  const [adminAction, setAdminAction] = useState<
    "add_student" | "add_teacher" | "add_staff" | "add_parent" | null
  >(null);
  const [initialVerifyId, setInitialVerifyId] = useState<string | null>(null);

  const [isQuickScanning, setIsQuickScanning] = useState(false);

  useEffect(() => {
    if (activeTab !== "gatepass") {
      setIsQuickScanning(false);
    }
  }, [activeTab]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);

  // Handle resize for sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [loading, setLoading] = useState(true);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    COUNTRY_CODES[0],
  );
  const [isPhoneLogin, setIsPhoneLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const isMainAdmin = profile?.email === MAIN_ADMIN_EMAIL;
  const trueIsAdmin = isMainAdmin || profile?.role === "admin";
  const isAdmin =
    activeProfile?.role === "admin" || (isMainAdmin && !impersonatingProfile);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "app_notifications"),
      orderBy("createdAt", "desc"),
      limit(50),
    );
    const unsubscribeNotifications = onSnapshot(q, (snapshot) => {
      setNotifications(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as AppNotification,
        ),
      );
    });
    return () => unsubscribeNotifications();
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get("verify");
    if (
      verifyId &&
      profile &&
      (isAdmin || profile.role === "teacher" || profile.role === "staff")
    ) {
      setInitialVerifyId(verifyId);
      setActiveTab("gatepass");
    }
  }, [profile, isAdmin]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            let data = docSnap.data() as UserProfile;

            // Force admin role for the main admin email
            if (
              firebaseUser.email === MAIN_ADMIN_EMAIL &&
              (data.role !== "admin" || data.allowedTabs?.length !== 7)
            ) {
              const updatedProfile = {
                ...data,
                role: "admin" as UserRole,
                allowedTabs: [
                  "dashboard",
                  "gatepass",
                  "store",
                  "transport",
                  "library",
                  "admin",
                  "settings",
                ],
              };
              await setDoc(docRef, updatedProfile);
              data = updatedProfile;
            }

            setProfile(data);
          } else if (!firebaseUser.isAnonymous) {
            // Create default profile for new Google users
            const isNewUserMainAdmin = firebaseUser.email === MAIN_ADMIN_EMAIL;
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "User",
              role: isNewUserMainAdmin ? "admin" : "staff",
              createdAt: new Date().toISOString(),
              allowedTabs: isNewUserMainAdmin
                ? [
                    "dashboard",
                    "gatepass",
                    "store",
                    "transport",
                    "library",
                    "admin",
                    "settings",
                  ]
                : ["dashboard"],
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error: any) {
          console.error("Error fetching user profile:", error);
          if (
            error.message?.includes("client is offline") ||
            error.code === "unavailable"
          ) {
            error.message =
              "Could not connect to Firestore. Please ensure the database 'ai-studio-991b43cf-8da1-495f-b24f-89722babf104' exists in your Firebase project 'gen-lang-client-0945475485' and that you have accepted the Firebase terms in the setup UI.";
          }
          handleFirestoreError(
            error,
            OperationType.GET,
            `users/${firebaseUser.uid}`,
          );
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    setLoginError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === "auth/admin-restricted-operation") {
        setLoginError(
          'Sign-ups are disabled. Please enable "Enable create (sign-up)" in Firebase Authentication settings.',
        );
      } else if (error.code === "auth/operation-not-allowed") {
        setLoginError(
          "Google sign-in is not enabled. Please enable it in Firebase Authentication settings.",
        );
      } else if (error.code === "auth/network-request-failed") {
        setLoginError(
          "Network request failed. This is often caused by ad blockers, privacy extensions (like Brave Shields), or blocked third-party cookies. Please disable them and try again.",
        );
      } else if (
        error.message?.includes("NTERNAL ASSERTION FAILED") ||
        error.message?.includes("INTERNAL ASSERTION FAILED")
      ) {
        setLoginError(
          "Login popup was closed or blocked. Please try again and ensure popups are allowed.",
        );
      } else {
        setLoginError(error.message || "Login failed. Please try again.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (!phoneNumber) {
      setLoginError("Please enter a phone number.");
      return;
    }

    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setLoading(true);
    try {
      // 1. Sign in anonymously to get read access
      const userCred = await signInAnonymously(auth);

      const cleanPhone = phoneNumber.replace(/^[+0]+/, "");
      const fullPhone = `${selectedCountryCode.code}${cleanPhone}`;

      // 2. Check if phone number exists in staff_invites
      let inviteDoc = await getDoc(doc(db, "staff_invites", fullPhone));
      let matchedPhone = fullPhone;

      if (!inviteDoc.exists()) {
        inviteDoc = await getDoc(doc(db, "staff_invites", phoneNumber));
        matchedPhone = phoneNumber;
      }

      if (!inviteDoc.exists()) {
        // Not found, sign out and show error
        await signOut(auth);
        setLoginError("Phone number not registered.");
        setLoading(false);
        setIsLoggingIn(false);
        return;
      }

      const invite = inviteDoc.data() as StaffInvite;

      // 3. If this phone number already has a profile (e.g. an admin already
      // assigned/updated its role), reuse that role instead of the invite's
      // original role so re-logins don't reset previously granted permissions.
      const existingUsersSnap = await getDocs(
        query(collection(db, "users"), where("phoneNumber", "==", matchedPhone)),
      );
      const existingProfile = existingUsersSnap.docs[0]?.data() as
        | UserProfile
        | undefined;

      const newProfile: UserProfile = {
        uid: userCred.user.uid,
        phoneNumber: matchedPhone,
        displayName: existingProfile?.displayName || invite.name,
        role: existingProfile?.role || invite.role,
        allowedTabs: existingProfile?.allowedTabs || invite.allowedTabs,
        createdAt: existingProfile?.createdAt || new Date().toISOString(),
      };

      // 4. Remove any stale duplicate profile(s) for this phone number so the
      // user doesn't show up twice with conflicting permissions.
      await Promise.all(
        existingUsersSnap.docs.map((d) => deleteDoc(d.ref)),
      );

      // 5. Create/replace the user profile
      await setDoc(doc(db, "users", userCred.user.uid), newProfile);

      // 6. Update local state
      setProfile(newProfile);
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/admin-restricted-operation") {
        setLoginError(
          'Sign-ups are disabled. Please enable "Enable create (sign-up)" in Firebase Authentication settings.',
        );
      } else if (error.code === "auth/operation-not-allowed") {
        setLoginError(
          "Anonymous auth is not enabled. Please enable it in Firebase Authentication settings.",
        );
      } else if (error.code === "auth/network-request-failed") {
        setLoginError(
          "Network request failed. This is often caused by ad blockers, privacy extensions (like Brave Shields), or blocked third-party cookies. Please disable them and try again.",
        );
      } else {
        setLoginError("Login failed. Please try again.");
      }
      await signOut(auth);
      setLoading(false);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setActiveTab("dashboard");
    signOut(auth);
  };

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row bg-[#F8FAFC]">
        {/* Left Panel */}
        <div className="hidden md:flex flex-col justify-between w-full md:w-[45%] lg:w-2/5 bg-[#1F8649] text-white p-12 relative overflow-hidden h-screen rounded-r-[2.5rem] shadow-2xl shadow-green-900/20 z-10">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#16A34A] rounded-full blur-[100px] opacity-40 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#0E6C34] rounded-full blur-[100px] opacity-40 translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

          <div className="relative z-10 pt-4">
            <div className="flex items-center gap-4 mb-24">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-xl shadow-gray-200/50 border border-white/20">
                <School className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-xl leading-tight font-sans tracking-tight">
                  DPS CRM
                </h2>
                <p className="text-emerald-100 text-sm font-medium">
                  Store & Transport
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <h1 className="text-[3rem] lg:text-[3.5rem] font-extrabold mb-6 leading-[1.05] tracking-tight text-white drop-shadow-xl shadow-gray-200/50 font-sans">
                Manage campus
                <br />
                operations, effortlessly.
              </h1>
              <p className="text-emerald-50 text-lg leading-relaxed mb-12 font-medium opacity-90 max-w-sm">
                One platform for gate passes, stores, transport, and library
                management — built for administrators and parents.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4 relative z-10 w-full max-w-[420px] pb-8">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-2">Welcome Back</h3>
              <p className="text-emerald-50 text-sm font-medium opacity-90 leading-relaxed">
                Log in to securely manage daily operations, track student
                activity, and oversee campus facilities in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6 lg:p-12 relative min-h-screen overflow-y-auto">
          <div className="max-w-[440px] w-full mx-auto py-8">
            <div className="bg-white/90 md:bg-white/70 backdrop-blur-xl rounded-3xl md:rounded-[2rem] shadow-2xl shadow-gray-200/50 p-6 sm:p-10 border border-white/80">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 md:hidden">
                  <School className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-[2rem] font-bold text-gray-900 mb-3 font-sans tracking-tight leading-tight">
                  Welcome back
                </h2>
                <p className="text-sm sm:text-base text-gray-500 font-medium">
                  Sign in to access your portal
                </p>
              </div>

              <div className="space-y-6">
                {loginError && (
                  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100 flex items-center text-left">
                    <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                    {loginError}
                  </div>
                )}

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full h-[3.5rem] bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20 text-white border-none text-white rounded-xl font-semibold hover:from-slate-800 hover:to-slate-950 hover:shadow-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-base outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-50"
                >
                  <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center shrink-0">
                    <img
                      src="https://www.google.com/favicon.ico"
                      className="w-[14px] h-[14px]"
                      alt="Google"
                    />
                  </div>
                  {isLoggingIn ? "Signing in..." : "Continue with Google"}
                </button>

                <div className="relative flex items-center justify-center py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/60"></div>
                  </div>
                  <div className="relative bg-white px-4 text-[13px] font-bold text-gray-400 uppercase tracking-widest">
                    Or
                  </div>
                </div>

                <div className="text-left space-y-4">
                  <label className="block text-sm font-bold text-gray-700">
                    Staff Login via Phone
                  </label>

                  <form onSubmit={handlePhoneLogin} className="space-y-4">
                    <div className="flex gap-0 overflow-hidden rounded-xl border border-white/60 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all bg-white shadow-xl shadow-gray-200/50">
                      <div className="relative flex items-center bg-white/50 border-r border-gray-100 shrink-0 group">
                        <select
                          className="appearance-none bg-transparent outline-none cursor-pointer pl-[2.25rem] pr-5 py-3 sm:py-3.5 text-gray-700 font-bold text-sm sm:text-base w-[95px] sm:w-[105px] z-10 relative"
                          value={selectedCountryCode.code}
                          onChange={(e) => {
                            const selected = COUNTRY_CODES.find(
                              (c) => c.code === e.target.value,
                            );
                            if (selected) setSelectedCountryCode(selected);
                          }}
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option
                              key={`${c.code}-${c.country}`}
                              value={c.code}
                            >
                              {c.name} {c.code}
                            </option>
                          ))}
                        </select>
                        <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 z-0">
                          <img
                            src={`https://flagcdn.com/w20/${selectedCountryCode.country.toLowerCase()}.png`}
                            alt={selectedCountryCode.name}
                            className="w-4 sm:w-5 rounded-[2px]"
                          />
                        </div>
                        <div className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 z-0 text-gray-500">
                          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 rotate-90" />
                        </div>
                      </div>
                      <input
                        type="tel"
                        placeholder="Mobile number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="flex-1 min-w-0 px-3 sm:px-4 py-3 sm:py-3.5 outline-none text-gray-900 font-medium placeholder-gray-400 bg-transparent text-sm sm:text-base"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full h-[3.5rem] bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                    >
                      Login <span className="font-serif">→</span>
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-8 text-center border-t border-white/80 pt-6">
                <p className="text-sm text-gray-400 font-medium">
                  Need access?{" "}
                  <a
                    href="#"
                    className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors"
                  >
                    Contact Administrator
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "gatepass", label: "Gate Pass", icon: Ticket },
    { id: "library", label: "Library", icon: BookOpen },
    { id: "store", label: "Store", icon: Package },
    { id: "transport", label: "Transport", icon: Bus },
    { id: "admin", label: "Management", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ].filter((item) => {
    if (profile?.role === "admin") return true;
    return profile?.allowedTabs?.includes(item.id);
  });

  return (
    <div className="h-screen bg-[#F8FAFC] flex relative overflow-hidden">
      {/* Vibrant Background Mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-400/10 rounded-full blur-[120px] mix-blend-multiply"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[800px] h-[800px] bg-emerald-400/15 rounded-full blur-[120px] mix-blend-multiply"></div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className={`bg-white/70 backdrop-blur-3xl border-r border-white/60 flex flex-col z-50 fixed lg:sticky top-0 h-screen transition-transform duration-300 shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div
                key="logo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden border border-white/60 shadow-2xl shadow-gray-200/50 bg-white">
                  <img
                    src="https://dpsbiratnagar.edu.np/wp-content/uploads/2026/03/dps-logo-high-scaled.png"
                    alt="DPS Logo"
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <span className="font-bold text-xl tracking-tight">
                  DPS CRM
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto overflow-hidden border border-white/60 shadow-2xl shadow-gray-200/50 bg-white"
              >
                <img
                  src="https://dpsbiratnagar.edu.np/wp-content/uploads/2026/03/dps-logo-high-scaled.png"
                  alt="DPS Logo"
                  className="w-full h-full object-contain p-1"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            if (!isAdmin && !profile?.allowedTabs?.includes(item.id))
              return null;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 p-3.5 rounded-[1.25rem] transition-all group ${
                  isActive
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25"
                    : "text-gray-500 hover:bg-white/50 hover:text-gray-900"
                }`}
              >
                <item.icon
                  className={`w-[22px] h-[22px] transition-transform ${isActive ? "text-white" : "group-hover:scale-110"}`}
                />
                {isSidebarOpen && <span>{item.label}</span>}
                {isActive && isSidebarOpen && (
                  <motion.div
                    layoutId="active-pill"
                    className="ml-auto w-1.5 h-6 bg-white rounded-full shadow-sm"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/60">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-3 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-[1rem] transition-all"
          >
            <LogOut className="w-6 h-6" />
            {isSidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative z-10 h-screen overflow-y-auto">
        {impersonatingProfile && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
            <div className="flex items-center gap-2 text-amber-800">
              <UserPlus className="w-5 h-5" />
              <span className="text-sm font-bold">
                You are currently impersonating{" "}
                {impersonatingProfile.displayName || impersonatingProfile.email}
              </span>
            </div>
            <button
              onClick={() => {
                setImpersonatingProfile(null);
                setActiveTab("admin");
              }}
              className="px-4 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-bold transition-colors"
            >
              Stop Impersonating
            </button>
          </div>
        )}
        <header
          className={`h-16 md:h-24 bg-white/40 backdrop-blur-3xl border-b border-white/60 px-4 md:px-8 flex items-center justify-between sticky ${impersonatingProfile ? "top-[52px]" : "top-0"} z-40`}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 bg-white/60 hover:bg-white shadow-sm rounded-xl lg:hidden transition-all"
            >
              <MenuIcon className="w-5 h-5 text-gray-700" />
            </button>
            <div className="relative hidden md:block group">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text"
                placeholder="Search students, routes..."
                className="pl-11 pr-4 py-3 bg-white/60 backdrop-blur-sm shadow-sm border border-white/60 rounded-xl w-64 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all outline-none text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-6">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all"
              >
                <Bell className="w-6 h-6" />
                {notifications.filter(
                  (n) => !n.readBy?.includes(user?.uid || ""),
                ).length > 0 && (
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-80 bg-white rounded-2xl md:rounded-[1.5rem] shadow-2xl shadow-gray-200/40 border border-white/60 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-white/60 flex justify-between items-center bg-white/60 backdrop-blur-md/50">
                      <h3 className="font-semibold text-gray-900">
                        Notifications
                      </h3>
                      <button
                        onClick={async () => {
                          const unreadNodes = notifications.filter(
                            (n) => !n.readBy?.includes(user?.uid || ""),
                          );
                          for (const node of unreadNodes) {
                            try {
                              await updateDoc(
                                doc(db, "app_notifications", node.id),
                                {
                                  readBy: [...(node.readBy || []), user?.uid],
                                },
                              );
                            } catch (e) {}
                          }
                        }}
                        className="text-xs text-emerald-600 font-medium hover:text-emerald-700"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100/80">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">
                          No notifications yet.
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const isUnread = !notif.readBy?.includes(
                            user?.uid || "",
                          );
                          const timeAgo = notif.createdAt?.seconds
                            ? Math.floor(
                                (Date.now() / 1000 - notif.createdAt.seconds) /
                                  60,
                              )
                            : 0;

                          let timeString = "Just now";
                          if (timeAgo > 60 * 24)
                            timeString = `${Math.floor(timeAgo / (60 * 24))}d ago`;
                          else if (timeAgo > 60)
                            timeString = `${Math.floor(timeAgo / 60)}h ago`;
                          else if (timeAgo > 0) timeString = `${timeAgo}m ago`;

                          return (
                            <div
                              key={notif.id}
                              className={`p-4 transition-colors cursor-pointer ${isUnread ? "bg-emerald-50/30" : "hover:bg-white/60 backdrop-blur-md"}`}
                              onClick={async () => {
                                if (isUnread) {
                                  try {
                                    await updateDoc(
                                      doc(db, "app_notifications", notif.id),
                                      {
                                        readBy: [
                                          ...(notif.readBy || []),
                                          user?.uid,
                                        ],
                                      },
                                    );
                                  } catch (e) {}
                                }
                              }}
                            >
                              <div className="flex gap-3">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    notif.type === "success"
                                      ? "bg-emerald-100"
                                      : notif.type === "warning"
                                        ? "bg-amber-100"
                                        : notif.type === "error"
                                          ? "bg-red-100"
                                          : "bg-blue-100"
                                  }`}
                                >
                                  <Bell
                                    className={`w-5 h-5 ${
                                      notif.type === "success"
                                        ? "text-emerald-600"
                                        : notif.type === "warning"
                                          ? "text-amber-600"
                                          : notif.type === "error"
                                            ? "text-red-600"
                                            : "text-blue-600"
                                    }`}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-start gap-2">
                                    <p
                                      className={`text-sm font-medium truncate ${isUnread ? "text-gray-900" : "text-gray-700"}`}
                                    >
                                      {notif.title}
                                    </p>
                                    {isUnread && (
                                      <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
                                    {notif.message}
                                  </p>
                                  <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                    {timeString}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-white/60">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-gray-900">
                  {activeProfile?.displayName}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {activeProfile?.role}
                </p>
              </div>
              <img
                src={
                  activeProfile === profile && user.photoURL
                    ? user.photoURL
                    : `https://ui-avatars.com/api/?name=${activeProfile?.displayName}`
                }
                className="w-10 h-10 rounded-xl border border-white/60"
                alt="Profile"
              />
            </div>
          </div>
        </header>

        <div className="p-4 md:p-5 md:p-8 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "dashboard" && (
                <DashboardOverview
                  profile={activeProfile}
                  isAdmin={isAdmin}
                  setActiveTab={setActiveTab}
                  setAdminAction={setAdminAction}
                  setIsQuickScanning={setIsQuickScanning}
                />
              )}
              {activeTab === "gatepass" && (
                <GatePassDashboard
                  profile={activeProfile}
                  isAdmin={isAdmin}
                  initialScan={isQuickScanning}
                  verifyId={initialVerifyId}
                />
              )}
              {activeTab === "store" && (
                <StoreDashboard profile={activeProfile} isAdmin={isAdmin} />
              )}
              {activeTab === "transport" && (
                <TransportDashboard profile={activeProfile} isAdmin={isAdmin} />
              )}
              {activeTab === "library" && (
                <LibraryDashboard profile={activeProfile} isAdmin={isAdmin} />
              )}
              {activeTab === "admin" && (
                <AdminDashboard
                  profile={activeProfile}
                  isAdmin={isAdmin}
                  isMainAdmin={trueIsAdmin}
                  initialAction={adminAction}
                  onActionComplete={() => setAdminAction(null)}
                  onImpersonate={(p: UserProfile) => {
                    setImpersonatingProfile(p);
                    setActiveTab("dashboard");
                  }}
                />
              )}
              {activeTab === "settings" && (
                <SettingsView profile={activeProfile} isAdmin={isAdmin} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function DashboardOverview({
  profile,
  isAdmin,
  setActiveTab,
  setAdminAction,
  setIsQuickScanning,
}: {
  profile: UserProfile | null;
  isAdmin: boolean;
  setActiveTab: (tab: string) => void;
  setAdminAction: (
    action: "add_student" | "add_teacher" | "add_staff" | "add_parent" | null,
  ) => void;
  setIsQuickScanning?: (scan: boolean) => void;
}) {
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeBuses: 0,
    storeProductsCount: 0,
    activeGatePasses: 0,
  });

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
      if (profile.role !== "admin" && profile.role !== "staff") {
        return;
      }
      try {
        const studentsSnap = await getDocs(collection(db, "students"));
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        const gatePassesSnap = await getDocs(collection(db, "gate_passes"));

        const productsSnap = await getDocs(collection(db, "store_products"));

        setStats({
          totalStudents: studentsSnap.size,
          activeBuses: vehiclesSnap.size,
          storeProductsCount: productsSnap.size,
          activeGatePasses: gatePassesSnap.docs.filter(
            (d) => d.data().status === "active",
          ).length,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        // Don't throw to error boundary for stats
      }
    };

    fetchStats();
  }, [profile]);

  const [isDownloading, setIsDownloading] = useState(false);
  const [showQuickAction, setShowQuickAction] = useState(false);

  const handleDownloadReport = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const xlsx = await import("xlsx");

      const collections = [
        "students",
        "users",
        "vehicles",
        "routes",
        "meals",
        "transactions",
        "boarding_logs",
        "transport_attendance",
      ];
      const workbook = xlsx.utils.book_new();

      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        const data = snap.docs.map((doc) => {
          const docData = doc.data();
          // Convert complex objects/arrays to strings for excel
          Object.keys(docData).forEach((key) => {
            if (typeof docData[key] === "object" && docData[key] !== null) {
              if (docData[key].toDate) {
                docData[key] = docData[key].toDate().toLocaleString();
              } else {
                docData[key] = JSON.stringify(docData[key]);
              }
            }
          });
          return { id: doc.id, ...docData };
        });

        const worksheet = xlsx.utils.json_to_sheet(
          data.length > 0 ? data : [{ message: "No data" }],
        );
        xlsx.utils.book_append_sheet(
          workbook,
          worksheet,
          colName.substring(0, 31),
        ); // Excel sheet names max 31 chars
      }

      const today = new Date().toISOString().split("T")[0];
      xlsx.writeFile(workbook, `DPS_CRM_Report_${today}.xlsx`);
    } catch (error) {
      console.error("Error downloading report:", error);
      alert("Failed to download report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[2.25rem] font-extrabold tracking-tight text-gray-900">
            Welcome back, {profile?.displayName.split(" ")[0]}!
          </h2>
          <p className="text-gray-500 mt-1">
            Here's what's happening across campus today.
          </p>
        </div>
        <div className="flex gap-3 relative">
          <button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="px-4 py-2 bg-white border border-white/60 rounded-xl text-sm font-medium hover:bg-white/60 backdrop-blur-md transition-all disabled:opacity-50"
          >
            {isDownloading ? "Downloading..." : "Download Report"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowQuickAction(!showQuickAction)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-lg shadow-emerald-100"
            >
              Quick Action
            </button>

            <AnimatePresence>
              {showQuickAction && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-2xl md:rounded-[1.5rem] shadow-2xl shadow-gray-200/40 border border-white/60 overflow-hidden z-50"
                >
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_student");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-white/60 backdrop-blur-md rounded-xl transition-all"
                    >
                      Add Student
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_teacher");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-white/60 backdrop-blur-md rounded-xl transition-all"
                    >
                      Add Teacher
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_staff");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-white/60 backdrop-blur-md rounded-xl transition-all"
                    >
                      Add Staff
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_parent");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-white/60 backdrop-blur-md rounded-xl transition-all"
                    >
                      Add Parent
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 w-full mb-4">
        {[
          {
            label: "Total Students",
            value: stats.totalStudents,
            icon: Users,
            color: "from-blue-400 to-indigo-500",
            bg: "bg-blue-50/50",
            trend: "Registered",
          },
          {
            label: "Active Buses",
            value: stats.activeBuses,
            icon: Bus,
            color: "from-emerald-400 to-teal-500",
            bg: "bg-emerald-50/50",
            trend: "Fleet",
          },
          {
            label: "Gate Passes",
            value: stats.activeGatePasses,
            icon: Ticket,
            color: "from-orange-400 to-rose-400",
            bg: "bg-orange-50/50",
            trend: "Active",
          },
          {
            label: "Store Items",
            value: stats.storeProductsCount,
            icon: Package,
            color: "from-violet-400 to-purple-500",
            bg: "bg-violet-50/50",
            trend: "Active",
          },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}
            className="group relative overflow-hidden bg-white/70 backdrop-blur-2xl p-5 md:p-8 rounded-3xl md:rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1 cursor-default"
          >
            <div
              className={`absolute -right-4 -top-4 w-32 h-32 bg-gradient-to-br ${stat.color} rounded-full blur-[40px] opacity-20 group-hover:opacity-30 transition-opacity`}
            ></div>
            <div className="relative z-10 flex items-center justify-between mb-6">
              <div
                className={`bg-gradient-to-br ${stat.color} p-4 rounded-2xl text-white shadow-lg`}
              >
                <stat.icon className="w-6 h-6" />
              </div>
              <span
                className={`text-xs font-bold px-3 py-1.5 rounded-full ${stat.bg} border border-white/60 text-gray-600 shadow-sm`}
              >
                {stat.trend}
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-wider">
                {stat.label}
              </p>
              <h3 className="text-[2.25rem] font-extrabold tracking-tight text-gray-900 leading-none">
                {stat.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Visual Dashboards */}
      <div className="bg-white/70 backdrop-blur-xl p-5 md:p-8 rounded-3xl md:rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50">
        <h3 className="text-[1.35rem] font-extrabold tracking-tight text-gray-900 mb-6">
          System Overview
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                {
                  name: "Students",
                  count: stats.totalStudents,
                  fill: "#3b82f6",
                },
                {
                  name: "Active Buses",
                  count: stats.activeBuses,
                  fill: "#10b981",
                },
                {
                  name: "Gate Passes",
                  count: stats.activeGatePasses,
                  fill: "#f97316",
                },
                {
                  name: "Store Items",
                  count: stats.storeProductsCount,
                  fill: "#6366f1",
                },
              ]}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E5E7EB"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#6B7280", fontSize: 12 }}
              />
              <RechartsTooltip
                cursor={{ fill: "#F3F4F6" }}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:p-8">
        {/* Fleet Status Card */}
        <div className="lg:col-span-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none rounded-2xl md:rounded-[1.5rem] p-5 md:p-8 text-white shadow-2xl shadow-gray-200/40 relative overflow-hidden">
          <div className="relative z-10 max-w-md">
            <h3 className="text-2xl font-extrabold tracking-tight mb-3">
              Fleet Status Overview
            </h3>
            <p className="text-emerald-100 text-lg mb-6">
              Total {stats.activeBuses} buses are currently registered and
              operational in the system.
            </p>
            <button
              onClick={() => setActiveTab("transport")}
              className="px-8 py-3 bg-white text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition-all"
            >
              Open Live Map
            </button>
          </div>
          <Bus className="absolute -right-8 -bottom-8 w-64 h-64 text-emerald-500/20 rotate-12" />
        </div>

        {/* Quick Actions - Restricted to Admin */}
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20 text-white border-none rounded-2xl md:rounded-[1.5rem] p-6 text-white shadow-2xl shadow-gray-200/40">
            <h3 className="font-bold text-lg mb-4">Management Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Add Student",
                  icon: Users,
                  adminOnly: true,
                  tab: "admin",
                },
                {
                  label: "Scan Student ID",
                  icon: QrCode,
                  tab: "gatepass",
                  quickScan: true,
                },
                { label: "Add Product", icon: Package, tab: "store" },
                { label: "Purchase Entry", icon: ShoppingCart, tab: "store" },
              ].map((action, i) => {
                const isDisabled = action.adminOnly && !isAdmin;
                return (
                  <button
                    key={i}
                    disabled={isDisabled}
                    onClick={() => {
                      if (action.quickScan) setIsQuickScanning?.(true);
                      setActiveTab(action.tab);
                    }}
                    className={`flex flex-col items-center justify-center p-4 rounded-[1rem] transition-all gap-2 ${
                      isDisabled
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-white/10 hover:bg-white/20 text-white"
                    }`}
                  >
                    <action.icon className="w-6 h-6" />
                    <span className="text-xs font-medium">{action.label}</span>
                    {action.adminOnly && !isDisabled && (
                      <span className="text-[8px] uppercase font-bold text-emerald-400">
                        Admin
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsView({
  profile,
  isAdmin,
}: {
  profile: UserProfile | null;
  isAdmin: boolean;
}) {
  const [smsEndpoint, setSmsEndpoint] = useState(""); // Stores campaign ID
  const [smsApiKey, setSmsApiKey] = useState(""); // Stores API Key
  const [smsSenderId, setSmsSenderId] = useState(""); // Stores Sender ID
  const [smsRouteId, setSmsRouteId] = useState(""); // Stores Route ID
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "sms"));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSmsEndpoint(data.endpoint || "");
          setSmsApiKey(data.apiKey || "");
          setSmsSenderId(data.senderId || "");
          setSmsRouteId(data.routeId || "");
        }
      } catch (e) {
        console.error("Failed to fetch settings:", e);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "sms"),
        {
          endpoint: smsEndpoint,
          apiKey: smsApiKey,
          senderId: smsSenderId,
          routeId: smsRouteId,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      alert("Settings saved successfully!");
    } catch (e) {
      console.error("Failed to save settings:", e);
      alert("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-[2.25rem] font-extrabold tracking-tight text-gray-900 mb-8">
        Settings
      </h2>
      <div className="bg-white/70 backdrop-blur-xl rounded-3xl md:rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50 divide-y divide-[#E2E8F0]">
        <div className="p-6">
          <h3 className="font-bold text-gray-900 mb-4">Profile Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Display Name
              </label>
              <input
                type="text"
                defaultValue={profile?.displayName}
                className="w-full p-3 bg-white/60 backdrop-blur-md border-none rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                defaultValue={profile?.email}
                disabled
                className="w-full p-3 bg-gray-100 border-none rounded-xl text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>
        </div>
        <div className="p-6">
          <h3 className="font-bold text-gray-900 mb-4">Notifications</h3>
          <div className="space-y-4">
            {[
              { label: "Email Alerts", desc: "Receive daily summary reports" },
              {
                label: "Push Notifications",
                desc: "Real-time alerts for bus delays",
              },
              {
                label: "Low Balance WhatsApp",
                desc: "Automated alerts for student accounts",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <div className="w-12 h-6 bg-emerald-500 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-2xl shadow-gray-200/50"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-6">
          <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
            SMS Gate Pass Integration
            <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              SMS Pasal API
            </span>
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Configure your SMS Pasal credentials to send notifications when gate
            passes are issued.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                API Key
              </label>
              <input
                type="text"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="e.g., 26A056A31B21AA"
                className="w-full p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                Sender ID
              </label>
              <input
                type="text"
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
                placeholder="Any Approved Sender ID"
                className="w-full p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-300 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Campaign ID
                </label>
                <input
                  type="text"
                  value={smsEndpoint}
                  onChange={(e) => setSmsEndpoint(e.target.value)}
                  placeholder="e.g., 9550"
                  className="w-full p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Route ID
                </label>
                <input
                  type="text"
                  value={smsRouteId}
                  onChange={(e) => setSmsRouteId(e.target.value)}
                  placeholder="e.g., 10259"
                  className="w-full p-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-gray-300 text-sm"
                />
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-[1rem] border border-amber-100">
              <p className="text-sm text-amber-800 font-bold mb-2">
                API Configuration Saved Securely
              </p>
              <p className="text-xs text-amber-900 mb-2 font-medium">
                SMS Pasal will be used to send automated messages to parents
                upon successful verification of the gate pass.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
