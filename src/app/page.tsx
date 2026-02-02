"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import {
  Download,
  FileUp,
  File,
  X,
  Trash2,
  Eye,
  RefreshCcw,
  Plus,
  Search,
  LogIn,
  LogOut,
  Check,
  Calendar,
  Clock,
  FileText,
} from "lucide-react";

// =========================
// TYPES
// =========================
type PortFile = {
  id: string;
  week: number;
  year: number;
  port_name: string;
  file_name: string;
  file_url: string;
  file_size?: number;
  uploaded_at: string;
  uploaded_by?: string;
};

type UploadForm = {
  port_name: string;
  file: File | null;
  week: number;
  year: number;
};

// =========================
// MODAL COMPONENTS
// =========================
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = "Confirm",
  confirmColor = "bg-red-600 hover:bg-red-700",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
  confirmColor?: string;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-slate-600">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold text-white ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =========================
// UTILITY FUNCTIONS
// =========================
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: diffDays < 365 ? undefined : "numeric",
    });
  }
}

function getWeekNumber(date: Date) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

// =========================
// MAIN COMPONENT
// =========================
export default function Home() {
  // State untuk data PDF
  const [portFiles, setPortFiles] = useState<PortFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<PortFile[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [uploadForm, setUploadForm] = useState<UploadForm>({
    port_name: "",
    file: null,
    week: getWeekNumber(new Date()),
    year: new Date().getFullYear(),
  });

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // State untuk file yang akan dihapus
  const [fileToDelete, setFileToDelete] = useState<PortFile | null>(null);

  // =========================
  // LOAD DATA
  // =========================
  async function loadPortFiles() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("port_files")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (error) throw error;

      setPortFiles(data || []);
      filterFiles(data || []);
    } catch (error) {
      console.error("Error loading port files:", error);
      showAlert(`Error loading files: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Filter files berdasarkan pencarian
  function filterFiles(files: PortFile[]) {
    let filtered = [...files];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (file) =>
          file.port_name.toLowerCase().includes(query) ||
          file.file_name.toLowerCase().includes(query) ||
          file.year.toString().includes(query) ||
          file.week.toString().includes(query)
      );
    }

    // Sort by uploaded date (newest first)
    filtered.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());

    setFilteredFiles(filtered);
  }

  // =========================
  // EFFECTS
  // =========================
  useEffect(() => {
    loadPortFiles();
  }, []);

  useEffect(() => {
    filterFiles(portFiles);
  }, [searchQuery, portFiles]);

  // =========================
  // AUTH SESSION CHECK
  // =========================
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setIsAdmin(!!data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAdmin(!!session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // =========================
  // UI HELPERS
  // =========================
  function showAlert(message: string) {
    setAlertMessage(message);
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  }

  // =========================
  // AUTH ACTIONS
  // =========================
  async function adminLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      showAlert(`Login failed: ${error.message}`);
      return;
    }

    setLoginEmail("");
    setLoginPassword("");
    setShowLoginModal(false);
    showAlert("Login successful!");
  }

  async function adminLogout() {
    await supabase.auth.signOut();
    showAlert("Logged out successfully");
  }

  // =========================
  // FILE ACTIONS
  // =========================
  async function uploadFile() {
    if (!uploadForm.file || !uploadForm.port_name.trim()) {
      showAlert("Please select a file and enter port name");
      return;
    }

    if (!uploadForm.week || !uploadForm.year) {
      showAlert("Please enter week and year");
      return;
    }

    setIsLoading(true);

    try {
      // Generate unique file name
      const fileExt = uploadForm.file.name.split(".").pop();
      const safePortName = uploadForm.port_name
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_]/g, "");
      const fileName = `${Date.now()}_${safePortName}_W${uploadForm.week}_${uploadForm.year}.${fileExt}`;
      const filePath = `port-files/${fileName}`;

      // Upload file to storage
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("port-files")
        .upload(filePath, uploadForm.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("port-files")
        .getPublicUrl(filePath);

      // Insert record to database
      const { error: dbError } = await supabase.from("port_files").insert({
        week: uploadForm.week,
        year: uploadForm.year,
        port_name: uploadForm.port_name.trim(),
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: uploadForm.file.size,
        uploaded_at: new Date().toISOString(),
      });

      if (dbError) throw dbError;

      // Reset form and reload
      setUploadForm({
        port_name: "",
        file: null,
        week: getWeekNumber(new Date()),
        year: new Date().getFullYear(),
      });
      setShowUploadModal(false);
      await loadPortFiles();
      showAlert("File uploaded successfully!");
    } catch (error) {
      console.error("Error uploading file:", error);
      showAlert(`Upload failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteFile() {
    if (!fileToDelete) return;

    setIsLoading(true);

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("port-files")
        .remove([fileToDelete.file_name]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("port_files")
        .delete()
        .eq("id", fileToDelete.id);

      if (dbError) throw dbError;

      // Reset state and reload
      setFileToDelete(null);
      setShowDeleteModal(false);
      await loadPortFiles();
      showAlert("File deleted successfully!");
    } catch (error) {
      console.error("Error deleting file:", error);
      showAlert(`Delete failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }

  function openFilePreview(file: PortFile) {
    window.open(file.file_url, "_blank");
  }

  function downloadFile(file: PortFile) {
    const link = document.createElement("a");
    link.href = file.file_url;
    link.download = file.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // =========================
  // RENDER
  // =========================
  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50">
      {/* SUCCESS ALERT */}
      {showSuccessAlert && (
        <div className="fixed top-4 left-1/2 z-[200] -translate-x-1/2 animate-fade-in">
          <div className="rounded-2xl bg-green-500 px-6 py-3 text-white shadow-2xl">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {alertMessage}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="sticky top-0 z-50 border-b border-blue-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[95vw] px-4 py-4 sm:py-6">
          {/* Brand */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-lg">
                <Image
                  src="/SITCPNG.png"
                  alt="SITC"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain brightness-0 invert"
                  priority
                />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight text-blue-900">
                  SITC Port PDF Files
                </div>
                <div className="text-xs text-blue-600">
                  All uploaded PDF files
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800"
                >
                  <Plus className="h-4 w-4" />
                  Upload PDF
                </button>
              )}

              {isAdmin ? (
                <button
                  onClick={adminLogout}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              ) : (
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-blue-700 hover:to-blue-800"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </button>
              )}
            </div>
          </div>

          {/* Search and Stats Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={loadPortFiles}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search port, file name, week, or year..."
                  className="w-full lg:w-80 rounded-2xl border border-blue-200 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-50 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                  <FileText className="h-4 w-4" />
                  Total Files: <span className="text-blue-600">{filteredFiles.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="mx-auto max-w-[95vw] px-4 py-6">
        {isLoading && portFiles.length === 0 ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <RefreshCcw className="h-8 w-8 animate-spin text-blue-500" />
              <div className="text-lg font-semibold text-blue-900">
                Loading port files...
              </div>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <File className="h-16 w-16 text-blue-300" />
              <div className="text-lg font-semibold text-blue-900">
                No PDF files uploaded yet
              </div>
              <div className="text-blue-600">
                {isAdmin
                  ? 'Upload your first PDF using the "Upload PDF" button'
                  : "No files available. Please contact admin."}
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800"
                >
                  <Plus className="h-4 w-4" />
                  Upload First PDF
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border-2 border-blue-200 bg-white shadow-xl">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-200">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      No.
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Port Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Week & Year
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      File Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Size
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-100">
                  {filteredFiles.map((file, index) => (
                    <tr key={file.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-blue-800">{file.port_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1">
                          <Calendar className="h-3 w-3 text-blue-600" />
                          <span className="text-xs font-semibold text-blue-700">
                            W{file.week} • {file.year}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 max-w-xs">
                          <File className="h-4 w-4 text-blue-500 flex-shrink-0" />
                          <span className="text-sm text-blue-900 truncate" title={file.file_name}>
                            {file.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-700">
                        {file.file_size ? formatFileSize(file.file_size) : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-blue-700">
                          <Clock className="h-3 w-3" />
                          {formatDate(file.uploaded_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openFilePreview(file)}
                            className="inline-flex items-center gap-1 rounded-xl bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                            title="Preview PDF"
                          >
                            <Eye className="h-3 w-3" />
                            Preview
                          </button>
                          <button
                            onClick={() => downloadFile(file)}
                            className="inline-flex items-center gap-1 rounded-xl bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200"
                            title="Download PDF"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setFileToDelete(file);
                                setShowDeleteModal(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-200"
                              title="Delete PDF"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3">
            <Image
              src="/SITCPNG.png"
              alt="SITC"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
            <div className="text-xs text-blue-700">
              Please note that our website is currently undergoing maintenance. In the meantime, schedule information is available in PDF format. We apologize for any inconvenience and thank you for your understanding. • {filteredFiles.length} files available
            </div>
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* MODALS */}
      {/* ========================= */}

      {/* LOGIN MODAL */}
      <Modal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        title="Admin Login"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={adminLogin}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-3 text-sm font-semibold text-white shadow-md hover:from-blue-700 hover:to-blue-800"
          >
            Sign In
          </button>
        </div>
      </Modal>

      {/* UPLOAD PDF MODAL */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadForm({
            port_name: "",
            file: null,
            week: getWeekNumber(new Date()),
            year: new Date().getFullYear(),
          });
        }}
        title="Upload PDF File"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Port Name *
            </label>
            <input
              type="text"
              value={uploadForm.port_name}
              onChange={(e) =>
                setUploadForm({ ...uploadForm, port_name: e.target.value })
              }
              placeholder="e.g., BATAM, HAIPHONG, SHANGHAI"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Year *
              </label>
              <input
                type="number"
                value={uploadForm.year}
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    year: parseInt(e.target.value || new Date().getFullYear().toString()),
                  })
                }
                min="2024"
                max="2030"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Week *
              </label>
              <input
                type="number"
                value={uploadForm.week}
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    week: parseInt(e.target.value || getWeekNumber(new Date()).toString()),
                  })
                }
                min="1"
                max="53"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              PDF File *
            </label>
            <div className="mt-1">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) =>
                  setUploadForm({
                    ...uploadForm,
                    file: e.target.files?.[0] || null,
                  })
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {uploadForm.file && (
              <div className="mt-2 rounded-lg bg-blue-50 p-3">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-800 truncate">
                      {uploadForm.file.name}
                    </div>
                    <div className="text-xs text-blue-600">
                      {formatFileSize(uploadForm.file.size)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-500">
            File will be uploaded to: Week {uploadForm.week}, {uploadForm.year}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowUploadModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={uploadFile}
              disabled={isLoading || !uploadForm.file || !uploadForm.port_name.trim() || !uploadForm.week || !uploadForm.year}
              className="rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 text-sm font-semibold text-white hover:from-green-700 hover:to-green-800 disabled:opacity-50"
            >
              {isLoading ? "Uploading..." : "Upload PDF"}
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete PDF File"
        message={`Are you sure you want to delete "${fileToDelete?.file_name}" for ${fileToDelete?.port_name} (Week ${fileToDelete?.week}, ${fileToDelete?.year})? This action cannot be undone.`}
        onConfirm={deleteFile}
        confirmText="Delete File"
      />
    </main>
  );
}