import React, { useState, useEffect } from "react";
import {
  Package,
  Plus,
  Search,
  ShoppingCart,
  History,
  Trash2,
  X,
  AlertCircle,
  Download,
  Upload,
  PackageX,
  FileText,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import NepaliDate from "nepali-date-converter";
import * as XLSX from "xlsx";
import { StoreProduct, StorePurchase, StoreUnusedItem, StoreSupplier, UserProfile } from "../types";
import { handleFirestoreError, OperationType } from "../App";

const UNUSED_DAYS_THRESHOLD = 45;

interface PurchaseItemRow {
  productName: string;
  quantity: number;
  costPrice?: number;
  vatEnabled?: boolean;
}

export default function StoreDashboard({
  profile,
  isAdmin,
  isMainAdmin,
}: {
  profile: UserProfile | null;
  isAdmin: boolean;
  isMainAdmin: boolean;
}) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [logs, setLogs] = useState<StorePurchase[]>([]);
  const [unusedItems, setUnusedItems] = useState<StoreUnusedItem[]>([]);
  const [suppliers, setSuppliers] = useState<StoreSupplier[]>([]);
  const [activeTab, setActiveTab] = useState<
    "inventory" | "purchase" | "invoices" | "in" | "out" | "unused"
  >("inventory");
  const [searchTerm, setSearchTerm] = useState("");

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    unit: "pcs",
    currentStock: 0,
    price: 0,
  });

  const [isAddingLog, setIsAddingLog] = useState<"in" | "out" | false>(false);
  const [newLog, setNewLog] = useState<{
    productName: string;
    quantity: number;
    costPrice?: number;
    supplier?: string;
    category: "Store" | "Canteen";
    purchaseDate: string;
  }>({
    productName: "",
    quantity: 0,
    costPrice: 0,
    supplier: "",
    category: "Store",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [newPurchase, setNewPurchase] = useState<{
    billNumber: string;
    supplier: string;
    category: "Store" | "Canteen";
    purchaseDate: string;
    items: PurchaseItemRow[];
    vatRate: number;
  }>({
    billNumber: "",
    supplier: "",
    category: "Store",
    purchaseDate: new Date().toISOString().split("T")[0],
    items: [{ productName: "", quantity: 0, costPrice: 0, vatEnabled: false }],
    vatRate: 13,
  });
  const [selectedInvoiceBillNumber, setSelectedInvoiceBillNumber] = useState<string | null>(null);

  const [isAddingUnused, setIsAddingUnused] = useState(false);
  const [newUnusedItem, setNewUnusedItem] = useState({
    productName: "",
    note: "",
  });

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<StorePurchase | null>(null);
  const [unusedToDelete, setUnusedToDelete] = useState<StoreUnusedItem | null>(
    null,
  );
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportCategory, setExportCategory] = useState("All");
  const [exportDateFrom, setExportDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [exportDateTo, setExportDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [isInvoiceExportModalOpen, setIsInvoiceExportModalOpen] = useState(false);
  const [invoiceExportDateFrom, setInvoiceExportDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [invoiceExportDateTo, setInvoiceExportDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [invoiceExportBillNumber, setInvoiceExportBillNumber] = useState("All");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(
      collection(db, "store_products"),
      (snapshot) => {
        setProducts(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as StoreProduct,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "store_products");
      },
    );

    const qLogs = query(
      collection(db, "store_purchases"),
      orderBy("purchaseDate", "desc"),
    );
    const unsubscribeLogs = onSnapshot(
      qLogs,
      (snapshot) => {
        setLogs(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as StorePurchase,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "store_purchases");
      },
    );

    const unsubscribeUnused = onSnapshot(
      collection(db, "store_unused_items"),
      (snapshot) => {
        setUnusedItems(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as StoreUnusedItem,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "store_unused_items");
      },
    );

    const unsubscribeSuppliers = onSnapshot(
      collection(db, "store_suppliers"),
      (snapshot) => {
        setSuppliers(
          snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as StoreSupplier,
          ),
        );
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "store_suppliers");
      },
    );

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
      unsubscribeUnused();
      unsubscribeSuppliers();
    };
  }, []);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, "store_products"), newProduct);
      setIsAddingProduct(false);
      setNewProduct({
        name: "",
        category: "",
        unit: "pcs",
        currentStock: 0,
        price: 0,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_products");
    }
  };

  const handleDeleteProduct = async () => {
    if (!isMainAdmin || !productToDelete) return;
    try {
      await deleteDoc(doc(db, "store_products", productToDelete));
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "store_products");
    }
  };

  const handleDeleteLog = async () => {
    if (!logToDelete) return;
    const canDelete =
      logToDelete.type === "out" ? isAdmin : isMainAdmin;
    if (!canDelete) return;
    try {
      await deleteDoc(doc(db, "store_purchases", logToDelete.id));

      const existingProduct = products.find(
        (p) => p.name.toLowerCase() === logToDelete.productName.toLowerCase()
      );
      if (existingProduct) {
        const quantityDelta =
          logToDelete.type !== "out" ? logToDelete.quantity : -logToDelete.quantity;
        await updateDoc(doc(db, "store_products", existingProduct.id), {
          currentStock: increment(-quantityDelta),
        });
      }

      setLogToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "store_purchases");
    }
  };

  const handleAddUnusedItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newUnusedItem.productName) return;
    try {
      await addDoc(collection(db, "store_unused_items"), {
        productName: newUnusedItem.productName,
        note: newUnusedItem.note || "",
        addedAt: new Date().toISOString(),
        addedBy: profile?.displayName || "Admin",
      });
      setIsAddingUnused(false);
      setNewUnusedItem({ productName: "", note: "" });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_unused_items");
    }
  };

  const handleDeleteUnusedItem = async () => {
    if (!isAdmin || !unusedToDelete) return;
    try {
      await deleteDoc(doc(db, "store_unused_items", unusedToDelete.id));
      setUnusedToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "store_unused_items");
    }
  };

  const removeMatchingUnusedItems = async (productName: string) => {
    try {
      const matches = unusedItems.filter(
        (u) => u.productName.toLowerCase() === productName.toLowerCase(),
      );
      await Promise.all(
        matches.map((u) => deleteDoc(doc(db, "store_unused_items", u.id))),
      );
    } catch (error) {
      console.error("Failed to clear unused item entries:", error);
    }
  };

  const handleExport = () => {
    let dataToExport = products;
    if (exportCategory !== "All") {
      dataToExport = products.filter((p) => p.category === exportCategory);
    }
    const fromDate = new Date(exportDateFrom);
    const toDate = new Date(exportDateTo + "T23:59:59");

    const rows = dataToExport.map((p) => {
      const productLogs = logs.filter(
        (l) =>
          l.productName === p.name &&
          new Date(l.purchaseDate) >= fromDate &&
          new Date(l.purchaseDate) <= toDate
      );
      const purchaseThisMonth = productLogs
        .filter((l) => l.type === "purchase")
        .reduce((sum, l) => sum + l.quantity, 0);
      const inThisMonth = productLogs
        .filter((l) => l.type === "in")
        .reduce((sum, l) => sum + l.quantity, 0);
      const outThisMonth = productLogs
        .filter((l) => l.type === "out")
        .reduce((sum, l) => sum + l.quantity, 0);
      const previousStock =
        p.currentStock - purchaseThisMonth - inThisMonth + outThisMonth;
      return {
        "Item Name": p.name,
        "Previous Stock": previousStock,
        "Purchase This Month": purchaseThisMonth,
        "Out This Month": outThisMonth,
        "In This Month": inThisMonth,
        "Total Current Stock": p.currentStock,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(
      wb,
      `inventory_${exportCategory}_${exportDateFrom}_to_${exportDateTo}.xlsx`
    );
    setIsExportModalOpen(false);
  };

  const handleExportInvoices = () => {
    const fromDate = new Date(invoiceExportDateFrom);
    const toDate = new Date(invoiceExportDateTo + "T23:59:59");

    const inRangeLogs = logs.filter(
      (log) =>
        log.type === "purchase" &&
        log.billNumber &&
        new Date(log.purchaseDate) >= fromDate &&
        new Date(log.purchaseDate) <= toDate
    );

    if (invoiceExportBillNumber !== "All") {
      const billItems = inRangeLogs.filter(
        (log) => log.billNumber === invoiceExportBillNumber
      );
      const rows = billItems.map((l) => ({
        "Bill No.": l.billNumber,
        Date: new NepaliDate(new Date(l.purchaseDate)).format("YYYY-MM-DD"),
        Supplier: l.supplier || "-",
        "Product Name": l.productName,
        Quantity: l.quantity,
        "Rate": l.costPrice || 0,
        "Item Total": l.totalCost || 0,
        "VAT Rate": l.vatRate ? `${l.vatRate}%` : "-",
        "VAT Amount": l.vatAmount || 0,
        "Item Grand Total": (l.totalCost || 0) + (l.vatAmount || 0),
        "Recorded By": l.recordedBy,
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Invoice");
      XLSX.writeFile(wb, `invoice_${invoiceExportBillNumber}.xlsx`);
      setIsInvoiceExportModalOpen(false);
      setInvoiceExportBillNumber("All");
      return;
    }

    const grouped = inRangeLogs.reduce<Record<string, StorePurchase[]>>(
      (acc, log) => {
        const key = log.billNumber as string;
        acc[key] = acc[key] ? [...acc[key], log] : [log];
        return acc;
      },
      {}
    );

    const rows = Object.entries(grouped).map(([billNumber, items]) => {
      const subtotal = items.reduce((sum, l) => sum + (l.totalCost || 0), 0);
      const vatTotal = items.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
      const first = items[0];
      return {
        "Bill No.": billNumber,
        Date: new NepaliDate(new Date(first.purchaseDate)).format("YYYY-MM-DD"),
        Supplier: first.supplier || "-",
        Items: items.length,
        Subtotal: subtotal,
        VAT: vatTotal,
        "Grand Total": subtotal + vatTotal,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(
      wb,
      `invoices_${invoiceExportDateFrom}_to_${invoiceExportDateTo}.xlsx`
    );
    setIsInvoiceExportModalOpen(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isAdmin) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").slice(1);
      for (const line of lines) {
        if (!line.trim()) continue;
        const [id, name, category, stock, unit, price] = line.split(",");
        if (name) {
          try {
            await addDoc(collection(db, "store_products"), {
              name,
              category: category || "Store",
              unit: unit || "pcs",
              currentStock: Number(stock) || 0,
              price: Number(price) || 0,
            });
          } catch (error) {
            console.error("Error importing product", error);
          }
        }
      }
      alert("Import completed successfully!");
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !isAddingLog) return;

    try {
      const logData: Omit<StorePurchase, "id"> = {
        type: isAddingLog,
        category: newLog.category,
        productName: newLog.productName,
        quantity: newLog.quantity,
        costPrice: newLog.costPrice || 0,
        totalCost: newLog.quantity * (newLog.costPrice || 0),
        supplier: newLog.supplier || "",
        purchaseDate: new Date(newLog.purchaseDate).toISOString(),
        recordedBy: profile?.displayName || "Admin",
      };

      await addDoc(collection(db, "store_purchases"), logData);

      const existingProduct = products.find(
        (p) => p.name.toLowerCase() === newLog.productName.toLowerCase()
      );

      const quantityDelta = isAddingLog === "in" ? newLog.quantity : -newLog.quantity;

      if (existingProduct) {
        await updateDoc(doc(db, "store_products", existingProduct.id), {
          currentStock: increment(quantityDelta),
        });
      } else if (isAddingLog === "in") {
        await addDoc(collection(db, "store_products"), {
          name: newLog.productName,
          category: newLog.category,
          unit: "pcs",
          currentStock: newLog.quantity,
          price: 0,
        });
      }

      if (isAddingLog === "out") {
        await removeMatchingUnusedItems(newLog.productName);
      }

      setIsAddingLog(false);
      setNewLog({
        productName: "",
        quantity: 0,
        costPrice: 0,
        supplier: "",
        category: "Store",
        purchaseDate: new Date().toISOString().split("T")[0],
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_purchases");
    }
  };

  const addPurchaseItemRow = () => {
    setNewPurchase({
      ...newPurchase,
      items: [...newPurchase.items, { productName: "", quantity: 0, costPrice: 0, vatEnabled: false }],
    });
  };

  const removePurchaseItemRow = (index: number) => {
    setNewPurchase({
      ...newPurchase,
      items: newPurchase.items.filter((_, i) => i !== index),
    });
  };

  const updatePurchaseItemRow = (index: number, patch: Partial<PurchaseItemRow>) => {
    setNewPurchase({
      ...newPurchase,
      items: newPurchase.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newPurchase.billNumber.trim()) return;
    const validItems = newPurchase.items.filter(
      (item) => item.productName.trim() && item.quantity > 0,
    );
    if (validItems.length === 0) return;

    try {
      for (const item of validItems) {
        const itemTotal = item.quantity * (item.costPrice || 0);
        const vatAmount = item.vatEnabled
          ? itemTotal * (newPurchase.vatRate / 100)
          : 0;
        const logData: Omit<StorePurchase, "id"> = {
          type: "purchase",
          category: newPurchase.category,
          productName: item.productName,
          quantity: item.quantity,
          costPrice: item.costPrice || 0,
          totalCost: itemTotal,
          supplier: newPurchase.supplier || "",
          billNumber: newPurchase.billNumber,
          purchaseDate: new Date(newPurchase.purchaseDate).toISOString(),
          recordedBy: profile?.displayName || "Admin",
          ...(item.vatEnabled
            ? { vatRate: newPurchase.vatRate, vatAmount }
            : {}),
        };

        await addDoc(collection(db, "store_purchases"), logData);

        const existingProduct = products.find(
          (p) => p.name.toLowerCase() === item.productName.toLowerCase(),
        );

        if (existingProduct) {
          await updateDoc(doc(db, "store_products", existingProduct.id), {
            currentStock: increment(item.quantity),
          });
        } else {
          await addDoc(collection(db, "store_products"), {
            name: item.productName,
            category: newPurchase.category,
            unit: "pcs",
            currentStock: item.quantity,
            price: 0,
          });
        }
      }

      const supplierName = newPurchase.supplier.trim();
      if (
        supplierName &&
        !suppliers.some((s) => s.name.toLowerCase() === supplierName.toLowerCase())
      ) {
        await addDoc(collection(db, "store_suppliers"), { name: supplierName });
      }

      setIsAddingPurchase(false);
      setNewPurchase({
        billNumber: "",
        supplier: "",
        category: "Store",
        purchaseDate: new Date().toISOString().split("T")[0],
        items: [{ productName: "", quantity: 0, costPrice: 0, vatEnabled: false }],
        vatRate: 13,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_purchases");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getLastOutDate = (productName: string) => {
    const outLogs = logs.filter(
      (l) =>
        l.type === "out" &&
        l.productName.toLowerCase() === productName.toLowerCase(),
    );
    if (outLogs.length === 0) return null;
    return outLogs.reduce(
      (latest, l) =>
        new Date(l.purchaseDate) > new Date(latest) ? l.purchaseDate : latest,
      outLogs[0].purchaseDate,
    );
  };

  const autoUnusedProducts = products.filter((p) => {
    if (p.currentStock <= 0) return false;
    const lastOutDate = getLastOutDate(p.name);
    if (!lastOutDate) return true;
    const daysSince =
      (Date.now() - new Date(lastOutDate).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > UNUSED_DAYS_THRESHOLD;
  });

  const manualUnusedItems = unusedItems.filter(
    (u) => !logs.some(
      (l) =>
        l.type === "out" &&
        l.productName.toLowerCase() === u.productName.toLowerCase() &&
        new Date(l.purchaseDate) > new Date(u.addedAt),
    ),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">
            Store Management
          </h1>
          <p className="text-gray-500 font-medium">
            Manage inventory and purchase entries.
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto min-w-0 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "inventory"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Package className="w-4 h-4 inline-block mr-2" />
            Inventory
          </button>
          <button
            onClick={() => setActiveTab("purchase")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "purchase"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline-block mr-2" />
            Purchase Entry
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "invoices"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Invoices
          </button>
          <button
            onClick={() => setActiveTab("in")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "in"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline-block mr-2" />
            Items In
          </button>
          <button
            onClick={() => setActiveTab("out")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "out"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <History className="w-4 h-4 inline-block mr-2" />
            Items Out
          </button>
          <button
            onClick={() => setActiveTab("unused")}
            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === "unused"
                ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            <PackageX className="w-4 h-4 inline-block mr-2" />
            Unused Items
          </button>
        </div>
      </div>

      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative max-w-md w-full">
              <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-white border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium shadow-sm"
              />
            </div>
            {isAdmin && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Upload className="w-5 h-5" /> Import CSV
                </button>
                <button
                  onClick={() => setIsExportModalOpen(true)}
                  className="px-6 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Download className="w-5 h-5" /> Export
                </button>
                <button
                  onClick={() => setIsAddingProduct(true)}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" /> Add Product
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all relative overflow-hidden group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Package className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                      Stock
                    </div>
                    <div
                      className={`text-2xl font-bold ${product.currentStock < 10 ? "text-orange-500" : "text-slate-900"}`}
                    >
                      {product.currentStock}{" "}
                      <span className="text-base text-gray-500 font-medium">
                        {product.unit}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="font-bold text-lg text-gray-900 mb-1">
                  {product.name}
                </h3>
                <div className="flex justify-between items-center text-sm font-medium text-gray-500">
                  <span>{product.category || "Uncategorized"}</span>
                  <span>₹{product.price || 0}</span>
                </div>

                {isMainAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProductToDelete(product.id);
                    }}
                    className="absolute top-4 right-4 p-2 text-red-500 bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(activeTab === "in" || activeTab === "out") && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsAddingLog(activeTab)}
                className={`px-6 py-3 text-white rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                  activeTab === "in"
                    ? "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20"
                    : "bg-rose-500 hover:bg-rose-600 shadow-rose-500/20"
                }`}
              >
                <ShoppingCart className="w-5 h-5" /> New {activeTab === "in" ? "Items In" : "Items Out"} Entry
              </button>
            </div>
          )}

          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {activeTab === "in" ? "Items In History" : "Items Out History"}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pl-6">
                      Date
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      {activeTab === "in" ? "Returned By" : "Ordered By"}
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                      Recorded By
                    </th>
                    {((activeTab === "in" && isMainAdmin) ||
                      (activeTab === "out" && isAdmin)) && (
                      <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.filter(log => log.type === activeTab).map((log) => {
                    const canDeleteThisLog =
                      activeTab === "in" ? isMainAdmin : isAdmin;
                    return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="p-4 pl-6 font-medium text-gray-900 whitespace-nowrap">
                        {new NepaliDate(new Date(log.purchaseDate)).format("YYYY-MM-DD")}
                      </td>
                      <td className="p-4 font-medium text-gray-900">
                        {log.productName}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.category}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.quantity}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.supplier || "-"}
                      </td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">
                        {log.recordedBy}
                      </td>
                      {canDeleteThisLog && (
                        <td className="p-4 pr-6">
                          <button
                            onClick={() => setLogToDelete(log)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                    );
                  })}
                  {logs.filter(log => log.type === activeTab).length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "in" ? (isMainAdmin ? 7 : 6) : (isAdmin ? 7 : 6)} className="p-8 text-center text-gray-500">
                        No history found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "purchase" && (
        <div className="space-y-6">
          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsAddingPurchase(true)}
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" /> New Purchase Entry
              </button>
            </div>
          )}

          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Purchase Entry History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pl-6">
                      Date
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Bill No.
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                      Recorded By
                    </th>
                    {isMainAdmin && (
                      <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.filter((log) => log.type === "purchase").map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6 font-medium text-gray-900 whitespace-nowrap">
                        {new NepaliDate(new Date(log.purchaseDate)).format("YYYY-MM-DD")}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.billNumber || "-"}
                      </td>
                      <td className="p-4 font-medium text-gray-900">
                        {log.productName}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.quantity}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.costPrice ? `₹${log.costPrice}` : "-"}
                      </td>
                      <td className="p-4 font-bold text-emerald-600">
                        {log.totalCost ? `₹${log.totalCost}` : "-"}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.vatAmount ? `₹${log.vatAmount.toFixed(2)} (${log.vatRate}%)` : "-"}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.supplier || "-"}
                      </td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">
                        {log.recordedBy}
                      </td>
                      {isMainAdmin && (
                        <td className="p-4 pr-6">
                          <button
                            onClick={() => setLogToDelete(log)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {logs.filter((log) => log.type === "purchase").length === 0 && (
                    <tr>
                      <td colSpan={isMainAdmin ? 9 : 8} className="p-8 text-center text-gray-500">
                        No purchase entries found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900">Invoices</h2>
              <button
                onClick={() => setIsInvoiceExportModalOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pl-6">
                      Bill No.
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      VAT
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(
                    logs
                      .filter((log) => log.type === "purchase" && log.billNumber)
                      .reduce<Record<string, StorePurchase[]>>((acc, log) => {
                        const key = log.billNumber as string;
                        acc[key] = acc[key] ? [...acc[key], log] : [log];
                        return acc;
                      }, {})
                  ).map(([billNumber, items]) => {
                    const subtotal = items.reduce((sum, l) => sum + (l.totalCost || 0), 0);
                    const vatTotal = items.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
                    const first = items[0];
                    return (
                      <tr
                        key={billNumber}
                        onClick={() => setSelectedInvoiceBillNumber(billNumber)}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                      >
                        <td className="p-4 pl-6 font-bold text-indigo-600">
                          {billNumber}
                        </td>
                        <td className="p-4 font-medium text-gray-900 whitespace-nowrap">
                          {new NepaliDate(new Date(first.purchaseDate)).format("YYYY-MM-DD")}
                        </td>
                        <td className="p-4 font-medium text-gray-500">
                          {first.supplier || "-"}
                        </td>
                        <td className="p-4 font-medium text-gray-500">
                          {items.length}
                        </td>
                        <td className="p-4 font-medium text-gray-500">
                          {vatTotal > 0 ? `₹${vatTotal.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 pr-6 font-bold text-emerald-600">
                          ₹{(subtotal + vatTotal).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.filter((log) => log.type === "purchase" && log.billNumber).length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        No invoices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "unused" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 font-medium">
            Items with stock that haven't had an "Items Out" entry in the
            last {UNUSED_DAYS_THRESHOLD} days are listed automatically. They
            disappear from this list as soon as they're used in an Items Out
            entry.
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsAddingUnused(true)}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> Add Unused Item
              </button>
            </div>
          )}

          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                Unused Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pl-6">
                      Product
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                      Note
                    </th>
                    {isAdmin && (
                      <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {autoUnusedProducts.map((p) => {
                    const lastOutDate = getLastOutDate(p.name);
                    return (
                      <tr key={`auto-${p.id}`} className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4 pl-6 font-medium text-gray-900">{p.name}</td>
                        <td className="p-4 font-medium text-gray-500">{p.currentStock} {p.unit}</td>
                        <td className="p-4 text-sm text-gray-500">
                          {lastOutDate
                            ? `Not used since ${new NepaliDate(new Date(lastOutDate)).format("YYYY-MM-DD")}`
                            : "Never used"}
                        </td>
                        <td className="p-4 pr-6 text-gray-400 text-sm">-</td>
                        {isAdmin && <td className="p-4 pr-6"></td>}
                      </tr>
                    );
                  })}
                  {manualUnusedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 pl-6 font-medium text-gray-900">{item.productName}</td>
                      <td className="p-4 font-medium text-gray-500">-</td>
                      <td className="p-4 text-sm text-gray-500">Manually added</td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">{item.note || "-"}</td>
                      {isAdmin && (
                        <td className="p-4 pr-6">
                          <button
                            onClick={() => setUnusedToDelete(item)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
                            title="Remove entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {autoUnusedProducts.length === 0 && manualUnusedItems.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-gray-500">
                        No unused items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <AnimatePresence>
        {isAddingProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingProduct(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Add New Product
              </h2>

              <form onSubmit={handleAddProduct} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. Notebook, Pen, etc."
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    required
                    value={newProduct.category}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. Stationery, Uniform"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Initial Stock
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newProduct.currentStock}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          currentStock: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-left text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      required
                      value={newProduct.unit}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, unit: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                      placeholder="e.g. pcs, boxes"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({
                        ...newProduct,
                        price: Number(e.target.value),
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-left text-gray-900"
                  />
                </div>

                <button type="submit" className="w-full pt-2">
                  <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all text-center">
                    Save Product
                  </div>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Product Confirm Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Delete Product?
              </h3>
              <p className="text-gray-500 mb-8">
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setProductToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProduct}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Log Entry Confirm Modal */}
      <AnimatePresence>
        {logToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Delete Entry?
              </h3>
              <p className="text-gray-500 mb-8">
                This will remove the log entry and reverse its stock adjustment. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setLogToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteLog}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Unused Item Modal */}
      <AnimatePresence>
        {isAddingUnused && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingUnused(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Add Unused Item
              </h2>

              <form onSubmit={handleAddUnusedItem} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnusedItem.productName}
                    onChange={(e) =>
                      setNewUnusedItem({
                        ...newUnusedItem,
                        productName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                    placeholder="Enter product name..."
                    list="product-list-unused"
                  />
                  <datalist id="product-list-unused">
                    {products.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Note <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newUnusedItem.note}
                    onChange={(e) =>
                      setNewUnusedItem({
                        ...newUnusedItem,
                        note: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-medium"
                    placeholder="e.g. Damaged, out of season"
                  />
                </div>

                <button type="submit" className="w-full pt-2">
                  <div className="w-full py-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-all text-center">
                    Save
                  </div>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Unused Item Confirm Modal */}
      <AnimatePresence>
        {unusedToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Remove Entry?
              </h3>
              <p className="text-gray-500 mb-8">
                This will remove the manual unused item entry. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUnusedToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUnusedItem}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Log Entry Modal */}
      <AnimatePresence>
        {isAddingLog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingLog(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                New {isAddingLog === "in" ? "Items In" : "Items Out"} Entry
              </h2>

              <form
                onSubmit={handleAddLog}
                className="space-y-4 text-left"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Entry Category
                  </label>
                  <select
                    required
                    value={newLog.category}
                    onChange={(e) =>
                      setNewLog({
                        ...newLog,
                        category: e.target.value as "Store" | "Canteen",
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                  >
                    <option value="Store">Store</option>
                    <option value="Canteen">Canteen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newLog.productName}
                    onChange={(e) =>
                      setNewLog({
                        ...newLog,
                        productName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder="Enter product name..."
                    list="product-list"
                  />
                  <datalist id="product-list">
                    {products.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newLog.quantity || ""}
                      onChange={(e) =>
                        setNewLog({
                          ...newLog,
                          quantity: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-left text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Cost Price (₹/unit) <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newLog.costPrice || ""}
                      onChange={(e) =>
                        setNewLog({
                          ...newLog,
                          costPrice: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-left"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Entry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newLog.purchaseDate}
                    onChange={(e) =>
                      setNewLog({
                        ...newLog,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {isAddingLog === "in" ? "Returned By" : "Ordered By"} <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newLog.supplier}
                    onChange={(e) =>
                      setNewLog({
                        ...newLog,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder={isAddingLog === "in" ? "e.g. John Doe" : "e.g. Class Teacher"}
                  />
                </div>

                {newLog.quantity > 0 && newLog.costPrice !== undefined && newLog.costPrice > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center mt-2">
                    <span className="font-bold text-indigo-700 text-sm">
                      Total Amount:
                    </span>
                    <span className="font-bold text-indigo-700 text-xl">
                      ₹
                      {(newLog.quantity * newLog.costPrice).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                )}

                <button type="submit" className="w-full pt-2">
                  <div className={`w-full py-4 text-white rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 ${
                    isAddingLog === "in" 
                      ? "bg-indigo-500 hover:bg-indigo-600" 
                      : "bg-rose-500 hover:bg-rose-600"
                  }`}>
                    <ShoppingCart className="w-5 h-5" /> Record {isAddingLog === "in" ? "Items In" : "Items Out"}
                  </div>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Add Purchase Entry Modal */}
      <AnimatePresence>
        {isAddingPurchase && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsAddingPurchase(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                New Purchase Entry
              </h2>

              <form onSubmit={handleAddPurchase} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Bill Number
                    </label>
                    <input
                      type="text"
                      required
                      value={newPurchase.billNumber}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, billNumber: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      placeholder="e.g. INV-2026-0145"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Entry Category
                    </label>
                    <select
                      required
                      value={newPurchase.category}
                      onChange={(e) =>
                        setNewPurchase({
                          ...newPurchase,
                          category: e.target.value as "Store" | "Canteen",
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                    >
                      <option value="Store">Store</option>
                      <option value="Canteen">Canteen</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Supplier
                    </label>
                    <input
                      type="text"
                      value={newPurchase.supplier}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, supplier: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                      placeholder="Select or type a new supplier..."
                      list="supplier-list"
                    />
                    <datalist id="supplier-list">
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Entry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={newPurchase.purchaseDate}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, purchaseDate: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    Items
                  </label>
                  {newPurchase.items.map((item, index) => {
                    const itemTotal = item.quantity * (item.costPrice || 0);
                    const itemVat = item.vatEnabled
                      ? itemTotal * (newPurchase.vatRate / 100)
                      : 0;
                    return (
                      <div key={index} className="bg-gray-50 p-3 rounded-xl space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <input
                              type="text"
                              required
                              value={item.productName}
                              onChange={(e) =>
                                updatePurchaseItemRow(index, { productName: e.target.value })
                              }
                              className="w-full px-3 py-2 bg-white border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                              placeholder="Product name"
                              list="product-list-purchase"
                            />
                          </div>
                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              required
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updatePurchaseItemRow(index, { quantity: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 bg-white border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                              placeholder="Qty"
                            />
                          </div>
                          <div className="w-24">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.costPrice || ""}
                              onChange={(e) =>
                                updatePurchaseItemRow(index, { costPrice: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 bg-white border-none rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                              placeholder="Rate"
                            />
                          </div>
                          <label className="flex items-center gap-1 px-2 py-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={!!item.vatEnabled}
                              onChange={(e) =>
                                updatePurchaseItemRow(index, { vatEnabled: e.target.checked })
                              }
                              className="w-4 h-4 rounded cursor-pointer accent-indigo-500"
                            />
                            <span className="text-xs font-bold text-gray-500">VAT</span>
                          </label>
                          {newPurchase.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removePurchaseItemRow(index)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        {itemTotal > 0 && (
                          <div className="text-right text-xs font-bold text-indigo-600">
                            {item.vatEnabled
                              ? `Total incl. VAT (${newPurchase.vatRate}%): ₹${(itemTotal + itemVat).toFixed(2)}`
                              : `Total: ₹${itemTotal.toFixed(2)}`}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <datalist id="product-list-purchase">
                    {products.map((p) => (
                      <option key={p.id} value={p.name} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={addPurchaseItemRow}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-2">
                  <label className="font-bold text-gray-700 text-sm">
                    VAT Rate (applied to items ticked above)
                  </label>
                  <div className="flex items-center gap-2 ml-auto">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newPurchase.vatRate}
                      onChange={(e) =>
                        setNewPurchase({ ...newPurchase, vatRate: Number(e.target.value) })
                      }
                      className="w-20 px-3 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-right"
                    />
                    <span className="font-bold text-gray-500 text-sm">%</span>
                  </div>
                </div>

                {(() => {
                  const subtotal = newPurchase.items.reduce(
                    (sum, item) => sum + item.quantity * (item.costPrice || 0),
                    0,
                  );
                  const vatAmount = newPurchase.items.reduce((sum, item) => {
                    const itemTotal = item.quantity * (item.costPrice || 0);
                    return sum + (item.vatEnabled ? itemTotal * (newPurchase.vatRate / 100) : 0);
                  }, 0);
                  const grandTotal = subtotal + vatAmount;
                  return subtotal > 0 ? (
                    <div className="bg-indigo-50 p-4 rounded-xl space-y-1 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-700 text-sm">Subtotal:</span>
                        <span className="font-bold text-indigo-700">₹{subtotal.toFixed(2)}</span>
                      </div>
                      {vatAmount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-700 text-sm">
                            VAT ({newPurchase.vatRate}%):
                          </span>
                          <span className="font-bold text-indigo-700">₹{vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-700 text-sm">Grand Total:</span>
                        <span className="font-bold text-indigo-700 text-xl">
                          ₹{grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ) : null;
                })()}

                <button type="submit" className="w-full pt-2">
                  <div className="w-full py-4 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all text-center flex items-center justify-center gap-2">
                    <ShoppingCart className="w-5 h-5" /> Record Purchase Entry
                  </div>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-start gap-4 mb-8">
                <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                  <Package className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">
                    {selectedProduct.name}
                  </h2>
                  <div className="flex items-center gap-4 text-sm mt-1 text-gray-500 font-medium">
                    <span>{selectedProduct.category || "Uncategorized"}</span>
                    <span>•</span>
                    <span>Current Stock: <strong className="text-gray-900">{selectedProduct.currentStock} {selectedProduct.unit}</strong></span>
                    <span>•</span>
                    <span>Price: <strong className="text-gray-900">₹{selectedProduct.price || 0}</strong></span>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg mb-4 text-gray-900">Recent History</h3>
              <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider pl-4">Date</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider">Quantity</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs
                      .filter((l) => l.productName === selectedProduct.name)
                      .slice(0, 10)
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-white transition-colors">
                          <td className="p-3 pl-4 text-gray-900 font-medium whitespace-nowrap">
                            {new NepaliDate(new Date(log.purchaseDate)).format("YYYY-MM-DD")}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                              log.type === "purchase"
                                ? "bg-indigo-100 text-indigo-700"
                                : log.type === "in"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-rose-100 text-rose-700"
                            }`}>
                              {log.type === "purchase" ? "PURCHASE" : log.type === "in" ? "IN" : "OUT"}
                            </span>
                          </td>
                          <td className="p-3 text-gray-900 font-medium">{log.quantity}</td>
                          <td className="p-3 text-gray-500">{log.recordedBy}</td>
                        </tr>
                      ))}
                    {logs.filter(l => l.productName === selectedProduct.name).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">No recent history</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Export Products
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Select Date Range
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={exportDateFrom}
                      onChange={(e) => setExportDateFrom(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    />
                    <input
                      type="date"
                      value={exportDateTo}
                      onChange={(e) => setExportDateTo(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Select Category
                  </label>
                  <select
                    value={exportCategory}
                    onChange={(e) => setExportCategory(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Store">Store</option>
                    <option value="Canteen">Canteen</option>
                  </select>
                </div>

                <button
                  onClick={handleExport}
                  className="w-full py-4 text-white rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600"
                >
                  <Download className="w-5 h-5" /> Download XLSX
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Export Modal */}
      <AnimatePresence>
        {isInvoiceExportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setIsInvoiceExportModalOpen(false);
                  setInvoiceExportBillNumber("All");
                }}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Export Invoices
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Select Date Range
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={invoiceExportDateFrom}
                      onChange={(e) => setInvoiceExportDateFrom(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    />
                    <input
                      type="date"
                      value={invoiceExportDateTo}
                      onChange={(e) => setInvoiceExportDateTo(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Invoice Number <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={invoiceExportBillNumber}
                    onChange={(e) => setInvoiceExportBillNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                  >
                    <option value="All">All Invoices (Summary)</option>
                    {Array.from(
                      new Set(
                        logs
                          .filter(
                            (log) =>
                              log.type === "purchase" &&
                              log.billNumber &&
                              new Date(log.purchaseDate) >= new Date(invoiceExportDateFrom) &&
                              new Date(log.purchaseDate) <= new Date(invoiceExportDateTo + "T23:59:59")
                          )
                          .map((log) => log.billNumber as string)
                      )
                    ).map((billNumber) => (
                      <option key={billNumber} value={billNumber}>
                        {billNumber}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportInvoices}
                  className="w-full py-4 text-white rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800"
                >
                  <Download className="w-5 h-5" /> Download XLSX
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Detail Modal */}
      <AnimatePresence>
        {selectedInvoiceBillNumber && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl relative max-h-[85vh] overflow-y-auto"
            >
              <button
                onClick={() => setSelectedInvoiceBillNumber(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-1 font-sans tracking-tight">
                Invoice {selectedInvoiceBillNumber}
              </h2>

              {(() => {
                const items = logs.filter(
                  (l) => l.type === "purchase" && l.billNumber === selectedInvoiceBillNumber
                );
                if (items.length === 0) return null;
                const first = items[0];
                const subtotal = items.reduce((sum, l) => sum + (l.totalCost || 0), 0);
                const vatTotal = items.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
                return (
                  <>
                    <p className="text-gray-500 font-medium mb-6">
                      {new NepaliDate(new Date(first.purchaseDate)).format("YYYY-MM-DD")} &middot; {first.supplier || "No supplier"} &middot; Recorded by {first.recordedBy}
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50/50">
                            <th className="p-3 font-bold text-sm text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="p-3 font-bold text-sm text-gray-500 uppercase tracking-wider">Qty</th>
                            <th className="p-3 font-bold text-sm text-gray-500 uppercase tracking-wider">Rate</th>
                            <th className="p-3 font-bold text-sm text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="p-3 font-bold text-sm text-gray-500 uppercase tracking-wider">VAT</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {items.map((item) => (
                            <tr key={item.id}>
                              <td className="p-3 font-medium text-gray-900">{item.productName}</td>
                              <td className="p-3 text-gray-500">{item.quantity}</td>
                              <td className="p-3 text-gray-500">{item.costPrice ? `₹${item.costPrice}` : "-"}</td>
                              <td className="p-3 font-bold text-emerald-600">{item.totalCost ? `₹${item.totalCost}` : "-"}</td>
                              <td className="p-3 text-gray-500">{item.vatAmount ? `₹${item.vatAmount.toFixed(2)}` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 space-y-1 text-right">
                      <p className="text-gray-500 font-medium">Subtotal: ₹{subtotal.toFixed(2)}</p>
                      {vatTotal > 0 && (
                        <p className="text-gray-500 font-medium">VAT: ₹{vatTotal.toFixed(2)}</p>
                      )}
                      <p className="text-gray-900 font-bold text-lg">
                        Grand Total: ₹{(subtotal + vatTotal).toFixed(2)}
                      </p>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
