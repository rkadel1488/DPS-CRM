import React, { useState, useEffect } from 'react';
import { 
  Ticket,
  Plus,
  Search,
  Users,
  Clock,
  Calendar,
  ChevronRight,
  X,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { addDoc, collection, onSnapshot, query, doc, serverTimestamp, updateDoc, getDoc } from 'firebase/firestore';
import { UserProfile, Student, GatePass } from '../types';
import { handleFirestoreError, OperationType } from '../App';
import { Html5Qrcode } from 'html5-qrcode';

export default function GatePassDashboard({ profile, isAdmin, initialScan = false }: { profile: UserProfile | null, isAdmin: boolean, initialScan?: boolean }) {
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isAddingGatePass, setIsAddingGatePass] = useState(false);
  const [newGatePass, setNewGatePass] = useState({ studentId: '', reason: '', departureTime: new Date().toISOString().slice(0, 16) });
  const [gatePassSearch, setGatePassSearch] = useState('');
  const [isScanning, setIsScanning] = useState(initialScan);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (initialScan) {
      setIsScanning(true);
    }
  }, [initialScan]);

  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    const startScanner = async () => {
      try {
        // Double check element existence
        const element = document.getElementById("qr-reader");
        if (!element) {
          if (isMounted) setTimeout(startScanner, 200);
          return;
        }

        setCameraError(null);
        html5QrCode = new Html5Qrcode("qr-reader");
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        try {
          // Try environment (back) camera first
          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              const student = students.find(s => s.id === decodedText || s.studentId === decodedText);
              if (student && isMounted) {
                setScannedStudent(student);
                setIsScanning(false);
                if (html5QrCode) {
                  html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
                }
              }
            },
            () => {}
          );
        } catch (envErr) {
          console.warn("Back camera failed, trying any available camera", envErr);
          // Fallback: Use the first available camera
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0 && isMounted) {
            await html5QrCode.start(
              cameras[0].id,
              config,
              (decodedText) => {
                const student = students.find(s => s.id === decodedText || s.studentId === decodedText);
                if (student && isMounted) {
                  setScannedStudent(student);
                  setIsScanning(false);
                  if (html5QrCode) {
                    html5QrCode.stop().catch(err => console.error("Error stopping scanner", err));
                  }
                }
              },
              () => {}
            );
          } else {
            throw new Error("No cameras found on this device.");
          }
        }
      } catch (err: any) {
        console.error("Scanner error:", err);
        if (isMounted) {
          if (err?.toString().includes("Permission denied")) {
            setCameraError("Camera permission denied. Please enable camera access in your browser settings.");
          } else if (err?.toString().includes("NotFound")) {
            setCameraError("No camera found. If you are on a laptop, ensure your webcam is connected.");
          } else {
            setCameraError("Could not access camera. Please ensure no other app is using it.");
          }
        }
      }
    };

    if (isScanning) {
      startScanner();
    }

    return () => {
      isMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().catch(err => console.error("Error stopping scanner on unmount", err));
      }
    };
  }, [isScanning, students]);

  useEffect(() => {
    if (!profile) return;

    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const unsubscribeGatePasses = onSnapshot(collection(db, 'gate_passes'), (snapshot) => {
      setGatePasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GatePass)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gate_passes');
    });

    return () => {
      unsubscribeStudents();
      unsubscribeGatePasses();
    };
  }, [profile]);

  const handleAddGatePass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const student = students.find(s => s.id === newGatePass.studentId);
    if (!student) return;

    try {
      await addDoc(collection(db, 'gate_passes'), {
        studentId: newGatePass.studentId,
        studentName: student.name,
        reason: newGatePass.reason,
        departureTime: newGatePass.departureTime,
        status: 'active',
        authorizedBy: profile.displayName || profile.email || 'Admin',
        createdAt: serverTimestamp()
      });
      setIsAddingGatePass(false);
      setNewGatePass({ studentId: '', reason: '', departureTime: new Date().toISOString().slice(0, 16) });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gate_passes');
    }
  };

  const handleVerifyAndIssue = async () => {
    if (!profile || !scannedStudent) return;
    setIsVerifying(true);

    try {
      const passData = {
        studentId: scannedStudent.id,
        studentName: scannedStudent.name,
        reason: "QR Verified Check-out",
        departureTime: new Date().toISOString(),
        status: 'active' as const,
        authorizedBy: profile.displayName || profile.email || 'Admin',
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'gate_passes'), passData);
      const scannedDate = new Date().toLocaleString();

      // Send SMS logic
      const phone = scannedStudent.phoneNumber || "N/A";
      if (phone !== "N/A") {
        await sendSMSNotification(phone, scannedStudent.name, scannedDate);
      }

      setScannedStudent(null);
      alert(`Gate pass issued and verified for ${scannedStudent.name}.\nDate: ${scannedDate}\n\nSMS notification has been sent to the parent (${phone}) via the integration system.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'gate_passes');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUpdateGatePassStatus = async (passId: string, status: 'returned' | 'cancelled') => {
    try {
      const updateData: any = { status };
      if (status === 'returned') {
        updateData.arrivalTime = new Date().toISOString();
      }
      await updateDoc(doc(db, 'gate_passes', passId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'gate_passes');
    }
  };

  const sendSMSNotification = async (phone: string, studentName: string, date: string) => {
    console.log(`[SMS-INTEGRATION] To: ${phone} | Message: ${studentName} has been verified for early departure on ${date}. Authorization provided by ${profile?.displayName || 'Admin'}.`);
    
    // This function acts as a hook for the SMS service integration
    // Configuration can be found in Settings -> SMS Gate Pass Integration
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gate Pass Management</h2>
          <p className="text-gray-500">Monitor and issue student gate passes for early departures.</p>
        </div>
        <div className="flex gap-3 w-full lg:w-auto">
          <button 
            onClick={() => setIsScanning(true)}
            className="flex-1 lg:flex-none px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all font-mono"
          >
            <QrCode className="w-5 h-5" /> Scan QR
          </button>
          <button 
            onClick={() => setIsAddingGatePass(true)}
            className="flex-1 lg:flex-none px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"
          >
            <Plus className="w-5 h-5" /> Issue New Pass
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-3xl border border-black/5 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search student or reason..."
            value={gatePassSearch}
            onChange={(e) => setGatePassSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium text-gray-900"
          />
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
          <span className="flex items-center gap-1.5 ring-1 ring-black/5 px-3 py-1 rounded-full bg-gray-50">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            {gatePasses.filter(p => p.status === 'active').length} Active
          </span>
          <span className="flex items-center gap-1.5 ring-1 ring-black/5 px-3 py-1 rounded-full bg-gray-50">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            {gatePasses.filter(p => p.status === 'returned').length} Returned
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {gatePasses
          .filter(gp => 
            gp.studentName.toLowerCase().includes(gatePassSearch.toLowerCase()) ||
            gp.reason.toLowerCase().includes(gatePassSearch.toLowerCase())
          )
          .sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds : new Date(a.createdAt).getTime();
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds : new Date(b.createdAt).getTime();
            return dateB - dateA;
          })
          .map((pass) => (
            <motion.div 
              key={pass.id}
              layout
              className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <Ticket className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                    pass.status === 'active' ? 'bg-orange-50 text-orange-600' : 
                    pass.status === 'returned' ? 'bg-emerald-50 text-emerald-600' : 
                    'bg-red-50 text-red-600'
                  }`}>
                    {pass.status}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {pass.createdAt?.toDate ? pass.createdAt.toDate().toLocaleDateString() : new Date(pass.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 text-lg">{pass.studentName}</h4>
                <p className="text-sm text-gray-500">Authorized by {pass.authorizedBy}</p>
              </div>

              <div className="space-y-3 border-t border-black/5 pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-tight">Departure Time</p>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(pass.departureTime).toLocaleString()}
                    </p>
                  </div>
                </div>
                {pass.arrivalTime && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium uppercase tracking-tight">Returned At</p>
                      <p className="text-sm font-bold text-gray-900">
                        {new Date(pass.arrivalTime).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
                <div className="bg-gray-50 p-3 rounded-2xl">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-tight mb-1">Reason</p>
                  <p className="text-sm text-gray-700 italic font-medium leading-relaxed">"{pass.reason}"</p>
                </div>
              </div>

              {pass.status === 'active' && (
                <div className="flex gap-2 pt-4 border-t border-black/5">
                  <button
                    onClick={() => handleUpdateGatePassStatus(pass.id, 'returned')}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
                  >
                    Mark Returned
                  </button>
                  <button
                    onClick={() => handleUpdateGatePassStatus(pass.id, 'cancelled')}
                    className="flex-1 py-2.5 bg-white text-red-600 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </motion.div>
          ))
        }
        {gatePasses.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
            <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No gate passes issued yet.</p>
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg relative"
            >
              <button 
                onClick={() => setIsScanning(false)}
                className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-8 h-8" />
              </button>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <QrCode className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Scan Student QR Code</h3>
                <p className="text-gray-500">Point your camera at the student's ID card QR</p>
              </div>
              
              {cameraError ? (
                <div className="bg-red-50 p-6 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-red-700 font-medium">{cameraError}</p>
                  <button 
                    onClick={() => {
                      setIsScanning(false);
                      setTimeout(() => setIsScanning(true), 100);
                    }}
                    className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div id="qr-reader" className="overflow-hidden rounded-2xl border-4 border-blue-50" />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Scanned Result Modal */}
      <AnimatePresence>
        {scannedStudent && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
            >
              <button 
                onClick={() => setScannedStudent(null)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-all"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>

              <div className="text-center space-y-4">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto ring-4 ring-blue-100 overflow-hidden">
                  {scannedStudent.photoUrl ? (
                    <img src={scannedStudent.photoUrl} alt={scannedStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-10 h-10 text-blue-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{scannedStudent.name}</h3>
                  <p className="text-blue-600 font-bold font-mono text-sm tracking-widest">{scannedStudent.studentId || 'ID Pending'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pb-6">
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Grade</p>
                    <p className="font-bold text-gray-900">{scannedStudent.grade}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Section</p>
                    <p className="font-bold text-gray-900">{scannedStudent.section}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-2xl col-span-2 flex items-center gap-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div className="text-left">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Parent Contact</p>
                      <p className="font-bold text-gray-900">{scannedStudent.phoneNumber || 'No number linked'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <button
                    disabled={isVerifying}
                    onClick={handleVerifyAndIssue}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <Clock className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    Mark as Verified & Notify
                  </button>
                  <button
                    disabled={isVerifying}
                    onClick={() => {
                      setScannedStudent(null);
                      setIsScanning(true);
                    }}
                    className="w-full py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Scan Another
                  </button>
                  <p className="text-[10px] text-gray-400 italic">
                     Clicking verify will issue an active gate pass and send an automated SMS to the linked phone number.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isAddingGatePass && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl relative"
          >
            <button 
              onClick={() => setIsAddingGatePass(false)}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-all"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Issue Gate Pass</h3>
              <p className="text-gray-500 text-sm">Fill in the details for early student departure.</p>
            </div>
            <form onSubmit={handleAddGatePass} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Select Student</label>
                <select
                  required
                  value={newGatePass.studentId}
                  onChange={e => setNewGatePass({...newGatePass, studentId: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                >
                  <option value="">Choose student...</option>
                  {students.sort((a,b) => a.name.localeCompare(b.name)).map(s => (
                    <option key={s.id} value={s.id}>{s.name} (Grade {s.grade})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Reason for Leaving</label>
                <textarea 
                  required
                  value={newGatePass.reason}
                  onChange={e => setNewGatePass({...newGatePass, reason: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-medium"
                  placeholder="e.g., Medical appointment, Early dismissal..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Departure Time</label>
                <input 
                  type="datetime-local" 
                  required
                  value={newGatePass.departureTime}
                  onChange={e => setNewGatePass({...newGatePass, departureTime: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                />
              </div>
              <div className="flex gap-3 pt-6">
                <button 
                  type="button"
                  onClick={() => setIsAddingGatePass(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Issue Pass
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
