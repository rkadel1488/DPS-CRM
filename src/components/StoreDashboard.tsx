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
import { StoreProduct, StorePurchase, UserProfile } from "../types";
import { handleFirestoreError, OperationType } from "../App";

export default function StoreDashboard({
  profile,
  isAdmin,
}: {
  profile: UserProfile | null;
  isAdmin: boolean;
}) {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [logs, setLogs] = useState<StorePurchase[]>([]);
  const [activeTab, setActiveTab] = useState<"inventory" | "in" | "out">(
    "inventory",
  );
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

  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [logToDelete, setLogToDelete] = useState<StorePurchase | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportCategory, setExportCategory] = useState("All");
  const [exportBsYear, setExportBsYear] = useState(() => NepaliDate.now().getYear().toString());
  const [exportBsMonth, setExportBsMonth] = useState(() => (NepaliDate.now().getMonth() + 1).toString().padStart(2, '0'));
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

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
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
    if (!isAdmin || !productToDelete) return;
    try {
      await deleteDoc(doc(db, "store_products", productToDelete));
      setProductToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "store_products");
    }
  };

  const handleDeleteLog = async () => {
    if (!isAdmin || !logToDelete) return;
    try {
      await deleteDoc(doc(db, "store_purchases", logToDelete.id));

      const existingProduct = products.find(
        (p) => p.name.toLowerCase() === logToDelete.productName.toLowerCase()
      );
      if (existingProduct) {
        const quantityDelta =
          logToDelete.type === "in" ? logToDelete.quantity : -logToDelete.quantity;
        await updateDoc(doc(db, "store_products", existingProduct.id), {
          currentStock: increment(-quantityDelta),
        });
      }

      setLogToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "store_purchases");
    }
  };

  const handleExport = () => {
    let dataToExport = products;
    if (exportCategory !== "All") {
      dataToExport = products.filter((p) => p.category === exportCategory);
    }
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "ID,Name,Category,Stock,Unit,Price,Month In,Month Out\n" +
      dataToExport
        .map(
          (p) => {
            const productLogs = logs.filter(
              (l) =>
                l.productName === p.name &&
                new NepaliDate(new Date(l.purchaseDate)).format("YYYY-MM") === `${exportBsYear}-${exportBsMonth}`
            );
            const monthIn = productLogs
              .filter((l) => l.type === "in")
              .reduce((sum, l) => sum + l.quantity, 0);
            const monthOut = productLogs
              .filter((l) => l.type === "out")
              .reduce((sum, l) => sum + l.quantity, 0);
            return `${p.id},${p.name},${p.category},${p.currentStock},${p.unit},${p.price},${monthIn},${monthOut}`;
          }
        )
        .join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_${exportCategory}_${exportBsYear}-${exportBsMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportModalOpen(false);
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

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase()),
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

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
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
                  <Download className="w-5 h-5" /> Export CSV
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

                {isAdmin && (
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
                    {activeTab === "in" && (
                      <>
                        <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                          Rate
                        </th>
                        <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                          Total Amount
                        </th>
                      </>
                    )}
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                      Recorded By
                    </th>
                    {isAdmin && (
                      <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.filter(log => log.type === activeTab).map((log) => (
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
                      {activeTab === "in" && (
                        <>
                          <td className="p-4 font-medium text-gray-500">
                            {log.costPrice ? `₹${log.costPrice}` : "-"}
                          </td>
                          <td className={`p-4 font-bold ${activeTab === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                            {log.totalCost ? `₹${log.totalCost}` : "-"}
                          </td>
                        </>
                      )}
                      <td className="p-4 font-medium text-gray-500">
                        {log.supplier || "-"}
                      </td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">
                        {log.recordedBy}
                      </td>
                      {isAdmin && (
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
                  {logs.filter(log => log.type === activeTab).length === 0 && (
                    <tr>
                      <td colSpan={activeTab === "in" ? (isAdmin ? 9 : 8) : (isAdmin ? 7 : 6)} className="p-8 text-center text-gray-500">
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
                    Supplier / Source <span className="text-gray-400 font-normal">(Optional)</span>
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
                    placeholder="e.g. ABC Distributors"
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
                              log.type === "in" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                            }`}>
                              {log.type === "in" ? "IN" : "OUT"}
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
                    Select Month for Analytics (Nepali)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={exportBsYear}
                      onChange={(e) => setExportBsYear(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    >
                      {Array.from({ length: 10 }).map((_, i) => {
                        const yr = NepaliDate.now().getYear() - 5 + i;
                        return <option key={yr} value={yr}>{yr}</option>;
                      })}
                    </select>
                    <select
                      value={exportBsMonth}
                      onChange={(e) => setExportBsMonth(e.target.value)}
                      className="w-1/2 px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                    >
                      {[{v: "01", n: "Baisakh"}, {v: "02", n: "Jestha"}, {v: "03", n: "Asar"}, {v: "04", n: "Shrawan"}, {v: "05", n: "Bhadra"}, {v: "06", n: "Aswin"}, {v: "07", n: "Kartik"}, {v: "08", n: "Mangsir"}, {v: "09", n: "Poush"}, {v: "10", n: "Magh"}, {v: "11", n: "Falgun"}, {v: "12", n: "Chaitra"}].map((m) => (
                        <option key={m.v} value={m.v}>{m.n}</option>
                      ))}
                    </select>
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
                  <Download className="w-5 h-5" /> Download CSV
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
