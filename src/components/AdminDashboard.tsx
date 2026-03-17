import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  Mail,
  Phone,
  GraduationCap,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trash2,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { addDoc, collection, onSnapshot, query, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Student, UserProfile, UserRole, StaffInvite } from '../types';
import { MAIN_ADMIN_EMAIL } from '../constants';
import { handleFirestoreError, OperationType } from '../App';

export default function AdminDashboard({ profile, isAdmin, initialAction, onActionComplete }: { profile: UserProfile | null, isAdmin: boolean, initialAction?: 'add_student' | 'add_teacher' | 'add_staff' | 'add_parent' | null, onActionComplete?: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'staff' | 'parents'>('students');
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({ name: '', grade: '', section: '', balance: 0, parentId: '', routeId: '' });
  const [newStaff, setNewStaff] = useState<StaffInvite>({ name: '', phoneNumber: '', role: 'staff', allowedTabs: ['dashboard'] });
  const [routes, setRoutes] = useState<any[]>([]);

  useEffect(() => {
    if (initialAction === 'add_student') {
      setActiveTab('students');
      setIsAddingStudent(true);
      if (onActionComplete) onActionComplete();
    } else if (initialAction === 'add_teacher') {
      setActiveTab('teachers');
      setNewStaff({ name: '', phoneNumber: '', role: 'teacher', allowedTabs: ['dashboard'] });
      setIsAddingStaff(true);
      if (onActionComplete) onActionComplete();
    } else if (initialAction === 'add_staff') {
      setActiveTab('staff');
      setNewStaff({ name: '', phoneNumber: '', role: 'staff', allowedTabs: ['dashboard'] });
      setIsAddingStaff(true);
      if (onActionComplete) onActionComplete();
    } else if (initialAction === 'add_parent') {
      setActiveTab('parents');
      setNewStaff({ name: '', phoneNumber: '', role: 'parent', allowedTabs: ['dashboard'] });
      setIsAddingStaff(true);
      if (onActionComplete) onActionComplete();
    }
  }, [initialAction, onActionComplete]);

  useEffect(() => {
    if (!profile) return;
    const unsubscribeRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'routes');
    });
    return () => unsubscribeRoutes();
  }, [profile]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await addDoc(collection(db, 'students'), newStudent);
      setIsAddingStudent(false);
      setNewStudent({ name: '', grade: '', section: '', balance: 0, parentId: '', routeId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'students', studentToDelete));
      setStudentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${studentToDelete}`);
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'users', staffToDelete));
      setStaffToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${staffToDelete}`);
    }
  };

  const handleDeleteInvite = async () => {
    if (!inviteToDelete || !isAdmin) return;
    try {
      await deleteDoc(doc(db, 'staff_invites', inviteToDelete));
      setInviteToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff_invites/${inviteToDelete}`);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      await setDoc(doc(db, 'staff_invites', newStaff.phoneNumber), newStaff);
      setIsAddingStaff(false);
      setNewStaff({ name: '', phoneNumber: '', role: 'staff', allowedTabs: ['dashboard'] });
      alert('User added successfully. They can now log in using their phone number.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff_invites');
    }
  };

  useEffect(() => {
    if (!profile) return;

    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const unsubscribeStaff = onSnapshot(collection(db, 'users'), (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ ...doc.data() } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    const unsubscribeInvites = onSnapshot(collection(db, 'staff_invites'), (snapshot) => {
      setInvites(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StaffInvite)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff_invites');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeStaff();
      unsubscribeInvites();
    };
  }, [profile]);

  const pendingInvites = invites.filter(invite => !staff.some(s => s.phoneNumber === invite.phoneNumber));

  const teacherMembers = staff.filter(s => s.role === 'teacher');
  const parentMembers = staff.filter(s => s.role === 'parent');
  const staffMembers = staff.filter(s => s.role !== 'parent' && s.role !== 'teacher');
  
  const pendingTeacherInvites = pendingInvites.filter(i => i.role === 'teacher');
  const pendingParentInvites = pendingInvites.filter(i => i.role === 'parent');
  const pendingStaffInvites = pendingInvites.filter(i => i.role !== 'parent' && i.role !== 'teacher');

  const toggleTabPermission = async (user: UserProfile, tabId: string) => {
    if (user.email === MAIN_ADMIN_EMAIL) return; // Cannot edit main admin

    const currentTabs = user.allowedTabs || [];
    const newTabs = currentTabs.includes(tabId)
      ? currentTabs.filter(t => t !== tabId)
      : [...currentTabs, tabId];

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        allowedTabs: newTabs
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateRole = async (user: UserProfile, newRole: UserRole) => {
    if (user.email === MAIN_ADMIN_EMAIL) return; // Cannot edit main admin

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: newRole
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const availableTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'canteen', label: 'Canteen' },
    { id: 'transport', label: 'Transport' },
    { id: 'admin', label: 'Management' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campus Management</h2>
          <p className="text-gray-500">Manage student records, staff roles, and parent access.</p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'students' && isAdmin && (
            <button 
              onClick={() => setIsAddingStudent(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Student
            </button>
          )}
          {activeTab === 'teachers' && isAdmin && (
            <button 
              onClick={() => {
                setNewStaff({ name: '', phoneNumber: '', role: 'teacher', allowedTabs: ['dashboard'] });
                setIsAddingStaff(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Teacher
            </button>
          )}
          {activeTab === 'staff' && isAdmin && (
            <button 
              onClick={() => {
                setNewStaff({ name: '', phoneNumber: '', role: 'staff', allowedTabs: ['dashboard'] });
                setIsAddingStaff(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Staff
            </button>
          )}
          {activeTab === 'parents' && isAdmin && (
            <button 
              onClick={() => {
                setNewStaff({ name: '', phoneNumber: '', role: 'parent', allowedTabs: ['dashboard'] });
                setIsAddingStaff(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Add Parent
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-black/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'students', label: 'Students', icon: GraduationCap },
              { id: 'teachers', label: 'Teachers', icon: BookOpen },
              { id: 'staff', label: 'Staff & Permissions', icon: Shield },
              { id: 'parents', label: 'Parents', icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." className="pl-9 pr-4 py-2 bg-gray-50 border-none rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-64" />
            </div>
            <button className="p-2 bg-gray-50 rounded-xl text-gray-500 hover:bg-gray-100">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'students' && (
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Balance</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {students.length > 0 ? students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50 transition-all cursor-pointer group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={student.photoUrl || `https://ui-avatars.com/api/?name=${student.name}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{student.name}</p>
                          <p className="text-xs text-gray-500">{student.grade} - {student.section}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="text-xs">parent@example.com</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${student.balance > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-bold text-gray-900">${student.balance.toFixed(2)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStudentToDelete(student.id);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="max-w-xs mx-auto">
                        <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No records found</p>
                        <p className="text-xs text-gray-400 mt-1">Start by adding students or staff members to the system.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'teachers' && (
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Teacher Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {teacherMembers.map((member) => (
                  <tr key={member.uid} className="hover:bg-gray-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${member.displayName}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{member.displayName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{member.phoneNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member, e.target.value as UserRole)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border-none bg-gray-50 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="staff">Staff</option>
                        <option value="teacher">Teacher</option>
                        <option value="driver">Driver</option>
                        <option value="parent">Parent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffToDelete(member.uid);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingTeacherInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-all opacity-60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${invite.name}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{invite.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{invite.phoneNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-orange-50 text-orange-600">
                        Pending ({invite.role})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteToDelete(invite.id || invite.phoneNumber);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {teacherMembers.length === 0 && pendingTeacherInvites.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="max-w-xs mx-auto">
                        <BookOpen className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No teachers found</p>
                        <p className="text-xs text-gray-400 mt-1">Start by adding teachers to the system.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'staff' && (
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Tab Access Permissions</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {staffMembers.map((member) => (
                  <tr key={member.uid} className="hover:bg-gray-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${member.displayName}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{member.displayName}</p>
                          <p className="text-xs text-gray-500">{member.email || member.phoneNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.email === MAIN_ADMIN_EMAIL ? (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-purple-50 text-purple-600">
                          Main Admin
                        </span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) => updateRole(member, e.target.value as UserRole)}
                          className="text-[10px] font-bold px-2 py-1 rounded-lg border-none bg-gray-50 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option value="staff">Staff</option>
                          <option value="teacher">Teacher</option>
                          <option value="driver">Driver</option>
                          <option value="parent">Parent</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {availableTabs.map(tab => {
                          const isMainAdmin = member.email === MAIN_ADMIN_EMAIL;
                          const hasAccess = isMainAdmin || member.role === 'admin' || member.allowedTabs?.includes(tab.id);
                          return (
                            <button
                              key={tab.id}
                              disabled={isMainAdmin || member.role === 'admin'}
                              onClick={() => toggleTabPermission(member, tab.id)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                hasAccess 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-gray-50 text-gray-400 border border-gray-100 grayscale'
                              } ${(isMainAdmin || member.role === 'admin') ? 'cursor-default' : 'hover:scale-105'}`}
                            >
                              {hasAccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && member.email !== MAIN_ADMIN_EMAIL && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffToDelete(member.uid);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingStaffInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-all opacity-60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${invite.name}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{invite.name}</p>
                          <p className="text-xs text-gray-500">{invite.phoneNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-orange-50 text-orange-600">
                        Pending ({invite.role})
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {availableTabs.map(tab => {
                          const hasAccess = invite.role === 'admin' || invite.allowedTabs?.includes(tab.id);
                          return (
                            <div
                              key={tab.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                hasAccess 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-gray-50 text-gray-400 border border-gray-100 grayscale'
                              }`}
                            >
                              {hasAccess ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {tab.label}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteToDelete(invite.id || invite.phoneNumber);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {activeTab === 'parents' && (
            <table className="w-full text-left min-w-[600px]">
              <thead className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4">Parent Name</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {parentMembers.map((member) => (
                  <tr key={member.uid} className="hover:bg-gray-50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${member.displayName}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{member.displayName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{member.phoneNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member, e.target.value as UserRole)}
                        className="text-[10px] font-bold px-2 py-1 rounded-lg border-none bg-gray-50 text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="staff">Staff</option>
                        <option value="teacher">Teacher</option>
                        <option value="driver">Driver</option>
                        <option value="parent">Parent</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setStaffToDelete(member.uid);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingParentInvites.map((invite) => (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-all opacity-60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img 
                          src={`https://ui-avatars.com/api/?name=${invite.name}`} 
                          className="w-10 h-10 rounded-xl border border-black/5"
                          alt=""
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-900">{invite.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="text-xs">{invite.phoneNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-orange-50 text-orange-600">
                        Pending ({invite.role})
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setInviteToDelete(invite.id || invite.phoneNumber);
                            }}
                            className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {parentMembers.length === 0 && pendingParentInvites.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <div className="max-w-xs mx-auto">
                        <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500 font-medium">No parents found</p>
                        <p className="text-xs text-gray-400 mt-1">Start by adding parents to the system.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Student</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this student? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setStudentToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteStudent}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {staffToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Staff Member</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this staff member? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setStaffToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteStaff}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {inviteToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center"
          >
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Staff Invite</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this pending invite? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setInviteToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteInvite}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isAddingStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New User</h3>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newStaff.name}
                  onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  value={newStaff.phoneNumber}
                  onChange={e => setNewStaff({...newStaff, phoneNumber: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={newStaff.role}
                  onChange={e => setNewStaff({...newStaff, role: e.target.value as UserRole})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="staff">Staff</option>
                  <option value="teacher">Teacher</option>
                  <option value="driver">Driver</option>
                  <option value="parent">Parent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Tabs</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTabs.map(tab => (
                    <label key={tab.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input 
                        type="checkbox"
                        checked={newStaff.allowedTabs.includes(tab.id)}
                        onChange={(e) => {
                          const tabs = e.target.checked 
                            ? [...newStaff.allowedTabs, tab.id]
                            : newStaff.allowedTabs.filter(t => t !== tab.id);
                          setNewStaff({...newStaff, allowedTabs: tabs});
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      {tab.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingStaff(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Add Staff
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isAddingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newStudent.name}
                  onChange={e => setNewStudent({...newStudent, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input 
                    type="text" 
                    required
                    value={newStudent.grade}
                    onChange={e => setNewStudent({...newStudent, grade: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input 
                    type="text" 
                    required
                    value={newStudent.section}
                    onChange={e => setNewStudent({...newStudent, section: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  value={newStudent.balance}
                  onChange={e => setNewStudent({...newStudent, balance: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transport Route (Optional)</label>
                <select
                  value={newStudent.routeId}
                  onChange={e => setNewStudent({...newStudent, routeId: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">No Route Assigned</option>
                  {routes.map(route => (
                    <option key={route.id} value={route.id}>{route.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingStudent(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Save Student
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
