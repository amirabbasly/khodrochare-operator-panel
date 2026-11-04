'use strict';

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    username: row.username,
    phone: row.phone,
    nationalId: row.national_id,
    role: row.role,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const WORK_TYPE_LABELS = {
  transport: 'حملی',
  onsite_repair: 'تعمیر در محل',
  both: 'حملی + تعمیر در محل',
  garage: 'تعمیرگاهی',
};

const STATUS_LABELS = {
  pending: 'در انتظار',
  confirmed: 'تایید شده',
  cancelled: 'کنسل شده',
};

const FOLLOW_UP_LABELS = {
  done: 'پیگیری انجام شد',
  not_done: 'پیگیری انجام نشد',
};

const LOAD_TYPE_LABELS = {
  transport: 'حملی',
  onsite_repair: 'تعمیر در محل',
  garage_dispatch: 'امکان اعزام به تعمیرگاه',
};

function publicRescuer(row) {
  if (!row) return null;
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    vehicle: row.vehicle,
    plate: row.plate,
    zoneId: row.zone_id,
    zoneName: row.zone_name || null,
    cityId: row.city_id,
    cityName: row.city_name || null,
    workType: row.work_type,
    workTypeLabel: WORK_TYPE_LABELS[row.work_type] || row.work_type,
    isSpecial: row.work_type === 'garage',
    isActive: Boolean(row.is_active),
    notes: row.notes,
    stats: {
      total: Number(row.total_loads || 0),
      confirmed: Number(row.confirmed_loads || 0),
      cancelled: Number(row.cancelled_loads || 0),
      // ---------- مالی ----------
      billedAmount: Number(row.billed_amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      unpaidAmount: Math.max(
        0,
        Number(row.billed_amount || 0) - Number(row.paid_amount || 0)
      ),
      paidLoads: Number(row.paid_loads || 0),
      unpaidLoads: Number(row.unpaid_loads || 0),
      // درآمد واقعی امدادگر = مبلغ دریافتی منهای سهم خودرو چاره
      earnedAmount: Number(row.earned_amount || 0),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function publicLoad(row) {
  if (!row) return null;
  return {
    id: row.id,
    loadDate: row.load_date,
    vehicleName: row.vehicle_name,
    customerPhone: row.customer_phone,
    carProblem: row.car_problem,
    customerName: row.customer_name,
    rescuerId: row.rescuer_id,
    rescuerName: row.rescuer_name,
    address: row.address,
    description: row.description,
    zoneId: row.zone_id,
    zoneName: row.zone_name || null,
    cityId: row.city_id,
    cityName: row.city_name || null,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    cancelReason: row.cancel_reason,
    followUp: row.follow_up,
    followUpLabel: FOLLOW_UP_LABELS[row.follow_up] || row.follow_up,
    // ---------- مالی ----------
    amountReceived: Number(row.amount_received || 0),
    loadType: row.load_type || 'transport',
    loadTypeLabel: LOAD_TYPE_LABELS[row.load_type] || row.load_type || '',
    garageDispatched: Boolean(row.garage_dispatched),
    commissionRate: Number(row.commission_rate || 0),
    commissionAmount: Number(row.commission_amount || 0),
    // سهم امدادگر = مبلغ دریافتی منهای سهم خودرو چاره
    rescuerShare: Math.max(
      0,
      Number(row.amount_received || 0) - Number(row.commission_amount || 0)
    ),
    isPaid: Boolean(row.is_paid),
    paidAt: row.paid_at || null,
    paidAmount: row.paid_amount === null || row.paid_amount === undefined ? null : Number(row.paid_amount),
    paidBy: row.paid_by || null,
    paidByUsername: row.paid_by_username || null,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username || null,
    dayClosed: Boolean(row.day_closed),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  publicUser,
  publicRescuer,
  publicLoad,
  WORK_TYPE_LABELS,
  STATUS_LABELS,
  FOLLOW_UP_LABELS,
  LOAD_TYPE_LABELS,
};
