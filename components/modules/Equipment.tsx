import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  LayoutGrid,
  List,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  Equipment as EquipmentType,
  EquipmentCategory,
  EquipmentStatus,
  Screening,
} from "../../types";
import { storageService } from "../../services/storageService";
import { ConfirmModal } from "../ConfirmModal";

interface EquipmentProps {
  onGoToDashboard?: () => void;
  canEdit?: boolean;
}
type EquipmentForm = Omit<EquipmentType, "id">;
const EMPTY_FORM: EquipmentForm = {
  name: "",
  category: "cihaz",
  serialNumber: "",
  status: "musait",
  lastCalibrationDate: "",
  nextCalibrationDate: "",
  assignedScreeningId: "",
  notes: "",
};
const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  arac: "Araç",
  cihaz: "Cihaz",
  sarf: "Sarf Malzeme",
};
const STATUS_LABELS: Record<EquipmentStatus, string> = {
  musait: "Müsait",
  zimmetli: "Zimmetli",
  bakimda: "Bakımda",
  arizali: "Arızalı",
};
const STATUS_STYLES: Record<EquipmentStatus, string> = {
  musait: "bg-emerald-50 text-emerald-700 border-emerald-200",
  zimmetli: "bg-blue-50 text-blue-700 border-blue-200",
  bakimda: "bg-amber-50 text-amber-700 border-amber-200",
  arizali: "bg-red-50 text-red-700 border-red-200",
};
const inputClass =
  "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all";
