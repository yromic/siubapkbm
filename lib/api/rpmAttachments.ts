import {
  RPMAttachment,
  RPMAttachmentMetadataUpdate,
} from "@/types/rpmAttachment";

export async function fetchRpmAttachments(documentId: string): Promise<RPMAttachment[]> {
  const res = await fetch(`/api/v1/rpm/${documentId}/attachments`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.message || "Gagal memuat daftar lampiran RPM.");
  }

  return json.data || [];
}

export async function uploadRpmAttachmentApi(
  documentId: string,
  formData: FormData
): Promise<RPMAttachment> {
  const res = await fetch(`/api/v1/rpm/${documentId}/attachments`, {
    method: "POST",
    body: formData, // FormData sends multipart/form-data boundary automatically
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.message || "Gagal mengunggah lampiran RPM.");
  }

  return json.data;
}

export async function updateRpmAttachmentMetadataApi(
  documentId: string,
  attachmentId: string,
  payload: RPMAttachmentMetadataUpdate
): Promise<RPMAttachment> {
  const res = await fetch(`/api/v1/rpm/${documentId}/attachments/${attachmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.message || "Gagal memperbarui metadata lampiran.");
  }

  return json.data;
}

export async function deleteRpmAttachmentApi(
  documentId: string,
  attachmentId: string
): Promise<{ success: boolean; deleted_id: string }> {
  const res = await fetch(`/api/v1/rpm/${documentId}/attachments/${attachmentId}`, {
    method: "DELETE",
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.message || "Gagal menghapus lampiran.");
  }

  return json.data;
}

export async function reorderRpmAttachmentsApi(
  documentId: string,
  orderedIds: string[]
): Promise<RPMAttachment[]> {
  const res = await fetch(`/api/v1/rpm/${documentId}/attachments/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.message || "Gagal mengubah urutan lampiran.");
  }

  return json.data;
}
