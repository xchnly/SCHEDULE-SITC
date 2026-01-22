"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import * as XLSX from "xlsx";
import {
  ChevronDown,
  Download,
  FileUp,
  Lock,
  LogIn,
  LogOut,
  Plus,
  RefreshCcw,
  Trash2,
  X,
  Calendar,
  Ship,
  MapPin,
  Edit,
  Save,
  CalendarDays,
  Globe,
  Flag,
  Folder,
  FolderOpen,
  Link,
  ChevronLeft,
  ChevronRight,
  Copy,
  Clock,
  Search,
  Smartphone,
  Monitor,
  AlertCircle,
  Zap,
  TrendingUp,
  Eye,
  EyeOff,
  FileSpreadsheet,
} from "lucide-react";

// =========================
// TYPES
// =========================
type ServiceCategory = {
  id: string;
  code: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active?: boolean;
};

type ServiceGroup = {
  id: string;
  category_id?: string;
  code: string;
  name: string;
  flag_emoji?: string;
  sort_order: number;
  is_active?: boolean;
};

type Service = {
  id: string;
  group_id: string;
  code: string;
  name: string;
  description?: string;
  color_code?: string;
  sort_order: number;
  is_active?: boolean;
};

type ServicePort = {
  id: string;
  service_id: string;
  port_name: string;
  port_code?: string;
  country_code?: string;
  event_type: "ETD" | "ETA";
  sequence: number;
  is_required?: boolean;
};

type Sailing = {
  id: string;
  service_id: string;
  year: number;
  week: number;
  vessel: string;
  voyage: string;
  connecting_vessel?: string | null;
  connecting_voyage?: string | null;
  status?: string;
  remarks?: string;
};

type SailingDate = {
  id: string;
  sailing_id: string;
  service_port_id: string;
  date_value: string | null;
  is_estimated?: boolean;
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
  confirmColor = "bg-blue-600 hover:bg-blue-700",
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
function formatHeader(port: ServicePort) {
  return `${port.event_type} ${port.port_name}`;
}

function normalizePortName(s: string) {
  return (s || "").trim().toUpperCase();
}

function normalizeEventType(s: string): "ETD" | "ETA" | null {
  const t = (s || "").trim().toUpperCase();
  if (t === "ETD" || t === "ETA") return t;
  return null;
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return "TBA";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "TBA";

    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleDateString("en-US", { month: "short" });
    return `${day} ${month}`;
  } catch {
    return "TBA";
  }
}

function formatLongDate(dateStr: string): string {
  if (!dateStr) return "TBA";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "TBA";

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "TBA";
  }
}

// Format khusus untuk Excel export
function formatDateForExcel(dateStr: string): string {
  if (!dateStr) return "TBA";

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "TBA";

    const day = date.getDate().toString().padStart(2, "0");
    const month = date.toLocaleDateString("en-US", { month: "short" });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return "TBA";
  }
}

function calculateDuration(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;

  try {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return 0;
  }
}

// =========================
// VESSEL SUGGESTION INTERFACE
// =========================
interface VesselSuggestion {
  sailing: Sailing;
  originDate: string;
  destinationDate: string;
  duration: number;
  serviceName: string;
  groupName: string;
  originPort: string;
  destinationPort: string;
}

