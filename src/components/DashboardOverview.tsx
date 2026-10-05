import React, { useState, useEffect } from "react";
import {
  Bus,
  Users,
  Ticket,
  Package,
  QrCode,
  ShoppingCart,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "../types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardOverviewProps {
  profile: UserProfile | null;
  isAdmin: boolean;
  setActiveTab: (tab: string) => void;
  setAdminAction: (
    action: "add_student" | "add_teacher" | "add_staff" | "add_parent" | null,
  ) => void;
  setIsQuickScanning?: (scan: boolean) => void;
}

export default function DashboardOverview({
  profile,
  isAdmin,
  setActiveTab,
  setAdminAction,
  setIsQuickScanning,
}: DashboardOverviewProps) {
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
        // Use server-side count aggregation instead of downloading every
        // document just to read snapshot.size
        const [studentsCount, vehiclesCount, activeGatePassesCount, productsCount] =
          await Promise.all([
            getCountFromServer(collection(db, "students")),
            getCountFromServer(collection(db, "vehicles")),
            getCountFromServer(
              query(collection(db, "gate_passes"), where("status", "==", "active")),
            ),
            getCountFromServer(collection(db, "store_products")),
          ]);

        setStats({
          totalStudents: studentsCount.data().count,
          activeBuses: vehiclesCount.data().count,
          storeProductsCount: productsCount.data().count,
          activeGatePasses: activeGatePassesCount.data().count,
        });
      } catch (error) {
        console.error("Failed to fetch stats:", error);
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
    <div className="space-y-6 sm:space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-[2.25rem] font-extrabold tracking-tight text-gray-900">
            Welcome back, {profile?.displayName.split(" ")[0]}!
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-1">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10 w-full mb-4">
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
            className="group relative overflow-hidden bg-white/70 backdrop-blur-2xl p-4 sm:p-5 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1 cursor-default"
          >
            <div
              className={`absolute -right-4 -top-4 w-32 h-32 bg-gradient-to-br ${stat.color} rounded-full blur-[40px] opacity-20 group-hover:opacity-30 transition-opacity`}
            ></div>
            <div className="relative z-10 flex items-center justify-between mb-4 sm:mb-6">
              <div
                className={`bg-gradient-to-br ${stat.color} p-3 sm:p-4 rounded-2xl text-white shadow-lg`}
              >
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
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
              <h3 className="text-2xl sm:text-[2.25rem] font-extrabold tracking-tight text-gray-900 leading-none">
                {stat.value}
              </h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Visual Dashboards */}
      <div className="bg-white/70 backdrop-blur-xl p-4 sm:p-5 md:p-8 rounded-2xl sm:rounded-3xl md:rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50">
        <h3 className="text-lg sm:text-[1.35rem] font-extrabold tracking-tight text-gray-900 mb-4 sm:mb-6">
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
