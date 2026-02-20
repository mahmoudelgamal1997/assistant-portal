import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase/config';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';

function ClinicSelector({ onSelect }) {
  const { assistantData } = useAuth();
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assistantData?.id) return;

    const loadClinics = async () => {
      try {
        const relRef = collection(db, 'doctor_clinic_assistant');
        const q = query(relRef, where('assistant_id', '==', assistantData.id));
        const snap = await getDocs(q);

        const clinicIds = [...new Set(snap.docs.map((d) => d.data().clinic_id))];

        const clinicPromises = clinicIds.map(async (cid) => {
          const cSnap = await getDoc(doc(db, 'clinics', cid));
          return cSnap.exists() ? { id: cid, ...cSnap.data() } : null;
        });

        const clinicResults = (await Promise.all(clinicPromises)).filter(Boolean);
        setClinics(clinicResults);

        if (clinicResults.length === 1) {
          onSelect(clinicResults[0]);
        }
      } catch (err) {
        console.error('Error loading clinics:', err);
      } finally {
        setLoading(false);
      }
    };

    loadClinics();
  }, [assistantData?.id]);

  if (loading) {
    return (
      <div className="splash">
        <div className="spinner"></div>
        <p>جارٍ التحميل...</p>
      </div>
    );
  }

  if (clinics.length === 0) {
    return (
      <div className="splash">
        <div className="splash-icon">⚠️</div>
        <h2>لا توجد عيادات مرتبطة بهذا الحساب</h2>
        <p>يرجى التواصل مع المسؤول</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">🏥</div>
          <h2>اختر العيادة</h2>
        </div>
        <div className="clinic-list">
          {clinics.map((clinic) => (
            <button
              key={clinic.id}
              className="clinic-select-btn"
              onClick={() => onSelect(clinic)}
            >
              <span className="clinic-select-name">
                {clinic.clinic_name_ar || clinic.clinic_name_en || 'عيادة'}
              </span>
              <span className="clinic-select-location">
                {clinic.location_ar || clinic.location_en || ''}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [selectedClinic, setSelectedClinic] = useState(null);

  if (loading) {
    return (
      <div className="splash">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  if (!selectedClinic) {
    return <ClinicSelector onSelect={setSelectedClinic} />;
  }

  return (
    <HomePage
      clinic={selectedClinic}
      onChangeClinic={() => setSelectedClinic(null)}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
