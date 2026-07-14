import { apiRequest } from "./client";

export interface SppPayment {
  id: string;
  student_id: string;
  student_name?: string;
  student_nisn?: string;
  academic_year_id: string;
  month: number;
  year: number;
  amount_due: number;
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid";
  paid_at: string;
  payment_method: string;
  verified_by: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export async function listSppPaymentsApi(
  token: string,
  class_id: string,
  month: number,
  year: number
): Promise<SppPayment[]> {
  return apiRequest<SppPayment[]>("list_spp_payments", { class_id, month, year }, token);
}

export async function verifySppPaymentApi(
  token: string,
  student_id: string,
  amount_paid: number,
  payment_method: string,
  notes: string,
  advance_months?: number
): Promise<SppPayment[]> {
  return apiRequest<SppPayment[]>("verify_spp_payment", { student_id, amount_paid, payment_method, notes, advance_months }, token);
}

export async function verifyBulkSppPaymentsApi(
  token: string,
  student_ids: string[],
  amount_paid: number,
  payment_method: string,
  notes: string,
  advance_months?: number
): Promise<SppPayment[]> {
  return apiRequest<SppPayment[]>("verify_bulk_spp_payments", { student_ids, amount_paid, payment_method, notes, advance_months }, token);
}

export interface ParentSppStatusResponse {
  current_bill: SppPayment | null;
  total_arrears_amount: number;
  arrears: SppPayment[];
  history: SppPayment[];
}

export async function getParentSppStatusApi(token: string): Promise<ParentSppStatusResponse> {
  return apiRequest<ParentSppStatusResponse>("parent_get_spp_status", { parent_access_token: token }, token);
}

export async function revertSppPaymentApi(token: string, payment_id: string): Promise<SppPayment> {
  return apiRequest<SppPayment>("spp_revert_payment", { payment_id }, token);
}

export interface StudentArrearsSummary {
  student_id: string;
  student_name: string;
  student_nisn: string;
  total_arrears: number;
  unpaid_months: Array<{
    id: string;
    payment_month: number;
    payment_year: number;
    amount_due: number;
    amount_paid: number;
  }>;
}

export async function getClassSppArrearsApi(token: string, class_id: string): Promise<StudentArrearsSummary[]> {
  return apiRequest<StudentArrearsSummary[]>("get_class_spp_arrears", { class_id }, token);
}

