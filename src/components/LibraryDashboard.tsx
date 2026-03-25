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
  
  const [activeTab, setActiveTab] = useState<'books' | 'issues'>('books');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  
  const [newBook, setNewBook] = useState({ bookCode: '', title: '', author: '', category: '', totalCopies: 1 });
  const [newIssue, setNewIssue] = useState({ bookId: '', issuedToName: '', issuedToId: '', issuedToType: 'student' as 'student' | 'teacher' });
  
  const [notifications, setNotifications] = useState<BookIssue[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const [selectedUserHistory, setSelectedUserHistory] = useState<{name: string, type: 'student'|'teacher'} | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'book' | 'issue', item: any } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile) return;

    const booksUnsubscribe = onSnapshot(collection(db, 'books'), (snapshot) => {
      const booksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Book));
      setBooks(booksData);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'books'));

    const issuesUnsubscribe = onSnapshot(collection(db, 'book_issues'), (snapshot) => {
      const issuesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BookIssue));
      setIssues(issuesData);
      
      // Check for overdue books (> 7 days)
      const now = new Date();
      const overdue = issuesData.filter(issue => {
        if (issue.status === 'returned') return false;
        const issueDate = new Date(issue.issueDate);
        const diffTime = Math.abs(now.getTime() - issueDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
      await addDoc(collection(db, 'books'), {
        ...newBook,
        availableCopies: newBook.totalCopies,
        addedBy: profile.uid,
        createdAt: new Date().toISOString()
      });
      setShowAddModal(false);
      setNewBook({ bookCode: '', title: '', author: '', category: '', totalCopies: 1 });
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

        for (const row of data as any[]) {
          if (row.bookCode && row.title) {
            await addDoc(collection(db, 'books'), {
              bookCode: String(row.bookCode),
              title: String(row.title),
              author: row.author ? String(row.author) : '',
              category: row.category ? String(row.category) : '',
              totalCopies: row.totalCopies ? Number(row.totalCopies) : 1,
              availableCopies: row.totalCopies ? Number(row.totalCopies) : 1,
              addedBy: profile.uid,
              createdAt: new Date().toISOString()
            });
          }
        }
        alert('Books imported successfully!');
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

  const filteredBooks = books.filter(book => 
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    book.bookCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIssues = issues.filter(issue => 
    issue.bookTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
    issue.issuedToName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto bg-[#F5F5F4]">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Library Management</h1>
            <p className="text-gray-500 mt-1">Manage books, issues, and returns</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 bg-white border border-black/5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {notifications.length}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-black/5 overflow-hidden z-50"
                  >
                    <div className="p-4 border-b border-black/5 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">Overdue Books</h3>
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        {notifications.length} Overdue
                      </span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map(notif => (
                          <div key={notif.id} className="p-4 border-b border-black/5 hover:bg-gray-50">
                            <div className="flex gap-3">
                              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{notif.bookTitle}</p>
                                <p className="text-xs text-gray-500 mt-1">Issued to: {notif.issuedToName}</p>
                                <p className="text-xs text-red-500 mt-1">
                                  Due: {new Date(notif.dueDate).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-gray-500 text-sm">
                          No overdue books
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => setActiveTab('books')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                activeTab === 'books' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-black/5 hover:bg-gray-50'
              }`}
            >
              Books
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                activeTab === 'issues' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-black/5 hover:bg-gray-50'
              }`}
            >
              Issued Entries
            </button>
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
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-black/5">
                    <th className="px-6 py-4 text-sm font-semibold text-gray-900">Book Code</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-900">Title & Author</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-900">Category</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-900">Availability</th>
                    <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredBooks.length > 0 ? filteredBooks.map((book) => (
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
                          <button
                            onClick={() => handleDeleteBook(book)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Book"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No books found. Add a book or import from Excel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {filteredIssues.length > 0 ? filteredIssues.map((issue) => {
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
                            <button
                              onClick={() => handleDeleteIssue(issue)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        No issued books found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Book Code *</label>
                  <input
                    type="text"
                    required
                    value={newBook.bookCode}
                    onChange={e => setNewBook({...newBook, bookCode: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-black/5 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none"
                    placeholder="e.g. BK-001"
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
