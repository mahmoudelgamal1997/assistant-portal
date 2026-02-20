import { useState, useRef } from 'react';

const API_BASE = 'https://nowaiting-076a4d0af321.herokuapp.com';

export default function UploadReportModal({ patient, assistantId, onClose, onSuccess }) {
  const [files, setFiles] = useState([]);
  const [reportType, setReportType] = useState('examination');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const addFiles = (newFiles) => {
    const mapped = Array.from(newFiles).map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
    }));
    setFiles((prev) => [...prev, ...mapped]);
  };

  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleUpload = async () => {
    if (files.length === 0) { setError('يرجى اختيار ملف واحد على الأقل'); return; }
    setError('');
    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('images', f.file));
      formData.append('doctor_id', patient.doctor_id ?? '');
      if (patient.id) formData.append('patient_id', patient.id);
      if (patient.patient_phone) formData.append('patient_phone', patient.patient_phone);
      formData.append('report_type', reportType);
      formData.append('description', description);
      if (assistantId) formData.append('uploaded_by', assistantId);

      const res = await fetch(`${API_BASE}/api/patients/reports/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (onSuccess) onSuccess();
        onClose();
      } else {
        setError(data.message || 'فشل الرفع، يرجى المحاولة مرة أخرى');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('خطأ في الاتصال، يرجى المحاولة مرة أخرى');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h2>📎 رفع تقرير / فحص</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-form">
          {/* Patient name */}
          <div style={{ marginBottom: 12, color: '#555', fontSize: '0.9rem' }}>
            المريض: <strong>{patient.patient_name}</strong>
          </div>

          {/* Pick source buttons */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
            >
              📷 التقاط صورة
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ flex: 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              🖼️ اختيار ملف
            </button>
          </div>

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            multiple
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            style={{ display: 'none' }}
            multiple
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />

          {/* Report type */}
          <div className="form-group">
            <label>نوع التقرير</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              disabled={uploading}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: '1rem', background: 'white' }}
            >
              <option value="examination">كشف</option>
              <option value="report">تقرير</option>
              <option value="investigation">تحليل / راديولوجي</option>
            </select>
          </div>

          {/* Description */}
          <div className="form-group">
            <label>وصف <span style={{ color: '#999', fontSize: '0.85em' }}>(اختياري)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: تحليل دم كامل"
              disabled={uploading}
            />
          </div>

          {/* Selected files list */}
          {files.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6, fontWeight: 600, fontSize: '0.9rem' }}>
                الملفات المحددة ({files.length}):
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {files.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 6,
                      background: '#f5f5f5',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {f.file.type.startsWith('image/') ? '🖼️' : '📄'} {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      disabled={uploading}
                      style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: '1rem', marginRight: 6 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={uploading}>
              إلغاء
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
            >
              {uploading ? <span className="spinner-inline"></span> : `رفع ${files.length > 0 ? `(${files.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
