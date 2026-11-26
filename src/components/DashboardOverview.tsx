import React, { useState, useEffect } from "react";
import {
  Bus,
  Users,
  Ticket,
  Package,
  QrCode,
  ShoppingCart,
  Calendar,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Sparkles,
  PieChart as PieIcon,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import NepaliDate from "nepali-date-converter";
import {
  collection,
  getDocs,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { db } from "../firebase";
import { UserProfile } from "../types";

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

  // Formatted Dates (English & Nepali B.S.)
  const todayEnglish = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const todayNepali = (() => {
    try {
      return new NepaliDate().format("MMMM DD, YYYY") + " B.S.";
    } catch {
      return "";
    }
  })();

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
        );
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

  const statCards = [
    {
      label: "Total Students",
      value: stats.totalStudents,
      icon: Users,
      color: "from-blue-500 to-indigo-600",
      bg: "bg-blue-50 text-blue-700 border-blue-200/60",
      dotColor: "bg-blue-500",
      trend: "Enrolled",
      tab: "admin",
      hint: "Manage Students",
    },
    {
      label: "Active Buses",
      value: stats.activeBuses,
      icon: Bus,
      color: "from-emerald-500 to-teal-600",
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
      dotColor: "bg-emerald-500",
      trend: "Live Fleet",
      tab: "transport",
      hint: "Live GPS Map",
    },
    {
      label: "Gate Passes",
      value: stats.activeGatePasses,
      icon: Ticket,
      color: "from-amber-500 to-orange-600",
      bg: "bg-amber-50 text-amber-700 border-amber-200/60",
      dotColor: "bg-amber-500",
      trend: "Active Today",
      tab: "gatepass",
      hint: "Gate Pass Hub",
    },
    {
      label: "Store Items",
      value: stats.storeProductsCount,
      icon: Package,
      color: "from-purple-500 to-violet-600",
      bg: "bg-purple-50 text-purple-700 border-purple-200/60",
      dotColor: "bg-purple-500",
      trend: "In Catalog",
      tab: "store",
      hint: "View Inventory",
    },
  ];

  // Pie Chart Data & Breakdown Details
  const pieData = [
    {
      name: "Store Inventory",
      value: stats.storeProductsCount,
      color: "#8b5cf6",
      gradient: "from-purple-500 to-violet-600",
      bgLight: "bg-purple-50",
      textColor: "text-purple-700",
      borderColor: "border-purple-200/80",
      tab: "store",
      icon: Package,
      unit: "Products",
      status: "Stock Monitored",
      description: "Active items in campus store catalog",
    },
    {
      name: "Active Gate Passes",
      value: stats.activeGatePasses,
      color: "#f59e0b",
      gradient: "from-amber-500 to-orange-600",
      bgLight: "bg-amber-50",
      textColor: "text-amber-700",
      borderColor: "border-amber-200/80",
      tab: "gatepass",
      icon: Ticket,
      unit: "Passes",
      status: "Active Today",
      description: "Gate exit/entry passes active in system",
      quickScan: true,
    },
    {
      name: "Student Records",
      value: stats.totalStudents,
      color: "#3b82f6",
      gradient: "from-blue-500 to-indigo-600",
      bgLight: "bg-blue-50",
      textColor: "text-blue-700",
      borderColor: "border-blue-200/80",
      tab: "admin",
      icon: Users,
      unit: "Students",
      status: "Active Database",
      description: "Registered & enrolled student directory",
    },
    {
      name: "Fleet Transport",
      value: stats.activeBuses,
      color: "#10b981",
      gradient: "from-emerald-500 to-teal-600",
      bgLight: "bg-emerald-50",
      textColor: "text-emerald-700",
      borderColor: "border-emerald-200/80",
      tab: "transport",
      icon: Bus,
      unit: "Buses",
      status: stats.activeBuses > 0 ? "GPS Monitored" : "Standby Fleet",
      description: "Operational transit fleet and mapped routes",
    },
  ];

  const totalEntities = pieData.reduce((acc, curr) => acc + curr.value, 0);
  const chartSlices = pieData.filter((item) => item.value > 0);
  const effectiveChartData =
    chartSlices.length > 0
      ? chartSlices
      : [{ name: "No Data", value: 1, color: "#e5e7eb", unit: "" }];

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const pct =
        totalEntities > 0
          ? ((data.value / totalEntities) * 100).toFixed(1)
          : "0.0";
      return (
        <div className="bg-gray-900/95 text-white backdrop-blur-md px-3.5 py-2.5 rounded-xl shadow-xl border border-white/10 text-xs select-none">
          <p className="font-bold flex items-center gap-1.5 mb-1 text-white">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{
                backgroundColor: data.payload.color || data.payload.fill,
              }}
            />
            {data.name}
          </p>
          <p className="text-gray-300 font-medium">
            Total:{" "}
            <span className="text-white font-bold">
              {data.value.toLocaleString()}
            </span>{" "}
            {data.payload.unit || ""}
          </p>
          <p className="text-emerald-400 font-semibold mt-0.5">
            Share: {pct}% of campus entities
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 sm:space-y-8 relative">
      {/* Header with Date Badge & Role Indicator */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {isAdmin
                ? "Super Admin"
                : profile?.role
                  ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1)
                  : "Staff"}
            </span>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/80 text-gray-700 border border-gray-200/80 shadow-xs backdrop-blur-md">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>{todayEnglish}</span>
              {todayNepali && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="text-emerald-700 font-semibold">{todayNepali}</span>
                </>
              )}
            </span>
          </div>

          <h2 className="text-2xl sm:text-[2.25rem] font-extrabold tracking-tight text-gray-900">
            Welcome back, {profile?.displayName?.split(" ")[0] || "User"}!
          </h2>
          <p className="text-sm sm:text-base text-gray-500 mt-0.5">
            Here's what's happening across campus operations today.
          </p>
        </div>

        <div className="flex gap-3 relative items-center">
          <button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="px-4 py-2 bg-white border border-gray-200/80 shadow-xs rounded-xl text-sm font-medium hover:bg-gray-50 backdrop-blur-md transition-all disabled:opacity-50 flex items-center gap-2 text-gray-700"
          >
            {isDownloading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Downloading...
              </>
            ) : (
              "Download Report"
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setShowQuickAction(!showQuickAction)}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Quick Action
            </button>

            <AnimatePresence>
              {showQuickAction && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl shadow-gray-200/40 border border-gray-100 overflow-hidden z-50"
                >
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_student");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                    >
                      Add Student
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_teacher");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                    >
                      Add Teacher
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_staff");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
                    >
                      Add Staff
                    </button>
                    <button
                      onClick={() => {
                        setShowQuickAction(false);
                        setActiveTab("admin");
                        setAdminAction("add_parent");
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-all"
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

      {/* Interactive Stats Grid with Click-to-Navigate & Pulse Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10 w-full">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.35, ease: "easeOut" }}
            onClick={() => setActiveTab(stat.tab)}
            className="group relative overflow-hidden bg-white/80 backdrop-blur-2xl p-5 md:p-6 rounded-2xl sm:rounded-3xl border border-white/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all hover:-translate-y-1.5 cursor-pointer"
          >
            {/* Ambient Background Glow */}
            <div
              className={`absolute -right-4 -top-4 w-32 h-32 bg-gradient-to-br ${stat.color} rounded-full blur-[40px] opacity-15 group-hover:opacity-30 transition-opacity`}
            />

            <div className="relative z-10 flex items-center justify-between mb-4">
              <div
                className={`bg-gradient-to-br ${stat.color} p-3 sm:p-3.5 rounded-2xl text-white shadow-md group-hover:scale-105 transition-transform`}
              >
                <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>

              {/* Pulsing Live Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${stat.bg} border shadow-xs`}
              >
                <span className={`w-2 h-2 rounded-full ${stat.dotColor} animate-pulse`} />
                {stat.trend}
              </span>
            </div>

            <div className="relative z-10">
              <p className="text-gray-500 text-xs font-bold mb-1 uppercase tracking-wider">
                {stat.label}
              </p>
              <h3 className="text-3xl sm:text-[2.25rem] font-extrabold tracking-tight text-gray-900 leading-none">
                {stat.value.toLocaleString()}
              </h3>

              {/* Hover Navigation Hint */}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-400 group-hover:text-gray-700 transition-colors">
                <span>{stat.hint}</span>
                <ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform text-gray-400 group-hover:text-emerald-600" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Visual Analytics: Pie Chart & Campus Operational Details */}
      <div className="bg-white/80 backdrop-blur-xl p-5 md:p-8 rounded-2xl sm:rounded-3xl border border-white/80 shadow-xl shadow-gray-200/40">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg sm:text-[1.35rem] font-extrabold tracking-tight text-gray-900">
                Operations & Resource Distribution
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Proportional distribution of campus data across inventory, gate passes, students, and fleet
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1 rounded-full shadow-2xs">
              <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
              Live Telemetry
            </span>
          </div>
        </div>

        {/* 2-Column Grid: Pie Chart on Left, Detailed Module Breakdown on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
          {/* Left Column: Donut / Pie Chart */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-gray-50/70 to-white border border-gray-100 shadow-2xs">
            <div className="relative w-full h-[260px] sm:h-[280px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <RechartsTooltip content={<CustomPieTooltip />} />
                  <Pie
                    data={effectiveChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={98}
                    paddingAngle={chartSlices.length > 1 ? 4 : 0}
                    cornerRadius={6}
                    dataKey="value"
                    onClick={(entry: any) => {
                      if (entry && entry.tab) {
                        if (entry.quickScan) setIsQuickScanning?.(true);
                        setActiveTab(entry.tab);
                      }
                    }}
                    cursor="pointer"
                  >
                    {effectiveChartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color}
                        stroke="#ffffff"
                        strokeWidth={2}
                        className="transition-opacity hover:opacity-85"
                      />
                    ))}
                  </Pie>
                </RechartsPieChart>
              </ResponsiveContainer>

              {/* Center Donut Grand Total Label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
                  {totalEntities.toLocaleString()}
                </span>
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-1">
                  Total Entities
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
            </div>

            {/* Quick Interactive Legend Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              {pieData.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (item.quickScan) setIsQuickScanning?.(true);
                    setActiveTab(item.tab);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white border border-gray-200/80 hover:border-gray-300 text-gray-600 hover:text-gray-900 transition-all shadow-2xs"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 font-medium text-center mt-2">
              Hover slices to inspect • Click to jump to module
            </p>
          </div>

          {/* Right Column: Detailed Breakdown & Operations Details */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-3.5">
            <div className="flex items-center justify-between pb-1 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Module Breakdown
              </span>
              <span className="text-xs font-semibold text-gray-400">
                Resource Share
              </span>
            </div>

            <div className="space-y-2.5">
              {pieData.map((item, idx) => {
                const pct =
                  totalEntities > 0
                    ? (item.value / totalEntities) * 100
                    : 0;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (item.quickScan) setIsQuickScanning?.(true);
                      setActiveTab(item.tab);
                    }}
                    className="group p-3 sm:p-3.5 rounded-2xl bg-white/70 hover:bg-white border border-gray-100 hover:border-gray-200/90 shadow-2xs hover:shadow-sm transition-all cursor-pointer flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.gradient} flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-105 transition-transform`}
                        >
                          <item.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-bold text-gray-800 truncate">
                              {item.name}
                            </h4>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.bgLight} ${item.textColor} ${item.borderColor}`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 truncate hidden sm:block">
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs sm:text-sm font-extrabold text-gray-900 block leading-tight">
                            {item.value.toLocaleString()}{" "}
                            <span className="text-[11px] font-medium text-gray-500">
                              {item.unit}
                            </span>
                          </span>
                          <span className="text-[11px] font-semibold text-gray-400">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      </div>
                    </div>

                    {/* Proportional Progress Bar */}
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(pct, item.value > 0 ? 3 : 0)}%`,
                        }}
                        transition={{
                          duration: 0.6,
                          delay: idx * 0.08,
                          ease: "easeOut",
                        }}
                        className={`h-full bg-gradient-to-r ${item.gradient} rounded-full`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Operational Highlights / Details */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Dominant Module
                  </p>
                  <p className="text-xs font-bold text-gray-800 truncate">
                    Store Catalog ({stats.storeProductsCount.toLocaleString()} items)
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-gray-50/80 border border-gray-100 flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Active Security
                  </p>
                  <p className="text-xs font-bold text-gray-800 truncate">
                    {stats.activeGatePasses.toLocaleString()} Passes in Circulation
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Status & Quick Launcher */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fleet Status Card */}
        <div className="lg:col-span-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none rounded-2xl sm:rounded-3xl p-6 md:p-8 text-white relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 max-w-md">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white backdrop-blur-md mb-3">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              Live Vehicle Telemetry
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
              Fleet Status Overview
            </h3>
            <p className="text-emerald-100 text-sm sm:text-base mb-6">
              Total <span className="font-bold text-white">{stats.activeBuses} vehicles</span> are currently active in the transport fleet with route mapping enabled.
            </p>
            <button
              onClick={() => setActiveTab("transport")}
              className="px-6 py-2.5 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 hover:shadow-lg transition-all inline-flex items-center gap-2 text-sm shadow-md"
            >
              <span>Open Live Map</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          <Bus className="absolute -right-8 -bottom-8 w-60 h-60 text-emerald-400/20 rotate-12 pointer-events-none" />
        </div>

        {/* Quick Actions Launcher */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 shadow-xl shadow-slate-900/20 rounded-2xl sm:rounded-3xl p-6 text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base sm:text-lg">Quick Launchpad</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-emerald-400">
                Shortcuts
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                {
                  label: "Add Student",
                  icon: Users,
                  adminOnly: true,
                  tab: "admin",
                },
                {
                  label: "Scan Gate Pass",
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
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl transition-all gap-1.5 border border-white/5 ${
                      isDisabled
                        ? "bg-white/5 text-white/20 cursor-not-allowed"
                        : "bg-white/10 hover:bg-white/20 text-white hover:scale-[1.02]"
                    }`}
                  >
                    <action.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold text-center">{action.label}</span>
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
          <p className="text-[11px] text-slate-400 text-center mt-4">
            Instant navigation to critical campus functions
          </p>
        </div>
      </div>
    </div>
  );
}
