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
  Pencil,
  ArrowLeftRight,
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
import {
  STORE_CATEGORIES,
  StoreCategory,
  StoreProduct,
  StorePurchase,
  StoreUnusedItem,
  StoreSupplier,
  UserProfile,
} from "../types";
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
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState("All");

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    unit: "pcs",
    currentStock: 0,
    price: 0,
    bookPageNo: "",
  });

  const [isAddingLog, setIsAddingLog] = useState<"in" | "out" | false>(false);
  const [newLog, setNewLog] = useState<{
    items: { productName: string; quantity: number; costPrice: number }[];
    supplier?: string;
    category: StoreCategory;
    purchaseDate: string;
  }>({
    items: [{ productName: "", quantity: 0, costPrice: 0 }],
    supplier: "",
    category: "Store",
    purchaseDate: new Date().toISOString().split("T")[0],
  });

  const [isAddingPurchase, setIsAddingPurchase] = useState(false);
  const [newPurchase, setNewPurchase] = useState<{
    billNumber: string;
    supplier: string;
    category: StoreCategory;
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
  const [editingLog, setEditingLog] = useState<StorePurchase | null>(null);
  const [editLogForm, setEditLogForm] = useState<{
    productName: string;
    quantity: number;
    costPrice?: number;
    supplier?: string;
    category: StoreCategory;
    purchaseDate: string;
  }>({
    productName: "",
    quantity: 0,
    costPrice: 0,
    supplier: "",
    category: "Store",
    purchaseDate: new Date().toISOString().split("T")[0],
  });
  const [billNumberToDelete, setBillNumberToDelete] = useState<string | null>(null);
  const [unusedToDelete, setUnusedToDelete] = useState<StoreUnusedItem | null>(
    null,
  );
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    category: "",
    unit: "pcs",
    price: 0,
    bookPageNo: "",
  });
  const [transferProduct, setTransferProduct] = useState<StoreProduct | null>(null);
  const [transferForm, setTransferForm] = useState<{ destProductId: string; quantity: number; remarks: string }>({
    destProductId: "",
    quantity: 1,
    remarks: "",
  });
  const [ledgerDateFrom, setLedgerDateFrom] = useState("");
  const [editingOpeningStock, setEditingOpeningStock] = useState<string | null>(null);
  const [ledgerDateTo, setLedgerDateTo] = useState("");
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
        bookPageNo: "",
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

  const handleStartEditProduct = (product: StoreProduct) => {
    setEditProductForm({
      name: product.name,
      category: product.category || "",
      unit: product.unit || "pcs",
      price: product.price || 0,
      bookPageNo: product.bookPageNo || "",
    });
    setEditingProduct(product);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingProduct) return;
    try {
      await updateDoc(doc(db, "store_products", editingProduct.id), {
        name: editProductForm.name,
        category: editProductForm.category,
        unit: editProductForm.unit,
        price: editProductForm.price,
        bookPageNo: editProductForm.bookPageNo,
      });
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "store_products");
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !transferProduct) return;
    const { destProductId, quantity, remarks } = transferForm;
    if (quantity <= 0) return;
    if (quantity > transferProduct.currentStock) {
      alert(`Cannot transfer ${quantity} units — only ${transferProduct.currentStock} in stock. Stock cannot go negative.`);
      return;
    }
    const destProduct = products.find((p) => p.id === destProductId);
    if (!destProduct) return;
    try {
      await updateDoc(doc(db, "store_products", transferProduct.id), {
        currentStock: increment(-quantity),
      });
      await updateDoc(doc(db, "store_products", destProduct.id), {
        currentStock: increment(quantity),
      });
      await addDoc(collection(db, "store_purchases"), {
        type: "transfer",
        category: transferProduct.category as StoreCategory,
        toCategory: destProduct.category,
        productName: transferProduct.name,
        quantity,
        supplier: remarks,
        purchaseDate: new Date().toISOString(),
        recordedBy: profile?.displayName || "Admin",
      });
      setTransferProduct(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "store_products");
    }
  };

  const handleDeleteLog = async () => {
    if (!logToDelete) return;
    const canDelete =
      logToDelete.type === "purchase" ? isMainAdmin : isAdmin;
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

  const handleStartEditLog = (log: StorePurchase) => {
    setEditLogForm({
      productName: log.productName,
      quantity: log.quantity,
      costPrice: log.costPrice || 0,
      supplier: log.supplier || "",
      category: log.category,
      purchaseDate: new Date(log.purchaseDate).toISOString().split("T")[0],
    });
    setEditingLog(log);
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingLog) return;
    try {
      await updateDoc(doc(db, "store_purchases", editingLog.id), {
        category: editLogForm.category,
        productName: editLogForm.productName,
        quantity: editLogForm.quantity,
        costPrice: editLogForm.costPrice || 0,
        totalCost: editLogForm.quantity * (editLogForm.costPrice || 0),
        supplier: editLogForm.supplier || "",
        purchaseDate: new Date(editLogForm.purchaseDate).toISOString(),
      });

      const existingProduct = products.find(
        (p) => p.name.toLowerCase() === editLogForm.productName.toLowerCase()
      );
      if (existingProduct) {
        const oldDelta =
          editingLog.type !== "out" ? editingLog.quantity : -editingLog.quantity;
        const newDelta =
          editingLog.type !== "out" ? editLogForm.quantity : -editLogForm.quantity;
        await updateDoc(doc(db, "store_products", existingProduct.id), {
          currentStock: increment(newDelta - oldDelta),
        });
      }

      setEditingLog(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "store_purchases");
    }
  };

  const handleDeleteInvoice = async () => {
    if (!isAdmin || !billNumberToDelete) return;
    try {
      const invoiceLogs = logs.filter(
        (l) => l.type === "purchase" && l.billNumber === billNumberToDelete
      );
      await Promise.all(
        invoiceLogs.map((l) => deleteDoc(doc(db, "store_purchases", l.id)))
      );

      const stockDeltas = new Map<string, number>();
      for (const l of invoiceLogs) {
        const key = l.productName.toLowerCase();
        stockDeltas.set(key, (stockDeltas.get(key) || 0) + l.quantity);
      }
      await Promise.all(
        Array.from(stockDeltas.entries()).map(([nameLower, qty]) => {
          const existingProduct = products.find(
            (p) => p.name.toLowerCase() === nameLower
          );
          if (!existingProduct) return Promise.resolve();
          return updateDoc(doc(db, "store_products", existingProduct.id), {
            currentStock: increment(-qty),
          });
        })
      );

      setBillNumberToDelete(null);
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

    const getWeightedRate = (purchaseLogs: StorePurchase[]) => {
      const qty = purchaseLogs.reduce((sum, l) => sum + l.quantity, 0);
      if (qty === 0) return { rate: 0, rateInclVat: 0 };
      const cost = purchaseLogs.reduce((sum, l) => sum + (l.totalCost || 0), 0);
      const vat = purchaseLogs.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
      return { rate: cost / qty, rateInclVat: (cost + vat) / qty };
    };

    const rows = dataToExport.map((p) => {
      const productLogs = logs.filter(
        (l) =>
          l.productName === p.name &&
          new Date(l.purchaseDate) >= fromDate &&
          new Date(l.purchaseDate) <= toDate
      );
      const purchaseLogsInRange = productLogs.filter((l) => l.type === "purchase");
      const purchaseThisMonth = purchaseLogsInRange.reduce(
        (sum, l) => sum + l.quantity,
        0
      );
      const inThisMonth = productLogs
        .filter((l) => l.type === "in")
        .reduce((sum, l) => sum + l.quantity, 0);
      const outThisMonth = productLogs
        .filter((l) => l.type === "out")
        .reduce((sum, l) => sum + l.quantity, 0);
      const previousStock =
        p.currentStock - purchaseThisMonth - inThisMonth + outThisMonth;

      const allPurchaseLogs = logs.filter(
        (l) => l.type === "purchase" && l.productName === p.name
      );
      const purchaseRate = getWeightedRate(purchaseLogsInRange);
      const totalRate = getWeightedRate(allPurchaseLogs);

      return {
        "Item Name": p.name,
        "Previous Stock": previousStock,
        "Purchase This Month": purchaseThisMonth,
        "Purchase Rate": Number(purchaseRate.rateInclVat.toFixed(2)),
        "Purchase Total Value": Number(
          (purchaseThisMonth * purchaseRate.rateInclVat).toFixed(2)
        ),
        "Out This Month": outThisMonth,
        "In This Month": inThisMonth,
        "Total Current Stock": p.currentStock,
        "Total Rate": Number(totalRate.rateInclVat.toFixed(2)),
        "Total Value": Number((p.currentStock * totalRate.rateInclVat).toFixed(2)),
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

    const validItems = newLog.items.filter(
      (it) => it.productName.trim() && it.quantity > 0
    );
    if (validItems.length === 0) return;

    // Validate all "out" items against stock before writing anything
    if (isAddingLog === "out") {
      for (const it of validItems) {
        const existing = products.find(
          (p) => p.name.toLowerCase() === it.productName.toLowerCase() && p.category === newLog.category
        );
        if (existing && it.quantity > existing.currentStock) {
          alert(`Cannot log ${it.quantity} of "${it.productName}" out — only ${existing.currentStock} in stock. Stock cannot go negative.`);
          return;
        }
      }
    }

    try {
      for (const it of validItems) {
        const logData: Omit<StorePurchase, "id"> = {
          type: isAddingLog,
          category: newLog.category,
          productName: it.productName,
          quantity: it.quantity,
          costPrice: it.costPrice || 0,
          totalCost: it.quantity * (it.costPrice || 0),
          supplier: newLog.supplier || "",
          purchaseDate: new Date(newLog.purchaseDate).toISOString(),
          recordedBy: profile?.displayName || "Admin",
        };

        const existingProduct = products.find(
          (p) => p.name.toLowerCase() === it.productName.toLowerCase() && p.category === newLog.category
        );

        await addDoc(collection(db, "store_purchases"), logData);

        const quantityDelta = isAddingLog === "in" ? it.quantity : -it.quantity;

        if (existingProduct) {
          await updateDoc(doc(db, "store_products", existingProduct.id), {
            currentStock: increment(quantityDelta),
          });
        } else if (isAddingLog === "in") {
          await addDoc(collection(db, "store_products"), {
            name: it.productName,
            category: newLog.category,
            unit: "pcs",
            currentStock: it.quantity,
            price: 0,
          });
        }

        if (isAddingLog === "out") {
          await removeMatchingUnusedItems(it.productName);
        }
      }

      setIsAddingLog(false);
      setNewLog((prev) => ({
        items: [{ productName: "", quantity: 0, costPrice: 0 }],
        supplier: "",
        category: prev.category,
        purchaseDate: prev.purchaseDate,
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_purchases");
    }
  };

  const updateLogItemRow = (
    index: number,
    patch: Partial<{ productName: string; quantity: number; costPrice: number }>,
  ) => {
    setNewLog((prev) => ({
      ...prev,
      items: prev.items.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
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
      setNewPurchase((prev) => ({
        billNumber: "",
        supplier: "",
        category: prev.category,
        purchaseDate: prev.purchaseDate,
        items: [{ productName: "", quantity: 0, costPrice: 0, vatEnabled: false }],
        vatRate: prev.vatRate,
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "store_purchases");
    }
  };

  const getProductInventoryValue = (product: StoreProduct) => {
    const purchaseLogs = logs.filter(
      (l) => l.type === "purchase" && l.productName === product.name,
    );
    const quantity = purchaseLogs.reduce((sum, l) => sum + l.quantity, 0);
    const cost = purchaseLogs.reduce((sum, l) => sum + (l.totalCost || 0), 0);
    const vat = purchaseLogs.reduce((sum, l) => sum + (l.vatAmount || 0), 0);
    const rateInclVat =
      quantity > 0 ? (cost + vat) / quantity : product.price || 0;
    return product.currentStock * rateInclVat;
  };

  const getStockBadgeClass = (stock: number) => {
    if (stock <= 0) return "bg-rose-50 text-rose-700 border-rose-100";
    if (stock < 10) return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  const inventoryCategories = ["All", ...STORE_CATEGORIES];

  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term);
      const matchesCategory =
        inventoryCategoryFilter === "All" ||
        p.category === inventoryCategoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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
        <div className="space-y-4">
          <div className="bg-white border border-gray-100 rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
                <div className="relative w-full sm:max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-transparent rounded-lg focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none text-sm font-medium"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {inventoryCategories.map((category) => {
                    const isActive = inventoryCategoryFilter === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setInventoryCategoryFilter(category)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap border transition-colors ${
                          isActive
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isAdmin && (
                <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImport}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                  >
                    <Upload className="w-4 h-4" /> Import
                  </button>
                  <button
                    onClick={() => setIsExportModalOpen(true)}
                    className="px-3 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                  >
                    <Download className="w-4 h-4" /> Export
                  </button>
                  <button
                    onClick={() => setIsAddingProduct(true)}
                    className="px-3 py-2 bg-emerald-500 text-white rounded-lg font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 whitespace-nowrap text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-3 text-xs font-bold text-gray-500">
              <span>{filteredProducts.length} shown</span>
              <span>{products.length} total</span>
              <span>
                {products.filter((product) => product.currentStock < 10).length} low stock
              </span>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase text-right">
                      Stock
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase">
                      Unit
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase text-right">
                      Price
                    </th>
                    <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase text-right">
                      Value
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-[11px] font-bold text-gray-500 uppercase text-right">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredProducts.map((product) => {
                    const inventoryValue = getProductInventoryValue(product);
                    return (
                      <tr
                        key={product.id}
                        onClick={() => setSelectedProduct(product)}
                        className="group cursor-pointer hover:bg-emerald-50/40 transition-colors"
                      >
                        <td className="px-4 py-3 min-w-[260px]">
                          <div className="font-bold text-sm text-gray-900 leading-snug">
                            {product.name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                            {product.category || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex justify-end min-w-16 px-2.5 py-1 rounded-lg border text-xs font-bold ${getStockBadgeClass(product.currentStock)}`}
                          >
                            {product.currentStock}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-500">
                          {product.unit}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                          Rs. {product.price || 0}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                          {inventoryValue > 0 ? `Rs. ${inventoryValue.toFixed(2)}` : "-"}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditProduct(product);
                                }}
                                className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                title="Edit product"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTransferProduct(product);
                                  const firstOther = products.find((p) => p.id !== product.id);
                                  setTransferForm({ destProductId: firstOther?.id || "", quantity: 1, remarks: "" });
                                }}
                                className="p-2 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title="Transfer stock"
                              >
                                <ArrowLeftRight className="w-4 h-4" />
                              </button>
                              {isMainAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProductToDelete(product.id);
                                  }}
                                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                  title="Delete product"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {filteredProducts.map((product) => {
                const inventoryValue = getProductInventoryValue(product);
                return (
                  <div key={product.id} className="p-4 bg-white">
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-gray-900 leading-snug">
                            {product.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                            <span>{product.category || "Uncategorized"}</span>
                            <span>{product.unit}</span>
                            <span>Rs. {product.price || 0}</span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 px-2.5 py-1 rounded-lg border text-xs font-bold ${getStockBadgeClass(product.currentStock)}`}
                        >
                          {product.currentStock}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs font-bold">
                        <span className="text-gray-500">Inventory value</span>
                        <span className="text-emerald-700">
                          {inventoryValue > 0 ? `Rs. ${inventoryValue.toFixed(2)}` : "-"}
                        </span>
                      </div>
                    </button>
                    {isAdmin && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleStartEditProduct(product)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => {
                            setTransferProduct(product);
                            const firstOther = products.find((p) => p.id !== product.id);
                            setTransferForm({ destProductId: firstOther?.id || "", quantity: 1, remarks: "" });
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
                        </button>
                        {isMainAdmin && (
                          <button
                            onClick={() => setProductToDelete(product.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="p-8 text-center text-sm font-medium text-gray-500">
                No products found
              </div>
            )}
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

          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {activeTab === "in" ? "Items In History" : "Items Out History"}
              </h2>
            </div>
            <div className="hidden lg:block overflow-x-auto">
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
                      <td className="p-4 font-medium text-gray-500">
                        {log.supplier || "-"}
                      </td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">
                        {log.recordedBy}
                      </td>
                      {isAdmin && (
                        <td className="p-4 pr-6">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditLog(log)}
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit entry"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setLogToDelete(log)}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {logs.filter(log => log.type === activeTab).length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-gray-500">
                        No history found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
              {logs.filter(log => log.type === activeTab).map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-gray-900 leading-snug">
                        {log.productName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-gray-500">
                        <span>{new NepaliDate(new Date(log.purchaseDate)).format("YYYY-MM-DD")}</span>
                        <span>&middot;</span>
                        <span>{log.category}</span>
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold">
                      Qty {log.quantity}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-gray-500">
                      <span className="font-bold">
                        {activeTab === "in" ? "Returned by" : "Ordered by"}:
                      </span>{" "}
                      {log.supplier || "-"}
                      <span className="ml-2 text-gray-400">by {log.recordedBy}</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEditLog(log)}
                          className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit entry"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setLogToDelete(log)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {logs.filter(log => log.type === activeTab).length === 0 && (
                <div className="p-8 text-center text-sm font-medium text-gray-500">
                  No history found
                </div>
              )}
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
                    {isAdmin && (
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
                        {log.costPrice ? `Rs. ${log.costPrice}` : "-"}
                      </td>
                      <td className="p-4 font-bold text-emerald-600">
                        {log.totalCost ? `Rs. ${log.totalCost}` : "-"}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.vatAmount ? `Rs. ${log.vatAmount.toFixed(2)} (${log.vatRate}%)` : "-"}
                      </td>
                      <td className="p-4 font-medium text-gray-500">
                        {log.supplier || "-"}
                      </td>
                      <td className="p-4 pr-6 text-gray-400 text-sm">
                        {log.recordedBy}
                      </td>
                      {isAdmin && (
                        <td className="p-4 pr-6">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleStartEditLog(log)}
                              className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit entry"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isMainAdmin && (
                              <button
                                onClick={() => setLogToDelete(log)}
                                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {logs.filter((log) => log.type === "purchase").length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="p-8 text-center text-gray-500">
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
          <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Invoices</h2>
              <button
                onClick={() => setIsInvoiceExportModalOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all"
              >
                <Download className="w-4 h-4" /> Export
              </button>
            </div>
            <div className="hidden lg:block overflow-x-auto">
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
                    {isAdmin && (
                      <th className="p-4 font-bold text-sm text-gray-500 uppercase tracking-wider pr-6">
                        Actions
                      </th>
                    )}
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
                          {vatTotal > 0 ? `Rs. ${vatTotal.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 pr-6 font-bold text-emerald-600">
                          Rs. {(subtotal + vatTotal).toFixed(2)}
                        </td>
                        {isAdmin && (
                          <td className="p-4 pr-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBillNumberToDelete(billNumber);
                              }}
                              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {logs.filter((log) => log.type === "purchase" && log.billNumber).length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="p-8 text-center text-gray-500">
                        No invoices found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
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
                  <div
                    key={billNumber}
                    onClick={() => setSelectedInvoiceBillNumber(billNumber)}
                    className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-indigo-600">{billNumber}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-gray-500">
                          <span>{new NepaliDate(new Date(first.purchaseDate)).format("YYYY-MM-DD")}</span>
                          <span>&middot;</span>
                          <span>{first.supplier || "-"}</span>
                          <span>&middot;</span>
                          <span>{items.length} items</span>
                        </div>
                      </div>
                      <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                        Rs. {(subtotal + vatTotal).toFixed(2)}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="mt-2 flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBillNumberToDelete(billNumber);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete invoice"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {logs.filter((log) => log.type === "purchase" && log.billNumber).length === 0 && (
                <div className="p-8 text-center text-sm font-medium text-gray-500">
                  No invoices found
                </div>
              )}
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
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
                    Selling Price (Rs.)
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
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Book Page No <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newProduct.bookPageNo}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, bookPageNo: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. 42"
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-sm shadow-2xl text-center"
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-sm shadow-2xl text-center"
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

      {/* Delete Invoice Confirmation Modal */}
      <AnimatePresence>
        {billNumberToDelete && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Delete Invoice {billNumberToDelete}?
              </h3>
              <p className="text-gray-500 mb-8">
                This will remove all line items on this invoice and reverse their stock adjustments. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setBillNumberToDelete(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteInvoice}
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-sm shadow-2xl text-center"
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

      {/* Transfer Stock Modal */}
      <AnimatePresence>
        {transferProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setTransferProduct(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <ArrowLeftRight className="w-5 h-5 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">
                  Transfer Stock
                </h2>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-5 text-sm">
                <div className="font-bold text-gray-900">{transferProduct.name}</div>
                <div className="text-gray-500 mt-0.5">
                  From: <span className="font-bold text-gray-700">{transferProduct.category}</span>
                  &nbsp;·&nbsp;Available: <span className="font-bold text-gray-700">{transferProduct.currentStock} {transferProduct.unit}</span>
                </div>
              </div>

              <form onSubmit={handleTransfer} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Destination Product
                  </label>
                  <select
                    required
                    value={transferForm.destProductId}
                    onChange={(e) => setTransferForm({ ...transferForm, destProductId: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium cursor-pointer"
                  >
                    <option value="">Select destination product…</option>
                    {products
                      .filter((p) => p.id !== transferProduct.id)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Quantity to Transfer
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={transferProduct.currentStock}
                    required
                    value={transferForm.quantity || ""}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-gray-900"
                  />
                  <p className="text-xs text-gray-400 mt-1">Max: {transferProduct.currentStock} {transferProduct.unit}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Remarks <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Reason for transfer…"
                    value={transferForm.remarks}
                    onChange={(e) => setTransferForm({ ...transferForm, remarks: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-gray-900"
                  />
                </div>

                {transferForm.quantity > 0 && transferForm.destProductId && (() => {
                  const dest = products.find((p) => p.id === transferForm.destProductId);
                  if (!dest) return null;
                  return (
                    <div className="bg-emerald-50 p-4 rounded-xl text-sm space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>{transferProduct.name} ({transferProduct.category}) after:</span>
                        <span className={`font-bold ${transferProduct.currentStock - transferForm.quantity < 0 ? "text-rose-600" : "text-gray-900"}`}>
                          {transferProduct.currentStock - transferForm.quantity} {transferProduct.unit}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>{dest.name} ({dest.category}) after:</span>
                        <span className="font-bold text-emerald-700">
                          {dest.currentStock + transferForm.quantity} {dest.unit}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  disabled={
                    !transferForm.destProductId ||
                    transferForm.quantity <= 0 ||
                    transferForm.quantity > transferProduct.currentStock ||
                    !transferForm.remarks.trim()
                  }
                  className="w-full pt-2"
                >
                  <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all text-center flex items-center justify-center gap-2 disabled:opacity-50">
                    <ArrowLeftRight className="w-5 h-5" /> Transfer Stock
                  </div>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setEditingProduct(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Edit Product
              </h2>

              <form onSubmit={handleUpdateProduct} className="space-y-4 text-left">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editProductForm.name}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, name: e.target.value })
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
                    value={editProductForm.category}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, category: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. Stationery, Uniform"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      required
                      value={editProductForm.unit}
                      onChange={(e) =>
                        setEditProductForm({ ...editProductForm, unit: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                      placeholder="e.g. pcs, boxes"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Selling Price (Rs.)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={editProductForm.price}
                      onChange={(e) =>
                        setEditProductForm({
                          ...editProductForm,
                          price: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-left text-gray-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Book Page No <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editProductForm.bookPageNo}
                    onChange={(e) =>
                      setEditProductForm({ ...editProductForm, bookPageNo: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. 42"
                  />
                </div>

                <button type="submit" className="w-full pt-2">
                  <div className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all text-center flex items-center justify-center gap-2">
                    <Pencil className="w-5 h-5" /> Save Changes
                  </div>
                </button>
              </form>
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto"
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
                        category: e.target.value as StoreCategory,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                  >
                    {STORE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    Items
                  </label>
                  <div className="space-y-3 max-h-[38vh] overflow-y-auto pr-1 -mr-1">
                  {newLog.items.map((item, index) => {
                    const matched = products.find(
                      (p) =>
                        p.name.toLowerCase() === item.productName.toLowerCase() &&
                        p.category === newLog.category
                    );
                    return (
                      <div key={index} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            required
                            value={item.productName}
                            onChange={(e) => updateLogItemRow(index, { productName: e.target.value })}
                            className="flex-1 px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                            placeholder="Product name..."
                            list="product-list"
                          />
                          {newLog.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewLog((prev) => ({
                                  ...prev,
                                  items: prev.items.filter((_, i) => i !== index),
                                }))
                              }
                              className="text-gray-400 hover:text-rose-500 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min="1"
                            required
                            value={item.quantity || ""}
                            onChange={(e) => updateLogItemRow(index, { quantity: Number(e.target.value) })}
                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm text-gray-900"
                            placeholder="Quantity"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.costPrice || ""}
                            onChange={(e) => updateLogItemRow(index, { costPrice: Number(e.target.value) })}
                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                            placeholder="Cost/unit (optional)"
                          />
                        </div>
                        {matched && (
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-gray-500">
                            <span>
                              Current Stock:{" "}
                              <strong className={matched.currentStock > 0 ? "text-emerald-600" : "text-rose-600"}>
                                {matched.currentStock} {matched.unit}
                              </strong>
                            </span>
                            {matched.bookPageNo && (
                              <span>
                                Book Page No: <strong className="text-gray-800">{matched.bookPageNo}</strong>
                              </span>
                            )}
                            {isAddingLog === "out" && item.quantity > matched.currentStock && (
                              <span className="text-rose-600 font-bold">Not enough stock!</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                  <datalist id="product-list">
                    {products
                      .filter((p) => p.category === newLog.category)
                      .map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() =>
                      setNewLog((prev) => ({
                        ...prev,
                        items: [...prev.items, { productName: "", quantity: 0, costPrice: 0 }],
                      }))
                    }
                    className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-500 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Add Another Item
                  </button>
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

                {newLog.items.some((it) => it.quantity > 0 && it.costPrice > 0) && (
                  <div className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center mt-2">
                    <span className="font-bold text-indigo-700 text-sm">
                      Total Amount:
                    </span>
                    <span className="font-bold text-indigo-700 text-xl">
                      Rs.
                      {newLog.items
                        .reduce((sum, it) => sum + it.quantity * (it.costPrice || 0), 0)
                        .toFixed(2)}
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
      {/* Edit Log Entry Modal */}
      <AnimatePresence>
        {editingLog && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
            >
              <button
                onClick={() => setEditingLog(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-2xl font-bold text-gray-900 mb-6 font-sans tracking-tight">
                Edit {editingLog.type === "in" ? "Items In" : editingLog.type === "out" ? "Items Out" : "Purchase"} Entry
              </h2>

              <form
                onSubmit={handleUpdateLog}
                className="space-y-4 text-left"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Entry Category
                  </label>
                  <select
                    required
                    value={editLogForm.category}
                    onChange={(e) =>
                      setEditLogForm({
                        ...editLogForm,
                        category: e.target.value as StoreCategory,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                  >
                    {STORE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Product Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editLogForm.productName}
                    onChange={(e) =>
                      setEditLogForm({
                        ...editLogForm,
                        productName: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder="Enter product name..."
                    list="edit-product-list"
                  />
                  <datalist id="edit-product-list">
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
                      value={editLogForm.quantity || ""}
                      onChange={(e) =>
                        setEditLogForm({
                          ...editLogForm,
                          quantity: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-left text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      Cost Price (Rs./unit) <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editLogForm.costPrice || ""}
                      onChange={(e) =>
                        setEditLogForm({
                          ...editLogForm,
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
                    value={editLogForm.purchaseDate}
                    onChange={(e) =>
                      setEditLogForm({
                        ...editLogForm,
                        purchaseDate: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {editingLog.type === "in" ? "Returned By" : "Ordered By"} <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editLogForm.supplier}
                    onChange={(e) =>
                      setEditLogForm({
                        ...editLogForm,
                        supplier: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                    placeholder={editingLog.type === "in" ? "e.g. John Doe" : "e.g. Class Teacher"}
                  />
                </div>

                {editLogForm.quantity > 0 && editLogForm.costPrice !== undefined && editLogForm.costPrice > 0 && (
                  <div className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center mt-2">
                    <span className="font-bold text-indigo-700 text-sm">
                      Total Amount:
                    </span>
                    <span className="font-bold text-indigo-700 text-xl">
                      Rs. 
                      {(editLogForm.quantity * editLogForm.costPrice).toFixed(
                        2,
                      )}
                    </span>
                  </div>
                )}

                <button type="submit" className="w-full pt-2">
                  <div className="w-full py-4 text-white rounded-xl font-bold transition-all text-center flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600">
                    <Pencil className="w-5 h-5" /> Update Entry
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] overflow-y-auto"
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
                          category: e.target.value as StoreCategory,
                        })
                      }
                      className="w-full px-4 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium cursor-pointer"
                    >
                      {STORE_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
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
                              ? `Total incl. VAT (${newPurchase.vatRate}%): Rs. ${(itemTotal + itemVat).toFixed(2)}`
                              : `Total: Rs. ${itemTotal.toFixed(2)}`}
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
                        <span className="font-bold text-indigo-700">Rs. {subtotal.toFixed(2)}</span>
                      </div>
                      {vatAmount > 0 && (
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-700 text-sm">
                            VAT ({newPurchase.vatRate}%):
                          </span>
                          <span className="font-bold text-indigo-700">Rs. {vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-indigo-700 text-sm">Grand Total:</span>
                        <span className="font-bold text-indigo-700 text-xl">
                          Rs. {grandTotal.toFixed(2)}
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

      {/* Product Ledger Modal */}
      <AnimatePresence>
        {selectedProduct && (() => {
          // All entries for this specific product (name + category), sorted oldest→newest
          const ledgerEntries = logs
            .filter((l) => {
              const nameMatch = l.productName === selectedProduct.name;
              const catMatch =
                l.category === selectedProduct.category ||
                (l.type === "transfer" && l.toCategory === selectedProduct.category);
              return nameMatch && catMatch;
            })
            .sort((a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime());

          // Compute opening stock: currentStock minus all logged movements
          const totalDelta = ledgerEntries.reduce((sum, l) => {
            const isTransferIn = l.type === "transfer" && l.toCategory === selectedProduct.category;
            const isTransferOut = l.type === "transfer" && l.category === selectedProduct.category;
            if (l.type === "in" || l.type === "purchase" || isTransferIn) return sum + l.quantity;
            if (l.type === "out" || isTransferOut) return sum - l.quantity;
            return sum;
          }, 0);
          const openingStock = selectedProduct.currentStock - totalDelta;

          // Editing opening stock adjusts currentStock by the difference,
          // since opening stock is derived (currentStock − all movements)
          const handleSaveOpeningStock = async () => {
            if (!isAdmin || editingOpeningStock === null) return;
            const newOpening = Number(editingOpeningStock);
            if (isNaN(newOpening) || newOpening < 0) {
              alert("Opening stock must be a number of 0 or more.");
              return;
            }
            const diff = newOpening - openingStock;
            if (diff !== 0) {
              const newCurrent = selectedProduct.currentStock + diff;
              if (newCurrent < 0) {
                alert(`Cannot set opening stock to ${newOpening} — current stock would become ${newCurrent}. Stock cannot go negative.`);
                return;
              }
              try {
                await updateDoc(doc(db, "store_products", selectedProduct.id), {
                  currentStock: increment(diff),
                });
                setSelectedProduct({ ...selectedProduct, currentStock: newCurrent });
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, "store_products");
                return;
              }
            }
            setEditingOpeningStock(null);
          };

          // Build running balance starting from opening stock
          let running = openingStock;
          const ledgerRows = ledgerEntries.map((l) => {
            const isTransferIn = l.type === "transfer" && l.toCategory === selectedProduct.category;
            const isTransferOut = l.type === "transfer" && l.category === selectedProduct.category;
            let delta = 0;
            if (l.type === "in" || l.type === "purchase" || isTransferIn) delta = l.quantity;
            else if (l.type === "out" || isTransferOut) delta = -l.quantity;
            running += delta;
            return { ...l, delta, balance: running };
          });

          // Date range filter for export
          const filteredForExport = ledgerRows.filter((r) => {
            const d = new Date(r.purchaseDate).getTime();
            const from = ledgerDateFrom ? new Date(ledgerDateFrom).getTime() : -Infinity;
            const to = ledgerDateTo ? new Date(ledgerDateTo + "T23:59:59").getTime() : Infinity;
            return d >= from && d <= to;
          });

          const handleLedgerExport = () => {
            const openingRow = { Date: "—", Type: "OPENING STOCK", Qty: "", Balance: openingStock, Remarks: "", "Recorded By": "" };
            const dataRows = filteredForExport.map((r) => ({
              Date: new NepaliDate(new Date(r.purchaseDate)).format("YYYY-MM-DD"),
              Type: r.type.toUpperCase() + (r.type === "transfer" ? (r.toCategory === selectedProduct.category ? " IN" : " OUT") : ""),
              Qty: r.delta > 0 ? `+${r.delta}` : String(r.delta),
              Balance: r.balance,
              Remarks: r.supplier || "",
              "Recorded By": r.recordedBy,
            }));
            const ws = XLSX.utils.json_to_sheet([openingRow, ...dataRows]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Ledger");
            XLSX.writeFile(wb, `${selectedProduct.name}_ledger.xlsx`);
          };

          const typeBadge = (row: typeof ledgerRows[0]) => {
            if (row.type === "transfer") {
              return row.toCategory === selectedProduct.category
                ? <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">TRANSFER IN</span>
                : <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">TRANSFER OUT</span>;
            }
            if (row.type === "purchase") return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">PURCHASE</span>;
            if (row.type === "in") return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">IN</span>;
            return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">OUT</span>;
          };

          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-3xl shadow-2xl relative max-h-[92vh] flex flex-col"
              >
                <button
                  onClick={() => { setSelectedProduct(null); setEditingOpeningStock(null); }}
                  className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="flex items-start gap-4 mb-5 shrink-0">
                  <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0">
                    <Package className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">{selectedProduct.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm mt-1 text-gray-500 font-medium">
                      <span>{selectedProduct.category || "Uncategorized"}</span>
                      <span>•</span>
                      <span>Current Stock: <strong className="text-gray-900">{selectedProduct.currentStock} {selectedProduct.unit}</strong></span>
                      <span>•</span>
                      <span>Price: <strong className="text-gray-900">Rs. {selectedProduct.price || 0}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Export controls */}
                <div className="flex flex-wrap items-end gap-3 mb-4 shrink-0">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">From</label>
                    <input
                      type="date"
                      value={ledgerDateFrom}
                      onChange={(e) => setLedgerDateFrom(e.target.value)}
                      className="px-3 py-2 bg-gray-50 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">To</label>
                    <input
                      type="date"
                      value={ledgerDateTo}
                      onChange={(e) => setLedgerDateTo(e.target.value)}
                      className="px-3 py-2 bg-gray-50 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    onClick={handleLedgerExport}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors"
                  >
                    <Download className="w-4 h-4" /> Export XLSX
                  </button>
                </div>

                <h3 className="font-bold text-base mb-3 text-gray-900 shrink-0">
                  Stock Ledger <span className="text-gray-400 font-normal text-sm">({ledgerRows.length} entries)</span>
                </h3>

                <div className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50 overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-white border-b border-gray-100">
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider pl-4">Date</th>
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-right">Qty</th>
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-right">Balance</th>
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Remarks</th>
                        <th className="p-3 font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {/* Opening stock row */}
                      <tr className="bg-amber-50/60">
                        <td className="p-3 pl-4 text-gray-400 text-xs font-medium">—</td>
                        <td className="p-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">OPENING STOCK</span>
                        </td>
                        <td className="p-3 text-right text-gray-400">—</td>
                        <td className="p-3 font-bold text-right text-gray-900">
                          {editingOpeningStock !== null ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                value={editingOpeningStock}
                                onChange={(e) => setEditingOpeningStock(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveOpeningStock();
                                  if (e.key === "Escape") setEditingOpeningStock(null);
                                }}
                                className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg text-right text-sm font-bold outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              <button
                                onClick={handleSaveOpeningStock}
                                className="px-2 py-1 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingOpeningStock(null)}
                                className="px-2 py-1 bg-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              {openingStock}
                              {isAdmin && (
                                <button
                                  onClick={() => setEditingOpeningStock(String(openingStock))}
                                  className="text-amber-600 hover:text-amber-800 transition-colors"
                                  title="Edit opening stock"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-gray-400 hidden sm:table-cell">—</td>
                        <td className="p-3 text-gray-400 hidden md:table-cell">—</td>
                      </tr>
                      {ledgerRows.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-500">No movement history</td>
                        </tr>
                      )}
                      {ledgerRows.map((row) => (
                        <tr key={row.id} className="hover:bg-white transition-colors">
                          <td className="p-3 pl-4 text-gray-900 font-medium whitespace-nowrap">
                            {new NepaliDate(new Date(row.purchaseDate)).format("YYYY-MM-DD")}
                          </td>
                          <td className="p-3">{typeBadge(row)}</td>
                          <td className={`p-3 font-bold text-right ${row.delta > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {row.delta > 0 ? `+${row.delta}` : row.delta}
                          </td>
                          <td className="p-3 font-bold text-right text-gray-900">{row.balance}</td>
                          <td className="p-3 text-gray-500 hidden sm:table-cell">{row.supplier || "—"}</td>
                          <td className="p-3 text-gray-500 hidden md:table-cell">{row.recordedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Export Modal */}
      <AnimatePresence>
        {isExportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
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
                    {STORE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-md shadow-2xl relative"
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
              className="bg-white rounded-2xl sm:rounded-[2rem] p-5 sm:p-8 w-full max-w-2xl shadow-2xl relative max-h-[85vh] overflow-y-auto"
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
                              <td className="p-3 text-gray-500">{item.costPrice ? `Rs. ${item.costPrice}` : "-"}</td>
                              <td className="p-3 font-bold text-emerald-600">{item.totalCost ? `Rs. ${item.totalCost}` : "-"}</td>
                              <td className="p-3 text-gray-500">{item.vatAmount ? `Rs. ${item.vatAmount.toFixed(2)}` : "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 space-y-1 text-right">
                      <p className="text-gray-500 font-medium">Subtotal: Rs. {subtotal.toFixed(2)}</p>
                      {vatTotal > 0 && (
                        <p className="text-gray-500 font-medium">VAT: Rs. {vatTotal.toFixed(2)}</p>
                      )}
                      <p className="text-gray-900 font-bold text-lg">
                        Grand Total: Rs. {(subtotal + vatTotal).toFixed(2)}
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
