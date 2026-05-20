import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  CreditCard, 
  ClipboardList, 
  AlertCircle,
  ChevronRight,
  Utensils,
  History,
  Package,
  Calendar,
  Trash2
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { addDoc, collection, onSnapshot, query, orderBy, doc, setDoc, getDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Meal, Transaction, UserProfile, MealPlan, Student } from '../types';
import { handleFirestoreError, OperationType } from '../App';

export default function CanteenDashboard({ profile, isAdmin }: { profile: UserProfile | null, isAdmin: boolean }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'menu' | 'billing' | 'inventory' | 'planner' | 'attendance'>('menu');
  const [attendanceType, setAttendanceType] = useState<'students' | 'teachers'>('students');
  const [isAddingMeal, setIsAddingMeal] = useState(false);
  const [newMeal, setNewMeal] = useState({ name: '', category: 'Main Course', items: '', available: true });
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedMealId, setSelectedMealId] = useState<string>('');
  const [mealToDelete, setMealToDelete] = useState<string | null>(null);
  
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecord, setAttendanceRecord] = useState<Record<string, boolean>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  
  const [calendarDate, setCalendarDate] = useState(new Date().toISOString().split('T')[0]);
  const [lunchCount, setLunchCount] = useState<number | null>(null);

  const handleAddMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'meals'), newMeal);
      setIsAddingMeal(false);
      setNewMeal({ name: '', category: 'Main Course', items: '', available: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meals');
    }
  };

  const handleDeleteMeal = async () => {
    if (!isAdmin || !mealToDelete) return;
    try {
      await deleteDoc(doc(db, 'meals', mealToDelete));
      setMealToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'meals');
    }
  };

  const handleScheduleMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const meal = meals.find(m => m.id === selectedMealId);
      if (!meal) return;
      
      // Use the day as the document ID for simplicity, or query and update
      const planRef = doc(db, 'meal_plans', selectedDay);
      await setDoc(planRef, {
        day: selectedDay,
        mealId: meal.id,
        mealName: meal.name
      });
      setIsScheduling(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meal_plans');
    }
  };

  useEffect(() => {
    if (!profile || !calendarDate) return;
    const fetchLunchCount = async () => {
      try {
        const docRef = doc(db, 'lunch_attendance', calendarDate);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const records = docSnap.data().records || {};
          const count = Object.values(records).filter(Boolean).length;
          setLunchCount(count);
        } else {
          setLunchCount(0);
        }
      } catch (error) {
        console.error("Failed to fetch lunch count", error);
        setLunchCount(0);
      }
    };
    fetchLunchCount();
  }, [profile, calendarDate]);

  useEffect(() => {
    if (!profile) return;

    const qMeals = query(collection(db, 'meals'));
    const unsubscribeMeals = onSnapshot(qMeals, (snapshot) => {
      setMeals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Meal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meals');
    });

    const qTrans = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'));
    const unsubscribeTrans = onSnapshot(qTrans, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    const qPlans = query(collection(db, 'meal_plans'));
    const unsubscribePlans = onSnapshot(qPlans, (snapshot) => {
      setMealPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MealPlan)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'meal_plans');
    });

    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const unsubscribeTeachers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as UserProfile));
      setTeachers(allUsers.filter(u => u.role === 'teacher'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribeMeals();
      unsubscribeTrans();
      unsubscribePlans();
      unsubscribeStudents();
      unsubscribeTeachers();
    };
  }, [profile]);

  useEffect(() => {
    if (!profile || !attendanceDate) return;
    const fetchAttendance = async () => {
      try {
        const docRef = doc(db, 'lunch_attendance', attendanceDate);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setAttendanceRecord(docSnap.data().records || {});
        } else {
          setAttendanceRecord({});
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'lunch_attendance');
      }
    };
    fetchAttendance();
  }, [profile, attendanceDate]);

  const handleSaveAttendance = async () => {
    setIsSavingAttendance(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 45); // 45 days from now

      await setDoc(doc(db, 'lunch_attendance', attendanceDate), {
        date: attendanceDate,
        records: attendanceRecord,
        expiresAt: expiresAt, // TTL field
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid
      });
      alert('Attendance saved successfully! Data will be automatically deleted after 45 days.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'lunch_attendance');
    }
    setIsSavingAttendance(false);
  };

  const toggleStudentAttendance = (studentId: string) => {
    setAttendanceRecord(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Canteen Management</h2>
          <p className="text-gray-500">Manage menus, billing, and meal planning.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 bg-white p-1 rounded-[1rem] border border-white/80 shadow-2xl shadow-gray-200/50">
          {[
            { id: 'menu', label: 'Menu', icon: Utensils },
            { id: 'planner', label: 'Meal Planner', icon: Calendar },
            { id: 'attendance', label: 'Attendance', icon: ClipboardList },
            ...(isAdmin ? [
              { id: 'billing', label: 'Billing', icon: CreditCard }
            ] : [])
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white shadow-md' 
                  : 'text-gray-500 hover:bg-white/60 backdrop-blur-md'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'menu' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {meals.length > 0 ? meals.map((meal) => (
                <motion.div 
                  key={meal.id}
                  layout
                  className="bg-white/70 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white/60 shadow-2xl shadow-gray-200/50 hover:shadow-md transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-orange-50 rounded-[1rem] flex items-center justify-center text-orange-600">
                      <Utensils className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      meal.available ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {meal.available ? 'Available' : 'Sold Out'}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg">{meal.name}</h4>
                  <p className="text-gray-500 text-sm mb-2">{meal.category}</p>
                  <p className="text-gray-700 text-sm mb-4 line-clamp-2">{meal.items}</p>
                  <div className="flex items-center justify-end pt-4 border-t border-white/60 gap-2">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => setMealToDelete(meal.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all opacity-0 group-hover:opacity-100"
                          title="Delete Meal"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedMealId(meal.id);
                            setSelectedDay(days[0]);
                            setIsScheduling(true);
                          }}
                          className="p-2 bg-gradient-to-r from-slate-700 to-slate-900 shadow-lg shadow-slate-900/20 text-white border-none text-white rounded-xl hover:from-slate-800 hover:to-slate-950 hover:shadow-xl hover:-translate-y-0.5 transition-all opacity-0 group-hover:opacity-100"
                          title="Schedule Meal"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-gray-300">
                  <Utensils className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No menu items found. Add your first meal!</p>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAddingMeal(true)}
                      className="mt-4 px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold"
                    >
                      Add Item
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'menu' && meals.length > 0 && isAdmin && (
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsAddingMeal(true)}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> Add New Meal
              </button>
            </div>
          )}

          {activeTab === 'planner' && (
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50 overflow-hidden">
              <div className="p-6 border-b border-white/60 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Weekly Meal Schedule</h3>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      setSelectedDay(days[0]);
                      setSelectedMealId(meals[0]?.id || '');
                      setIsScheduling(true);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl text-sm font-bold"
                  >
                    Edit Schedule
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100/80">
                {days.map((day) => {
                  const plan = mealPlans.find(p => p.day === day);
                  return (
                    <div key={day} className="p-6 flex items-center justify-between hover:bg-white/60 backdrop-blur-md transition-all">
                      <div className="flex items-center gap-6">
                        <div className="w-16 text-sm font-bold text-gray-400 uppercase tracking-wider">{day.slice(0, 3)}</div>
                        <div>
                          <h4 className="font-bold text-gray-900">{plan ? plan.mealName : 'No meal planned'}</h4>
                          <p className="text-xs text-gray-500">{plan ? 'Balanced Nutrition' : 'Click to set meal'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {plan && (
                          <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase">
                            Confirmed
                          </div>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              setSelectedDay(day);
                              setSelectedMealId(plan?.mealId || meals[0]?.id || '');
                              setIsScheduling(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg"
                          >
                            <Plus className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50 overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-white/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900">Daily Lunch Attendance</h3>
                  <p className="text-sm text-gray-500">Mark present for lunch. Data auto-deletes after 45 days.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAttendanceType('students')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        attendanceType === 'students' ? 'bg-white text-gray-900 shadow-2xl shadow-gray-200/50' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Students
                    </button>
                    <button
                      onClick={() => setAttendanceType('teachers')}
                      className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                        attendanceType === 'teachers' ? 'bg-white text-gray-900 shadow-2xl shadow-gray-200/50' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Teachers
                    </button>
                  </div>
                  <input 
                    type="date" 
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="px-4 py-2 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button 
                    onClick={handleSaveAttendance}
                    disabled={isSavingAttendance}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl text-sm font-bold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                  >
                    {isSavingAttendance ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {attendanceType === 'students' ? students.map(student => {
                    const isPresent = attendanceRecord[student.id] || false;
                    return (
                      <div 
                        key={student.id}
                        onClick={() => toggleStudentAttendance(student.id)}
                        className={`flex items-center justify-between p-4 rounded-[1rem] border cursor-pointer transition-all ${
                          isPresent 
                            ? 'bg-emerald-50 border-emerald-200 shadow-2xl shadow-gray-200/50' 
                            : 'bg-white border-white/60 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={student.photoUrl || `https://ui-avatars.com/api/?name=${student.name}`} 
                            className="w-10 h-10 rounded-xl border border-white/60"
                            alt=""
                          />
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.grade} - {student.section}</p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          isPresent 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-gray-300'
                        }`}>
                          {isPresent && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                    );
                  }) : teachers.map(teacher => {
                    const isPresent = attendanceRecord[teacher.uid] || false;
                    return (
                      <div 
                        key={teacher.uid}
                        onClick={() => toggleStudentAttendance(teacher.uid)}
                        className={`flex items-center justify-between p-4 rounded-[1rem] border cursor-pointer transition-all ${
                          isPresent 
                            ? 'bg-emerald-50 border-emerald-200 shadow-2xl shadow-gray-200/50' 
                            : 'bg-white border-white/60 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={`https://ui-avatars.com/api/?name=${teacher.displayName}`} 
                            className="w-10 h-10 rounded-xl border border-white/60"
                            alt=""
                          />
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{teacher.displayName}</p>
                            <p className="text-xs text-gray-500 capitalize">{teacher.role}</p>
                          </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          isPresent 
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-gray-300'
                        }`}>
                          {isPresent && <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </div>
                      </div>
                    );
                  })}
                  {attendanceType === 'students' && students.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-500">
                      No students found. Add students in the Management tab first.
                    </div>
                  )}
                  {attendanceType === 'teachers' && teachers.length === 0 && (
                    <div className="col-span-full py-10 text-center text-gray-500">
                      No teachers found. Add teachers in the Management tab first.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && isAdmin && (
            <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] border border-white/60 shadow-2xl shadow-gray-200/50 overflow-hidden">
              <div className="p-6 border-b border-white/60 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Recent Transactions</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search ID..." className="pl-9 pr-4 py-1.5 bg-white/60 backdrop-blur-md border-none rounded-lg text-sm outline-none" />
                  </div>
                  <button className="p-1.5 bg-white/60 backdrop-blur-md rounded-lg text-gray-500 hover:bg-gray-100">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-white/60 backdrop-blur-md text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-bold">Student Name</th>
                      <th className="px-6 py-4 font-bold">Type</th>
                      <th className="px-6 py-4 font-bold">Amount</th>
                      <th className="px-6 py-4 font-bold">Date</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100/80">
                    {transactions.map((t) => {
                      const student = students.find(s => s.id === t.studentId);
                      return (
                      <tr key={t.id} className="hover:bg-white/60 backdrop-blur-md transition-all cursor-pointer">
                        <td className="px-6 py-4 font-medium text-gray-900">{student ? student.name : 'Unknown Student'}</td>
                        <td className="px-6 py-4 capitalize text-sm text-gray-500">{t.type}</td>
                        <td className={`px-6 py-4 font-bold ${t.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {t.type === 'credit' ? '+' : '-'}${t.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {t.timestamp?.toDate ? t.timestamp.toDate().toLocaleString() : 'Just now'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full uppercase">Completed</span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-6 border border-white/60 shadow-2xl shadow-gray-200/50">
            <h3 className="font-bold text-gray-900 mb-4">Lunch Attendance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                <input 
                  type="date" 
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 backdrop-blur-md border-none focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex justify-between items-center p-4 bg-emerald-50 rounded-[1rem]">
                <span className="text-emerald-800 font-medium">Total Had Lunch</span>
                <span className="font-bold text-2xl text-emerald-600">
                  {lunchCount !== null ? lunchCount : '...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddingMeal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-md shadow-2xl shadow-gray-200/40"
          >
            <h3 className="text-[1.35rem] font-extrabold tracking-tight text-gray-900 mb-4">Add New Meal</h3>
            <form onSubmit={handleAddMeal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal Name</label>
                <input 
                  type="text" 
                  required
                  value={newMeal.name}
                  onChange={e => setNewMeal({...newMeal, name: e.target.value})}
                  className="w-full px-4 py-2 bg-white/60 backdrop-blur-md border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select 
                  value={newMeal.category}
                  onChange={e => setNewMeal({...newMeal, category: e.target.value})}
                  className="w-full px-4 py-2 bg-white/60 backdrop-blur-md border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="Main Course">Main Course</option>
                  <option value="Snack">Snack</option>
                  <option value="Beverage">Beverage</option>
                  <option value="Dessert">Dessert</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Items in Menu</label>
                <textarea 
                  required
                  rows={3}
                  value={newMeal.items}
                  onChange={e => setNewMeal({...newMeal, items: e.target.value})}
                  placeholder="e.g., Rice, Dal, Mixed Veg, Salad"
                  className="w-full px-4 py-2 bg-white/60 backdrop-blur-md border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="available"
                  checked={newMeal.available}
                  onChange={e => setNewMeal({...newMeal, available: e.target.checked})}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <label htmlFor="available" className="text-sm font-medium text-gray-700">Available</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingMeal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Save Meal
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isScheduling && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-md shadow-2xl shadow-gray-200/40"
          >
            <h3 className="text-[1.35rem] font-extrabold tracking-tight text-gray-900 mb-4">Schedule Meal</h3>
            <form onSubmit={handleScheduleMeal} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select 
                  value={selectedDay}
                  onChange={e => setSelectedDay(e.target.value)}
                  className="w-full px-4 py-2 bg-white/60 backdrop-blur-md border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meal</label>
                <select 
                  value={selectedMealId}
                  onChange={e => setSelectedMealId(e.target.value)}
                  className="w-full px-4 py-2 bg-white/60 backdrop-blur-md border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                >
                  <option value="" disabled>Select a meal</option>
                  {meals.map(meal => (
                    <option key={meal.id} value={meal.id}>{meal.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsScheduling(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/20 border-none text-white rounded-xl font-bold hover:from-emerald-600 hover:to-teal-600 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {mealToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl shadow-gray-200/40 text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-[1.35rem] font-extrabold tracking-tight text-gray-900 mb-2">Delete Meal?</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this meal? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setMealToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteMeal}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
