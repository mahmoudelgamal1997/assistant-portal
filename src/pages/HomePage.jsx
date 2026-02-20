import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, getDocs, doc, getDoc,
  onSnapshot, addDoc, updateDoc, setDoc, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import PatientCard from '../components/PatientCard';
import AddPatientModal from '../components/AddPatientModal';
import BillNotificationModal from '../components/BillNotificationModal';
import PaymentModal from '../components/PaymentModal';
import HistoryPage from './HistoryPage';

function formatDate(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDateDisplay(date) {
  return date.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function HomePage({ clinic, onChangeClinic }) {
  const { assistantData, logout } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [patients, setPatients] = useState([]);
  const [currentOrder, setCurrentOrder] = useState(0);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [billNotification, setBillNotification] = useState(null);
  const [paymentPatient, setPaymentPatient] = useState(null);
  const [paymentBill, setPaymentBill] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'history'
  const [doctorNotification, setDoctorNotification] = useState(null); // { message, doctorName }

  const dateStr = formatDate(selectedDate);
  const seenNotificationsRef = useRef(new Set());
  const prevPatientsRef = useRef({});
  const doctorNotifTimerRef = useRef(null);

  // Load doctors for this clinic
  useEffect(() => {
    const loadDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const relRef = collection(db, 'doctor_clinic_assistant');
        const q = query(relRef, where('clinic_id', '==', clinic.id));
        const snap = await getDocs(q);
        const doctorIds = [...new Set(snap.docs.map((d) => d.data().doctor_id))];

        const doctorPromises = doctorIds.map(async (did) => {
          const dSnap = await getDoc(doc(db, 'doctors', did));
          return dSnap.exists() ? { id: did, ...dSnap.data() } : null;
        });

        const results = (await Promise.all(doctorPromises)).filter(Boolean);
        setDoctors(results);
        if (results.length > 0) setSelectedDoctor(results[0]);
      } catch (err) {
        console.error('Error loading doctors:', err);
      } finally {
        setLoadingDoctors(false);
      }
    };
    loadDoctors();
  }, [clinic.id]);

  // Listen to patients
  useEffect(() => {
    if (!selectedDoctor) return;
    setLoadingPatients(true);

    const patientsRef = collection(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'patients'
    );
    const q = query(patientsRef, where('doctor_id', '==', selectedDoctor.id));

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          // Sort by createdAt ms timestamp — last added appears last.
          // Fall back to position/user_order_in_queue for older patients without createdAt.
          const aKey = a.createdAt ?? (a.position ?? a.user_order_in_queue ?? 0) * 1e12;
          const bKey = b.createdAt ?? (b.position ?? b.user_order_in_queue ?? 0) * 1e12;
          return aKey - bKey;
        });

      // Detect newly assigned bills by comparing with previous state
      list.forEach((patient) => {
        const prev = prevPatientsRef.current[patient.id];
        const prevBillCount = prev ? (prev.bills?.length ?? 0) : -1;
        const currBillCount = patient.bills?.length ?? 0;

        // New bill appeared (not first load, and count increased)
        if (prevBillCount !== -1 && currBillCount > prevBillCount) {
          const newBills = (patient.bills ?? []).slice(prevBillCount);
          const newBill = newBills[0];
          if (newBill && newBill.paymentStatus === 'pending') {
            setBillNotification({ patient, bill: newBill });
            playNotificationSound();
          }
        }
      });

      // Update previous state map
      prevPatientsRef.current = Object.fromEntries(list.map((p) => [p.id, p]));

      setPatients(list);
      setLoadingPatients(false);
    });

    return () => unsubscribe();
  }, [clinic.id, selectedDoctor?.id, dateStr]);

  // Listen to current order
  useEffect(() => {
    if (!selectedDoctor) return;

    const orderRef = doc(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'CurrentOrder', selectedDoctor.id
    );

    const unsubscribe = onSnapshot(orderRef, (snap) => {
      if (snap.exists()) {
        setCurrentOrder(snap.data().currentOrder ?? 0);
      } else {
        setCurrentOrder(0);
      }
    });

    return () => unsubscribe();
  }, [clinic.id, selectedDoctor?.id, dateStr]);

  // Listen for "Notify Assistant" messages from doctor (type: custom)
  useEffect(() => {
    if (!assistantData?.id) return;

    const seenIds = seenNotificationsRef.current;

    const notifRef = collection(db, 'doctor_assistant_notifications');
    const q = query(
      notifRef,
      where('assistant_id', '==', assistantData.id),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const docId = change.doc.id;

        // Only handle non-billing (billing is already handled via patient listener)
        if (data.type === 'billing') return;
        if (data.read === true) return;
        if (seenIds.has(docId)) return;

        seenIds.add(docId);
        const msg = data.message || 'لديك إشعار جديد من الطبيب';
        const doctorName = data.doctor_name || 'الطبيب';

        setDoctorNotification({ message: msg, doctorName });
        playDoctorNotificationSound();

        // Auto-dismiss after 15 seconds
        if (doctorNotifTimerRef.current) clearTimeout(doctorNotifTimerRef.current);
        doctorNotifTimerRef.current = setTimeout(() => setDoctorNotification(null), 15000);
      });
    });

    return () => {
      unsubscribe();
      if (doctorNotifTimerRef.current) clearTimeout(doctorNotifTimerRef.current);
    };
  }, [assistantData?.id]);

  // Bill notifications are detected directly from patient document changes (see patient listener above)

  const updateCurrentOrder = async (newOrder) => {
    const orderRef = doc(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'CurrentOrder', selectedDoctor.id
    );
    await setDoc(orderRef, { currentOrder: newOrder }, { merge: true });
  };

  const handleOrderIncrement = () => updateCurrentOrder(currentOrder + 1);
  const handleOrderDecrement = () => {
    if (currentOrder > 1) updateCurrentOrder(currentOrder - 1);
  };
  const handleOrderReset = () => updateCurrentOrder(1);

  const getNextQueueNumber = () => {
    if (patients.length === 0) return 1;
    const max = Math.max(...patients.map((p) => p.user_order_in_queue ?? 0));
    return max + 1;
  };

  const handleAddPatient = async (patientData) => {
    const queueNumber = getNextQueueNumber();
    const now = new Date();
    // 12-hour format with clear AM/PM, locale-independent
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = String(hours % 12 || 12).padStart(2, '0');
    const timeStr = `${displayHours}:${minutes} ${ampm}`;

    const patientDoc = {
      patient_name: patientData.name,
      patient_phone: patientData.phone,
      doctor_id: selectedDoctor.id,
      doctor_name: selectedDoctor.name,
      clinic_id: clinic.id,
      date: dateStr,
      time: timeStr,
      status: 'WAITING',
      position: queueNumber,
      user_order_in_queue: queueNumber,
      age: '',
      address: '',
      visit_type: patientData.visitType,
      visit_speed: patientData.visitSpeed,
      referral_source: patientData.referralSource ?? 'عام',
      createdAt: now.getTime(),
      fcmToken: '',
      consultationPayment: {
        amount: patientData.fee ?? 0,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        consultationType: patientData.visitType,
        paidAt: null,
        paidBy: null,
      },
    };

    const patientsRef = collection(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'patients'
    );
    await addDoc(patientsRef, patientDoc);
    setShowAddModal(false);
  };

  const handleStatusChange = async (patient, newStatus) => {
    const patientRef = doc(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'patients', patient.id
    );
    await updateDoc(patientRef, { status: newStatus });

    // When FINISHED → add patient to doctor's patient list in MongoDB (same as Android app)
    if (newStatus === 'FINISHED') {
      const patientPayload = {
        patient_name: patient.patient_name,
        patient_phone: patient.patient_phone ?? '',
        patient_id: patient.id,
        doctor_id: patient.doctor_id,
        doctor_name: patient.doctor_name ?? '',
        clinic_id: clinic.id,
        date: patient.date ?? dateStr,
        time: patient.time ?? '',
        status: 'FINISHED',
        visit_type: patient.visit_type ?? 'كشف',
        visit_speed: patient.visit_speed ?? 'عادي',
        age: patient.age ?? '',
        address: patient.address ?? '',
        user_order_in_queue: patient.user_order_in_queue ?? 0,
        assistant_id: assistantData?.id ?? '',
      };

      // Fire-and-forget: don't await so the UI never blocks on a slow/cold Heroku server.
      // Retries once automatically if the first attempt fails.
      const saveToMongoDB = async () => {
        const doFetch = () =>
          fetch('https://nowaiting-076a4d0af321.herokuapp.com/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patientPayload),
          });

        try {
          const res = await doFetch();
          if (!res.ok) {
            // Non-2xx response — retry once
            console.warn(`Patient API returned ${res.status}, retrying…`);
            const retry = await doFetch();
            if (!retry.ok) {
              console.error('Patient API retry also failed:', retry.status);
            }
          }
        } catch (err) {
          // Network error — retry once
          console.warn('Patient API network error, retrying…', err);
          try {
            await doFetch();
          } catch (retryErr) {
            console.error('Patient API retry failed:', retryErr);
          }
        }
      };

      saveToMongoDB(); // intentionally not awaited
    }

    // Auto-advance queue to next waiting patient
    if (newStatus === 'FINISHED' || newStatus === 'CANCELED') {
      const nextWaiting = patients.find(
        (p) =>
          p.id !== patient.id &&
          p.status === 'WAITING' &&
          (p.user_order_in_queue ?? 0) > currentOrder
      );
      if (nextWaiting) {
        await updateCurrentOrder(nextWaiting.user_order_in_queue);
      }
    }
  };

  const handlePayConsultation = (patient) => {
    setPaymentPatient(patient);
    setPaymentBill({ type: 'consultation' });
  };

  const handlePayBill = (patient, bill) => {
    setPaymentPatient(patient);
    setPaymentBill({ type: 'bill', bill });
  };

  const handleConfirmPayment = async (method) => {
    if (!paymentPatient || !paymentBill) return;

    const patientRef = doc(
      db,
      'clinics', clinic.id, 'waiting_list', dateStr, 'patients', paymentPatient.id
    );

    const now = new Date().toISOString();

    if (paymentBill.type === 'consultation') {
      const consultAmount = paymentPatient.consultationPayment?.amount ?? 0;
      const consultType = paymentPatient.consultationPayment?.consultationType ?? 'كشف';

      // 1. Update Firestore patient record
      await updateDoc(patientRef, {
        'consultationPayment.paymentStatus': 'paid',
        'consultationPayment.paymentMethod': method,
        'consultationPayment.paidAt': now,
        'consultationPayment.paidBy': assistantData?.id ?? '',
      });

      // 2. Record in MongoDB via API so dashboard shows it
      try {
        await fetch('https://nowaiting-076a4d0af321.herokuapp.com/api/billing/consultation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctor_id: paymentPatient.doctor_id,
            patient_id: paymentPatient.id,
            patient_name: paymentPatient.patient_name,
            patient_phone: paymentPatient.patient_phone ?? '',
            clinic_id: clinic.id,
            consultationType: consultType,
            consultationFee: consultAmount,
            paymentMethod: method,
          }),
        });
      } catch (err) {
        console.error('Failed to record billing in API:', err);
      }

    } else if (paymentBill.type === 'bill') {
      const bill = paymentBill.bill;

      // 1. Update Firestore
      const bills = paymentPatient.bills ?? [];
      const updatedBills = bills.map((b) =>
        b.billing_id === bill.billing_id
          ? { ...b, paymentStatus: 'paid', paymentMethod: method, paidAt: now }
          : b
      );
      await updateDoc(patientRef, { bills: updatedBills });

      // 2. Update billing status in MongoDB via API
      try {
        await fetch(
          `https://nowaiting-076a4d0af321.herokuapp.com/api/billing/doctor/${paymentPatient.doctor_id}/${bill.billing_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentStatus: 'paid',
              paymentMethod: method,
              amountPaid: bill.totalAmount,
            }),
          }
        );
      } catch (err) {
        console.error('Failed to update billing in API:', err);
      }
    }

    setPaymentPatient(null);
    setPaymentBill(null);
  };

  const playDoctorNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.4, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playBeep(660, 0, 0.2);
      playBeep(880, 0.25, 0.2);
      playBeep(660, 0.5, 0.2);
      playBeep(880, 0.75, 0.3);
    } catch (e) {
      // silent fail
    }
  };

  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, start, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      playBeep(880, 0, 0.15);
      playBeep(1100, 0.18, 0.15);
      playBeep(1320, 0.36, 0.25);
    } catch (e) {
      // Audio not supported — silent fail
    }
  };

  const handleDismissNotification = () => {
    setBillNotification(null);
  };

  const handlePayNowFromNotification = () => {
    if (billNotification?.patient && billNotification?.bill) {
      setPaymentPatient(billNotification.patient);
      setPaymentBill({ type: 'bill', bill: billNotification.bill });
    }
    setBillNotification(null);
  };

  const isToday = formatDate(new Date()) === dateStr;

  const waitingCount = patients.filter((p) => p.status === 'WAITING').length;
  const finishedCount = patients.filter((p) => p.status === 'FINISHED').length;

  return (
    <div className="home-page">
      {/* Header */}
      <header className="header">
        <div className="header-right">
          <div className="header-clinic">
            <span className="header-clinic-icon">🏥</span>
            <div>
              <div className="header-clinic-name">
                {clinic.clinic_name_ar || clinic.clinic_name_en || 'عيادة'}
              </div>
              <div className="header-clinic-location">
                {clinic.location_ar || ''}
              </div>
            </div>
          </div>
        </div>

        <div className="header-center">
          {!loadingDoctors && doctors.length > 1 && activeTab === 'home' && (
            <select
              className="doctor-select"
              value={selectedDoctor?.id ?? ''}
              onChange={(e) => {
                const d = doctors.find((doc) => doc.id === e.target.value);
                setSelectedDoctor(d);
              }}
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}
          {!loadingDoctors && doctors.length === 1 && activeTab === 'home' && (
            <div className="doctor-name-single">د. {selectedDoctor?.name ?? ''}</div>
          )}
          {activeTab === 'history' && (
            <div className="doctor-name-single">السجل الطبي</div>
          )}
        </div>

        <div className="header-left">
          <div className="menu-wrapper">
            <button className="icon-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button
                  className="dropdown-item danger"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  🚪 تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tab content */}
      {activeTab === 'home' && (
        <>
          {/* Date Bar */}
          <div className="date-bar">
            <button className="date-nav-btn" onClick={() => {
              const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d);
            }}>▶</button>
            <div className="date-display">
              <span className="date-text">{formatDateDisplay(selectedDate)}</span>
              {isToday && <span className="today-badge">اليوم</span>}
            </div>
            <button className="date-nav-btn" onClick={() => {
              const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d);
            }}>◀</button>
          </div>

          {/* Queue Counter */}
          <div className="queue-section">
            <div className="queue-card">
              <div className="queue-label">رقم الدور الحالي</div>
              <div className="queue-number">{currentOrder}</div>
              <div className="queue-controls">
                <button className="queue-btn queue-btn-prev" onClick={handleOrderDecrement}>−</button>
                <button className="queue-btn queue-btn-reset" onClick={handleOrderReset}>إعادة</button>
                <button className="queue-btn queue-btn-next" onClick={handleOrderIncrement}>+</button>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat-chip waiting"><span>{waitingCount}</span> في الانتظار</div>
              <div className="stat-chip finished"><span>{finishedCount}</span> منتهي</div>
            </div>
          </div>

          {/* Patient List */}
          <div className="patient-list-section">
            <div className="section-header">
              <h2>قائمة المرضى</h2>
              <button className="btn-add" onClick={() => setShowAddModal(true)}>+ إضافة مريض</button>
            </div>
            {loadingPatients ? (
              <div className="loading-center"><div className="spinner"></div></div>
            ) : patients.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👤</div>
                <p>لا يوجد مرضى لهذا اليوم</p>
                <button className="btn-primary" onClick={() => setShowAddModal(true)}>إضافة أول مريض</button>
              </div>
            ) : (
              <div className="patient-list">
                {patients.map((patient) => (
                  <PatientCard
                    key={patient.id}
                    patient={patient}
                    currentOrder={currentOrder}
                    onStatusChange={handleStatusChange}
                    onPayConsultation={handlePayConsultation}
                    onPayBill={handlePayBill}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <HistoryPage doctors={doctors} />
      )}

      {/* Bottom Tab Bar */}
      <nav className="bottom-tab-bar">
        <button
          className={`tab-item ${activeTab === 'home' ? 'tab-item--active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <span className="tab-icon">🏠</span>
          <span className="tab-label">الرئيسية</span>
        </button>
        <button
          className={`tab-item ${activeTab === 'history' ? 'tab-item--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-icon">📋</span>
          <span className="tab-label">السجل</span>
        </button>
      </nav>

      {/* Modals */}
      {showAddModal && (
        <AddPatientModal
          doctor={selectedDoctor}
          onAdd={handleAddPatient}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {billNotification && (
        <BillNotificationModal
          patient={billNotification.patient}
          bill={billNotification.bill}
          onDismiss={handleDismissNotification}
          onPayNow={handlePayNowFromNotification}
        />
      )}

      {paymentPatient && paymentBill && (
        <PaymentModal
          patient={paymentPatient}
          billInfo={paymentBill}
          onConfirm={handleConfirmPayment}
          onClose={() => { setPaymentPatient(null); setPaymentBill(null); }}
        />
      )}

      {menuOpen && (
        <div className="overlay-transparent" onClick={() => setMenuOpen(false)} />
      )}

      {/* Doctor "Notify Assistant" Toast */}
      {doctorNotification && (
        <div className="doctor-notif-toast" onClick={() => setDoctorNotification(null)}>
          <div className="doctor-notif-icon">🔔</div>
          <div className="doctor-notif-body">
            <div className="doctor-notif-title">رسالة من د. {doctorNotification.doctorName}</div>
            <div className="doctor-notif-msg">{doctorNotification.message}</div>
          </div>
          <button className="doctor-notif-close" onClick={() => setDoctorNotification(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
