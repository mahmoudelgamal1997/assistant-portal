import { useEffect } from 'react';

export default function BillNotificationModal({ patient, bill, onDismiss, onPayNow }) {
  const services = bill?.services ?? [];
  const total = bill?.totalAmount ?? 0;
  const consultFee = bill?.consultationFee ?? 0;
  const servicesTotal = bill?.servicesTotal ?? 0;

  // Auto-dismiss after 30 seconds
  useEffect(() => {
    const timer = setTimeout(onDismiss, 30000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bill-notif-overlay">
      <div className="bill-notif-box">
        {/* Pulsing icon */}
        <div className="bill-notif-icon-wrap">
          <div className="bill-notif-pulse"></div>
          <div className="bill-notif-icon">🧾</div>
        </div>

        <div className="bill-notif-title">فاتورة جديدة من الطبيب!</div>
        <div className="bill-notif-patient">
          <span className="bill-notif-patient-label">المريض</span>
          <span className="bill-notif-patient-name">{patient?.patient_name}</span>
        </div>

        {/* Bill breakdown */}
        <div className="bill-notif-breakdown">
          {consultFee > 0 && (
            <div className="bill-notif-row">
              <span>رسوم الكشف</span>
              <span>{consultFee} ج</span>
            </div>
          )}
          {services.map((s, i) => (
            <div key={i} className="bill-notif-row">
              <span>{s.name ?? s.service_name ?? 'خدمة'}</span>
              <span>{s.price ?? s.subtotal ?? 0} ج</span>
            </div>
          ))}
          <div className="bill-notif-row bill-notif-total">
            <span>الإجمالي</span>
            <span>{total} ج</span>
          </div>
        </div>

        <div className="bill-notif-actions">
          <button className="bill-notif-btn-later" onClick={onDismiss}>
            لاحقاً
          </button>
          <button className="bill-notif-btn-pay" onClick={onPayNow}>
            💵 تحصيل الآن
          </button>
        </div>
      </div>
    </div>
  );
}
