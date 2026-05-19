import React, { useState, useEffect } from 'react';
import { 
  Bus, 
  MapPin, 
  Navigation, 
  Users, 
  AlertTriangle,
  Clock,
  ChevronRight,
  Shield,
  Fuel,
  Activity,
  Plus,
  Play
} from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { addDoc, collection, onSnapshot, query, doc, setDoc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Vehicle, Route, BoardingLog, UserProfile, Student, TransportAttendance } from '../types';
import { handleFirestoreError, OperationType } from '../App';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapBoundsUpdater({ vehicles, routes, selectedVehicleId, centerTrigger }: { vehicles: Vehicle[], routes: Route[], selectedVehicleId: string, centerTrigger: number }) {
  const map = useMap();
  useEffect(() => {
    let targetVehicles = vehicles.filter(v => v.currentLat && v.currentLng);
    if (selectedVehicleId !== 'all') {
      targetVehicles = targetVehicles.filter(v => v.id === selectedVehicleId);
    }
    
    let points: L.LatLngExpression[] = targetVehicles.map(v => [v.currentLat!, v.currentLng!]);
    
    if (selectedVehicleId !== 'all') {
      const trackingRoute = routes.find(r => r.vehicleId === selectedVehicleId);
      if (trackingRoute && trackingRoute.stops) {
        trackingRoute.stops.forEach(s => points.push([s.lat, s.lng]));
      }
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      // If no vehicles, try to get user's current location
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            map.setView([position.coords.latitude, position.coords.longitude], 13);
          },
          (error) => {
            console.error("Error getting location:", error);
            // Fallback to a default location if geolocation fails or is denied
            // map.setView([40.7128, -74.0060], 12); 
          }
        );
      }
    }
  }, [vehicles, routes, map, selectedVehicleId, centerTrigger]);
  return null;
}

