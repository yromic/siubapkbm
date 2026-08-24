export type DocumentStatus = 'DRAFT' | 'PUBLISHED' | 'APPROVED' | 'ARCHIVED';
export type UserRole = 'administrator' | 'operator' | 'teacher' | 'guru' | 'admin';

export interface DocumentPermissionSubject {
  id: string;
  type?: string;
  author_id: string;
  status: DocumentStatus;
  signed_at?: string | null;
}

export interface UserPermissionContext {
  id: string;
  role: string;
}

const ZERO_APPROVAL_TYPES = ['RPM', 'KKTP', 'TRISULA'];

export function canViewDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  const isOwner = doc.author_id === user.id;
  const isAdminOrOperator = ['administrator', 'admin', 'operator'].includes(user.role);

  // RPM, KKTP, TRISULA selalu visible (tidak di-gate oleh status)
  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) return true;

  return doc.status !== 'DRAFT' || isOwner || isAdminOrOperator;
}

export function canEditDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;

  // RPM, KKTP, TRISULA: author selalu bisa edit kapan saja tanpa locking
  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) return doc.author_id === user.id;

  // Dokumen non-perencanaan / tipe lain
  return doc.author_id === user.id && doc.status !== 'APPROVED';
}

export function canReviewDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  // RPM, KKTP, TRISULA tidak menggunakan review gate
  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) return false;
  return (user.role === 'operator' || user.role === 'administrator' || user.role === 'admin') && doc.status === 'PUBLISHED';
}

export function canApproveDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  // RPM, KKTP, TRISULA tidak menggunakan approve gate
  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) return false;
  return (user.role === 'administrator' || user.role === 'admin') && doc.status === 'PUBLISHED';
}

export function canCloneDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  // RPM, KKTP, TRISULA selalu bisa di-clone (langsung siap pakai)
  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) return true;
  return doc.status === 'PUBLISHED' || doc.status === 'APPROVED';
}

/**
 * canDeleteDocument — Permission hapus dokumen.
 * RPM, KKTP, TRISULA: author bisa hapus miliknya sendiri kapan saja, administrator bisa hapus milik siapapun.
 * Tipe lain: hanya administrator.
 */
export function canDeleteDocument(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  const isAdmin = ['administrator', 'admin'].includes(user.role);

  if (ZERO_APPROVAL_TYPES.includes(doc.type || '')) {
    return doc.author_id === user.id || isAdmin;
  }

  return isAdmin;
}

/**
 * canSignDocument — Tidak ada lagi mekanisme sign/konfirmasi tanda tangan untuk modul perencanaan.
 */
export function canSignDocument(_user: UserPermissionContext, _doc: DocumentPermissionSubject): boolean {
  return false;
}

/**
 * canShareToBLC — Hanya author yang bisa toggle berbagi ke Bank Modul BLC.
 */
export function canShareToBLC(user: UserPermissionContext, doc: DocumentPermissionSubject): boolean {
  if (!user || !doc) return false;
  return doc.author_id === user.id;
}
