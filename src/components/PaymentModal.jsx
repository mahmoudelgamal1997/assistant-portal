import { useState } from 'react';

export default function PaymentModal({ patient, billInfo, onConfirm, onClose }) {
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);

  const isConsultation = billInfo?.type === 'consultation';
  const bill = billInfo?.bill;

  const amount = isConsultation
    ? patient?.consultationPayment?.amount ?? 0
    : bill?.totalAmount ?? 0;

  const consultType = patient?.consultationPayment?.consultationType ?? 'الكشف';

  // Build line items for bill breakdown
  const lineItems = [];
  if (!isConsultation && bill) {
    const consultFee = bill.consultationFee ?? 0;
    const services = bill.services ?? [];
    if (consultFee > 0) {
      lineItems.push({ label: `رسوم ${bill.consultationType ?? 'الكشف'}`, amount: consultFee });
    }
    services.forEach((s) => {
      const name = s.service_name ?? s.name ?? 'خدمة';
      const price = s.subtotal ?? s.price ?? 0;
      const qty = s.quantity ?? 1;
      lineItems.push({ label: qty > 1 ? `${name} × ${qty}` : name, amount: price });
    });
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    await onConfirm(method);
    setSubmitting(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="modal-header">
          <h2>تحصيل دفعة</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Patient name */}
        <div className="payment-patient-name" style={{ textAlign: 'center', marginBottom: 12 }}>
          {patient?.patient_name}
        </div>

        {/* Consultation: simple display */}
        {isConsultation && (
          <div className="payment-info">
            <div className="payment-label">رسوم {consultType}</div>
            <div className="payment-amount">{amount} جنيه</div>
          </div>
        )}

        {/* Bill: full breakdown */}
        {!isConsultation && lineItems.length > 0 && (
          <div className="payment-breakdown">
            {lineItems.map((item, i) => (
              <div key={i} className="payment-breakdown-row">
                <span>{item.label}</span>
                <span>{item.amount} ج</span>
              </div>
            ))}
            <div className="payment-breakdown-row payment-breakdown-total">
              <span>الإجمالي</span>
              <span>{amount} ج</span>
            </div>
          </div>
        )}

        {/* Bill with no services: simple display */}
        {!isConsultation && lineItems.length === 0 && (
          <div className="payment-info">
            <div className="payment-label">فاتورة الطبيب</div>
            <div className="payment-amount">{amount} جنيه</div>
          </div>
        )}

        <div className="form-group">
          <label>طريقة الدفع</label>
          <div className="btn-group-toggle">
            <button
              type="button"
              className={`toggle-btn ${method === 'cash' ? 'active' : ''}`}
              onClick={() => setMethod('cash')}
              disabled={submitting}
            >
              💵 نقداً
            </button>
            <button
              type="button"
              className={`toggle-btn ${method === 'card' ? 'active' : ''}`}
              onClick={() => setMethod('card')}
              disabled={submitting}
            >
              💳 كارت
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={submitting}>
            إلغاء
          </button>
          <button className="btn-primary" onClick={handleConfirm} disabled={submitting}>
            {submitting ? <span className="spinner-inline"></span> : `تأكيد التحصيل (${amount} ج)`}
          </button>
        </div>
      </div>
    </div>
  );
}