export default function TransportDashboard({ profile, isAdmin }: { profile: UserProfile | null, isAdmin: boolean }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [logs, setLogs] = useState<BoardingLog[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<TransportAttendance[]>([]);
  const [activeTab, setActiveTab] = useState<'fleet' | 'routes' | 'attendance' | 'tracking'>('fleet');
  const [isAddingVehicle, setIsAddingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ busNumber: '', plateNumber: '', capacity: 40, status: 'active' as const, gpsTrackerId: '' });
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', driverId: '', vehicleId: '', stops: [] });
  
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [broadcastingVehicleId, setBroadcastingVehicleId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const [selectedTrackingVehicleId, setSelectedTrackingVehicleId] = useState<string>('all');
  const [centerTrigger, setCenterTrigger] = useState<number>(0);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  const toggleBroadcast = (vehicleId: string) => {
    if (broadcastingVehicleId === vehicleId) {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setBroadcastingVehicleId(null);
    } else {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      
      if ('geolocation' in navigator) {
        const id = navigator.geolocation.watchPosition(
          async (position) => {
            try {
              await updateDoc(doc(db, 'vehicles', vehicleId), {
                currentLat: position.coords.latitude,
                currentLng: position.coords.longitude,
                lastUpdate: serverTimestamp()
              });
            } catch (error) {
              console.error("Failed to update location", error);
            }
          },
          (error) => {
            console.error("Geolocation error:", error);
            alert("Failed to get location. Please ensure location permissions are granted.");
            setBroadcastingVehicleId(null);
            if (watchId !== null) setWatchId(null);
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
        setWatchId(id);
        setBroadcastingVehicleId(vehicleId);
      } else {
        alert("Geolocation is not supported by your browser");
      }
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const vehicleData = { ...newVehicle };
      if (!vehicleData.gpsTrackerId) {
        delete (vehicleData as any).gpsTrackerId;
      }
      await addDoc(collection(db, 'vehicles'), vehicleData);
      setIsAddingVehicle(false);
      setNewVehicle({ busNumber: '', plateNumber: '', capacity: 40, status: 'active', gpsTrackerId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'vehicles');
    }
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (!isAdmin) return;
    setVehicleToDelete(vehicleId);
  };

  const confirmDeleteVehicle = async () => {
    if (!isAdmin || !vehicleToDelete) return;
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleToDelete));
      setVehicleToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'vehicles');
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    try {
      const mockStops = [
        { name: 'Start Point', lat: 40.7100, lng: -74.0150 },
        { name: 'Midway Station', lat: 40.7150, lng: -74.0050 },
        { name: 'School Campus', lat: 40.7200, lng: -73.9950 }
      ];
      const routeData = { ...newRoute, stops: newRoute.stops.length > 0 ? newRoute.stops : mockStops };
      if (!routeData.vehicleId) {
        delete (routeData as any).vehicleId;
      }
      await addDoc(collection(db, 'routes'), routeData);
      setIsAddingRoute(false);
      setNewRoute({ name: '', driverId: '', vehicleId: '', stops: [] });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'routes');
    }
  };

  const handleDeleteRoute = (routeId: string) => {
    if (!isAdmin) return;
    setRouteToDelete(routeId);
  };

  const confirmDeleteRoute = async () => {
    if (!isAdmin || !routeToDelete) return;
    try {
      await deleteDoc(doc(db, 'routes', routeToDelete));
      setRouteToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'routes');
    }
  };

  const handleMarkAttendance = async (studentId: string, status: 'present' | 'absent') => {
    if (!profile) return;
    
    // Check if record exists for this date and student
    const existingRecord = attendance.find(a => a.date === selectedDate && a.studentId === studentId && a.routeId === selectedRouteId);
    
    try {
      if (existingRecord) {
        await setDoc(doc(db, 'transport_attendance', existingRecord.id), {
          ...existingRecord,
          status,
          timestamp: serverTimestamp(),
          markedBy: profile.uid
        });
      } else {
        await addDoc(collection(db, 'transport_attendance'), {
          date: selectedDate,
          routeId: selectedRouteId,
          studentId,
          status,
          timestamp: serverTimestamp(),
          markedBy: profile.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'transport_attendance');
    }
  };

  useEffect(() => {
    if (!profile) return;

    const unsubscribeVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'vehicles');
    });

    const unsubscribeRoutes = onSnapshot(collection(db, 'routes'), (snapshot) => {
      setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'routes');
    });

    const unsubscribeLogs = onSnapshot(collection(db, 'boarding_logs'), (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BoardingLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'boarding_logs');
    });

    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'students');
    });

    const unsubscribeAttendance = onSnapshot(collection(db, 'transport_attendance'), (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TransportAttendance)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transport_attendance');
    });

    return () => {
      unsubscribeVehicles();
      unsubscribeRoutes();
      unsubscribeLogs();
      unsubscribeStudents();
      unsubscribeAttendance();
    };
  }, [profile]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Transport Management</h2>
          <p className="text-gray-500">Monitor fleet, optimize routes, and track students.</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
          {[
            { id: 'fleet', label: 'Fleet', icon: Bus },
            { id: 'routes', label: 'Routes', icon: Navigation },
            { id: 'attendance', label: 'Attendance', icon: Users },
            { id: 'tracking', label: 'Live Tracking', icon: MapPin },
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
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {activeTab === 'fleet' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {vehicles.length > 0 ? vehicles.map((bus) => (
                <motion.div 
                  key={bus.id}
                  layout
                  className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Bus className="w-8 h-8" />
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                        bus.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {bus.status}
                      </span>
                      <p className="text-sm font-bold text-gray-900 mt-1">Bus #{bus.busNumber}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Plate Number</span>
                      <span className="font-medium text-gray-900">{bus.plateNumber}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Capacity</span>
                      <span className="font-medium text-gray-900">{bus.capacity} Students</span>
                    </div>
                    {bus.gpsTrackerId && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">GPS Tracker</span>
                        <span className="font-medium text-gray-900">{bus.gpsTrackerId}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-4 border-t border-black/5">
                    <div className="text-center">
                      <Fuel className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                      <span className="text-[10px] font-bold text-gray-900">85%</span>
                    </div>
                    <div className="text-center">
                      <Activity className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                      <span className="text-[10px] font-bold text-gray-900">Good</span>
                    </div>
                    <div className="text-center">
                      <Shield className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                      <span className="text-[10px] font-bold text-gray-900">Insured</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-black/5 space-y-2">
                    <button
                      onClick={() => toggleBroadcast(bus.id)}
                      className={`w-full py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                        broadcastingVehicleId === bus.id
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                      {broadcastingVehicleId === bus.id ? 'Stop Broadcasting GPS' : 'Start Broadcasting GPS'}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteVehicle(bus.id)}
                        className="w-full py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-white text-red-500 border border-red-100 hover:bg-red-50"
                      >
                        Remove Bus
                      </button>
                    )}
                  </div>
                </motion.div>
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300">
                  <Bus className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No vehicles registered. Add your first bus!</p>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAddingVehicle(true)}
                      className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold"
                    >
                      Register Vehicle
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'fleet' && vehicles.length > 0 && isAdmin && (
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setIsAddingVehicle(true)}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2"
              >
                <Plus className="w-5 h-5" /> Register Vehicle
              </button>
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-4">
              {routes.length > 0 ? routes.map((route) => (
                <div key={route.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex items-center gap-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-900">{route.name}</h4>
                    <p className="text-sm text-gray-500">
                      {route.stops?.length || 0} Stops • {students.filter(s => s.routeId === route.id).length} Students Assigned
                      {route.vehicleId && vehicles.find(v => v.id === route.vehicleId) && (
                        <span> • Bus #{vehicles.find(v => v.id === route.vehicleId)?.busNumber}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-[10px] font-bold">
                        S{i}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => alert('Route details coming soon!')}
                      className="p-2 hover:bg-gray-50 rounded-xl transition-all"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={() => handleDeleteRoute(route.id)}
                        className="p-2 hover:bg-red-50 text-red-400 hover:text-red-600 rounded-xl transition-all"
                        title="Delete Route"
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-gray-300">
                  <Navigation className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No routes found.</p>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAddingRoute(true)}
                      className="mt-4 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold"
                    >
                      Add Route
                    </button>
                  )}
                </div>
              )}
              
              {routes.length > 0 && isAdmin && (
                <div className="mt-6 flex justify-end">
                  <button 
                    onClick={() => setIsAddingRoute(true)}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Add Route
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-900 mb-2">Select Route</label>
                  <select
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Select a route...</option>
                    {routes.map(route => (
                      <option key={route.id} value={route.id}>{route.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-bold text-gray-900 mb-2">Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              {selectedRouteId ? (
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-900 border-b pb-2">Students on this Route</h3>
                  {students.filter(s => s.routeId === selectedRouteId).length > 0 ? (
                    students.filter(s => s.routeId === selectedRouteId).map(student => {
                      const record = attendance.find(a => a.date === selectedDate && a.studentId === student.id && a.routeId === selectedRouteId);
                      return (
                        <div key={student.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{student.name}</p>
                              <p className="text-xs text-gray-500">Grade {student.grade} - {student.section}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkAttendance(student.id, 'present')}
                              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                record?.status === 'present' 
                                  ? 'bg-emerald-600 text-white' 
                                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              onClick={() => handleMarkAttendance(student.id, 'absent')}
                              className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                                record?.status === 'absent' 
                                  ? 'bg-red-600 text-white' 
                                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-red-50'
                              }`}
                            >
                              Absent
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 text-center py-8">No students assigned to this route.</p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Select a route to view and mark attendance.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tracking' && (
            <div className="bg-white rounded-3xl border border-black/5 shadow-sm h-[500px] relative overflow-hidden">
              <div className="absolute inset-0 bg-gray-100">
                <MapContainer center={[40.7128, -74.0060]} zoom={12} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  <MapBoundsUpdater vehicles={vehicles} routes={routes} selectedVehicleId={selectedTrackingVehicleId} centerTrigger={centerTrigger} />
                  {vehicles.filter(v => v.currentLat && v.currentLng).map(bus => (
                    <Marker key={bus.id} position={[bus.currentLat!, bus.currentLng!]}>
                      <Popup>
                        <div className="font-bold">Bus #{bus.busNumber}</div>
                        <div className="text-sm text-gray-600">Plate: {bus.plateNumber}</div>
                        <div className="text-sm text-gray-600">Status: {bus.status}</div>
                      </Popup>
                    </Marker>
                  ))}
                  {(() => {
                    const trackingRoute = selectedTrackingVehicleId !== 'all' ? routes.find(r => r.vehicleId === selectedTrackingVehicleId) : null;
                    if (!trackingRoute || !trackingRoute.stops || trackingRoute.stops.length === 0) return null;
                    return (
                      <>
                        <Polyline 
                          positions={trackingRoute.stops.map(s => [s.lat, s.lng])} 
                          color="#3b82f6" 
                          weight={4} 
                          opacity={0.8}
                          dashArray="5, 10"
                        />
                        {trackingRoute.stops.map((stop, idx) => (
                          <CircleMarker 
                            key={`stop-${idx}`} 
                            center={[stop.lat, stop.lng]} 
                            radius={6} 
                            fillColor="#ffffff" 
                            color="#3b82f6" 
                            weight={2} 
                            fillOpacity={1}
                          >
                            <Popup>
                              <div className="font-bold">{stop.name}</div>
                              <div className="text-xs text-gray-500">Stop {idx + 1}</div>
                            </Popup>
                          </CircleMarker>
                        ))}
                      </>
                    );
                  })()}
                </MapContainer>
              </div>
              
              {/* Overlay UI */}
              <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none z-[1000]">
                <div className="bg-white/90 backdrop-blur p-3 rounded-2xl shadow-lg pointer-events-auto border border-black/5 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-xs font-bold text-gray-900">{vehicles.filter(v => v.currentLat && v.currentLng).length} Buses Online</span>
                  </div>
                  <select
                    value={selectedTrackingVehicleId}
                    onChange={(e) => setSelectedTrackingVehicleId(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white"
                  >
                    <option value="all">All Buses</option>
                    {vehicles.filter(v => v.currentLat && v.currentLng).map(v => (
                      <option key={v.id} value={v.id}>Bus #{v.busNumber}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-500">Drivers can broadcast GPS from the Fleet tab.</p>
                </div>
                <div className="flex flex-col gap-2 pointer-events-auto">
                  {isAdmin && (
                    <button 
                      onClick={async () => {
                        // Simulate GPS movement
                        const activeVehicles = vehicles.filter(v => v.status === 'active');
                        for (const bus of activeVehicles) {
                          const baseLat = 40.7128;
                          const baseLng = -74.0060;
                          
                          // If it doesn't have coords, give it a random one near center
                          const currentLat = bus.currentLat || (baseLat + (Math.random() - 0.5) * 0.1);
                          const currentLng = bus.currentLng || (baseLng + (Math.random() - 0.5) * 0.1);
                          
                          // Move slightly (much smaller step to look like driving, not teleporting)
                          const newLat = currentLat + (Math.random() - 0.5) * 0.0005;
                          const newLng = currentLng + (Math.random() - 0.5) * 0.0005;
                          
                          try {
                            await updateDoc(doc(db, 'vehicles', bus.id), {
                              currentLat: newLat,
                              currentLng: newLng,
                              lastUpdate: serverTimestamp()
                            });
                          } catch (error) {
                            console.error("Failed to update vehicle location", error);
                          }
                        }
                      }}
                      className="p-3 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-black/5 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                      title="Simulate GPS Movement"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => setCenterTrigger(prev => prev + 1)}
                    className="p-3 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-black/5 text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                    title="Current Location"
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Fleet Health</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Buses in Service</span>
                <span className="font-bold text-emerald-600">{vehicles.filter(v => v.status === 'active').length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">Under Maintenance</span>
                <span className="font-bold text-orange-500">{vehicles.filter(v => v.status === 'maintenance').length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isAddingVehicle && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Register Vehicle</h3>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bus Number</label>
                <input 
                  type="text" 
                  required
                  value={newVehicle.busNumber}
                  onChange={e => setNewVehicle({...newVehicle, busNumber: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plate Number</label>
                <input 
                  type="text" 
                  required
                  value={newVehicle.plateNumber}
                  onChange={e => setNewVehicle({...newVehicle, plateNumber: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input 
                  type="number" 
                  required
                  min="1"
                  value={newVehicle.capacity}
                  onChange={e => setNewVehicle({...newVehicle, capacity: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select 
                  value={newVehicle.status}
                  onChange={e => setNewVehicle({...newVehicle, status: e.target.value as any})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="active">Active</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GPS Tracker ID (Optional)</label>
                <input 
                  type="text" 
                  value={newVehicle.gpsTrackerId}
                  onChange={e => setNewVehicle({...newVehicle, gpsTrackerId: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g., TRK-9921"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingVehicle(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Register
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {isAddingRoute && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Add Route</h3>
            <form onSubmit={handleAddRoute} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Route Name</label>
                <input 
                  type="text" 
                  required
                  value={newRoute.name}
                  onChange={e => setNewRoute({...newRoute, name: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g., North City Loop"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign Bus (Optional)</label>
                <select 
                  value={newRoute.vehicleId}
                  onChange={e => setNewRoute({...newRoute, vehicleId: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">No Bus Assigned</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>Bus #{v.busNumber} ({v.plateNumber})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsAddingRoute(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  Save Route
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {vehicleToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl text-center"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Remove Bus</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to remove this bus? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setVehicleToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteVehicle}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Remove
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {routeToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl text-center"
          >
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Route</h3>
            <p className="text-gray-500 mb-6">Are you sure you want to delete this route? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setRouteToDelete(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDeleteRoute}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
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
