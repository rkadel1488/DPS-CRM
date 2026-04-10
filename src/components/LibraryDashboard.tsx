import React, { useState, useEffect, useRef } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Book, BookIssue, UserProfile, Student } from '../types';
import { BookOpen, Search, Plus, Upload, Download, Bell, Clock, CheckCircle, X, AlertCircle, Trash2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { handleFirestoreError, OperationType } from '../App';

interface LibraryDashboardProps {
  profile: UserProfile | null;
  isAdmin: boolean;
}

export default function LibraryDashboard({ profile, isAdmin }: LibraryDashboardProps) {
  const [books, setBooks] = useState<Book[]>([]);
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  
  const [activeTab, setActiveTab] = useState<'books' | 'issues' | 'overdue'>('books');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  
  const [newBook, setNewBook] = useState({ bookCode: '', title: '', author: '', category: '', totalCopies: 1, bookClass: '', price: '' });
  const [newIssue, setNewIssue] = useState({ bookId: '', issuedToName: '', issuedToId: '', issuedToType: 'student' as 'student' | 'teacher' });
  
  const [notifications, setNotifications] = useState<BookIssue[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [selectedUserHistory, setSelectedUserHistory] = useState<{name: string, type: 'student'|'teacher'} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'book' | 'issue', item: any } | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  useEffect(() => {
    if (!profile) return;

    const booksUnsubscribe = onSnapshot(collection(db, 'books'), (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
      // Sort books by newest first
      booksData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBooks(booksData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'books'));

    const issuesUnsubscribe = onSnapshot(collection(db, 'book_issues'), (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookIssue));
      setIssues(issuesData);
      
      // Check for overdue books (> 7 days past due date)
      const now = new Date();
      const overdue = issuesData.filter(issue => {
        if (issue.status === 'returned') return false;
        const dueDate = new Date(issue.dueDate);
        if (now <= dueDate) return false;
        const diffTime = now.getTime() - dueDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 7;
      });
      setNotifications(overdue);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'book_issues'));

    const studentsUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'students'));

    const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const teachersUnsubscribe = onSnapshot(teachersQuery, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      booksUnsubscribe();
      issuesUnsubscribe();
      studentsUnsubscribe();
      teachersUnsubscribe();
    };
  }, [profile]);

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    try {
      let finalBookCode = newBook.bookCode.trim();
      if (!finalBookCode) {
        // Auto-generate book code
        const dpsBooks = books.filter(b => b.bookCode.startsWith('DPS-'));
        let maxNum = 0;
        dpsBooks.forEach(b => {
          const numPart = b.bookCode.substring(4);
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        });
        const nextNum = maxNum + 1;
        finalBookCode = `DPS-${nextNum.toString().padStart(4, '0')}`;
      }

      await addDoc(collection(db, 'books'), {
        ...newBook,
        bookCode: finalBookCode,
        price: newBook.price ? Number(newBook.price) : null,
        availableCopies: newBook.totalCopies,
        addedBy: profile.uid,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewBook({ bookCode: '', title: '', author: '', category: '', totalCopies: 1, bookClass: '', price: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'books');
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let currentMaxNum = 0;
        const dpsBooks = books.filter(b => b.bookCode.startsWith('DPS-'));
        dpsBooks.forEach(b => {
          const numPart = b.bookCode.substring(4);
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > currentMaxNum) {
            currentMaxNum = num;
          }
        });

        let importedCount = 0;
        for (const row of data as any[]) {
          // Try to find the title column dynamically
          const titleKey = Object.keys(row).find(k => 
            k.toLowerCase().includes('title') || 
            k.toLowerCase().includes('name') || 
            k.toLowerCase() === 'book'
          );
          
          const title = titleKey ? row[titleKey] : null;
          
          if (title) {
            // Try to find the book code column dynamically
            const codeKey = Object.keys(row).find(k => 
              k.toLowerCase().includes('code') || 
              k.toLowerCase().includes('id') || 
              k.toLowerCase().includes('isbn')
            );
            let bookCode = codeKey ? row[codeKey] : null;
            
            if (!bookCode) {
              currentMaxNum++;
              bookCode = `DPS-${currentMaxNum.toString().padStart(4, '0')}`;
            }

            // Try to find other columns dynamically
            const authorKey = Object.keys(row).find(k => k.toLowerCase().includes('author'));
            const categoryKey = Object.keys(row).find(k => k.toLowerCase().includes('category') || k.toLowerCase().includes('genre'));
            const classKey = Object.keys(row).find(k => k.toLowerCase().includes('class') || k.toLowerCase().includes('grade'));
            const priceKey = Object.keys(row).find(k => k.toLowerCase().includes('price') || k.toLowerCase().includes('cost'));
            const copiesKey = Object.keys(row).find(k => k.toLowerCase().includes('copies') || k.toLowerCase().includes('qty') || k.toLowerCase().includes('quantity'));

            const author = authorKey ? row[authorKey] : '';
            const category = categoryKey ? row[categoryKey] : '';
            const bookClass = classKey ? row[classKey] : '';
            const price = priceKey ? row[priceKey] : null;
            const totalCopies = copiesKey ? row[copiesKey] : 1;

            await addDoc(collection(db, 'books'), {
              bookCode: String(bookCode),
              title: String(title),
              author: String(author),
              category: String(category),
              bookClass: String(bookClass),
              price: price && !isNaN(Number(price)) ? Number(price) : null,
              totalCopies: Number(totalCopies),
              availableCopies: Number(totalCopies),
              addedBy: profile.uid,
              createdAt: new Date().toISOString()
            });
            importedCount++;
          }
        }
        
        if (importedCount === 0) {
          alert('No valid books found in the Excel file. Please ensure there is a "Title" or "Name" column.');
        } else {
          alert(`${importedCount} books imported successfully!`);
        }
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        console.error("Error importing books:", error);
        alert("Failed to import books. Please check the file format.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedBook) return;

    const issuedToName = newIssue.issuedToName.trim();

    if (!issuedToName) {
      alert('Please enter a valid student or teacher name.');
      return;
    }

    try {
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      await addDoc(collection(db, 'book_issues'), {
        bookId: selectedBook.id,
        bookCode: selectedBook.bookCode,
        bookTitle: selectedBook.title,
        issuedToId: 'manual',
        issuedToName,
        issuedToType: newIssue.issuedToType,
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        status: 'issued',
        issuedBy: profile.uid
      });

      await updateDoc(doc(db, 'books', selectedBook.id), {
        availableCopies: selectedBook.availableCopies - 1
      });

      setShowIssueModal(false);
      setNewIssue({ bookId: '', issuedToName: '', issuedToId: '', issuedToType: 'student' });
      setSelectedBook(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'book_issues');
    }
  };

  const handleReturnBook = async (issue: BookIssue) => {
    try {
      await updateDoc(doc(db, 'book_issues', issue.id), {
        status: 'returned',
        returnDate: new Date().toISOString()
      });

      const book = books.find(b => b.id === issue.bookId);
      if (book) {
        await updateDoc(doc(db, 'books', book.id), {
          availableCopies: book.availableCopies + 1
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `book_issues/${issue.id}`);
    }
  };

  const handleDeleteBook = (book: Book) => {
    setDeleteConfirm({ type: 'book', item: book });
  };

  const handleDeleteIssue = (issue: BookIssue) => {
    setDeleteConfirm({ type: 'issue', item: issue });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'book') {
      const book = deleteConfirm.item as Book;
      try {
        await deleteDoc(doc(db, 'books', book.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `books/${book.id}`);
      }
    } else if (deleteConfirm.type === 'issue') {
      const issue = deleteConfirm.item as BookIssue;
      try {
        if (issue.status === 'issued') {
          const book = books.find(b => b.id === issue.bookId);
          if (book) {
            await updateDoc(doc(db, 'books', book.id), {
              availableCopies: book.availableCopies + 1
            });
          }
        }
        await deleteDoc(doc(db, 'book_issues', issue.id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `book_issues/${issue.id}`);
      }
    }
    setDeleteConfirm(null);
  };

  const exportEntries = () => {
    const dataToExport = issues.map(issue => ({
      'Book Code': issue.bookCode,
      'Book Title': issue.bookTitle,
      'Issued To': issue.issuedToName,
      'Type': issue.issuedToType,
      'Issue Date': new Date(issue.issueDate).toLocaleDateString(),
      'Due Date': new Date(issue.dueDate).toLocaleDateString(),
      'Return Date': issue.returnDate ? new Date(issue.returnDate).toLocaleDateString() : 'Not Returned',
      'Status': issue.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Library Entries");
    XLSX.writeFile(wb, "Library_Entries.xlsx");
  };

  const exportBooks = () => {
    const dataToExport = books.map(book => ({
      'Book Code': book.bookCode,
      'Title': book.title,
      'Author': book.author || 'N/A',
      'Category': book.category || 'General',
      'Class': book.bookClass || 'N/A',
      'Price': book.price || 'N/A',
      'Total Copies': book.totalCopies,
      'Available Copies': book.availableCopies
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Books");
    XLSX.writeFile(wb, "Library_Books.xlsx");
  };

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    book.bookCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIssues = issues.filter(issue => 
    issue.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
    issue.issuedToName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOverdue = notifications.filter(issue =>
    issue.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
    issue.issuedToName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(
    (activeTab === 'books' ? filteredBooks.length : 
     activeTab === 'issues' ? filteredIssues.length : 
     filteredOverdue.length) / itemsPerPage
  );
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBooks = filteredBooks.slice(startIndex, startIndex + itemsPerPage);
  const paginatedIssues = filteredIssues.slice(startIndex, startIndex + itemsPerPage);
  const paginatedOverdue = filteredOverdue.slice(startIndex, startIndex + itemsPerPage);

  const renderIssuesTable = (items: BookIssue[], emptyMessage: string) => (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-black/5">
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Book</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Issued To</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Issue Date</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900">Status</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {items.length > 0 ? items.map((issue) => {
              const isOverdue = issue.status === 'issued' && new Date(issue.dueDate) < new Date();
              return (
                <tr key={issue.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">{issue.bookTitle}</p>
                    <p className="text-xs text-gray-500 font-mono">{issue.bookCode}</p>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => setSelectedUserHistory({name: issue.issuedToName, type: issue.issuedToType})}
                      className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline text-left transition-colors"
                    >
                      {issue.issuedToName}
                    </button>
                    <p className="text-xs text-gray-500 capitalize">{issue.issuedToType}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900">{new Date(issue.issueDate).toLocaleDateString()}</p>
                    <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                      Due: {new Date(issue.dueDate).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    {issue.status === 'returned' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Returned
                      </span>
                    ) : isOverdue ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                        <Clock className="w-3 h-3" /> Issued
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {issue.status === 'issued' && (
                        <button
                          onClick={() => handleReturnBook(issue)}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          Mark Returned
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteIssue(issue)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-black/5">
        {items.length > 0 ? items.map((issue) => {
          const isOverdue = issue.status === 'issued' && new Date(issue.dueDate) < new Date();
          return (
            <div key={issue.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900">{issue.bookTitle}</h3>
                  <p className="text-xs text-gray-500 font-mono">{issue.bookCode}</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteIssue(issue)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Issued To</p>
                  <button 
                    onClick={() => setSelectedUserHistory({name: issue.issuedToName, type: issue.issuedToType})}
                    className="font-bold text-emerald-600 hover:underline"
                  >
                    {issue.issuedToName}
                  </button>
                  <p className="text-xs text-gray-500 capitalize">{issue.issuedToType}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Status</p>
                  {issue.status === 'returned' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle className="w-3 h-3" /> Returned
                    </span>
                  ) : isOverdue ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                      <AlertCircle className="w-3 h-3" /> Overdue
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                      <Clock className="w-3 h-3" /> Issued
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Issue Date</p>
                  <p className="text-sm font-medium">{new Date(issue.issueDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Due Date</p>
                  <p className={`text-sm font-bold ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                    {new Date(issue.dueDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {issue.status === 'issued' && (
                <button
                  onClick={() => handleReturnBook(issue)}
                  className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-100"
                >
                  Mark as Returned
                </button>
              )}
            </div>
          );
        }) : (
          <div className="px-6 py-12 text-center text-gray-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F4]">
      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Library Management</h2>
            <p className="text-gray-500">Manage books, issues, and returns</p>
          </div>
          
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
            {[
              { id: 'books', label: 'Books', icon: BookOpen },
              { id: 'issues', label: 'Issued Entries', icon: Clock },
              { id: 'overdue', label: 'Overdue', icon: AlertCircle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'overdue' && notifications.length > 0 && (
                  <span className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                    {notifications.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={activeTab === 'books' ? "Search by book name or code..." : "Search by book or person..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
          
          <div className="flex gap-3 w-full md:w-auto">
            {activeTab === 'books' ? (
              <>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImportExcel}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/5 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  <Upload className="w-4 h-4" />
                  Import Excel
                </button>
                <button
                  onClick={exportBooks}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/5 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export Books
                </button>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm shadow-emerald-200"
                >
                  <Plus className="w-4 h-4" />
                  Add Book
                </button>
              </>
            ) : (
              <button
                onClick={exportEntries}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-black/5 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
              >
                <Download className="w-4 h-4" />
                Export Entries
              </button>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
          {activeTab === 'books' ? (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-black/5">
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Book Code</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Title & Author</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Category</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Class</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900">Availability</th>
                      <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {paginatedBooks.length > 0 ? paginatedBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded-md text-gray-700">
                            {book.bookCode}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{book.title}</p>
                          {book.author && <p className="text-sm text-gray-500">{book.author}</p>}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                            {book.category || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                            {book.bookClass || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${book.availableCopies > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-sm font-medium text-gray-700">
                              {book.availableCopies} / {book.totalCopies}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedBook(book);
                                setShowIssueModal(true);
                              }}
                              disabled={book.availableCopies === 0}
                              className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              Issue Book
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteBook(book)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Book"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                          No books found. Add a book or import from Excel.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-black/5">
                {paginatedBooks.length > 0 ? paginatedBooks.map((book) => (
                  <div key={book.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                          {book.bookCode}
                        </span>
                        <h3 className="font-bold text-gray-900 mt-1">{book.title}</h3>
                        {book.author && <p className="text-sm text-gray-500">{book.author}</p>}
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteBook(book)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {book.category || 'General'}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                        {book.bookClass || 'N/A'}
                      </span>
                      <div className="flex items-center gap-2 bg-gray-50 px-2 py-0.5 rounded-full">
                        <div className={`w-1.5 h-1.5 rounded-full ${book.availableCopies > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-xs font-medium text-gray-700">
                          {book.availableCopies} / {book.totalCopies} Available
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedBook(book);
                        setShowIssueModal(true);
                      }}
                      disabled={book.availableCopies === 0}
                      className="w-full py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Issue Book
                    </button>
                  </div>
                )) : (
                  <div className="px-6 py-12 text-center text-gray-500">
                    No books found.
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'issues' ? (
            renderIssuesTable(paginatedIssues, "No issued books found.")
          ) : (
            renderIssuesTable(paginatedOverdue, "No overdue books found.")
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-black/5 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{startIndex + 1}</span> to{' '}
                <span className="font-medium text-gray-900">
                  {Math.min(startIndex + itemsPerPage, 
                    activeTab === 'books' ? filteredBooks.length : 
                    activeTab === 'issues' ? filteredIssues.length : 
                    filteredOverdue.length
                  )}
                </span> of{' '}
                <span className="font-medium text-gray-900">
                  {activeTab === 'books' ? filteredBooks.length : 
                   activeTab === 'issues' ? filteredIssues.length : 
                   filteredOverdue.length}
                </span> entries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-black/5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Book Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Add New Book</h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleAddBook} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Book Code (Optional)</label>
                  <input
                    type="text"
                    value={newBook.bookCode}
                    onChange={e => setNewBook({...newBook, bookCode: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="e.g. BK-001 (Leave empty to auto-generate)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={newBook.title}
                    onChange={e => setNewBook({...newBook, title: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="Book Title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                  <input
                    type="text"
                    value={newBook.author}
                    onChange={e => setNewBook({...newBook, author: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="Author Name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <input
                      type="text"
                      value={newBook.bookClass}
                      onChange={e => setNewBook({...newBook, bookClass: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="e.g. Grade 10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newBook.price}
                      onChange={e => setNewBook({...newBook, price: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <input
                      type="text"
                      value={newBook.category}
                      onChange={e => setNewBook({...newBook, category: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      placeholder="e.g. Science"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Copies *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newBook.totalCopies}
                      onChange={e => setNewBook({...newBook, totalCopies: parseInt(e.target.value)})}
                      className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Add Book
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Issue Book Modal */}
      <AnimatePresence>
        {showIssueModal && selectedBook && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Issue Book</h2>
                <button onClick={() => setShowIssueModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleIssueBook} className="p-6 space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-black/5">
                  <p className="text-sm text-gray-500 font-mono mb-1">{selectedBook.bookCode}</p>
                  <p className="font-semibold text-gray-900">{selectedBook.title}</p>
                  <p className="text-sm text-gray-600 mt-1">Available: {selectedBook.availableCopies}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue To Type</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="issueType" 
                        checked={newIssue.issuedToType === 'student'}
                        onChange={() => setNewIssue({...newIssue, issuedToType: 'student', issuedToName: ''})}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Student</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        name="issueType" 
                        checked={newIssue.issuedToType === 'teacher'}
                        onChange={() => setNewIssue({...newIssue, issuedToType: 'teacher', issuedToName: ''})}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-gray-700">Teacher</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Enter {newIssue.issuedToType === 'student' ? 'Student' : 'Teacher'} Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newIssue.issuedToName}
                    onChange={e => setNewIssue({...newIssue, issuedToName: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder={`e.g. ${newIssue.issuedToType === 'student' ? 'John Doe' : 'Mr. Smith'}`}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  >
                    Confirm Issue
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User History Modal */}
      <AnimatePresence>
        {selectedUserHistory && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedUserHistory.name}</h2>
                    <p className="text-sm text-gray-500 capitalize">{selectedUserHistory.type} History</p>
                  </div>
                </div>
                <button onClick={() => setSelectedUserHistory(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="space-y-4">
                  {issues.filter(i => i.issuedToName === selectedUserHistory.name).length > 0 ? (
                    issues.filter(i => i.issuedToName === selectedUserHistory.name).map(issue => {
                      const isOverdue = issue.status === 'issued' && new Date(issue.dueDate) < new Date();
                      return (
                        <div key={issue.id} className="p-4 rounded-2xl border border-black/5 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900">{issue.bookTitle}</p>
                            <p className="text-sm text-gray-500 font-mono mt-0.5">{issue.bookCode}</p>
                          </div>
                          <div className="flex flex-col sm:items-end gap-1">
                            {issue.status === 'returned' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 w-fit">
                                <CheckCircle className="w-3 h-3" /> Returned on {new Date(issue.returnDate).toLocaleDateString()}
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 w-fit">
                                <AlertCircle className="w-3 h-3" /> Overdue (Due: {new Date(issue.dueDate).toLocaleDateString()})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 w-fit">
                                <Clock className="w-3 h-3" /> Issued (Due: {new Date(issue.dueDate).toLocaleDateString()})
                              </span>
                            )}
                            <p className="text-xs text-gray-400">Issued on: {new Date(issue.issueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No book history found for this user.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Confirm Deletion</h2>
                <p className="text-gray-500 mb-6">
                  Are you sure you want to delete this {deleteConfirm.type}? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
