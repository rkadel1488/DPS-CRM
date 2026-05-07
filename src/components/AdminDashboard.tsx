import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
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
  BookOpen,
  Upload,
  Edit2,
  QrCode,
  Download,
  Camera
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { addDoc, collection, onSnapshot, query, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Student, UserProfile, UserRole, StaffInvite } from '../types';
import { MAIN_ADMIN_EMAIL } from '../constants';
import { handleFirestoreError, OperationType } from '../App';
import * as xlsx from 'xlsx';

export default function AdminDashboard({ profile, isAdmin, isMainAdmin, initialAction, onActionComplete }: { profile: UserProfile | null, isAdmin: boolean, isMainAdmin: boolean, initialAction?: 'add_student' | 'add_teacher' | 'add_staff' | 'add_parent' | null, onActionComplete?: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<StaffInvite[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'teachers' | 'staff' | 'parents'>('students');
  const [editingStaff, setEditingStaff] = useState<UserProfile | null>(null);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [isAddingFamily, setIsAddingFamily] = useState(false);
  const [newFamily, setNewFamily] = useState({
    fatherName: '', fatherPhotoUrl: '',
    motherName: '', motherPhotoUrl: '',
    driverName: '', driverPhotoUrl: '',
    phoneNumber: '',
    students: [{ name: '', studentId: '', grade: '', section: '', photoUrl: '' }]
  });
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [inviteToDelete, setInviteToDelete] = useState<string | null>(null);
  const [newStudent, setNewStudent] = useState({ 
    name: '', 
    grade: '', 
    section: '', 
    balance: 0, 
    parentId: '', 
    routeId: '', 
    phoneNumber: '',
    fatherName: '',
    fatherPhotoUrl: '',
    motherName: '',
    motherPhotoUrl: '',
    driverName: '',
    driverPhotoUrl: '',
    photoUrl: ''
  });
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
      const docRef = await addDoc(collection(db, 'students'), newStudent);
      setIsAddingStudent(false);
      setNewStudent({ 
        name: '', 
        grade: '', 
        section: '', 
        balance: 0, 
        parentId: '', 
        routeId: '', 
        phoneNumber: '',
        fatherName: '',
        fatherPhotoUrl: '',
        motherName: '',
        motherPhotoUrl: '',
        driverName: '',
        driverPhotoUrl: '',
        photoUrl: ''
      });
      alert('Student added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 400;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.fillStyle = '#ffffff';
             ctx.fillRect(0, 0, width, height);
             ctx.drawImage(img, 0, 0, width, height);
          }
          resolve(canvas.toDataURL('image/jpeg', 0.5));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUploadFamily = async (e: React.ChangeEvent<HTMLInputElement>, type: 'father' | 'mother' | 'driver' | 'student', studentIndex?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64String = await compressImage(file);
    
    if (type === 'student' && studentIndex !== undefined) {
      const updatedStudents = [...newFamily.students];
      updatedStudents[studentIndex].photoUrl = base64String;
      setNewFamily({ ...newFamily, students: updatedStudents });
    } else {
      const field = `${type}PhotoUrl`;
      setNewFamily({ ...newFamily, [field]: base64String });
    }
  };

  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const familyId = `FAM-${Date.now()}`;
      for (const student of newFamily.students) {
        if (!student.name) continue;
        await addDoc(collection(db, 'students'), {
          ...student,
          fatherName: newFamily.fatherName,
          fatherPhotoUrl: newFamily.fatherPhotoUrl,
          motherName: newFamily.motherName,
          motherPhotoUrl: newFamily.motherPhotoUrl,
          driverName: newFamily.driverName,
          driverPhotoUrl: newFamily.driverPhotoUrl,
          phoneNumber: newFamily.phoneNumber,
          familyId: familyId,
          balance: 0,
          parentId: '',
          routeId: ''
        });
      }
      
      await downloadGroupQRCode(newFamily, familyId);
      
      setIsAddingFamily(false);
      setNewFamily({
        fatherName: '', fatherPhotoUrl: '',
        motherName: '', motherPhotoUrl: '',
        driverName: '', driverPhotoUrl: '',
        phoneNumber: '',
        students: [{ name: '', studentId: '', grade: '', section: '', photoUrl: '' }]
      });
      alert('Family Gate Pass added successfully! You can download the QR Code from the students list.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'students');
    }
  };

  const downloadGroupQRCode = async (family: typeof newFamily, familyId: string) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // A6 Size Equivalent (1240 x 1754) for printing 4 on A4 page
      canvas.width = 1240;
      const originalWidth = 1000;
      const studentsHeight = Math.ceil(family.students.length / 2) * 200 + 100;
      const requiredOriginalHeight = 850 + studentsHeight; // Increased from 800
      canvas.height = Math.max(1754, requiredOriginalHeight * 1.25); // Minimum A6 height, or taller if needed
      
      const scaleX = 1240 / 1000;
      const scaleY = canvas.height / requiredOriginalHeight;
      // We will use 1.24 scale for both to keep aspect ratio perfect, if it fits
      // Actually, since A6 width is 1240, scale is exactly 1.24.
      ctx.scale(1.24, 1.24);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, requiredOriginalHeight * 1.2);

      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, 1000, 100);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GROUP GATE PASS', 500, 65);

      const loadImage = (src: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          if (!src) resolve(null);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });
      };

      ctx.fillStyle = '#374151';
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('STUDENTS', 50, 160);

      for (let i = 0; i < family.students.length; i++) {
        const student = family.students[i];
        if (!student.name) continue;
        const row = Math.floor(i / 2);
        const col = i % 2;
        
        const startX = 50 + (col * 450);
        const startY = 200 + (row * 180);
        const imgSize = 140;
        const studentImg = await loadImage(student.photoUrl || '');
        
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.strokeRect(startX, startY, imgSize, imgSize);
        if (studentImg) {
          ctx.drawImage(studentImg, startX, startY, imgSize, imgSize);
        } else {
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(startX, startY, imgSize, imgSize);
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText(student.name.substring(0, 20), startX + imgSize + 20, startY + 40);
        
        ctx.fillStyle = '#4b5563';
        ctx.font = '22px sans-serif';
        ctx.fillText(`Grade: ${student.grade} - ${student.section}`, startX + imgSize + 20, startY + 80);
      }

      const qrStartY = 200 + Math.ceil(family.students.length / 2) * 180 + 50;
      const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/?verify=${familyId}`, { width: 350, margin: 1 });
      const qrImg = await loadImage(qrDataUrl);
      if (qrImg) {
        ctx.drawImage(qrImg, (1000 - 350) / 2, qrStartY, 350, 350);
      }

      const guardiansStartY = qrStartY + 400;
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(50, guardiansStartY, 1000 - 100, 350);
      
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('AUTHORIZED RECOVERY PERSONNEL', 80, guardiansStartY + 45);

      const items = [
        { label: 'FATHER', name: family.fatherName, photo: family.fatherPhotoUrl },
        { label: 'MOTHER', name: family.motherName, photo: family.motherPhotoUrl },
        { label: 'DRIVER', name: family.driverName, photo: family.driverPhotoUrl },
      ];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const startX = 80 + (i * 280);
        const startY = guardiansStartY + 70;
        const imgSize = 200;

        const itemImg = await loadImage(item.photo || '');
        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(startX, startY, imgSize, imgSize);
        if (itemImg) {
          ctx.drawImage(itemImg, startX, startY, imgSize, imgSize);
        } else {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(startX, startY, imgSize, imgSize);
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(item.label, startX + imgSize/2, startY + imgSize + 25);
        
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 22px sans-serif';
        const displayName = item.name || 'Not Provided';
        ctx.fillText(displayName.length > 18 ? displayName.substring(0, 15) + '...' : displayName, startX + imgSize/2, startY + imgSize + 55);
      }

      const finalUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = `GROUP_GATE_PASS_${familyId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error('Group ID Card Generation error:', err);
      alert('Failed to generate full group ID card.');
    }
  };

  const downloadQRCode = async (student: Student) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Card Dimensions at 300 DPI for exactly 4 pcs per A4 page (A6 size equivalent 1240x1754)
      canvas.width = 1240;
      canvas.height = 1754;
      ctx.scale(1.24, 1.25); // Scale up from internal 1000x1400 coordinate system

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1000, 1400);

      // Header Banner
      ctx.fillStyle = '#10b981'; // Emerald 500
      ctx.fillRect(0, 0, 1000, 100);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STUDENT GATE PASS', 500, 65);

      // Helper to load images
      const loadImage = (src: string): Promise<HTMLImageElement | null> => {
        return new Promise((resolve) => {
          if (!src) resolve(null);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = src;
        });
      };

      // 1. Draw Student Photo or Placeholder
      const studentImg = await loadImage(student.photoUrl || '');
      const photoX = 50;
      const photoY = 150;
      const photoSize = 250;
      
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(photoX, photoY, photoSize, photoSize);
      
      if (studentImg) {
        ctx.drawImage(studentImg, photoX, photoY, photoSize, photoSize);
      } else {
        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(photoX, photoY, photoSize, photoSize);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '24px sans-serif';
        ctx.fillText('NO PHOTO', photoX + photoSize/2, photoY + photoSize/2);
      }

      // 2. Draw Student Details
      ctx.textAlign = 'left';
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 50px sans-serif';
      ctx.fillText(student.name.toUpperCase(), 330, 200);
      
      ctx.font = '30px sans-serif';
      ctx.fillStyle = '#4b5563';
      ctx.fillText(`Grade: ${student.grade} - ${student.section}`, 330, 250);
      ctx.fillText(`ID: ${student.studentId || student.id?.substring(0, 8)}`, 330, 300);
      if (student.phoneNumber) {
        ctx.fillText(`Phone: ${student.phoneNumber}`, 330, 350);
      }

      // 3. Generate and Draw QR Code
      const qrData = student.familyId || student.id || student.studentId || student.name;
      const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const qrDataUrl = await QRCode.toDataURL(`${appUrl}/?verify=${qrData}`, { width: 400, margin: 1 });
      const qrImg = await loadImage(qrDataUrl);
      if (qrImg) {
        ctx.drawImage(qrImg, 1000 - 450, 450, 400, 400);
      }

      // 4. Draw Family & Driver Section
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(50, 880, 1000 - 100, 450);
      
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('GUARDIANS & AUTHORIZED PERSONNEL', 80, 930);

      const items = [
        { label: 'FATHER', name: student.fatherName, photo: student.fatherPhotoUrl },
        { label: 'MOTHER', name: student.motherName, photo: student.motherPhotoUrl },
        { label: 'DRIVER', name: student.driverName, photo: student.driverPhotoUrl },
      ];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const startX = 80 + (i * 300);
        const startY = 960;
        const imgSize = 240;

        // Photo
        const itemImg = await loadImage(item.photo || '');
        ctx.strokeStyle = '#d1d5db';
        ctx.strokeRect(startX, startY, imgSize, imgSize);
        if (itemImg) {
          ctx.drawImage(itemImg, startX, startY, imgSize, imgSize);
        } else {
          ctx.fillStyle = '#e5e7eb';
          ctx.fillRect(startX, startY, imgSize, imgSize);
        }

        // Label & Name
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6b7280';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(item.label, startX + imgSize/2, startY + imgSize + 30);
        
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 24px sans-serif';
        const displayName = item.name || 'Not Provided';
        ctx.fillText(displayName.length > 18 ? displayName.substring(0, 15) + '...' : displayName, startX + imgSize/2, startY + imgSize + 65);
      }

      // Footer
      ctx.fillStyle = '#9ca3af';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('This card is for official use only. If found, please return to school office.', 1000/2, 1370);

      // Trigger Download
      const finalUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.href = finalUrl;
      link.download = `ID_CARD_${student.name.replace(/\s+/g, '_')}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (err) {
      console.error('ID Card Generation error:', err);
      alert('Failed to generate full ID card.');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean, type: 'student' | 'father' | 'mother' | 'driver') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const base64String = await compressImage(file);
    const field = type === 'student' ? 'photoUrl' : `${type}PhotoUrl`;
    
    if (isEdit && editingStudent) {
      setEditingStudent({ ...editingStudent, [field]: base64String });
    } else {
      setNewStudent({ ...newStudent, [field]: base64String });
    }
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingStudent) return;
    try {
      const { id, ...updateData } = editingStudent;
      await updateDoc(doc(db, 'students', id), updateData);
      setEditingStudent(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${editingStudent.id}`);
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
    if (newRole === 'admin' && !isMainAdmin) {
      alert("Only the main admin can assign the admin role.");
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        role: newRole
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = xlsx.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = xlsx.utils.sheet_to_json(worksheet);

      if (activeTab === 'students') {
        for (const row of jsonData as any[]) {
          if (!row.name) continue;
          await addDoc(collection(db, 'students'), {
            name: row.name,
            grade: String(row.grade || ''),
            section: String(row.section || ''),
            rollNumber: String(row.rollNumber || ''),
            parentName: String(row.parentName || ''),
            parentPhone: String(row.parentPhone || ''),
            parentEmail: String(row.parentEmail || ''),
            canteenBalance: Number(row.canteenBalance) || 0,
            transportRoute: String(row.transportRoute || ''),
            busStop: String(row.busStop || ''),
            createdAt: new Date().toISOString(),
          });
        }
        alert('Students imported successfully!');
      } else {
        for (const row of jsonData as any[]) {
          if (!row.name || !row.phoneNumber) continue;
          
          let role = activeTab === 'teachers' ? 'teacher' : 
                     activeTab === 'parents' ? 'parent' : 
                     (row.role || 'staff');
                     
          await addDoc(collection(db, 'staff_invites'), {
            name: row.name,
            phoneNumber: String(row.phoneNumber),
            role: role,
            allowedTabs: ['dashboard'],
            createdAt: new Date().toISOString(),
            createdBy: profile?.uid || 'admin'
          });
        }
        alert(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} imported successfully!`);
      }
    } catch (error) {
      console.error('Error importing Excel:', error);
      alert('Failed to import Excel file. Please check the format.');
    }
    
    e.target.value = '';
  };

  const availableTabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'gatepass', label: 'Gate Pass' },
    { id: 'canteen', label: 'Canteen' },
    { id: 'transport', label: 'Transport' },
    { id: 'library', label: 'Library' },
    { id: 'admin', label: 'Management' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Campus Management</h2>
          <p className="text-gray-500">Manage student records, staff roles, and parent access.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-100 transition-all cursor-pointer">
              <Upload className="w-4 h-4" />
              Import Excel
              <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
            </label>
          )}
          {activeTab === 'students' && isAdmin && (
            <>
              <button 
                onClick={() => setIsAddingFamily(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-all"
              >
                <QrCode className="w-4 h-4" />
                Add Group Gate Pass
              </button>
              <button 
                onClick={() => setIsAddingStudent(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add Student
              </button>
            </>
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
          <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 bg-gray-100 p-1 rounded-xl">
            {[
              { id: 'students', label: 'Students', icon: GraduationCap },
              { id: 'teachers', label: 'Teachers', icon: BookOpen },
              { id: 'staff', label: 'Staff & Permissions', icon: Shield },
              { id: 'parents', label: 'Parents', icon: Users },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center md:justify-start gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                  <th className="px-6 py-4">Route</th>
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
                      <span className="text-sm font-medium text-gray-700">
                        {student.routeId ? routes.find(r => r.id === student.routeId)?.name || 'Unknown Route' : 'Unassigned'}
                      </span>
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
                          <>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadQRCode(student);
                              }}
                              className="p-2 hover:bg-blue-50 text-blue-400 hover:text-blue-500 rounded-lg transition-all"
                              title="Download QR Code"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingStudent(student);
                              }}
                              className="p-2 hover:bg-emerald-50 text-emerald-400 hover:text-emerald-500 rounded-lg transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setStudentToDelete(student.id);
                              }}
                              className="p-2 hover:bg-red-50 text-red-400 hover:text-red-500 rounded-lg transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
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
                        disabled={!isAdmin}
                      >
                        <option value="staff">Staff</option>
                        <option value="teacher">Teacher</option>
                        <option value="driver">Driver</option>
                        <option value="parent">Parent</option>
                        {isMainAdmin && <option value="admin">Admin</option>}
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
                          disabled={!isAdmin}
                        >
                          <option value="staff">Staff</option>
                          <option value="teacher">Teacher</option>
                          <option value="driver">Driver</option>
                          <option value="parent">Parent</option>
                          {isMainAdmin && <option value="admin">Admin</option>}
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
                        disabled={!isAdmin}
                      >
                        <option value="staff">Staff</option>
                        <option value="teacher">Teacher</option>
                        <option value="driver">Driver</option>
                        <option value="parent">Parent</option>
                        {isMainAdmin && <option value="admin">Admin</option>}
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

      {editingStudent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Student</h3>
            <form onSubmit={handleEditStudent} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {editingStudent.photoUrl ? (
                      <img src={editingStudent.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-all">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true, 'student')} />
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Student Photo (Optional)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editingStudent.name}
                  onChange={e => setEditingStudent({...editingStudent, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
                  <input 
                    type="text" 
                    required
                    value={editingStudent.grade}
                    onChange={e => setEditingStudent({...editingStudent, grade: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input 
                    type="text" 
                    required
                    value={editingStudent.section}
                    onChange={e => setEditingStudent({...editingStudent, section: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Family & Driver Information</p>
                
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {editingStudent.fatherPhotoUrl ? (
                        <img src={editingStudent.fatherPhotoUrl} alt="Father" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true, 'father')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Father's Name</label>
                    <input 
                      type="text" 
                      placeholder="Father's Name"
                      value={editingStudent.fatherName || ''}
                      onChange={e => setEditingStudent({...editingStudent, fatherName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {editingStudent.motherPhotoUrl ? (
                        <img src={editingStudent.motherPhotoUrl} alt="Mother" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true, 'mother')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Mother's Name</label>
                    <input 
                      type="text" 
                      placeholder="Mother's Name"
                      value={editingStudent.motherName || ''}
                      onChange={e => setEditingStudent({...editingStudent, motherName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {editingStudent.driverPhotoUrl ? (
                        <img src={editingStudent.driverPhotoUrl} alt="Driver" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true, 'driver')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Driver's Name</label>
                    <input 
                      type="text" 
                      placeholder="Driver's Name"
                      value={editingStudent.driverName || ''}
                      onChange={e => setEditingStudent({...editingStudent, driverName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transport Route (Optional)</label>
                <select
                  value={editingStudent.routeId || ''}
                  onChange={e => setEditingStudent({...editingStudent, routeId: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">No Route Assigned</option>
                  {routes.map(route => (
                    <option key={route.id} value={route.id}>{route.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone Number (For SMS Notifications)</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+1234567890"
                  value={editingStudent.phoneNumber || ''}
                  onChange={e => setEditingStudent({...editingStudent, phoneNumber: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isAddingFamily && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-black/5 shrink-0 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Add Group Gate Pass</h3>
                <p className="text-xs text-gray-500">Create a shared gate pass for multiple students</p>
              </div>
              <button onClick={() => setIsAddingFamily(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleAddFamily} className="flex-1 overflow-y-auto p-6 space-y-8">
              
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4"/> 1. Family & Pickup Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Father */}
                  <div className="space-y-2">
                    <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-black/5">
                      <div className="w-20 h-20 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                        {newFamily.fatherPhotoUrl ? <img src={newFamily.fatherPhotoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] uppercase font-bold cursor-pointer hover:bg-black transition-all">
                        <Upload className="w-3 h-3" /> Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUploadFamily(e, 'father')} />
                      </label>
                      <div className="w-full mt-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1 text-center">Father's Name</label>
                        <input type="text" value={newFamily.fatherName} onChange={e => setNewFamily({...newFamily, fatherName: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter Name..." />
                      </div>
                    </div>
                  </div>

                  {/* Mother */}
                  <div className="space-y-2">
                    <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-black/5">
                      <div className="w-20 h-20 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                        {newFamily.motherPhotoUrl ? <img src={newFamily.motherPhotoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] uppercase font-bold cursor-pointer hover:bg-black transition-all">
                        <Upload className="w-3 h-3" /> Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUploadFamily(e, 'mother')} />
                      </label>
                      <div className="w-full mt-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1 text-center">Mother's Name</label>
                        <input type="text" value={newFamily.motherName} onChange={e => setNewFamily({...newFamily, motherName: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter Name..." />
                      </div>
                    </div>
                  </div>

                  {/* Driver */}
                  <div className="space-y-2">
                    <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-black/5">
                      <div className="w-20 h-20 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                        {newFamily.driverPhotoUrl ? <img src={newFamily.driverPhotoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                      </div>
                      <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] uppercase font-bold cursor-pointer hover:bg-black transition-all">
                        <Upload className="w-3 h-3" /> Upload Photo
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUploadFamily(e, 'driver')} />
                      </label>
                      <div className="w-full mt-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1 text-center">Driver's Name</label>
                        <input type="text" value={newFamily.driverName} onChange={e => setNewFamily({...newFamily, driverName: e.target.value})} className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Enter Name..." />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full max-w-sm">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Primary Contact Number (For SMS Alerts)</label>
                  <input type="text" value={newFamily.phoneNumber} onChange={e => setNewFamily({...newFamily, phoneNumber: e.target.value})} className="w-full px-4 py-2 bg-gray-50 border border-black/10 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+1234567890" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2"><GraduationCap className="w-4 h-4"/> 2. Students in Group</h4>
                  <button type="button" onClick={() => setNewFamily({...newFamily, students: [...newFamily.students, { name: '', studentId: '', grade: '', section: '', photoUrl: '' }]})} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-all">
                    + Add Student
                  </button>
                </div>
                
                <div className="space-y-4">
                  {newFamily.students.map((student, index) => (
                    <div key={index} className="flex flex-col lg:flex-row items-center lg:items-start gap-4 p-4 rounded-2xl border border-black/5 bg-gray-50/50">
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className="w-20 h-20 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                          {student.photoUrl ? <img src={student.photoUrl} className="w-full h-full object-cover" /> : <Camera className="w-8 h-8 text-gray-300" />}
                        </div>
                        <label className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] uppercase font-bold cursor-pointer hover:bg-black transition-all">
                          <Upload className="w-3 h-3" /> Upload
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUploadFamily(e, 'student', index)} />
                        </label>
                      </div>
                      
                      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Full Name *</label>
                          <input required type="text" value={student.name} onChange={e => { const s = [...newFamily.students]; s[index].name = e.target.value; setNewFamily({...newFamily, students: s}) }} className="w-full px-3 py-2 text-sm bg-white border border-black/10 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Student ID (Opt)</label>
                          <input type="text" value={student.studentId} onChange={e => { const s = [...newFamily.students]; s[index].studentId = e.target.value; setNewFamily({...newFamily, students: s}) }} className="w-full px-3 py-2 text-sm bg-white border border-black/10 rounded-lg outline-none focus:border-blue-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Grade *</label>
                          <input required type="text" value={student.grade} onChange={e => { const s = [...newFamily.students]; s[index].grade = e.target.value; setNewFamily({...newFamily, students: s}) }} className="w-full px-3 py-2 text-sm bg-white border border-black/10 rounded-lg outline-none focus:border-blue-500" placeholder="e.g. 10th" />
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Section *</label>
                          <input required type="text" value={student.section} onChange={e => { const s = [...newFamily.students]; s[index].section = e.target.value; setNewFamily({...newFamily, students: s}) }} className="w-full px-3 py-2 text-sm bg-white border border-black/10 rounded-lg outline-none focus:border-blue-500" placeholder="e.g. A" />
                        </div>
                      </div>

                      {newFamily.students.length > 1 && (
                        <button type="button" onClick={() => { const s = [...newFamily.students]; s.splice(index, 1); setNewFamily({...newFamily, students: s}) }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg shrink-0 mt-4 lg:mt-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 shrink-0 flex gap-3">
                <button type="button" onClick={() => setIsAddingFamily(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all">
                  Save Group & Generate QR
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
            <form onSubmit={handleAddStudent} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
                    {newStudent.photoUrl ? (
                      <img src={newStudent.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <label className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 text-white rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-all">
                    <Upload className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false, 'student')} />
                  </label>
                </div>
                <p className="text-[10px] text-gray-400 font-bold uppercase">Student Photo (Optional)</p>
              </div>

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

              <div className="space-y-4 pt-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Family & Driver Information</p>
                
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {newStudent.fatherPhotoUrl ? (
                        <img src={newStudent.fatherPhotoUrl} alt="Father" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false, 'father')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Father's Name</label>
                    <input 
                      type="text" 
                      placeholder="Father's Name"
                      value={newStudent.fatherName}
                      onChange={e => setNewStudent({...newStudent, fatherName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {newStudent.motherPhotoUrl ? (
                        <img src={newStudent.motherPhotoUrl} alt="Mother" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false, 'mother')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Mother's Name</label>
                    <input 
                      type="text" 
                      placeholder="Mother's Name"
                      value={newStudent.motherName}
                      onChange={e => setNewStudent({...newStudent, motherName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-xl bg-white border border-black/5 flex items-center justify-center overflow-hidden">
                      {newStudent.driverPhotoUrl ? (
                        <img src={newStudent.driverPhotoUrl} alt="Driver" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 p-1.5 bg-gray-900 text-white rounded-lg shadow-sm cursor-pointer hover:bg-black transition-all">
                      <Upload className="w-3 h-3" />
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false, 'driver')} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Driver's Name</label>
                    <input 
                      type="text" 
                      placeholder="Driver's Name"
                      value={newStudent.driverName}
                      onChange={e => setNewStudent({...newStudent, driverName: e.target.value})}
                      className="w-full px-3 py-1.5 bg-white border border-black/10 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone Number (For SMS Notifications)</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+1234567890"
                  value={newStudent.phoneNumber}
                  onChange={e => setNewStudent({...newStudent, phoneNumber: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
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