const dateDiff = (date?: string) =>
  date
    ? Math.ceil(
        (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000,
      )
    : null;

export const Equipment: React.FC<EquipmentProps> = ({
  onGoToDashboard,
  canEdit = true,
}) => {
  const [items, setItems] = useState<EquipmentType[]>(() =>
    storageService.getEquipment(),
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<EquipmentCategory | "all">("all");
  const [status, setStatus] = useState<EquipmentStatus | "all">("all");
  const [section, setSection] = useState<"inventory" | "vehicles">("inventory");
  const [form, setForm] = useState<EquipmentForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "cards">(() =>
    localStorage.getItem("mediscan_equipment_view") === "cards"
      ? "cards"
      : "list",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const q = search.trim().toLocaleLowerCase("tr-TR");
        return (
          (!q ||
            [
              item.name,
              item.serialNumber,
              item.plateNumber,
              item.brandModel,
              item.notes,
            ].some((value) => value?.toLocaleLowerCase("tr-TR").includes(q))) &&
          (section === "vehicles"
            ? item.category === "arac"
            : category === "all" || item.category === category) &&
          (status === "all" || item.status === status)
        );
      }),
    [items, search, category, status, section],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const allPageSelected =
    pageItems.length > 0 && pageItems.every((item) => selectedIds.has(item.id));
  useEffect(() => {
    localStorage.setItem("mediscan_equipment_view", viewMode);
  }, [viewMode]);
  const dueItems = items.filter((item) => {
    const diff = dateDiff(item.nextCalibrationDate);
    return diff !== null && diff <= 60;
  });
  const screenings = storageService.getScreenings();
  const teamMembers = storageService
    .getTeam()
    .filter((member) => member.status !== "pasif");
  const openNew = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      category: section === "vehicles" ? "arac" : "cihaz",
    });
    setShowForm(true);
  };
  const openEdit = (item: EquipmentType) => {
    setEditingId(item.id);
    setForm({ ...EMPTY_FORM, ...item });
    setShowForm(true);
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const next = editingId
      ? items.map((item) =>
          item.id === editingId
            ? { ...form, id: editingId, name: form.name.trim() }
            : item,
        )
      : [{ ...form, id: `eq_${Date.now()}`, name: form.name.trim() }, ...items];
    setItems(next);
    storageService.saveEquipment(next);
    setShowForm(false);
  };
  const remove = () => {
    if (!deleteIds.length) return;
    const next = items.filter((item) => !deleteIds.includes(item.id));
    setItems(next);
    storageService.saveEquipment(next);
    setSelectedIds(new Set());
    setDeleteIds([]);
  };
  const toggleSelection = (id: string) =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePageSelection = () =>
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allPageSelected) pageItems.forEach((item) => next.delete(item.id));
      else pageItems.forEach((item) => next.add(item.id));
      return next;
    });
  const screeningName = (id?: string) =>
    screenings.find((screening: Screening) => screening.id === id)?.title;
  const teamName = (id?: string) =>
    teamMembers.find((member) => member.id === id)?.fullName;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">
            Mobil operasyon
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">
            Ekipman
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Araç, cihaz ve sarf malzemelerinizi tek envanterden takip edin.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openNew}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-200 transition-all"
          >
            {section === "vehicles" ? (
              <CarFront size={15} />
            ) : (
              <Plus size={15} />
            )}{" "}
            {section === "vehicles" ? "Mobil Araç Ekle" : "Ekipman Ekle"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => {
            setSection("inventory");
            setPage(1);
            setSelectedIds(new Set());
          }}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${section === "inventory" ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent"}`}
        >
          Tüm Ekipmanlar
        </button>
        <button
          onClick={() => {
            setSection("vehicles");
            setCategory("all");
            setPage(1);
            setSelectedIds(new Set());
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${section === "vehicles" ? "text-blue-600 border-blue-600" : "text-slate-400 border-transparent"}`}
        >
          <CarFront size={14} /> Mobil Araçlar
        </button>
      </div>
      {dueItems.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/70 text-amber-900">
          <CalendarClock size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold">
              Kalibrasyon takvimi dikkat istiyor
            </p>
            <p className="text-xs mt-0.5">
              {dueItems.length} ekipmanın kalibrasyonu geçmiş veya önümüzdeki 60
              gün içinde.
            </p>
          </div>
        </div>
      )}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-lg">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ekipman veya seri numarası ara..."
                className={`${inputClass} pl-9`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as EquipmentCategory | "all")
                }
                className={`${inputClass} w-full sm:w-40`}
              >
                <option value="all">Tüm kategoriler</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as EquipmentStatus | "all")
                }
                className={`${inputClass} w-full sm:w-40`}
              >
                <option value="all">Tüm durumlar</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2.5 ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "text-slate-400"}`}
                  title="Liste görünümü"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-2.5 ${viewMode === "cards" ? "bg-blue-50 text-blue-600" : "text-slate-400"}`}
                  title="Kart görünümü"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          </div>
          {canEdit && pageItems.length > 0 && (
            <div className="flex items-center justify-between text-xs">
              <button
                onClick={togglePageSelection}
                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold"
              >
                <span
                  className={`w-4 h-4 rounded border flex items-center justify-center ${allPageSelected ? "bg-blue-600 border-blue-600 text-white" : "border-slate-300"}`}
                >
                  {allPageSelected && <Check size={12} />}
                </span>{" "}
                Bu sayfadakileri seç
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setDeleteIds([...selectedIds])}
                  className="flex items-center gap-1.5 text-red-600 hover:text-red-700 font-bold"
                >
                  <Trash2 size={14} /> Seçilenleri sil ({selectedIds.size})
                </button>
              )}
            </div>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={30} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-600">
              Ekipman bulunamadı
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Arama filtresini değiştirin veya yeni ekipman ekleyin.
            </p>
          </div>
        ) : (
          <>
            {viewMode === "list" ? (
              <div className="divide-y divide-slate-100">
                {pageItems.map((item) => {
                  const diff = dateDiff(item.nextCalibrationDate);
                  return (
                    <div
                      key={item.id}
                      className="p-4 md:px-5 flex items-center gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        disabled={!canEdit}
                        className="w-4 h-4 accent-blue-600 shrink-0"
                      />
                      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Package size={19} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 truncate">
                            {item.name}
                          </p>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {CATEGORY_LABELS[item.category]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {item.category === "arac"
                            ? `${item.plateNumber || "Plaka yok"}${item.brandModel ? ` · ${item.brandModel}` : ""}`
                            : item.serialNumber || "Seri numarası yok"}{" "}
                          {screeningName(item.assignedScreeningId) &&
                            `· ${screeningName(item.assignedScreeningId)}`}
                        </p>
                        {item.notes && (
                          <p className="text-[11px] text-slate-400 mt-1 truncate">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <span
                            className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-bold ${STATUS_STYLES[item.status]}`}
                          >
                            {STATUS_LABELS[item.status]}
                          </span>
                          {diff !== null && (
                            <p
                              className={`text-[10px] mt-1 font-semibold ${diff < 0 ? "text-red-600" : diff <= 60 ? "text-amber-600" : "text-slate-400"}`}
                            >
                              {diff < 0
                                ? `${Math.abs(diff)} gün gecikmiş`
                                : `Kalibrasyon: ${diff} gün`}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <>
                            <button
                              aria-label={`${item.name} düzenle`}
                              onClick={() => openEdit(item)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              aria-label={`${item.name} sil`}
                              onClick={() => setDeleteIds([item.id])}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-4">
                {pageItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-200 rounded-2xl p-4 hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        disabled={!canEdit}
                        className="w-4 h-4 accent-blue-600 mt-1 shrink-0"
                      />
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Package size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">
                          {CATEGORY_LABELS[item.category]}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      {item.category === "arac"
                        ? `${item.plateNumber || "Plaka yok"}${item.brandModel ? ` · ${item.brandModel}` : ""}`
                        : item.serialNumber || "Seri numarası yok"}
                      {item.category === "arac" &&
                        teamName(item.assignedTeamMemberId) && (
                          <span className="block text-[11px] text-slate-400 mt-1">
                            Sorumlu: {teamName(item.assignedTeamMemberId)}
                          </span>
                        )}
                    </p>
                    <div className="flex items-center justify-between mt-4">
                      <span
                        className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${STATUS_STYLES[item.status]}`}
                      >
                        {STATUS_LABELS[item.status]}
                      </span>
                      {canEdit && (
                        <div className="flex gap-1">
                          <button
                            aria-label={`${item.name} düzenle`}
                            onClick={() => openEdit(item)}
                            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            aria-label={`${item.name} sil`}
                            onClick={() => setDeleteIds([item.id])}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                {filtered.length} kayıt · Sayfa {currentPage}/{pageCount}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                >
                  <option value={8}>8 / sayfa</option>
                  <option value={16}>16 / sayfa</option>
                  <option value={24}>24 / sayfa</option>
                </select>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  className="p-1.5 border rounded-lg disabled:opacity-30"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  className="p-1.5 border rounded-lg disabled:opacity-30"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={save}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  {editingId ? "Ekipmanı Düzenle" : "Yeni Ekipman"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Envanter bilgilerini girin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="md:col-span-2 text-xs font-bold text-slate-500">
                Ekipman adı
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} mt-1`}
                  placeholder="Örn. Odyometre cihazı"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                Kategori
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category: e.target.value as EquipmentCategory,
                    })
                  }
                  className={`${inputClass} mt-1`}
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {form.category === "arac" && (
                <>
                  <label className="text-xs font-bold text-slate-500">
                    Plaka
                    <input
                      value={form.plateNumber || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          plateNumber:
                            e.target.value.toLocaleUpperCase("tr-TR"),
                        })
                      }
                      className={`${inputClass} mt-1`}
                      placeholder="34 ABC 123"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Marka / model
                    <input
                      value={form.brandModel || ""}
                      onChange={(e) =>
                        setForm({ ...form, brandModel: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                      placeholder="Ford Transit"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Muayene tarihi
                    <input
                      type="date"
                      value={form.inspectionDate || ""}
                      onChange={(e) =>
                        setForm({ ...form, inspectionDate: e.target.value })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Sigorta bitiş tarihi
                    <input
                      type="date"
                      value={form.insuranceExpiryDate || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          insuranceExpiryDate: e.target.value,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-500">
                    Sorumlu ekip
                    <select
                      value={form.assignedTeamMemberId || ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          assignedTeamMemberId: e.target.value || undefined,
                        })
                      }
                      className={`${inputClass} mt-1`}
                    >
                      <option value="">Sorumlu seçilmedi</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label className="text-xs font-bold text-slate-500">
                Durum
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as EquipmentStatus,
                    })
                  }
                  className={`${inputClass} mt-1`}
                >
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500">
                Seri / plaka no
                <input
                  value={form.serialNumber}
                  onChange={(e) =>
                    setForm({ ...form, serialNumber: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                  placeholder="EQ-2026-001"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                Tarama ataması
                <select
                  value={form.assignedScreeningId || ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      assignedScreeningId: e.target.value || undefined,
                    })
                  }
                  className={`${inputClass} mt-1`}
                >
                  <option value="">Atama yok</option>
                  {screenings
                    .filter(
                      (s) => s.status !== "tamamlandi" && s.status !== "iptal",
                    )
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500">
                Son kalibrasyon
                <input
                  type="date"
                  value={form.lastCalibrationDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, lastCalibrationDate: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                Sonraki kalibrasyon
                <input
                  type="date"
                  value={form.nextCalibrationDate || ""}
                  onChange={(e) =>
                    setForm({ ...form, nextCalibrationDate: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="md:col-span-2 text-xs font-bold text-slate-500">
                Notlar
                <textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className={`${inputClass} mt-1 resize-none`}
                  placeholder="Bakım, kullanım veya teslim notları..."
                />
              </label>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? "Ekipmanları sil" : "Ekipmanı sil"}
        message={`${deleteIds.length > 1 ? `${deleteIds.length} envanter kaydı` : "Bu envanter kaydı"} kalıcı olarak silinecek. Devam etmek istiyor musunuz?`}
        onConfirm={remove}
        onCancel={() => setDeleteIds([])}
      />
      {onGoToDashboard && items.length === 0 && (
        <button
          onClick={onGoToDashboard}
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          Dashboard’a dön →
        </button>
      )}
    </div>
  );
};
