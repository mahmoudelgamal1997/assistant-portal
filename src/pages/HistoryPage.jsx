import { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'https://nowaiting-076a4d0af321.herokuapp.com/api';
const PAGE_SIZE = 20;

function formatVisitDate(dateStr) {
  if (!dateStr) return '–';
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return dateStr; }
}

function VisitTypeBadge({ type }) {
  const colors = {
    'كشف':        { bg: '#e3f2fd', color: '#1565c0' },
    'إعادة كشف': { bg: '#fff3e0', color: '#e65100' },
    'استشارة':   { bg: '#f3e5f5', color: '#6a1b9a' },
  };
  const style = colors[type] ?? { bg: '#f5f5f5', color: '#555' };
  return (
    <span className="visit-badge" style={{ background: style.bg, color: style.color }}>
      {type || 'كشف'}
    </span>
  );
}

function PatientHistoryCard({ patient }) {
  const [expanded, setExpanded] = useState(false);
  const visits = patient.visits ?? [];
  const totalVisits = patient.total_visits ?? visits.length ?? 0;
  const lastVisit = patient.last_visit_date
    ? formatVisitDate(patient.last_visit_date)
    : visits[0]?.date ? formatVisitDate(visits[0].date) : '–';

  return (
    <div className="history-card">
      <div className="history-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="history-card-main">
          <div className="history-patient-name">{patient.patient_name}</div>
          <div className="history-patient-phone">{patient.patient_phone}</div>
        </div>
        <div className="history-card-stats">
          <div className="history-stat">
            <span className="history-stat-num">{totalVisits}</span>
            <span className="history-stat-label">زيارة</span>
          </div>
          <div className="history-stat-divider" />
          <div className="history-stat">
            <span className="history-stat-label">آخر زيارة</span>
            <span className="history-stat-date">{lastVisit}</span>
          </div>
          <span className={`history-expand-arrow ${expanded ? 'expanded' : ''}`}>▼</span>
        </div>
      </div>

      {expanded && visits.length > 0 && (
        <div className="history-visits">
          {visits.map((visit, i) => (
            <div key={visit.visit_id ?? i} className="history-visit-row">
              <div className="history-visit-left">
                <VisitTypeBadge type={visit.visit_type} />
                {visit.complaint && (
                  <span className="history-visit-complaint">{visit.complaint}</span>
                )}
              </div>
              <div className="history-visit-right">
                <span className="history-visit-date">{formatVisitDate(visit.date)}</span>
                {visit.time && <span className="history-visit-time">{visit.time}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && visits.length === 0 && (
        <div className="history-visits">
          <p className="history-no-visits">لا توجد تفاصيل زيارات</p>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage({ doctors }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors?.[0]?.id ?? '');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [patients, setPatients] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchTimerRef = useRef(null);

  const fetchHistory = useCallback(async (doctorId, searchTerm, pageNum) => {
    if (!doctorId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        doctor_id: doctorId,
        page: pageNum,
        limit: PAGE_SIZE,
        sortBy: 'date',
        sortOrder: 'desc',
      });
      if (searchTerm?.trim()) params.set('search', searchTerm.trim());

      const res = await fetch(`${API_BASE}/history?${params}`);
      const json = await res.json();

      if (json.success) {
        setPatients(json.data ?? []);
        setTotalPages(json.pagination?.totalPages ?? 1);
        setTotalItems(json.pagination?.totalItems ?? 0);
      } else {
        setError('فشل في تحميل السجل');
      }
    } catch (err) {
      setError('فشل في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when doctor, search, or page changes
  useEffect(() => {
    fetchHistory(selectedDoctorId, search, page);
  }, [selectedDoctorId, search, page, fetchHistory]);

  // Debounce search input
  const handleSearchInput = (val) => {
    setSearchInput(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 500);
  };

  const handleDoctorChange = (id) => {
    setSelectedDoctorId(id);
    setPage(1);
  };

  return (
    <div className="history-page">
      {/* Filters */}
      <div className="history-filters">
        {doctors?.length > 1 && (
          <select
            className="history-doctor-select"
            value={selectedDoctorId}
            onChange={(e) => handleDoctorChange(e.target.value)}
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}

        <div className="history-search-wrap">
          <span className="history-search-icon">🔍</span>
          <input
            type="text"
            className="history-search-input"
            placeholder="ابحث بالاسم أو الهاتف..."
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              className="history-search-clear"
              onClick={() => { setSearchInput(''); handleSearchInput(''); }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Summary */}
      {!loading && !error && (
        <div className="history-summary">
          <span>إجمالي المرضى: <strong>{totalItems}</strong></span>
        </div>
      )}

      {/* Content */}
      {loading && (
        <div className="loading-center" style={{ paddingTop: 40 }}>
          <div className="spinner"></div>
        </div>
      )}

      {!loading && error && (
        <div className="history-error">
          <div>⚠️ {error}</div>
          <button className="btn-primary" style={{ marginTop: 12 }}
            onClick={() => fetchHistory(selectedDoctorId, search, page)}>
            إعادة المحاولة
          </button>
        </div>
      )}

      {!loading && !error && patients.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>{search ? 'لا توجد نتائج للبحث' : 'لا يوجد سجل لهذا الطبيب'}</p>
        </div>
      )}

      {!loading && !error && patients.length > 0 && (
        <>
          <div className="history-list">
            {patients.map((p) => (
              <PatientHistoryCard key={p.patient_id ?? p._id} patient={p} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ▶ السابق
              </button>
              <span className="page-indicator">
                {page} / {totalPages}
              </span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي ◀
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
