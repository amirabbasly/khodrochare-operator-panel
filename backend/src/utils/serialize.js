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
};
