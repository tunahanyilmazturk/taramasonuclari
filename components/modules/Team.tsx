import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  HardHat,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Role, TeamMember, TeamMemberStatus, TeamRole } from "../../types";
import { storageService } from "../../services/storageService";
import { ConfirmModal } from "../ConfirmModal";

interface TeamProps {
  onGoToDashboard?: () => void;
  canEdit?: boolean;
}
type TeamForm = Omit<TeamMember, "id">;
const EMPTY_FORM: TeamForm = {
  fullName: "",
  role: "hemsire",
  phone: "",
  email: "",
  status: "aktif",
  certificates: [],
};
const DEFAULT_JOB_ROLES: Array<{
  id: TeamRole;
  name: string;
  system: boolean;
}> = [
  { id: "is_yeri_hekimi", name: "İşyeri Hekimi", system: true },
  { id: "hemsire", name: "Hemşire", system: true },
  { id: "saglik_memuru", name: "Sağlık Memuru", system: true },
  { id: "teknisyen", name: "Teknisyen", system: true },
  { id: "sofor", name: "Sürücü", system: true },
];
const ROLE_LABELS: Record<string, string> = {
  is_yeri_hekimi: "İşyeri Hekimi",
  hemsire: "Hemşire",
  saglik_memuru: "Sağlık Memuru",
  teknisyen: "Teknisyen",
  sofor: "Sürücü",
};
const STATUS_LABELS: Record<TeamMemberStatus, string> = {
  aktif: "Aktif",
  izinli: "İzinli",
  pasif: "Pasif",
};
const STATUS_STYLES: Record<TeamMemberStatus, string> = {
  aktif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  izinli: "bg-amber-50 text-amber-700 border-amber-200",
  pasif: "bg-slate-100 text-slate-500 border-slate-200",
};
const inputClass =
  "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all";
