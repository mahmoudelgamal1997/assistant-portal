import { useState, useEffect } from 'react';

const VISIT_SPEEDS = ['عادي', 'سريع'];

const VISIT_TYPE_CONFIG = [
  { label: 'كشف',        feeKey: 'consultationFee' },
  { label: 'إعادة كشف', feeKey: 'revisitFee'      },
  { label: 'استشارة',   feeKey: 'estisharaFee'    },
];

export default function AddPatientModal({ doctor, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [visitType, setVisitType] = useState('كشف');
  const [visitSpeed, setVisitSpeed] = useState('عادي');
  const [settings, setSettings] = useState(null);
  const [loadingFees, setLoadingFees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!doctor?.id) return;
    setLoadingFees(true);
    fetch(`https://nowaiting-076a4d0af321.herokuapp.com/api/doctors/${doctor.id}/settings`)
      .then((r) => r.json())
      .then((data) => setSettings(data.settings ?? data))
      .catch(() => setSettings(null))
      .finally(() => setLoadingFees(false));
  }, [doctor?.id]);

  const currentTypeConfig = VISIT_TYPE_CONFIG.find((v) => v.label === visitType);
  const currentFee = settings ? (settings[currentTypeConfig.feeKey] ?? 0) : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('يرجى إدخال اسم المريض'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onAdd({
        name: name.trim(),
        phone: phone.trim(),
        visitType,
        visitSpeed,
        fee: currentFee ?? 0,
      });
    } catch (err) {
      setError('حدث خطأ أثناء الإضافة');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>إضافة مريض جديد</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>اسم المريض *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="الاسم الكامل"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label>رقم الهاتف</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label>نوع الزيارة</label>
            <div className="btn-group-toggle btn-group-visit-types">
              {VISIT_TYPE_CONFIG.map((vtConfig) => {
                const feeValue = settings ? (settings[vtConfig.feeKey] ?? 0) : null;
                return (
                  <button
                    key={vtConfig.label}
                    type="button"
                    className={`toggle-btn toggle-btn-visit-type ${visitType === vtConfig.label ? 'active' : ''}`}
                    onClick={() => setVisitType(vtConfig.label)}
                    disabled={submitting}
                  >
                    <span className="visit-type-name">{vtConfig.label}</span>
                    {loadingFees ? (
                      <span className="visit-type-price loading">...</span>
                    ) : feeValue !== null ? (
                      <span className="visit-type-price">{feeValue} ج</span>
                    ) : (
                      <span className="visit-type-price na">-</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label>سرعة الزيارة</label>
            <div className="btn-group-toggle">
              {VISIT_SPEEDS.map((vs) => (
                <button
                  key={vs}
                  type="button"
                  className={`toggle-btn ${visitSpeed === vs ? 'active' : ''} ${vs === 'سريع' ? 'toggle-fast' : ''}`}
                  onClick={() => setVisitSpeed(vs)}
                  disabled={submitting}
                >
                  {vs === 'سريع' ? '⚡ ' : ''}{vs}
                </button>
              ))}
            </div>
          </div>

          {/* Fee display */}
          <div className="fee-display">
            <span className="fee-label">رسوم {visitType}:</span>
            {loadingFees ? (
              <span className="fee-loading">جارٍ التحميل...</span>
            ) : currentFee !== null ? (
              <span className="fee-amount">{currentFee} ج</span>
            ) : (
              <span className="fee-na">غير محدد</span>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
              إلغاء
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner-inline"></span> : 'إضافة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