// =========================
// MAIN COMPONENT
// =========================
export default function Home() {
  // State untuk data
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [ports, setPorts] = useState<ServicePort[]>([]);
  const [sailings, setSailings] = useState<Sailing[]>([]);
  const [sailingDates, setSailingDates] = useState<SailingDate[]>([]);

  // Filter state
  const [year, setYear] = useState<number>(2026);
  const [week, setWeek] = useState<number>(3);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // UI State
  const [openGroupIds, setOpenGroupIds] = useState<Record<string, boolean>>({});
  const [openServiceIds, setOpenServiceIds] = useState<Record<string, boolean>>(
    {},
  );

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Auth state
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Modals state
  const [showAddServiceGroupModal, setShowAddServiceGroupModal] =
    useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showAddPortModal, setShowAddPortModal] = useState(false);
  const [showAddSailingModal, setShowAddSailingModal] = useState(false);
  const [showEditConnectingModal, setShowEditConnectingModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Vessel Suggestion Modal
  const [showVesselSuggestionModal, setShowVesselSuggestionModal] =
    useState(false);
  const [vesselSuggestions, setVesselSuggestions] = useState<
    VesselSuggestion[]
  >([]);

  // Form states
  const [selectedGroup, setSelectedGroup] = useState<ServiceGroup | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPort, setSelectedPort] = useState<ServicePort | null>(null);
  const [selectedSailing, setSelectedSailing] = useState<Sailing | null>(null);

  // EDIT CELL STATE
  const [editingCell, setEditingCell] = useState<{
    sailingId: string;
    servicePortId: string;
    currentValue: string;
    tempValue: string;
  } | null>(null);

  // EDIT CONNECTING STATE
  const [editingConnecting, setEditingConnecting] = useState<{
    sailingId: string;
    vessel: string;
    voyage: string;
    connectingVessel: string;
    connectingVoyage: string;
  } | null>(null);

  const [addServiceGroupForm, setAddServiceGroupForm] = useState({
    code: "",
    name: "",
    flag_emoji: "🌐",
  });

  const [addServiceForm, setAddServiceForm] = useState({
    group_id: "",
    code: "",
    name: "",
    color_code: "#3B82F6",
  });

  const [addPortForm, setAddPortForm] = useState({
    service_id: "",
    port_name: "",
    event_type: "ETA" as "ETD" | "ETA",
    sequence: 0,
  });

  const [addSailingForm, setAddSailingForm] = useState({
    service_id: "",
    vessel: "",
    voyage: "",
    connecting_vessel: "",
    connecting_voyage: "",
  });

  const [editConnectingForm, setEditConnectingForm] = useState({
    connecting_vessel: "",
    connecting_voyage: "",
  });

  // UI state
  const [savingCellKey, setSavingCellKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Fitur durasi & search
  const [originPort, setOriginPort] = useState<string>("BATAM");
  const [destinationPort, setDestinationPort] = useState<string>("");
  const [availableDestinations, setAvailableDestinations] = useState<string[]>(
    [],
  );
  const [calculatedDuration, setCalculatedDuration] = useState<number | null>(
    null,
  );
  const [selectedSailingId, setSelectedSailingId] = useState<string>("");

  // View mode untuk tanggal
  const [dateViewMode, setDateViewMode] = useState<"short" | "long">("short");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // =========================
  // RESPONSIVE HANDLING
  // =========================
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // =========================
  // LOAD DATA
  // =========================
  async function refreshAll() {
    setBusy(true);
    try {
      const [
        categoriesRes,
        groupsRes,
        servicesRes,
        portsRes,
        sailingsRes,
        datesRes,
      ] = await Promise.all([
        supabase.from("service_categories").select("*").order("sort_order"),
        supabase.from("service_groups").select("*").order("sort_order"),
        supabase.from("services").select("*").order("sort_order"),
        supabase.from("service_ports").select("*").order("sequence"),
        supabase
          .from("sailings")
          .select("*")
          .eq("year", year)
          .eq("week", week)
          .order("vessel"),
        supabase.from("sailing_dates").select("*"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (portsRes.error) throw portsRes.error;
      if (sailingsRes.error) throw sailingsRes.error;
      if (datesRes.error) throw datesRes.error;

      setCategories(categoriesRes.data ?? []);
      setServiceGroups(groupsRes.data ?? []);
      setServices(servicesRes.data ?? []);
      setPorts(portsRes.data ?? []);
      setSailings(sailingsRes.data ?? []);
      setSailingDates(datesRes.data ?? []);

      const newOpenGroups: Record<string, boolean> = {};
      groupsRes.data?.forEach((group) => {
        if (openGroupIds[group.id] === undefined) {
          newOpenGroups[group.id] = true;
        }
      });
      if (Object.keys(newOpenGroups).length > 0) {
        setOpenGroupIds((prev) => ({ ...prev, ...newOpenGroups }));
      }
    } catch (error) {
      console.error("Error loading data:", error);
      showAlert(`Error loading data: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [year, week]);

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
        if (!session) setEditMode(false);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  // =========================
  // MEMO MAPS untuk grouping data
  // =========================
  const sailingDateMap = useMemo(() => {
    const map = new Map<string, SailingDate>();
    for (const date of sailingDates) {
      map.set(`${date.sailing_id}_${date.service_port_id}`, date);
    }
    return map;
  }, [sailingDates]);

  const groupsByCategory = useMemo(() => {
    const map = new Map<string, ServiceGroup[]>();
    for (const group of serviceGroups) {
      const catId = group.category_id || "uncategorized";
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(group);
    }
    return map;
  }, [serviceGroups]);

  const servicesByGroup = useMemo(() => {
    const map = new Map<string, Service[]>();
    for (const service of services) {
      if (!map.has(service.group_id)) map.set(service.group_id, []);
      map.get(service.group_id)!.push(service);
    }
    return map;
  }, [services]);

  const portsByService = useMemo(() => {
    const map = new Map<string, ServicePort[]>();
    for (const port of ports) {
      if (!map.has(port.service_id)) map.set(port.service_id, []);
      map.get(port.service_id)!.push(port);
    }

    // Sort ports: BATAM ETD first, then others by sequence
    for (const [serviceId, portList] of map) {
      portList.sort((a, b) => {
        // Prioritize BATAM ETD
        const isBatamA =
          a.port_name.toUpperCase().includes("BATAM") && a.event_type === "ETD";
        const isBatamB =
          b.port_name.toUpperCase().includes("BATAM") && b.event_type === "ETD";

        if (isBatamA && !isBatamB) return -1;
        if (!isBatamA && isBatamB) return 1;

        // Then sort by sequence
        return a.sequence - b.sequence;
      });
    }

    return map;
  }, [ports]);

  const sailingsByService = useMemo(() => {
    const map = new Map<string, Sailing[]>();
    for (const sailing of sailings) {
      if (!map.has(sailing.service_id)) map.set(sailing.service_id, []);
      map.get(sailing.service_id)!.push(sailing);
    }

    // Sort sailings by BATAM ETD date
    for (const [serviceId, sailingList] of map) {
      const servicePorts = portsByService.get(serviceId) || [];
      const batamEtdPort = servicePorts.find(
        (port) =>
          port.port_name.toUpperCase().includes("BATAM") &&
          port.event_type === "ETD",
      );

      if (batamEtdPort) {
        sailingList.sort((a, b) => {
          const dateA =
            sailingDateMap.get(`${a.id}_${batamEtdPort.id}`)?.date_value || "";
          const dateB =
            sailingDateMap.get(`${b.id}_${batamEtdPort.id}`)?.date_value || "";

          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;

          return new Date(dateA).getTime() - new Date(dateB).getTime();
        });
      }
    }

    return map;
  }, [sailings, portsByService, sailingDateMap]);

  // =========================
  // FITUR DURASI PELAYARAN & SUGGEST VESSEL
  // =========================
  useEffect(() => {
    // Kumpulkan semua destinasi yang tersedia (kecuali BATAM)
    const destinations = new Set<string>();
    ports.forEach((port) => {
      if (!port.port_name.toUpperCase().includes("BATAM")) {
        destinations.add(port.port_name);
      }
    });
    setAvailableDestinations(Array.from(destinations));
  }, [ports]);

  // Fungsi untuk menghitung durasi pelayaran
  function calculateVoyageDuration(
    sailingId: string,
    origin: string,
    destination: string,
  ): number | null {
    const servicePorts = Array.from(portsByService.values()).flat();

    // Cari port origin (BATAM ETD)
    const originPort = servicePorts.find(
      (port) =>
        port.port_name.toUpperCase().includes(origin.toUpperCase()) &&
        port.event_type === "ETD",
    );

    // Cari port destination (ETA)
    const destinationPort = servicePorts.find(
      (port) =>
        port.port_name.toUpperCase().includes(destination.toUpperCase()) &&
        port.event_type === "ETA",
    );

    if (!originPort || !destinationPort) return null;

    const originDate = sailingDateMap.get(
      `${sailingId}_${originPort.id}`,
    )?.date_value;
    const destinationDate = sailingDateMap.get(
      `${sailingId}_${destinationPort.id}`,
    )?.date_value;

    if (!originDate || !destinationDate) return null;

    return calculateDuration(originDate, destinationDate);
  }

  // Fungsi untuk mencari vessel suggestions berdasarkan route
  function findVesselSuggestions(
    origin: string,
    destination: string,
  ): VesselSuggestion[] {
    if (!origin || !destination) return [];

    const suggestions: VesselSuggestion[] = [];

    // Loop melalui semua sailings
    sailings.forEach((sailing) => {
      const servicePorts = portsByService.get(sailing.service_id) || [];

      // Cari origin port (BATAM ETD)
      const originPort = servicePorts.find(
        (port) =>
          port.port_name.toUpperCase().includes(origin.toUpperCase()) &&
          port.event_type === "ETD",
      );

      // Cari destination port (ETA)
      const destinationPort = servicePorts.find(
        (port) =>
          port.port_name.toUpperCase().includes(destination.toUpperCase()) &&
          port.event_type === "ETA",
      );

      if (originPort && destinationPort) {
        const originDate = sailingDateMap.get(
          `${sailing.id}_${originPort.id}`,
        )?.date_value;
        const destinationDate = sailingDateMap.get(
          `${sailing.id}_${destinationPort.id}`,
        )?.date_value;

        if (originDate && destinationDate) {
          const service = services.find((s) => s.id === sailing.service_id);
          const group = service
            ? serviceGroups.find((g) => g.id === service.group_id)
            : null;

          suggestions.push({
            sailing,
            originDate,
            destinationDate,
            duration: calculateDuration(originDate, destinationDate),
            serviceName: service?.name || "Unknown Service",
            groupName: group?.name || "Unknown Group",
            originPort: originPort.port_name,
            destinationPort: destinationPort.port_name,
          });
        }
      }
    });

    // Sort berdasarkan durasi terpendek
    return suggestions.sort((a, b) => a.duration - b.duration);
  }

  // Handler untuk mencari vessel suggestions
  function handleFindVessels() {
    if (!destinationPort) {
      showAlert("Please select destination port first");
      return;
    }

    const suggestions = findVesselSuggestions(originPort, destinationPort);

    if (suggestions.length === 0) {
      showAlert(
        `No vessels found for route ${originPort} → ${destinationPort}`,
      );
      return;
    }

    setVesselSuggestions(suggestions);
    setShowVesselSuggestionModal(true);
  }

  // Helper untuk mendapatkan date value berdasarkan sailing dan port
  function getDateValue(sailingId: string, servicePortId: string): string {
    const key = `${sailingId}_${servicePortId}`;
    return sailingDateMap.get(key)?.date_value || "";
  }

  // =========================
  // EXPORT TO EXCEL FUNCTION WITH HEADER
  // =========================
  async function exportToExcel() {
    setIsExporting(true);

    try {
      // 1. Create workbook
      const wb = XLSX.utils.book_new();

      // 2. Prepare data arrays
      const data = [];

      // 3. Add header rows
      // Row 1: Empty row for spacing
      data.push([]);

      // Row 2: Company name
      data.push([
        "新海丰集装箱运输有限公司",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // Row 3: English company name
      data.push([
        "SITC CONTAINER LINES CO., LTD.",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // Row 4: Title with week/year
      data.push([
        `SITC Batam Schedule - Week ${week}, ${year}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // Row 5: Generated date
      data.push([
        `Generated on: ${new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);

      // Row 6: Empty row
      data.push([]);

      // 4. Add data headers
      const headers = [
        "Group",
        "Service",
        "Vessel",
        "Voyage",
        "Connecting Vessel",
        "Connecting Voyage",
      ];

      // Add port headers
      const allPorts = Array.from(portsByService.values()).flat();
      const uniquePorts = Array.from(
        new Set(allPorts.map((p) => `${p.port_name} ${p.event_type}`)),
      );

      headers.push(...uniquePorts);
      data.push(headers);

      // 5. Add data rows
      filteredGroups.forEach((group) => {
        const groupServices = servicesByGroup.get(group.id) || [];

        groupServices.forEach((service) => {
          const serviceSailings = sailingsByService.get(service.id) || [];
          const servicePorts = portsByService.get(service.id) || [];

          serviceSailings.forEach((sailing) => {
            const row = [
              group.name,
              service.name,
              sailing.vessel,
              sailing.voyage,
              sailing.connecting_vessel || "",
              sailing.connecting_voyage || "",
            ];

            // Add dates for each port
            uniquePorts.forEach((portHeader) => {
              const [portName, eventType] = portHeader.split(" ");
              const port = servicePorts.find(
                (p) =>
                  p.port_name.toUpperCase() === portName.toUpperCase() &&
                  p.event_type === eventType,
              );

              if (port) {
                const dateValue = getDateValue(sailing.id, port.id);
                row.push(dateValue ? formatDateForExcel(dateValue) : "TBA");
              } else {
                row.push("-");
              }
            });

            data.push(row);
          });

          // Add empty row between services if there are vessels
          if (serviceSailings.length > 0) {
            data.push(Array(headers.length).fill(""));
          }
        });

        // Add separator row between groups
        if (groupServices.length > 0) {
          data.push(Array(headers.length).fill("---"));
          data.push([]);
        }
      });

      // 6. Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(data);

      // 7. Style the worksheet
      // Set column widths
      const colWidths = [
        { wch: 20 }, // Group
        { wch: 30 }, // Service
        { wch: 20 }, // Vessel
        { wch: 12 }, // Voyage
        { wch: 20 }, // Connecting Vessel
        { wch: 15 }, // Connecting Voyage
      ];

      // Add widths for port columns
      uniquePorts.forEach(() => {
        colWidths.push({ wch: 18 });
      });

      ws["!cols"] = colWidths;

      // Merge cells for headers
      if (!ws["!merges"]) ws["!merges"] = [];

      // Merge company name cells (row 2, columns A-L)
      ws["!merges"].push({ s: { r: 1, c: 0 }, e: { r: 1, c: 11 } });
      // Merge English name cells (row 3, columns A-L)
      ws["!merges"].push({ s: { r: 2, c: 0 }, e: { r: 2, c: 11 } });
      // Merge title cells (row 4, columns A-L)
      ws["!merges"].push({ s: { r: 3, c: 0 }, e: { r: 3, c: 11 } });
      // Merge generated date cells (row 5, columns A-L)
      ws["!merges"].push({ s: { r: 4, c: 0 }, e: { r: 4, c: 11 } });

      // 8. Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, `Week ${week} ${year}`);

      // 9. Generate and download
      const fileName = `SITC_Batam_Schedule_Week${week}_${year}_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showAlert(`✅ Excel file "${fileName}" downloaded successfully!`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      showAlert(`Error exporting to Excel: ${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  }

  // =========================
  // UI HELPERS
  // =========================
  function showAlert(message: string) {
    setAlertMessage(message);
    setShowSuccessAlert(true);
    setTimeout(() => setShowSuccessAlert(false), 3000);
  }

  function toggleGroupOpen(groupId: string) {
    setOpenGroupIds((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function toggleServiceOpen(serviceId: string) {
    setOpenServiceIds((prev) => ({ ...prev, [serviceId]: !prev[serviceId] }));
  }

  function scrollTable(direction: "left" | "right") {
    if (!tableContainerRef.current) return;

    const scrollAmount = 300;
    const newPosition =
      direction === "left"
        ? scrollPosition - scrollAmount
        : scrollPosition + scrollAmount;

    tableContainerRef.current.scrollLeft = newPosition;
    setScrollPosition(newPosition);
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
  // CELL DATE UPDATE
  // =========================
  async function updateCell(
    sailingId: string,
    servicePortId: string,
    value: string,
  ) {
    if (!isAdmin || !editMode) return;

    const cellKey = `${sailingId}_${servicePortId}`;
    setSavingCellKey(cellKey);

    try {
      const existing = sailingDateMap.get(cellKey);

      if (existing) {
        const { error } = await supabase
          .from("sailing_dates")
          .update({ date_value: value || null })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("sailing_dates").insert({
          sailing_id: sailingId,
          service_port_id: servicePortId,
          date_value: value || null,
        });

        if (error) throw error;
      }

      await refreshAll();
      setEditingCell(null);
      showAlert("Date updated!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    } finally {
      setSavingCellKey(null);
    }
  }

  // =========================
  // UPDATE CONNECTING VESSEL & VOYAGE
  // =========================
  async function updateConnectingVessel() {
    if (!editingConnecting) return;

    try {
      const { error } = await supabase
        .from("sailings")
        .update({
          connecting_vessel: editConnectingForm.connecting_vessel || null,
          connecting_voyage: editConnectingForm.connecting_voyage || null,
        })
        .eq("id", editingConnecting.sailingId);

      if (error) throw error;

      await refreshAll();
      setShowEditConnectingModal(false);
      setEditingConnecting(null);
      showAlert("Connecting vessel updated!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  // Fungsi untuk mulai edit cell
  function startEditingCell(
    sailingId: string,
    servicePortId: string,
    currentValue: string,
  ) {
    if (!isAdmin || !editMode) return;

    setEditingCell({
      sailingId,
      servicePortId,
      currentValue,
      tempValue: currentValue || "",
    });
  }

  // Fungsi untuk mulai edit connecting vessel
  function startEditingConnecting(sailing: Sailing) {
    if (!isAdmin || !editMode) return;

    setEditingConnecting({
      sailingId: sailing.id,
      vessel: sailing.vessel,
      voyage: sailing.voyage,
      connectingVessel: sailing.connecting_vessel || "",
      connectingVoyage: sailing.connecting_voyage || "",
    });

    setEditConnectingForm({
      connecting_vessel: sailing.connecting_vessel || "",
      connecting_voyage: sailing.connecting_voyage || "",
    });

    setShowEditConnectingModal(true);
  }

  // Fungsi untuk save edit
  function saveEditingCell() {
    if (!editingCell) return;
    updateCell(
      editingCell.sailingId,
      editingCell.servicePortId,
      editingCell.tempValue,
    );
  }

  // Fungsi untuk cancel edit
  function cancelEditingCell() {
    setEditingCell(null);
  }

  // =========================
  // CRUD ACTIONS
  // =========================
  async function handleAddServiceGroup() {
    if (!addServiceGroupForm.code || !addServiceGroupForm.name) {
      showAlert("Please fill all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("service_groups").insert({
        code: addServiceGroupForm.code.trim().toUpperCase(),
        name: addServiceGroupForm.name.trim(),
        flag_emoji: addServiceGroupForm.flag_emoji,
        sort_order: serviceGroups.length + 1,
      });

      if (error) throw error;

      await refreshAll();
      setAddServiceGroupForm({
        code: "",
        name: "",
        flag_emoji: "🌐",
      });
      setShowAddServiceGroupModal(false);
      showAlert("Service group added!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  async function handleAddService() {
    if (
      !addServiceForm.group_id ||
      !addServiceForm.code ||
      !addServiceForm.name
    ) {
      showAlert("Please fill all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("services").insert({
        group_id: addServiceForm.group_id,
        code: addServiceForm.code.trim().toUpperCase(),
        name: addServiceForm.name.trim(),
        color_code: addServiceForm.color_code,
        sort_order:
          (servicesByGroup.get(addServiceForm.group_id)?.length || 0) + 1,
      });

      if (error) throw error;

      await refreshAll();
      setAddServiceForm({
        group_id: "",
        code: "",
        name: "",
        color_code: "#3B82F6",
      });
      setShowAddServiceModal(false);
      showAlert("Service added!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  async function handleAddPort() {
    if (
      !addPortForm.service_id ||
      !addPortForm.port_name ||
      !addPortForm.event_type
    ) {
      showAlert("Please fill all required fields");
      return;
    }

    try {
      const servicePorts = portsByService.get(addPortForm.service_id) || [];
      const sequence = servicePorts.length + 1;

      const { error } = await supabase.from("service_ports").insert({
        service_id: addPortForm.service_id,
        port_name: normalizePortName(addPortForm.port_name),
        event_type: addPortForm.event_type,
        sequence: sequence,
      });

      if (error) throw error;

      await refreshAll();
      setAddPortForm({
        service_id: "",
        port_name: "",
        event_type: "ETA",
        sequence: 0,
      });
      setShowAddPortModal(false);
      showAlert("Port added!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  async function handleAddSailing() {
    if (
      !addSailingForm.service_id ||
      !addSailingForm.vessel ||
      !addSailingForm.voyage
    ) {
      showAlert("Please fill all required fields");
      return;
    }

    try {
      const { error } = await supabase.from("sailings").insert({
        service_id: addSailingForm.service_id,
        year: year,
        week: week,
        vessel: addSailingForm.vessel.trim(),
        voyage: addSailingForm.voyage.trim(),
        connecting_vessel: addSailingForm.connecting_vessel.trim() || null,
        connecting_voyage: addSailingForm.connecting_voyage.trim() || null,
        status: "SCHEDULED",
      });

      if (error) throw error;

      await refreshAll();
      setAddSailingForm({
        service_id: "",
        vessel: "",
        voyage: "",
        connecting_vessel: "",
        connecting_voyage: "",
      });
      setShowAddSailingModal(false);
      showAlert("Vessel added!");
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  async function handleDeleteItem(
    type: "group" | "service" | "port" | "sailing",
  ) {
    try {
      switch (type) {
        case "group":
          if (!selectedGroup) return;
          await supabase
            .from("service_groups")
            .delete()
            .eq("id", selectedGroup.id);
          break;
        case "service":
          if (!selectedService) return;
          await supabase.from("services").delete().eq("id", selectedService.id);
          break;
        case "port":
          if (!selectedPort) return;
          await supabase
            .from("service_ports")
            .delete()
            .eq("id", selectedPort.id);
          break;
        case "sailing":
          if (!selectedSailing) return;
          await supabase.from("sailings").delete().eq("id", selectedSailing.id);
          break;
      }

      await refreshAll();
      setShowDeleteModal(false);
      showAlert(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted!`);
    } catch (error) {
      showAlert(`Error: ${(error as Error).message}`);
    }
  }

  // =========================
  // EXCEL TEMPLATE & IMPORT
  // =========================
  function downloadTemplateExcel() {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "group_code",
        "service_code",
        "year",
        "week",
        "vessel",
        "voyage",
        "connecting_vessel",
        "connecting_voyage",
        "port_name",
        "event_type",
        "date_value",
      ],
      [
        "CHINA",
        "CVM_CJV2",
        2026,
        3,
        "VESSEL A",
        "001W",
        "VESSEL B",
        "002W",
        "BATAM",
        "ETD",
        "2026-01-18",
      ],
      [
        "CHINA",
        "CVM_CJV2",
        2026,
        3,
        "VESSEL A",
        "001W",
        "VESSEL B",
        "002W",
        "HAIPHONG",
        "ETA",
        "2026-01-19",
      ],
      [
        "CHINA",
        "CVM_CJV2",
        2026,
        3,
        "VESSEL A",
        "001W",
        "VESSEL B",
        "002W",
        "SHANGHAI",
        "ETA",
        "2026-01-22",
      ],
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "template");

    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const blob = new Blob([out], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sitc_schedule_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    showAlert("Template downloaded!");
  }

  // Helper untuk mengonversi nilai Excel ke string
  function excelValueToString(v: unknown): string {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number") return v.toString();
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    return String(v);
  }

  async function importExcel(file: File) {
    if (!isAdmin) {
      showAlert("Admin access required");
      return;
    }

    setBusy(true);

    function excelDateToISO(v: unknown): string {
      if (v === null || v === undefined || v === "") return "";

      const strValue = excelValueToString(v);

      // sudah format yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
        return strValue;
      }

      // format umum: dd/mm/yyyy atau dd-mm-yyyy
      const m = strValue.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        const dd = String(m[1]).padStart(2, "0");
        const mm = String(m[2]).padStart(2, "0");
        const yyyy = String(m[3]).padStart(4, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      // excel serial number (contoh 46048)
      const asNum = Number(strValue);
      if (!Number.isNaN(asNum) && asNum > 20000) {
        const d = XLSX.SSF.parse_date_code(asNum);
        if (!d) return "";
        const yyyy = String(d.y).padStart(4, "0");
        const mm = String(d.m).padStart(2, "0");
        const dd = String(d.d).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }

      return "";
    }

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      interface ExcelRow {
        group_code?: string;
        service_code?: string;
        year?: number;
        week?: number;
        vessel?: string;
        voyage?: string;
        connecting_vessel?: string;
        connecting_voyage?: string;
        port_name?: string;
        event_type?: string;
        date_value?: unknown;
      }

      const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as ExcelRow[];

      if (!json.length) {
        showAlert("Excel file is empty");
        return;
      }

      const [groupsRes, servicesRes, portsRes, sailingsRes, datesRes] =
        await Promise.all([
          supabase.from("service_groups").select("*"),
          supabase.from("services").select("*"),
          supabase.from("service_ports").select("*"),
          supabase.from("sailings").select("*"),
          supabase.from("sailing_dates").select("*"),
        ]);

      if (groupsRes.error) throw groupsRes.error;
      if (servicesRes.error) throw servicesRes.error;
      if (portsRes.error) throw portsRes.error;
      if (sailingsRes.error) throw sailingsRes.error;
      if (datesRes.error) throw datesRes.error;

      const groups = groupsRes.data ?? [];
      const services = servicesRes.data ?? [];
      const ports = portsRes.data ?? [];
      const sailingsAll = sailingsRes.data ?? [];
      const datesAll = datesRes.data ?? [];

      // ===== 2) Build Map lookup =====
      const groupByCode = new Map<string, ServiceGroup>();
      for (const g of groups) groupByCode.set(g.code.toUpperCase(), g);

      const serviceByCode = new Map<string, Service>();
      for (const s of services) serviceByCode.set(s.code.toUpperCase(), s);

      const portByKey = new Map<string, ServicePort>();
      for (const p of ports) {
        const key = `${p.service_id}__${p.port_name.toUpperCase()}__${p.event_type.toUpperCase()}`;
        portByKey.set(key, p);
      }

      const sailingByKey = new Map<string, Sailing>();
      for (const s of sailingsAll) {
        const key = `${s.service_id}__${s.year}__${s.week}__${s.vessel.toUpperCase()}__${s.voyage.toUpperCase()}`;
        sailingByKey.set(key, s);
      }

      const dateByKey = new Map<string, SailingDate>();
      for (const d of datesAll) {
        const key = `${d.sailing_id}__${d.service_port_id}`;
        dateByKey.set(key, d);
      }

      // ===== 3) Stats =====
      let createdGroups = 0;
      let createdServices = 0;
      let createdPorts = 0;
      let createdSailings = 0;
      let upsertDates = 0;
      let skipped = 0;

      // ===== 4) Import per row =====
      for (let i = 0; i < json.length; i++) {
        const row = json[i];

        const connecting_vessel = excelValueToString(row.connecting_vessel);
        const connecting_voyage = excelValueToString(row.connecting_voyage);

        const group_code = excelValueToString(row.group_code).toUpperCase();
        const service_code = excelValueToString(row.service_code).toUpperCase();

        const yearValue = Number(row.year || year);
        const weekValue = Number(row.week || week);

        const vessel = excelValueToString(row.vessel);
        const voyage = excelValueToString(row.voyage);

        const port_name = excelValueToString(row.port_name).toUpperCase();
        const event_type = excelValueToString(row.event_type).toUpperCase();

        const date_value = excelDateToISO(row.date_value);

        // minimal validation
        if (
          !group_code ||
          !service_code ||
          !yearValue ||
          !weekValue ||
          !vessel ||
          !voyage ||
          !port_name ||
          (event_type !== "ETA" && event_type !== "ETD")
        ) {
          skipped++;
          continue;
        }

        // ===== A) ensure group exists =====
        let group = groupByCode.get(group_code);
        if (!group) {
          const { data, error } = await supabase
            .from("service_groups")
            .insert({
              code: group_code,
              name: group_code,
              flag_emoji: "🌐",
              sort_order: groups.length + createdGroups + 1,
            })
            .select("*")
            .single();

          if (error)
            throw new Error(`Row ${i + 1} create group: ${error.message}`);

          group = data;
          if (group) {
            groupByCode.set(group_code, group);
            createdGroups++;
          }
        }

        // ===== B) ensure service exists =====
        let service = serviceByCode.get(service_code);
        if (!service) {
          if (!group) {
            throw new Error(`Row ${i + 1}: Group creation failed`);
          }

          const { data, error } = await supabase
            .from("services")
            .insert({
              group_id: group.id,
              code: service_code,
              name: service_code,
              color_code: "#3B82F6",
              sort_order: 9999,
            })
            .select("*")
            .single();

          if (error)
            throw new Error(`Row ${i + 1} create service: ${error.message}`);

          service = data;
          if (service) {
            serviceByCode.set(service_code, service);
            createdServices++;
          }
        }

        // ===== C) ensure port exists =====
        if (!service) {
          throw new Error(`Row ${i + 1}: Service creation failed`);
        }

        if (!group) {
          throw new Error(`Row ${i + 1}: Group creation failed`);
        }

        const portKey = `${service.id}__${port_name}__${event_type}`;
        let port = portByKey.get(portKey);

        if (!port) {
          const servicePorts = ports.filter((p) => p.service_id === service.id);
          const nextSeq = servicePorts.length + createdPorts + 1;

          const { data, error } = await supabase
            .from("service_ports")
            .insert({
              service_id: service.id,
              port_name: port_name,
              event_type: event_type as "ETD" | "ETA",
              sequence: nextSeq,
            })
            .select("*")
            .single();

          if (error)
            throw new Error(`Row ${i + 1} create port: ${error.message}`);

          port = data;
          if (port) {
            portByKey.set(portKey, port);
            createdPorts++;
          }
        }

        // ===== D) ensure sailing exists =====
        if (!service) {
          throw new Error(`Row ${i + 1}: Service creation failed`);
        }

        if (!group) {
          throw new Error(`Row ${i + 1}: Group creation failed`);
        }

        const sailingKey = `${service.id}__${yearValue}__${weekValue}__${vessel.toUpperCase()}__${voyage.toUpperCase()}`;
        let sailing = sailingByKey.get(sailingKey);

        if (!sailing) {
          const { data, error } = await supabase
            .from("sailings")
            .insert({
              service_id: service.id,
              year: yearValue,
              week: weekValue,
              vessel: vessel,
              voyage: voyage,
              connecting_vessel: connecting_vessel || null,
              connecting_voyage: connecting_voyage || null,
              status: "SCHEDULED",
            })
            .select("*")
            .single();

          if (error)
            throw new Error(`Row ${i + 1} create vessel: ${error.message}`);

          sailing = data;
          if (sailing) {
            sailingByKey.set(sailingKey, sailing);
            createdSailings++;
          }
        }

        // ===== E) upsert sailing_date =====
        if (!sailing) {
          throw new Error(`Row ${i + 1}: Sailing creation failed`);
        }

        if (!port) {
          throw new Error(`Row ${i + 1}: Port creation failed`);
        }

        const dateKey = `${sailing.id}__${port.id}`;
        const existingDate = dateByKey.get(dateKey);

        if (existingDate) {
          const { error } = await supabase
            .from("sailing_dates")
            .update({ date_value: date_value || null })
            .eq("id", existingDate.id);

          if (error)
            throw new Error(`Row ${i + 1} update date: ${error.message}`);
        } else {
          const { data, error } = await supabase
            .from("sailing_dates")
            .insert({
              sailing_id: sailing.id,
              service_port_id: port.id,
              date_value: date_value || null,
            })
            .select("*")
            .single();

          if (error)
            throw new Error(`Row ${i + 1} insert date: ${error.message}`);

          dateByKey.set(dateKey, data);
        }

        upsertDates++;
      }

      showAlert(
        `Import done ✅ Rows:${json.length} | Groups +${createdGroups} | Services +${createdServices} | Ports +${createdPorts} | Vessels +${createdSailings} | Dates ${upsertDates} | Skipped ${skipped}`,
      );

      await refreshAll();
    } catch (error: unknown) {
      console.log("IMPORT ERROR:", error);
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      } else if (error && typeof error === "object") {
        errorMessage = JSON.stringify(error);
      }
      showAlert(`Import error: ${errorMessage}`);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // =========================
  // FILTERED DATA
  // =========================
  const filteredGroups = useMemo(() => {
    if (selectedCategory === "all") return serviceGroups;
    return serviceGroups.filter(
      (group) => group.category_id === selectedCategory,
    );
  }, [serviceGroups, selectedCategory]);

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
              <div className="h-2 w-2 rounded-full bg-white" />
              {alertMessage}
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="sticky top-0 z-50 border-b border-blue-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-[95vw] px-4 py-4 sm:py-6">
          {/* Mobile View Compact Header */}
          {isMobile ? (
            <div className="space-y-3">
              {/* Brand Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-md">
                    <Image
                      src="/SITCPNG.png"
                      alt="SITC"
                      width={20}
                      height={20}
                      className="h-5 w-5 object-contain brightness-0 invert"
                      priority
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-blue-900">
                      SITC Batam Schedule
                    </div>
                    <div className="text-xs text-blue-600">
                      W{week} • {year}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMobileFilters(!showMobileFilters)}
                    className="rounded-xl bg-blue-100 p-2 text-blue-700"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      onClick={adminLogout}
                      className="rounded-xl bg-blue-100 p-2 text-blue-700"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile Filter Button */}
              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="flex w-full items-center justify-between rounded-xl bg-blue-50 px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">
                    {showMobileFilters
                      ? "Hide Filters"
                      : "Show Filters & Tools"}
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 text-blue-500 transition ${
                    showMobileFilters ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          ) : (
            /* Desktop Header */
            <>
              {/* Brand */}
              <div className="flex items-center gap-4 mb-4">
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
                    SITC Batam Schedule Board
                  </div>
                  <div className="text-xs text-blue-600">
                    Week {week} • {year}
                  </div>
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={refreshAll}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                  >
                    <RefreshCcw
                      className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>

                  {/* Export to Excel Button */}
                  <button
                    onClick={exportToExcel}
                    disabled={isExporting}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50"
                  >
                    {isExporting ? (
                      <>
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                        Generating Excel...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4" />
                        Export to Excel
                      </>
                    )}
                  </button>

                  {/* Toggle Date View Button */}
                  <button
                    onClick={() =>
                      setDateViewMode(
                        dateViewMode === "short" ? "long" : "short",
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-indigo-700 hover:to-indigo-800"
                    title={`Switch to ${dateViewMode === "short" ? "detailed" : "short"} date view`}
                  >
                    {dateViewMode === "short" ? (
                      <>
                        <Eye className="h-4 w-4" />
                        Detailed View
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Short View
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => setEditMode((v) => !v)}
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                          editMode
                            ? "bg-blue-600 text-white shadow-lg"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        <Lock className="h-4 w-4" />
                        {editMode ? "Editing ON" : "Editing OFF"}
                      </button>

                      <button
                        onClick={() => setShowAddServiceGroupModal(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800"
                      >
                        <Plus className="h-4 w-4" />
                        Add Group
                      </button>
                    </>
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
                      Admin Login
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* FILTER BAR - Show always on desktop, conditionally on mobile */}
          {(showMobileFilters || !isMobile) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-blue-100 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-blue-800">
                  <Calendar className="h-4 w-4" />
                  Year:
                  <input
                    type="number"
                    value={year}
                    onChange={(e) =>
                      setYear(parseInt(e.target.value || "2026"))
                    }
                    className="w-20 sm:w-28 rounded-xl border border-blue-200 bg-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-blue-100 px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                  Week:
                  <input
                    type="number"
                    value={week}
                    onChange={(e) => setWeek(parseInt(e.target.value || "1"))}
                    min="1"
                    max="53"
                    className="w-20 sm:w-24 rounded-xl border border-blue-200 bg-white px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Voyage Duration Calculator & Vessel Finder */}
              <div className="rounded-2xl bg-gradient-to-r from-indigo-100 to-purple-100 px-4 py-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm font-semibold text-indigo-800">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Route Planner:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={originPort}
                      onChange={(e) => setOriginPort(e.target.value)}
                      className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="BATAM">BATAM (ETD)</option>
                    </select>
                    <span className="text-indigo-600">→</span>
                    <select
                      value={destinationPort}
                      onChange={(e) => {
                        setDestinationPort(e.target.value);
                        // Hitung durasi untuk sailing pertama
                        if (sailings.length > 0) {
                          const duration = calculateVoyageDuration(
                            sailings[0].id,
                            originPort,
                            e.target.value,
                          );
                          setCalculatedDuration(duration);
                        }
                      }}
                      className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Destination</option>
                      {availableDestinations.map((dest) => (
                        <option key={dest} value={dest}>
                          {dest}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={handleFindVessels}
                      disabled={!destinationPort}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50"
                    >
                      <Ship className="h-3 w-3" />
                      Find Vessels
                    </button>

                    {calculatedDuration !== null && calculatedDuration > 0 && (
                      <div className="rounded-xl bg-indigo-600 px-3 py-1.5 text-white">
                        {calculatedDuration} days
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-1 text-xs text-indigo-600">
                  Select destination to find vessels and calculate voyage
                  duration from BATAM
                </div>
              </div>

              {isAdmin && (
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadTemplateExcel}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-100 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                  >
                    <Download className="h-4 w-4" />
                    Template
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) importExcel(f);
                    }}
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-blue-700 hover:to-blue-800"
                    title="Upload Excel"
                  >
                    <FileUp className="h-4 w-4" />
                    Upload Excel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="mx-auto max-w-[95vw] px-4 py-6" id="print-content">
        {filteredGroups.length === 0 ? (
          <div className="rounded-3xl border border-blue-200 bg-white p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <Globe className="h-16 w-16 text-blue-300" />
              <div className="text-lg font-semibold text-blue-900">
                No service groups available
              </div>
              <div className="text-blue-600">
                Add your first service group using the &quot;Add Service
                Group&quot; button button
              </div>
              {isAdmin && (
                <button
                  onClick={() => setShowAddServiceGroupModal(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:from-green-700 hover:to-green-800"
                >
                  <Plus className="h-4 w-4" />
                  Add First Service Group
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredGroups.map((group) => {
              const groupServices = servicesByGroup.get(group.id) || [];
              const isGroupOpen = openGroupIds[group.id] || false;

              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-3xl border-2 border-blue-200 bg-white shadow-xl group-container"
                  data-group-id={group.id}
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-blue-50/50 transition-colors cursor-pointer group-header"
                    onClick={() => toggleGroupOpen(group.id)}
                  >
                    <div className="flex flex-1 items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-md">
                          <span className="text-lg sm:text-xl">
                            {group.flag_emoji || "🌐"}
                          </span>
                        </div>
                        <div>
                          <div className="text-base sm:text-lg font-bold text-blue-600">
                            {group.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-blue-500">
                              {group.code}
                            </span>
                            <span className="text-xs text-blue-300">
                              • {groupServices.length} Services
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-4 w-4 text-white transition ${
                            isGroupOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>

                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroup(group);
                          setShowDeleteModal(true);
                        }}
                        className="ml-3 rounded-xl bg-red-50 px-2.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 no-print"
                        title="Delete service group"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Services dalam group */}
                  {isGroupOpen && (
                    <div className="border-t border-blue-200 px-2 sm:px-4 py-4">
                      {groupServices.length === 0 ? (
                        <div className="py-6 text-center text-blue-500">
                          <div className="mb-2">
                            <Ship className="h-10 w-10 mx-auto opacity-50" />
                          </div>
                          <div className="font-semibold">
                            No services in this group
                          </div>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                setSelectedGroup(group);
                                setAddServiceForm((prev) => ({
                                  ...prev,
                                  group_id: group.id,
                                }));
                                setShowAddServiceModal(true);
                              }}
                              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-md hover:from-blue-700 hover:to-blue-800 no-print"
                            >
                              <Plus className="h-3 w-3" />
                              Add First Service
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {groupServices.map((service) => {
                            const servicePorts =
                              portsByService.get(service.id) || [];
                            const serviceSailings =
                              sailingsByService.get(service.id) || [];
                            const isServiceOpen =
                              openServiceIds[service.id] || false;

                            return (
                              <div
                                key={service.id}
                                className="rounded-xl border border-blue-100 bg-white service-container"
                              >
                                {/* Service Header */}
                                <div
                                  className="flex items-center justify-between px-3 sm:px-4 py-3 hover:bg-blue-50/30 cursor-pointer service-header"
                                  onClick={() => toggleServiceOpen(service.id)}
                                >
                                  <div className="flex flex-1 items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{
                                          backgroundColor:
                                            service.color_code || "#3B82F6",
                                        }}
                                      />
                                      <div>
                                        <div className="font-bold text-blue-800 text-sm">
                                          {service.name}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-blue-600">
                                          <span className="font-semibold">
                                            {service.code}
                                          </span>
                                          <span>•</span>
                                          <span>
                                            {servicePorts.length} Ports
                                          </span>
                                          <span>•</span>
                                          <span>
                                            {serviceSailings.length} Vessels
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <ChevronDown
                                      className={`h-3.5 w-3.5 text-blue-400 transition ${
                                        isServiceOpen ? "rotate-180" : ""
                                      }`}
                                    />
                                  </div>

                                  {isAdmin && (
                                    <div className="flex items-center gap-1.5 ml-3 no-print">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedService(service);
                                          setAddPortForm((prev) => ({
                                            ...prev,
                                            service_id: service.id,
                                          }));
                                          setShowAddPortModal(true);
                                        }}
                                        className="rounded-lg bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                                      >
                                        <Plus className="h-2.5 w-2.5 mr-1 inline" />
                                        Add Port
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedService(service);
                                          setAddSailingForm((prev) => ({
                                            ...prev,
                                            service_id: service.id,
                                          }));
                                          setShowAddSailingModal(true);
                                        }}
                                        className="rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200"
                                      >
                                        <Plus className="h-2.5 w-2.5 mr-1 inline" />
                                        Add Vessel
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedService(service);
                                          setShowDeleteModal(true);
                                        }}
                                        className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                                        title="Delete service"
                                      >
                                        <Trash2 className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Service Table */}
                                {isServiceOpen && servicePorts.length > 0 && (
                                  <div className="border-t border-blue-100">
                                    <div className="relative">
                                      {/* Scroll Controls */}
                                      {scrollPosition > 0 && (
                                        <button
                                          onClick={() => scrollTable("left")}
                                          className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm no-print"
                                        >
                                          <ChevronLeft className="h-4 w-4 text-blue-600" />
                                        </button>
                                      )}

                                      <div
                                        ref={tableContainerRef}
                                        className="overflow-x-auto scrollbar-hide"
                                        onScroll={(e) =>
                                          setScrollPosition(
                                            e.currentTarget.scrollLeft,
                                          )
                                        }
                                      >
                                        <table className="min-w-full border-collapse">
                                          <thead className="bg-blue-50">
                                            <tr>
                                              <th className="sticky left-0 z-20 whitespace-nowrap border-b border-blue-200 px-3 py-2.5 text-left text-xs font-bold text-blue-900 bg-blue-50 col-vessel">
                                                <div className="flex items-center gap-1.5">
                                                  <Ship className="h-3.5 w-3.5" />
                                                  VESSEL
                                                </div>
                                              </th>
                                              <th className="whitespace-nowrap border-b border-blue-200 px-3 py-2.5 text-left text-xs font-bold text-blue-900 col-voyage">
                                                VOYAGE
                                              </th>
                                              <th className="whitespace-nowrap border-b border-blue-200 px-3 py-2.5 text-left text-xs font-bold text-blue-900 col-connecting">
                                                <div className="flex items-center gap-1.5">
                                                  <Link className="h-3.5 w-3.5" />
                                                  CONNECTING
                                                </div>
                                              </th>
                                              {isAdmin && (
                                                <th className="whitespace-nowrap border-b border-blue-200 px-3 py-2.5 text-left text-xs font-bold text-blue-900 admin-only no-print">
                                                  ACTIONS
                                                </th>
                                              )}

                                              {servicePorts.map((port) => (
                                                <th
                                                  key={port.id}
                                                  className={`whitespace-nowrap border-b border-blue-200 px-3 py-2.5 text-left min-w-[140px] sm:min-w-[160px] col-port ${
                                                    port.port_name
                                                      .toUpperCase()
                                                      .includes("BATAM") &&
                                                    port.event_type === "ETD"
                                                      ? "batam-etd"
                                                      : ""
                                                  }`}
                                                >
                                                  <div className="flex items-center justify-between gap-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                                                      <div>
                                                        <div className="text-xs font-bold text-blue-900">
                                                          {port.port_name
                                                            .toUpperCase()
                                                            .includes(
                                                              "BATAM",
                                                            ) &&
                                                          port.event_type ===
                                                            "ETD" ? (
                                                            <span className="inline-flex items-center gap-1">
                                                              <span className="text-red-600">
                                                                ★
                                                              </span>
                                                              <span className="text-[10px] sm:text-xs">
                                                                {formatHeader(
                                                                  port,
                                                                )}
                                                              </span>
                                                              <span className="text-red-600">
                                                                ★
                                                              </span>
                                                            </span>
                                                          ) : (
                                                            <span className="text-[10px] sm:text-xs">
                                                              {formatHeader(
                                                                port,
                                                              )}
                                                            </span>
                                                          )}
                                                        </div>
                                                        {port.port_code && (
                                                          <div className="text-[9px] text-blue-500">
                                                            {port.port_code}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {isAdmin && (
                                                      <button
                                                        onClick={() => {
                                                          setSelectedPort(port);
                                                          setShowDeleteModal(
                                                            true,
                                                          );
                                                        }}
                                                        className="rounded-lg p-0.5 text-blue-500 hover:bg-white hover:text-red-600 admin-only no-print"
                                                        title="Delete port"
                                                      >
                                                        <Trash2 className="h-2.5 w-2.5" />
                                                      </button>
                                                    )}
                                                  </div>
                                                </th>
                                              ))}
                                            </tr>
                                          </thead>

                                          <tbody>
                                            {serviceSailings.length === 0 ? (
                                              <tr>
                                                <td
                                                  colSpan={
                                                    3 +
                                                    servicePorts.length +
                                                    (isAdmin ? 1 : 0)
                                                  }
                                                  className="px-4 py-6 text-center"
                                                >
                                                  <div className="flex flex-col items-center gap-1.5 text-blue-500">
                                                    <Ship className="h-6 w-6 opacity-50" />
                                                    <div className="text-sm font-semibold">
                                                      No vessels for Week {week}{" "}
                                                      / {year}
                                                    </div>
                                                    {isAdmin && (
                                                      <button
                                                        onClick={() => {
                                                          setSelectedService(
                                                            service,
                                                          );
                                                          setAddSailingForm(
                                                            (prev) => ({
                                                              ...prev,
                                                              service_id:
                                                                service.id,
                                                            }),
                                                          );
                                                          setShowAddSailingModal(
                                                            true,
                                                          );
                                                        }}
                                                        className="mt-1 inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 no-print"
                                                      >
                                                        <Plus className="h-2.5 w-2.5" />
                                                        Add First Vessel
                                                      </button>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            ) : (
                                              serviceSailings.map((sailing) => {
                                                // Hitung durasi jika ada destination yang dipilih
                                                let voyageDuration = null;
                                                if (destinationPort) {
                                                  voyageDuration =
                                                    calculateVoyageDuration(
                                                      sailing.id,
                                                      originPort,
                                                      destinationPort,
                                                    );
                                                }

                                                return (
                                                  <tr
                                                    key={sailing.id}
                                                    className="hover:bg-blue-50/30 transition-colors"
                                                  >
                                                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-blue-100 px-3 py-2.5 text-sm font-bold text-blue-900 bg-white col-vessel">
                                                      {sailing.vessel}
                                                    </td>
                                                    <td className="whitespace-nowrap border-b border-blue-100 px-3 py-2.5 text-sm text-blue-700 col-voyage">
                                                      {sailing.voyage}
                                                    </td>
                                                    <td className="whitespace-nowrap border-b border-blue-100 px-3 py-2.5 text-sm text-blue-700 col-connecting">
                                                      <div
                                                        className="group relative"
                                                        onClick={() => {
                                                          if (
                                                            isAdmin &&
                                                            editMode
                                                          ) {
                                                            startEditingConnecting(
                                                              sailing,
                                                            );
                                                          }
                                                        }}
                                                      >
                                                        <div
                                                          className={`flex flex-col p-1.5 rounded-md ${
                                                            isAdmin && editMode
                                                              ? "cursor-pointer hover:bg-blue-50 no-print"
                                                              : ""
                                                          }`}
                                                        >
                                                          <div className="font-medium text-xs">
                                                            {sailing.connecting_vessel ||
                                                              "-"}
                                                          </div>
                                                          {sailing.connecting_voyage && (
                                                            <div className="text-[10px] text-blue-600">
                                                              {
                                                                sailing.connecting_voyage
                                                              }
                                                            </div>
                                                          )}
                                                          {isAdmin &&
                                                            editMode &&
                                                            !sailing.connecting_vessel &&
                                                            !sailing.connecting_voyage && (
                                                              <div className="text-[10px] text-blue-400 italic">
                                                                Click to add
                                                                connecting
                                                              </div>
                                                            )}
                                                        </div>
                                                        {isAdmin &&
                                                          editMode && (
                                                            <Edit className="absolute right-1 top-1.5 h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity admin-only no-print" />
                                                          )}
                                                      </div>
                                                    </td>
                                                    {isAdmin && (
                                                      <td className="whitespace-nowrap border-b border-blue-100 px-3 py-2.5 admin-only no-print">
                                                        <div className="flex items-center gap-1.5">
                                                          <button
                                                            onClick={() => {
                                                              setSelectedSailing(
                                                                sailing,
                                                              );
                                                              setShowDeleteModal(
                                                                true,
                                                              );
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                                                            title="Delete vessel"
                                                          >
                                                            <Trash2 className="h-2.5 w-2.5" />
                                                            Delete
                                                          </button>
                                                          {isAdmin &&
                                                            editMode && (
                                                              <button
                                                                onClick={() =>
                                                                  startEditingConnecting(
                                                                    sailing,
                                                                  )
                                                                }
                                                                className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-1.5 py-1 text-[10px] font-semibold text-blue-700 hover:bg-blue-200 admin-only"
                                                                title="Edit connecting vessel"
                                                              >
                                                                <Edit className="h-2.5 w-2.5" />
                                                                Edit Connecting
                                                              </button>
                                                            )}
                                                        </div>
                                                      </td>
                                                    )}

                                                    {servicePorts.map(
                                                      (port) => {
                                                        const dateValue =
                                                          getDateValue(
                                                            sailing.id,
                                                            port.id,
                                                          );
                                                        const cellKey = `${sailing.id}_${port.id}`;
                                                        const isSaving =
                                                          savingCellKey ===
                                                          cellKey;
                                                        const isEditing =
                                                          editingCell?.sailingId ===
                                                            sailing.id &&
                                                          editingCell?.servicePortId ===
                                                            port.id;

                                                        return (
                                                          <td
                                                            key={port.id}
                                                            className={`whitespace-nowrap border-b border-blue-100 px-3 py-2.5 min-w-[140px] sm:min-w-[160px] ${
                                                              port.port_name
                                                                .toUpperCase()
                                                                .includes(
                                                                  "BATAM",
                                                                ) &&
                                                              port.event_type ===
                                                                "ETD"
                                                                ? "batam-etd"
                                                                : ""
                                                            }`}
                                                            data-full-date={
                                                              dateValue
                                                            }
                                                          >
                                                            {isEditing ? (
                                                              // EDITING MODE
                                                              <div className="flex items-center gap-1.5 no-print">
                                                                <input
                                                                  type="date"
                                                                  value={
                                                                    editingCell?.tempValue ||
                                                                    ""
                                                                  }
                                                                  onChange={(
                                                                    e,
                                                                  ) =>
                                                                    setEditingCell(
                                                                      {
                                                                        ...editingCell!,
                                                                        tempValue:
                                                                          e
                                                                            .target
                                                                            .value,
                                                                      },
                                                                    )
                                                                  }
                                                                  className="w-[110px] sm:w-[130px] rounded-lg border border-blue-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                                  autoFocus
                                                                />
                                                                <div className="flex gap-0.5">
                                                                  <button
                                                                    onClick={
                                                                      saveEditingCell
                                                                    }
                                                                    disabled={
                                                                      isSaving
                                                                    }
                                                                    className="rounded-md bg-green-500 p-1 text-white hover:bg-green-600 disabled:opacity-50"
                                                                    title="Save"
                                                                  >
                                                                    <Save className="h-3 w-3" />
                                                                  </button>
                                                                  <button
                                                                    onClick={
                                                                      cancelEditingCell
                                                                    }
                                                                    className="rounded-md bg-slate-200 p-1 text-slate-700 hover:bg-slate-300"
                                                                    title="Cancel"
                                                                  >
                                                                    <X className="h-3 w-3" />
                                                                  </button>
                                                                </div>
                                                                {isSaving && (
                                                                  <span className="text-[10px] font-semibold text-blue-600">
                                                                    saving...
                                                                  </span>
                                                                )}
                                                              </div>
                                                            ) : (
                                                              // VIEW MODE
                                                              <div className="group relative">
                                                                <div
                                                                  className={`flex items-center justify-between gap-1.5 p-1.5 rounded-md ${
                                                                    isAdmin &&
                                                                    editMode
                                                                      ? "cursor-pointer hover:bg-blue-50 no-print"
                                                                      : ""
                                                                  }`}
                                                                  onClick={() => {
                                                                    if (
                                                                      isAdmin &&
                                                                      editMode
                                                                    ) {
                                                                      startEditingCell(
                                                                        sailing.id,
                                                                        port.id,
                                                                        dateValue,
                                                                      );
                                                                    }
                                                                  }}
                                                                >
                                                                  <div className="flex items-center gap-1.5">
                                                                    <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
                                                                    <span
                                                                      className={`text-sm font-medium ${
                                                                        dateValue
                                                                          ? "text-blue-900"
                                                                          : "text-blue-400"
                                                                      }`}
                                                                    >
                                                                      {dateViewMode ===
                                                                      "short"
                                                                        ? formatShortDate(
                                                                            dateValue,
                                                                          )
                                                                        : formatDateForExcel(
                                                                            dateValue,
                                                                          )}
                                                                    </span>
                                                                    {/* Show voyage duration for selected destination */}
                                                                    {voyageDuration !==
                                                                      null &&
                                                                      port.port_name
                                                                        .toUpperCase()
                                                                        .includes(
                                                                          destinationPort.toUpperCase(),
                                                                        ) &&
                                                                      port.event_type ===
                                                                        "ETA" && (
                                                                        <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                                                          {
                                                                            voyageDuration
                                                                          }
                                                                          d
                                                                        </span>
                                                                      )}
                                                                  </div>
                                                                  {isAdmin &&
                                                                    editMode && (
                                                                      <Edit className="h-2.5 w-2.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity admin-only no-print" />
                                                                    )}
                                                                </div>

                                                                {/* Tooltip */}
                                                                {dateValue && (
                                                                  <div className="absolute bottom-full left-0 mb-1.5 hidden w-48 rounded-md bg-blue-900 p-1.5 text-xs text-white group-hover:block z-50 no-print">
                                                                    <div className="font-semibold">
                                                                      {formatHeader(
                                                                        port,
                                                                      )}
                                                                    </div>
                                                                    <div>
                                                                      {formatLongDate(
                                                                        dateValue,
                                                                      )}
                                                                    </div>
                                                                    {/* Show voyage duration in tooltip */}
                                                                    {voyageDuration !==
                                                                      null &&
                                                                      port.port_name
                                                                        .toUpperCase()
                                                                        .includes(
                                                                          destinationPort.toUpperCase(),
                                                                        ) &&
                                                                      port.event_type ===
                                                                        "ETA" && (
                                                                        <div className="mt-1 pt-1 border-t border-blue-700">
                                                                          <div className="flex items-center gap-1 text-indigo-200">
                                                                            <Clock className="h-3 w-3" />
                                                                            Voyage
                                                                            duration:{" "}
                                                                            {
                                                                              voyageDuration
                                                                            }{" "}
                                                                            days
                                                                          </div>
                                                                        </div>
                                                                      )}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            )}
                                                          </td>
                                                        );
                                                      },
                                                    )}
                                                  </tr>
                                                );
                                              })
                                            )}
                                          </tbody>
                                        </table>
                                        <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
                                          <div className="flex flex-col gap-3">
                                            <div className="flex items-center gap-2">
                                              <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center">
                                                <span className="text-blue-600 text-lg">
                                                  📩
                                                </span>
                                              </div>

                                              <div className="flex flex-col">
                                                <span className="text-blue-700 font-semibold text-sm">
                                                  For Booking & Inquiries
                                                </span>
                                                <span className="text-slate-500 text-xs">
                                                  Please contact our Batam
                                                  Branch
                                                </span>
                                              </div>
                                            </div>

                                            <div className="rounded-xl bg-blue-50/60 p-3 border border-blue-100">
                                              <span className="text-blue-700 font-semibold text-sm">
                                                SITC Batam Branch
                                              </span>

                                              <div className="mt-2 flex flex-col gap-2">
                                                <div className="rounded-xl bg-white p-3 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition">
                                                  <p className="text-slate-800 text-sm font-medium">
                                                    Meyfenia R
                                                  </p>
                                                  <p className="text-slate-500 text-xs mt-0.5">
                                                    +62 822 2664 5667 •
                                                    mey@sitc.co.id
                                                  </p>
                                                </div>

                                                <div className="rounded-xl bg-white p-3 border border-slate-100 hover:border-blue-200 hover:shadow-sm transition">
                                                  <p className="text-slate-800 text-sm font-medium">
                                                    Eka Widyatama
                                                  </p>
                                                  <p className="text-slate-500 text-xs mt-0.5">
                                                    +628-571-8086-854 •
                                                    eka@sitc.co.id
                                                  </p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      {tableContainerRef.current &&
                                        scrollPosition <
                                          tableContainerRef.current
                                            .scrollWidth -
                                            tableContainerRef.current
                                              .clientWidth && (
                                          <button
                                            onClick={() => scrollTable("right")}
                                            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow-lg backdrop-blur-sm no-print"
                                          >
                                            <ChevronRight className="h-4 w-4 text-blue-600" />
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                )}

                                {isServiceOpen && servicePorts.length === 0 && (
                                  <div className="border-t border-blue-100 px-4 py-4 text-center text-blue-500">
                                    <div className="mb-2">
                                      <MapPin className="h-6 w-6 mx-auto opacity-50" />
                                    </div>
                                    <div className="text-sm font-semibold">
                                      No ports defined for this service
                                    </div>
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          setSelectedService(service);
                                          setAddPortForm((prev) => ({
                                            ...prev,
                                            service_id: service.id,
                                          }));
                                          setShowAddPortModal(true);
                                        }}
                                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 no-print"
                                      >
                                        <Plus className="h-2.5 w-2.5" />
                                        Add First Port
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Service Button untuk Group */}
                      {isAdmin && (
                        <div className="mt-4 flex justify-center no-print">
                          <button
                            onClick={() => {
                              setSelectedGroup(group);
                              setAddServiceForm((prev) => ({
                                ...prev,
                                group_id: group.id,
                              }));
                              setShowAddServiceModal(true);
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:from-blue-700 hover:to-blue-800"
                          >
                            <Plus className="h-4 w-4" />
                            Add New Service to {group.name}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center print-footer">
          <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3">
            <Image
              src="/SITCPNG.png"
              alt="SITC"
              width={20}
              height={20}
              className="h-5 w-5 object-contain"
            />
            <div className="text-xs text-blue-700">
              SITC Batam Schedule Board • Week {week}, {year}
            </div>
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* MODALS */}
      {/* ========================= */}

      {/* VESSEL SUGGESTION MODAL */}
      <Modal
        isOpen={showVesselSuggestionModal}
        onClose={() => setShowVesselSuggestionModal(false)}
        title={`Vessel Suggestions: ${originPort} → ${destinationPort}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {vesselSuggestions.length === 0 ? (
            <div className="py-8 text-center">
              <Ship className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600">No vessels found for this route.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-5 w-5 text-indigo-600" />
                  <div>
                    <div className="font-semibold text-indigo-800">
                      Found {vesselSuggestions.length} vessel
                      {vesselSuggestions.length > 1 ? "s" : ""}
                    </div>
                    <div className="text-sm text-indigo-600">
                      Sorted by shortest voyage duration
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {vesselSuggestions.map((suggestion, index) => (
                  <div
                    key={suggestion.sailing.id}
                    className="rounded-xl border border-gray-200 p-4 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {index === 0 && (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-800">
                              FASTEST
                            </span>
                          )}
                          <div className="font-bold text-lg text-gray-900">
                            {suggestion.sailing.vessel}
                          </div>
                          <div className="font-mono font-bold text-blue-600">
                            {suggestion.sailing.voyage}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600 mb-2">
                          {suggestion.groupName} • {suggestion.serviceName}
                        </div>

                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <div className="font-semibold text-gray-700">
                              Departure
                            </div>
                            <div className="text-gray-900">
                              {formatLongDate(suggestion.originDate)}
                            </div>
                            <div className="text-xs text-gray-500">
                              from {suggestion.originPort}
                            </div>
                          </div>

                          <div className="text-gray-400">→</div>

                          <div>
                            <div className="font-semibold text-gray-700">
                              Arrival
                            </div>
                            <div className="text-gray-900">
                              {formatLongDate(suggestion.destinationDate)}
                            </div>
                            <div className="text-xs text-gray-500">
                              at {suggestion.destinationPort}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-white font-bold">
                          {suggestion.duration} days
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          voyage time
                        </div>
                      </div>
                    </div>

                    {suggestion.sailing.connecting_vessel && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2 text-sm">
                          <Link className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">Connecting: </span>
                          <span className="font-semibold">
                            {suggestion.sailing.connecting_vessel}
                          </span>
                          {suggestion.sailing.connecting_voyage && (
                            <span className="font-mono text-gray-500">
                              {suggestion.sailing.connecting_voyage}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4 inline mr-1" />
                  <span>
                    Tip: Vessels are sorted by shortest voyage duration. The
                    fastest option is marked as &quot;FASTEST&quot;.
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

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

      {/* ADD SERVICE GROUP MODAL */}
      <Modal
        isOpen={showAddServiceGroupModal}
        onClose={() => {
          setShowAddServiceGroupModal(false);
          setAddServiceGroupForm({
            code: "",
            name: "",
            flag_emoji: "🌐",
          });
        }}
        title="Add New Service Group"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Group Code *
            </label>
            <input
              type="text"
              value={addServiceGroupForm.code}
              onChange={(e) =>
                setAddServiceGroupForm({
                  ...addServiceGroupForm,
                  code: e.target.value,
                })
              }
              placeholder="e.g., CHINA, JAPAN, KOREA"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Group Name *
            </label>
            <input
              type="text"
              value={addServiceGroupForm.name}
              onChange={(e) =>
                setAddServiceGroupForm({
                  ...addServiceGroupForm,
                  name: e.target.value,
                })
              }
              placeholder="e.g., China Service, Japan Service"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Flag Emoji
            </label>
            <select
              value={addServiceGroupForm.flag_emoji}
              onChange={(e) =>
                setAddServiceGroupForm({
                  ...addServiceGroupForm,
                  flag_emoji: e.target.value,
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="🌐">🌐 Global</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddServiceGroupModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddServiceGroup}
              className="rounded-2xl bg-gradient-to-r from-green-600 to-green-700 px-4 py-2 text-sm font-semibold text-white hover:from-green-700 hover:to-green-800"
            >
              Add Service Group
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD SERVICE MODAL */}
      <Modal
        isOpen={showAddServiceModal}
        onClose={() => {
          setShowAddServiceModal(false);
          setAddServiceForm({
            group_id: "",
            code: "",
            name: "",
            color_code: "#3B82F6",
          });
        }}
        title={`Add New Service to ${selectedGroup?.name || "Group"}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Service Code *
            </label>
            <input
              type="text"
              value={addServiceForm.code}
              onChange={(e) =>
                setAddServiceForm({ ...addServiceForm, code: e.target.value })
              }
              placeholder="e.g., CVM_CJV2, CMX_CPX1"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Service Name *
            </label>
            <input
              type="text"
              value={addServiceForm.name}
              onChange={(e) =>
                setAddServiceForm({ ...addServiceForm, name: e.target.value })
              }
              placeholder="e.g., NEW CVM + CJV2 : HAIPHONG - SHANGHAI"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Color Code
            </label>
            <div className="flex gap-2">
              {["#3B82F6", "#10B981", "#8B5CF6", "#EF4444", "#F59E0B"].map(
                (color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setAddServiceForm({
                        ...addServiceForm,
                        color_code: color,
                      })
                    }
                    className={`h-8 w-8 rounded-full border-2 ${
                      addServiceForm.color_code === color
                        ? "border-blue-500"
                        : "border-slate-300"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ),
              )}
              ；
              <input
                type="color"
                value={addServiceForm.color_code}
                onChange={(e) =>
                  setAddServiceForm({
                    ...addServiceForm,
                    color_code: e.target.value,
                  })
                }
                className="h-8 w-12 cursor-pointer"
              />
            </div>
          </div>
          <input type="hidden" value={addServiceForm.group_id} />
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowAddServiceModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddService}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800"
            >
              Add Service
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD PORT MODAL */}
      <Modal
        isOpen={showAddPortModal}
        onClose={() => {
          setShowAddPortModal(false);
          setAddPortForm({
            service_id: "",
            port_name: "",
            event_type: "ETA",
            sequence: 0,
          });
        }}
        title={`Add Port to ${selectedService?.name || "Service"}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Port Name *
            </label>
            <input
              type="text"
              value={addPortForm.port_name}
              onChange={(e) =>
                setAddPortForm({ ...addPortForm, port_name: e.target.value })
              }
              placeholder="e.g., SHANGHAI, QINGDAO, HAIPHONG"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Event Type
            </label>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setAddPortForm({ ...addPortForm, event_type: "ETA" })
                }
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  addPortForm.event_type === "ETA"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ETA (Estimated Time of Arrival)
              </button>
              <button
                onClick={() =>
                  setAddPortForm({ ...addPortForm, event_type: "ETD" })
                }
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold ${
                  addPortForm.event_type === "ETD"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                ETD (Estimated Time of Departure)
              </button>
            </div>
          </div>
          <input type="hidden" value={addPortForm.service_id} />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddPortModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPort}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800"
            >
              Add Port
            </button>
          </div>
        </div>
      </Modal>

      {/* ADD SAILING MODAL */}
      <Modal
        isOpen={showAddSailingModal}
        onClose={() => {
          setShowAddSailingModal(false);
          setAddSailingForm({
            service_id: "",
            vessel: "",
            voyage: "",
            connecting_vessel: "",
            connecting_voyage: "",
          });
        }}
        title={`Add Vessel to ${selectedService?.name || "Service"}`}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Vessel Name *
            </label>
            <input
              type="text"
              value={addSailingForm.vessel}
              onChange={(e) =>
                setAddSailingForm({ ...addSailingForm, vessel: e.target.value })
              }
              placeholder="e.g., SITC TAIPEI, SITC SHANGHAI"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Voyage Number *
            </label>
            <input
              type="text"
              value={addSailingForm.voyage}
              onChange={(e) =>
                setAddSailingForm({ ...addSailingForm, voyage: e.target.value })
              }
              placeholder="e.g., 001W, 003E, 101W"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Connecting Vessel
            </label>
            <input
              type="text"
              value={addSailingForm.connecting_vessel}
              onChange={(e) =>
                setAddSailingForm({
                  ...addSailingForm,
                  connecting_vessel: e.target.value,
                })
              }
              placeholder="Optional: e.g., VESSEL B"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Connecting Voyage
            </label>
            <input
              type="text"
              value={addSailingForm.connecting_voyage}
              onChange={(e) =>
                setAddSailingForm({
                  ...addSailingForm,
                  connecting_voyage: e.target.value,
                })
              }
              placeholder="Optional: e.g., 002W"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-sm text-slate-500">
            Vessel will be added for Week {week}, {year}
          </div>
          <input type="hidden" value={addSailingForm.service_id} />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowAddSailingModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddSailing}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800"
            >
              Add Vessel
            </button>
          </div>
        </div>
      </Modal>

      {/* EDIT CONNECTING VESSEL MODAL */}
      <Modal
        isOpen={showEditConnectingModal}
        onClose={() => {
          setShowEditConnectingModal(false);
          setEditingConnecting(null);
        }}
        title="Edit Connecting Vessel"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 p-4">
            <div className="text-sm font-semibold text-blue-800">
              Editing for:
            </div>
            <div className="text-lg font-bold text-blue-900">
              {editingConnecting?.vessel} - {editingConnecting?.voyage}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Connecting Vessel
            </label>
            <input
              type="text"
              value={editConnectingForm.connecting_vessel}
              onChange={(e) =>
                setEditConnectingForm({
                  ...editConnectingForm,
                  connecting_vessel: e.target.value,
                })
              }
              placeholder="e.g., VESSEL B"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Connecting Voyage
            </label>
            <input
              type="text"
              value={editConnectingForm.connecting_voyage}
              onChange={(e) =>
                setEditConnectingForm({
                  ...editConnectingForm,
                  connecting_voyage: e.target.value,
                })
              }
              placeholder="e.g., 002W"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowEditConnectingModal(false)}
              className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={updateConnectingVessel}
              className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white hover:from-blue-700 hover:to-blue-800"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <AlertModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={
          selectedGroup
            ? "Delete Service Group"
            : selectedService
              ? "Delete Service"
              : selectedPort
                ? "Delete Port"
                : selectedSailing
                  ? "Delete Vessel"
                  : "Delete Item"
        }
        message={
          selectedGroup
            ? `Are you sure you want to delete service group "${selectedGroup.name}"? This will delete ALL services, ports, and vessels in this group.`
            : selectedService
              ? `Are you sure you want to delete service "${selectedService.name}" (${selectedService.code})? This will delete ALL ports and vessels for this service.`
              : selectedPort
                ? `Are you sure you want to delete port "${selectedPort.port_name}" (${selectedPort.event_type})?`
                : selectedSailing
                  ? `Are you sure you want to delete vessel "${selectedSailing.vessel} - ${selectedSailing.voyage}"? This will delete all schedule dates for this vessel.`
                  : "Are you sure you want to delete this item?"
        }
        onConfirm={() => {
          if (selectedGroup) handleDeleteItem("group");
          else if (selectedService) handleDeleteItem("service");
          else if (selectedPort) handleDeleteItem("port");
          else if (selectedSailing) handleDeleteItem("sailing");
        }}
        confirmText={
          selectedGroup
            ? "Delete Group"
            : selectedService
              ? "Delete Service"
              : selectedPort
                ? "Delete Port"
                : selectedSailing
                  ? "Delete Vessel"
                  : "Delete"
        }
        confirmColor="bg-red-600 hover:bg-red-700"
      />
    </main>
  );
}