const daysUntil = (date?: string) =>
  date
    ? Math.ceil(
        (new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000,
      )
    : null;

export const Team: React.FC<TeamProps> = ({
  onGoToDashboard,
  canEdit = true,
}) => {
  const [items, setItems] = useState<TeamMember[]>(() =>
    storageService.getTeam(),
  );
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<TeamRole | "all">("all");
  const [status, setStatus] = useState<TeamMemberStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"list" | "cards">(() =>
    localStorage.getItem("mediscan_team_view") === "cards" ? "cards" : "list",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [jobRoles, setJobRoles] = useState<
    Array<{ id: TeamRole; name: string; system?: boolean }>
  >(() => {
    const saved = localStorage.getItem("mediscan_team_job_roles");
    try {
      return saved ? JSON.parse(saved) : DEFAULT_JOB_ROLES;
    } catch {
      return DEFAULT_JOB_ROLES;
    }
  });
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<TeamRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleError, setRoleError] = useState("");
  const [form, setForm] = useState<TeamForm>(EMPTY_FORM);
  const [certificateText, setCertificateText] = useState("");
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountRoleId, setAccountRoleId] = useState("");
  const [accountError, setAccountError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const roles = useMemo<Role[]>(
    () => storageService.getRoles().filter((item) => item.id !== "role_admin"),
    [],
  );
  const roleOptions = useMemo(() => jobRoles, [jobRoles]);
  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const q = search.trim().toLocaleLowerCase("tr-TR");
        return (
          (!q ||
            [item.fullName, item.phone, item.email].some((v) =>
              v?.toLocaleLowerCase("tr-TR").includes(q),
            )) &&
          (role === "all" || item.role === role) &&
          (status === "all" || item.status === status)
        );
      }),
    [items, search, role, status],
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
    localStorage.setItem("mediscan_team_view", viewMode);
  }, [viewMode]);
  useEffect(() => {
    localStorage.setItem("mediscan_team_job_roles", JSON.stringify(jobRoles));
  }, [jobRoles]);
  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, role: roleOptions[0]?.id || "hemsire" });
    setCertificateText("");
    setAccountUsername("");
    setAccountPassword("");
    setAccountRoleId(roles[0]?.id || "");
    setAccountError("");
    setShowForm(true);
  };
  const openEdit = (item: TeamMember) => {
    const linkedUser = storageService
      .getUsers()
      .find((user) => user.teamMemberId === item.id);
    setEditingId(item.id);
    setForm({ ...EMPTY_FORM, ...item });
    setCertificateText(
      item.certificates
        .map((c) => `${c.name}${c.expiryDate ? ` | ${c.expiryDate}` : ""}`)
        .join("\n"),
    );
    setAccountUsername(linkedUser?.username || "");
    setAccountPassword("");
    setAccountRoleId(linkedUser?.roleId || roles[0]?.id || "");
    setAccountError("");
    setShowForm(true);
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setAccountError("");
    if (!form.fullName.trim()) return;
    const teamId = editingId || `team_${Date.now()}`;
    const certificates = certificateText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((value) => value.trim());
        return {
          name: parts[0] || "",
          ...(parts[1] ? { expiryDate: parts[1] } : {}),
        };
      })
      .filter((c) => c.name);
    const payload = {
      ...form,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      certificates,
    };
    const next = editingId
      ? items.map((item) =>
          item.id === editingId ? { ...payload, id: teamId } : item,
        )
      : [{ ...payload, id: teamId }, ...items];
    const users = storageService.getUsers();
    const linkedUser = users.find((user) => user.teamMemberId === teamId);
    const username = accountUsername.trim();
    if (username) {
      const duplicate = users.find(
        (user) =>
          user.username.toLocaleLowerCase() === username.toLocaleLowerCase() &&
          user.id !== linkedUser?.id,
      );
      if (duplicate) {
        setAccountError("Bu kullanıcı adı zaten kullanılıyor.");
        return;
      }
      if (!linkedUser && !accountPassword.trim()) {
        setAccountError("Yeni hesap için şifre girin.");
        return;
      }
      const account = linkedUser
        ? {
            ...linkedUser,
            username,
            fullName: payload.fullName,
            phone: payload.phone,
            email: payload.email,
            role: "user" as const,
            roleId: accountRoleId || roles[0]?.id,
            active: payload.status === "aktif",
            ...(accountPassword.trim()
              ? { password: accountPassword.trim() }
              : {}),
          }
        : {
            id: `user_${Date.now()}`,
            teamMemberId: teamId,
            username,
            password: accountPassword.trim(),
            fullName: payload.fullName,
            phone: payload.phone,
            email: payload.email,
            role: "user" as const,
            roleId: accountRoleId || roles[0]?.id,
            active: payload.status === "aktif",
          };
      storageService.saveUsers(
        linkedUser
          ? users.map((user) => (user.id === linkedUser.id ? account : user))
          : [account, ...users],
      );
    } else if (linkedUser)
      storageService.saveUsers(
        users.map((user) =>
          user.id === linkedUser.id
            ? {
                ...user,
                fullName: payload.fullName,
                active: payload.status === "aktif",
              }
            : user,
        ),
      );
    setItems(next);
    storageService.saveTeam(next);
    setShowForm(false);
  };
  const remove = () => {
    if (!deleteIds.length) return;
    const next = items.filter((item) => !deleteIds.includes(item.id));
    setItems(next);
    storageService.saveTeam(next);
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
  const saveJobRole = (event: React.FormEvent) => {
    event.preventDefault();
    const name = roleName.trim();
    if (!name) return;
    if (
      jobRoles.some(
        (item) =>
          item.id !== editingRoleId &&
          item.name.toLocaleLowerCase("tr-TR") ===
            name.toLocaleLowerCase("tr-TR"),
      )
    ) {
      setRoleError("Bu görev zaten tanımlı.");
      return;
    }
    if (editingRoleId)
      setJobRoles((previous) =>
        previous.map((item) =>
          item.id === editingRoleId ? { ...item, name } : item,
        ),
      );
    else
      setJobRoles((previous) => [
        ...previous,
        { id: `custom_${Date.now()}` as TeamRole, name },
      ]);
    setRoleName("");
    setEditingRoleId(null);
    setRoleError("");
  };
  const removeJobRole = (id: TeamRole) => {
    if (jobRoles.length <= 1) {
      setRoleError("En az bir görev tanımı kalmalıdır.");
      return;
    }
    const fallback = jobRoles.find((item) => item.id !== id);
    const reassigned = items.map((item) =>
      item.role === id && fallback ? { ...item, role: fallback.id } : item,
    );
    if (reassigned.some((item, index) => item !== items[index])) {
      setItems(reassigned);
      storageService.saveTeam(reassigned);
    }
    setJobRoles((previous) => previous.filter((item) => item.id !== id));
    if (role === id) setRole("all");
    setRoleError("");
  };
  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  const getRoleName = (id: TeamRole) =>
    roleOptions.find((item) => item.id === id)?.name || ROLE_LABELS[id] || id;
  const actions = (item: TeamMember) =>
    canEdit && (
      <div className="flex gap-1">
        <button
          aria-label={`${item.fullName} düzenle`}
          onClick={() => openEdit(item)}
          className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"
        >
          <Edit3 size={15} />
        </button>
        <button
          aria-label={`${item.fullName} sil`}
          onClick={() => setDeleteIds([item.id])}
          className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
        >
          <Trash2 size={15} />
        </button>
      </div>
    );
  const card = (item: TeamMember) => {
    const expiring = item.certificates.filter((c) => {
      const d = daysUntil(c.expiryDate);
      return d !== null && d <= 60;
    });
    return (
      <div
        key={item.id}
        className="border border-slate-200 rounded-2xl p-4 hover:border-blue-200 hover:shadow-sm transition-all"
      >
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleSelection(item.id)}
            disabled={!canEdit}
            className="w-4 h-4 accent-blue-600 mt-1 shrink-0"
          />
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
            {initials(item.fullName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-slate-800 truncate">
                {item.fullName}
              </p>
              <span
                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${STATUS_STYLES[item.status]}`}
              >
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <p className="text-xs text-blue-600 font-semibold mt-1">
              {getRoleName(item.role)}
            </p>
            <div className="flex flex-wrap gap-x-3 mt-2 text-[11px] text-slate-500">
              {item.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={11} />
                  {item.phone}
                </span>
              )}
              {item.email && (
                <span className="flex items-center gap-1 truncate">
                  <Mail size={11} />
                  {item.email}
                </span>
              )}
            </div>
          </div>
          {actions(item)}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Award
              size={13}
              className={expiring.length ? "text-amber-500" : "text-slate-400"}
            />
            {item.certificates.length
              ? `${item.certificates.length} sertifika`
              : "Sertifika kaydı yok"}
          </span>
          {expiring.length > 0 && (
            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
              {expiring.length} belge yenilenmeli
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-16 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">
            Saha kadrosu
          </p>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800">
            Ekip
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Saha personelinizi, görev durumlarını ve sertifika geçerliliklerini
            yönetin.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openNew}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl"
            >
              <Plus size={15} /> Personel Ekle
            </button>
            <button
              onClick={() => {
                setEditingRoleId(null);
                setRoleName("");
                setRoleError("");
                setShowRoleManager(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:border-blue-300"
            >
              <HardHat size={15} /> Görevleri Yönet
            </button>
          </div>
        )}
      </div>
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
                placeholder="İsim, telefon veya e-posta ara..."
                className={`${inputClass} pl-9`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TeamRole | "all")}
                className={`${inputClass} w-full sm:w-40`}
              >
                <option value="all">Tüm roller</option>
                {roleOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as TeamMemberStatus | "all")
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
                  className="flex items-center gap-1.5 text-red-600 font-bold"
                >
                  <Trash2 size={14} /> Seçilenleri sil ({selectedIds.size})
                </button>
              )}
            </div>
          )}
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <HardHat size={30} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-600">
              Personel bulunamadı
            </p>
          </div>
        ) : (
          <>
            {viewMode === "cards" ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
                {pageItems.map(card)}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pageItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 flex items-center gap-3 hover:bg-slate-50/60"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      disabled={!canEdit}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-black">
                      {initials(item.fullName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {item.fullName}
                        </p>
                        <span className="text-xs text-blue-600 font-semibold">
                          {getRoleName(item.role)}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${STATUS_STYLES[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {item.phone || "Telefon yok"}
                        {item.email ? ` · ${item.email}` : ""}
                      </p>
                    </div>
                    {actions(item)}
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
                  <option value={6}>6 / sayfa</option>
                  <option value={12}>12 / sayfa</option>
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
      {showRoleManager && (
        <div className="fixed inset-0 z-[85] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  Görevleri Yönet
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Personel görev seçeneklerini kurumunuza göre düzenleyin.
                </p>
              </div>
              <button
                onClick={() => setShowRoleManager(false)}
                className="p-2 text-slate-400 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={saveJobRole}
              className="p-5 border-b border-slate-100 flex gap-2"
            >
              <input
                autoFocus
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                className={`${inputClass} flex-1 bg-white`}
                placeholder="Yeni görev adı"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl"
              >
                {editingRoleId ? "Güncelle" : "Ekle"}
              </button>
            </form>
            <div className="p-3 max-h-72 overflow-y-auto space-y-1">
              {roleOptions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50"
                >
                  <span className="flex-1 text-sm font-semibold text-slate-700">
                    {item.name}
                  </span>
                  <button
                    onClick={() => {
                      setEditingRoleId(item.id);
                      setRoleName(item.name);
                      setRoleError("");
                    }}
                    className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"
                    title="Görevi düzenle"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => removeJobRole(item.id)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg"
                    title="Görevi sil"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            {roleError && (
              <p className="px-5 pb-2 text-xs font-bold text-red-600">
                {roleError}
              </p>
            )}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowRoleManager(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 rounded-xl"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-[80] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={save}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  {editingId ? "Personeli Düzenle" : "Yeni Personel"}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ekip kartı ve sertifika bilgilerini girin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 text-slate-400 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="md:col-span-2 text-xs font-bold text-slate-500">
                Ad soyad
                <input
                  required
                  value={form.fullName}
                  onChange={(e) =>
                    setForm({ ...form, fullName: e.target.value })
                  }
                  className={`${inputClass} mt-1`}
                  placeholder="Örn. Ayşe Demir"
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                Görev
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as TeamRole })
                  }
                  className={`${inputClass} mt-1`}
                >
                  {roleOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500">
                Durum
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as TeamMemberStatus,
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
                Telefon
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="text-xs font-bold text-slate-500">
                E-posta
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} mt-1`}
                />
              </label>
              <label className="md:col-span-2 text-xs font-bold text-slate-500">
                Sertifikalar
                <textarea
                  value={certificateText}
                  onChange={(e) => setCertificateText(e.target.value)}
                  rows={3}
                  className={`${inputClass} mt-1 resize-none`}
                  placeholder={"Temel İlk Yardım | 2027-05-30"}
                />
              </label>
              <div className="md:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-xs font-black text-blue-800">
                  Kullanıcı hesabı ve yetki
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                  <label className="text-xs font-bold text-slate-600">
                    Kullanıcı adı
                    <input
                      value={accountUsername}
                      onChange={(e) => setAccountUsername(e.target.value)}
                      className={`${inputClass} mt-1 bg-white`}
                      autoComplete="off"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Şifre
                    <input
                      type="password"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      className={`${inputClass} mt-1 bg-white`}
                      placeholder={
                        editingId ? "Değiştirmek için girin" : "••••••••"
                      }
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="text-xs font-bold text-slate-600">
                    Yetki rolü
                    <select
                      value={accountRoleId}
                      onChange={(e) => setAccountRoleId(e.target.value)}
                      className={`${inputClass} mt-1 bg-white`}
                    >
                      <option value="">Rol seçin</option>
                      {roles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {accountError && (
                  <p className="text-xs font-bold text-red-600 mt-2">
                    {accountError}
                  </p>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 rounded-xl"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}
      <ConfirmModal
        open={deleteIds.length > 0}
        title={deleteIds.length > 1 ? "Personelleri sil" : "Personeli sil"}
        message={`${deleteIds.length > 1 ? `${deleteIds.length} personel kaydı` : "Bu personel kaydı"} kalıcı olarak silinecek. Devam etmek istiyor musunuz?`}
        onConfirm={remove}
        onCancel={() => setDeleteIds([])}
      />
      {onGoToDashboard && items.length === 0 && (
        <button
          onClick={onGoToDashboard}
          className="text-xs font-bold text-blue-600"
        >
          Dashboard’a dön →
        </button>
      )}
    </div>
  );
};
