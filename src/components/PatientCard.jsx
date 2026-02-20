const VISIT_TYPE_COLORS = {
  'كشف': { bg: '#e8f4fd', color: '#1565c0', border: '#90caf9' },
  'إعادة كشف': { bg: '#fff3e0', color: '#e65100', border: '#ffcc80' },
  'استشارة': { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
};

const STATUS_LABELS = {
  WAITING: 'في الانتظار',
  FINISHED: 'منتهي',
  CANCELED: 'ملغي',
};

export default function PatientCard({
  patient,
  currentOrder,
  onStatusChange,
  onPayConsultation,
  onPayBill,
}) {
  const isCurrent = patient.user_order_in_queue === currentOrder;
  const isWaiting = patient.status === 'WAITING';
  const isFinished = patient.status === 'FINISHED';
  const isCanceled = patient.status === 'CANCELED';

  const consultPay = patient.consultationPayment;
  const hasUnpaidConsult = consultPay?.paymentStatus === 'pending' && (consultPay?.amount ?? 0) > 0;

  const bills = patient.bills ?? [];
  const pendingBills = bills.filter((b) => b.paymentStatus === 'pending' || b.paymentStatus === 'partial');
  const hasPendingBill = pendingBills.length > 0;

  const hasAnyUnpaid = hasUnpaidConsult || hasPendingBill;

  const visitStyle = VISIT_TYPE_COLORS[patient.visit_type] ?? {
    bg: '#f5f5f5',
    color: '#333',
    border: '#ddd',
  };

  const cardClass = [
    'patient-card',
    isCurrent && isWaiting ? 'patient-card--current' : '',
    hasPendingBill ? 'patient-card--bill' : '',
    isFinished ? 'patient-card--finished' : '',
    isCanceled ? 'patient-card--canceled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cardClass}>
      {/* Queue number + name row */}
      <div className="pc-header">
        <div className="pc-queue-num">{patient.user_order_in_queue ?? '–'}</div>
        <div className="pc-info">
          <div className="pc-name">{patient.patient_name}</div>
          <div className="pc-phone">{patient.patient_phone}</div>
        </div>
        <div className="pc-badges">
          <span
            className="badge"
            style={{
              background: visitStyle.bg,
              color: visitStyle.color,
              border: `1px solid ${visitStyle.border}`,
            }}
          >
            {patient.visit_type}
          </span>
          {patient.visit_speed === 'سريع' && (
            <span className="badge badge-fast">⚡ سريع</span>
          )}
        </div>
      </div>

      {/* Referral source label — shown only when not default */}
      {patient.referral_source && patient.referral_source !== 'عام' && (
        <div className="pc-referral-source">
          📣 {patient.referral_source}
        </div>
      )}

      {/* Status + time */}
      <div className="pc-meta">
        <span className={`status-dot status-${patient.status}`}></span>
        <span className="pc-status-label">{STATUS_LABELS[patient.status] ?? patient.status}</span>
        {patient.time && <span className="pc-time">• {patient.time}</span>}
        {isCurrent && isWaiting && (
          <span className="current-badge">◀ الدور الحالي</span>
        )}
      </div>

      {/* Consultation payment */}
      {hasUnpaidConsult && (
        <div className="pc-payment-row">
          <div className="pc-payment-info">
            <span className="pc-payment-label">رسوم الكشف:</span>
            <span className="pc-payment-amount">{consultPay.amount} ج</span>
          </div>
          <button
            className="btn-pay"
            onClick={() => onPayConsultation(patient)}
          >
            تحصيل
          </button>
        </div>
      )}
      {consultPay?.paymentStatus === 'paid' && (
        <div className="pc-paid-row">
          ✅ تم تحصيل رسوم الكشف ({consultPay.amount} ج - {consultPay.paymentMethod === 'cash' ? 'نقداً' : 'كارت'})
        </div>
      )}

      {/* Bills from doctor */}
      {hasPendingBill && (
        <div className="pc-bills">
          {pendingBills.map((bill) => {
            const services = bill.services ?? [];
            const consultFee = bill.consultationFee ?? 0;
            return (
              <div key={bill.billing_id} className="pc-bill-card">
                <div className="pc-bill-card-header">
                  <span className="pc-bill-icon">🧾</span>
                  <span className="pc-bill-title">فاتورة من الطبيب</span>
                  <button
                    className="btn-pay btn-pay-bill"
                    onClick={() => onPayBill(patient, bill)}
                  >
                    دفع
                  </button>
                </div>
                <div className="pc-bill-breakdown">
                  {consultFee > 0 && (
                    <div className="pc-bill-line">
                      <span>رسوم الكشف</span>
                      <span>{consultFee} ج</span>
                    </div>
                  )}
                  {services.map((s, i) => (
                    <div key={i} className="pc-bill-line">
                      <span>{s.service_name ?? s.name ?? 'خدمة'}</span>
                      <span>{(s.subtotal ?? s.price ?? 0)} ج</span>
                    </div>
                  ))}
                  <div className="pc-bill-line pc-bill-total">
                    <span>الإجمالي</span>
                    <span>{bill.totalAmount} ج</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Paid bills */}
      {bills.filter((b) => b.paymentStatus === 'paid').map((bill) => (
        <div key={bill.billing_id} className="pc-paid-row">
          ✅ فاتورة مدفوعة: {bill.totalAmount} ج ({bill.paymentMethod === 'cash' ? 'نقداً' : 'كارت'})
        </div>
      ))}

      {/* Action buttons */}
      {isWaiting && (
        <div className="pc-actions">
          <button
            className="btn-action btn-finished"
            onClick={() => onStatusChange(patient, 'FINISHED')}
          >
            ✔ منتهي
          </button>
          <button
            className="btn-action btn-canceled"
            onClick={() => onStatusChange(patient, 'CANCELED')}
          >
            ✖ إلغاء
          </button>
        </div>
      )}

      {(isFinished || isCanceled) && (
        <div className="pc-actions">
          <button
            className="btn-action btn-restore"
            onClick={() => onStatusChange(patient, 'WAITING')}
          >
            ↩ إعادة للانتظار
          </button>
        </div>
      )}
    </div>
  );
}
