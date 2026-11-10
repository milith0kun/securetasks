"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Search,
  Trash2,
  Edit2,
  LogOut,
  User as UserIcon,
  Users,
  BarChart3,
  FileText,
  KeyRound,
  Filter,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "estudiante" | "docente" | "administrador";
  createdAt: string;
}

interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "pendiente" | "en_progreso" | "completada";
  userId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditLogItem {
  id: string;
  action: string;
  userId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  user?: {
    name: string;
    email: string;
  } | null;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "estudiante" | "docente" | "administrador";
  createdAt: string;
  _count: { tasks: number };
}

interface TeacherSummaryData {
  teacher: {
    id: string;
    name: string;
    myTasks: { total: number; pendiente: number; en_progreso: number; completada: number };
  };
  studentsMetrics: {
    totalStudents: number;
    totalTasks: number;
    pendiente: number;
    en_progreso: number;
    completada: number;
  };
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "teacher" | "admin" | "audit" | "profile">("tasks");

  // Tareas
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modal nueva / editar tarea
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", status: "pendiente" });

  // Docente
  const [teacherData, setTeacherData] = useState<TeacherSummaryData | null>(null);

  // Admin
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Perfil
  const [profileForm, setProfileForm] = useState({ currentPassword: "", newPassword: "" });
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // 1. Cargar usuario actual
  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // 2. Cargar tareas
  const loadTasks = useCallback(async () => {
    if (!currentUser) return;
    setLoadingTasks(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (statusFilter !== "todas") params.append("status", statusFilter);

      const res = await fetch(`/api/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTasks(false);
    }
  }, [currentUser, search, statusFilter]);

  useEffect(() => {
    if (currentUser) {
      loadTasks();
    }
  }, [currentUser, loadTasks]);

  // 3. Cargar datos de docente
  const loadTeacher = useCallback(async () => {
    if (currentUser?.role === "docente" || currentUser?.role === "administrador") {
      try {
        const res = await fetch("/api/teacher/summary");
        if (res.ok) {
          const data = await res.json();
          setTeacherData(data);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUser]);

  // 4. Cargar datos de admin
  const loadAdmin = useCallback(async () => {
    if (currentUser?.role === "administrador") {
      try {
        const [resUsers, resLogs] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/audit-logs"),
        ]);
        if (resUsers.ok) {
          const u = await resUsers.json();
          setAdminUsers(u.users || []);
        }
        if (resLogs.ok) {
          const l = await resLogs.json();
          setAuditLogs(l.logs || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === "teacher") loadTeacher();
    if (activeTab === "admin" || activeTab === "audit") loadAdmin();
  }, [activeTab, loadTeacher, loadAdmin]);

  // Manejar creación / edición de tarea
  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    try {
      if (editingTask) {
        const res = await fetch(`/api/tasks/${editingTask.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskForm),
        });
        if (res.ok) {
          setModalOpen(false);
          setEditingTask(null);
          loadTasks();
        }
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskForm),
        });
        if (res.ok) {
          setModalOpen(false);
          setTaskForm({ title: "", description: "", status: "pendiente" });
          loadTasks();
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm("Esta seguro de eliminar esta tarea?")) return;
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) loadAdmin();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg("Contrasena actualizada con exito");
        setProfileForm({ currentPassword: "", newPassword: "" });
      } else {
        setProfileMsg(data.error || "Error al actualizar clave");
      }
    } catch {
      setProfileMsg("Error de conexion");
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        Verificando credenciales del sistema...
      </div>
    );
  }

  // Vista no autenticada: Landing y acceso
  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-50 text-slate-900">
        <header className="border-b border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-600 text-white rounded-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="font-bold text-xl tracking-tight">SecureTasks</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition"
              >
                Iniciar Sesion
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-16 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" /> Arquitectura de Software Seguro y Defensas en Profundidad
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Gestion de Tareas con Seguridad de Grado Empresarial
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Plataforma desarrollada con Next.js App Router, PostgreSQL y Prisma ORM. Proteccion nativa contra SQL Injection, IDOR, XSS, elevacion de privilegios y fuerza bruta con hashing criptografico Argon2id.
          </p>

          <div className="flex justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              Acceder al Sistema
            </Link>
            <Link
              href="/register"
              className="px-6 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg shadow-sm transition"
            >
              Crear Cuenta Estudiante
            </Link>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 pt-12 text-left">
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Contrasenas Argon2id</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Derivacion de claves con algoritmo RFC 9106 Argon2id, memoria dedicada y resistencia ante ataques paralelos por GPU.
              </p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Control RBAC & Anti-IDOR</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Verificacion de propiedad en capa de backend para estudiantes, docentes y administradores sin fuga de objetos directos.
              </p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Auditoria Inmutable</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Registro minucioso de cada evento de seguridad y operacion CRUD sin almacenar contraseñas ni tokens en texto plano.
              </p>
            </div>
          </div>
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          SecureTasks &copy; 2026. Proyecto de Ingenieria de Software Seguro — UNSAAC.
        </footer>
      </div>
    );
  }

  // Vista autenticada: Panel principal
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header superior */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight">SecureTasks</span>
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-mono uppercase bg-slate-100 text-slate-700 border border-slate-200">
                {currentUser.role}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800">{currentUser.name}</p>
              <p className="text-[11px] text-slate-500">{currentUser.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Cerrar Sesion"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de pestañas */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-slate-100 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab("tasks")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "tasks"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Mis Tareas
          </button>

          {(currentUser.role === "docente" || currentUser.role === "administrador") && (
            <button
              onClick={() => setActiveTab("teacher")}
              className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                activeTab === "teacher"
                  ? "border-blue-600 text-blue-600 font-bold"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Resumen Docente
            </button>
          )}

          {currentUser.role === "administrador" && (
            <>
              <button
                onClick={() => setActiveTab("admin")}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === "admin"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="w-4 h-4" /> Administracion de Usuarios
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
                  activeTab === "audit"
                    ? "border-blue-600 text-blue-600 font-bold"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4" /> Registros de Auditoria
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab("profile")}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === "profile"
                ? "border-blue-600 text-blue-600 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserIcon className="w-4 h-4" /> Perfil y Seguridad
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* PESTAÑA: TAREAS */}
        {activeTab === "tasks" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {currentUser.role === "administrador" ? "Todas las Tareas del Sistema" : "Mis Tareas"}
                </h2>
                <p className="text-xs text-slate-500">
                  Control de actividades con verificacion estricta de propiedad (Anti-IDOR).
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({ title: "", description: "", status: "pendiente" });
                  setModalOpen(true);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition"
              >
                <Plus className="w-4 h-4" /> Nueva Tarea
              </button>
            </div>

            {/* Filtros y búsqueda */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-center">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por titulo o descripcion..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
                {["todas", "pendiente", "en_progreso", "completada"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize transition ${
                      statusFilter === st
                        ? "bg-slate-900 text-white font-medium"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista de tareas */}
            {loadingTasks ? (
              <div className="text-center py-12 text-xs text-slate-400">Cargando tareas seguras...</div>
            ) : tasks.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-xl py-12 text-center text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold">No se encontraron tareas</p>
                <p className="text-xs text-slate-400 mt-1">Crea una nueva tarea para comenzar el seguimiento.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition"
                  >
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                            task.status === "completada"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : task.status === "en_progreso"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingTask(task);
                              setTaskForm({
                                title: task.title,
                                description: task.description,
                                status: task.status,
                              });
                              setModalOpen(true);
                            }}
                            className="p-1 text-slate-400 hover:text-blue-600 transition"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 leading-snug break-words">
                        {task.title}
                      </h3>
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed break-words whitespace-pre-wrap">
                        {task.description || "Sin descripcion adicional."}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[11px] text-slate-400">
                      <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                      {task.user && (
                        <span className="font-medium text-slate-600">
                          {task.userId === currentUser.id ? "Por ti" : task.user.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: RESUMEN DOCENTE */}
        {activeTab === "teacher" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Modulo de Supervision Docente
              </h2>
              <p className="text-xs text-slate-500">
                Metricas consolidadas del avance academico y gestion de actividades.
              </p>
            </div>

            {teacherData && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Total Estudiantes</p>
                    <p className="text-2xl font-extrabold text-blue-600 mt-1">
                      {teacherData.studentsMetrics.totalStudents}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Tareas Estudiantes</p>
                    <p className="text-2xl font-extrabold text-slate-900 mt-1">
                      {teacherData.studentsMetrics.totalTasks}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Tareas en Progreso</p>
                    <p className="text-2xl font-extrabold text-amber-600 mt-1">
                      {teacherData.studentsMetrics.en_progreso}
                    </p>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase">Tareas Completadas</p>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                      {teacherData.studentsMetrics.completada}
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-sm text-slate-900">
                    Progreso General de Actividades Estudiantiles
                  </h3>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${
                          teacherData.studentsMetrics.totalTasks > 0
                            ? (teacherData.studentsMetrics.completada /
                                teacherData.studentsMetrics.totalTasks) *
                              100
                            : 0
                        }%`,
                      }}
                      title="Completadas"
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{
                        width: `${
                          teacherData.studentsMetrics.totalTasks > 0
                            ? (teacherData.studentsMetrics.en_progreso /
                                teacherData.studentsMetrics.totalTasks) *
                              100
                            : 0
                        }%`,
                      }}
                      title="En progreso"
                    />
                    <div
                      className="bg-slate-300 h-full"
                      style={{
                        width: `${
                          teacherData.studentsMetrics.totalTasks > 0
                            ? (teacherData.studentsMetrics.pendiente /
                                teacherData.studentsMetrics.totalTasks) *
                              100
                            : 0
                        }%`,
                      }}
                      title="Pendientes"
                    />
                  </div>
                  <div className="flex gap-4 text-xs text-slate-600 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-emerald-500 rounded-sm" /> Completadas (
                      {teacherData.studentsMetrics.completada})
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-amber-400 rounded-sm" /> En Progreso (
                      {teacherData.studentsMetrics.en_progreso})
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 bg-slate-300 rounded-sm" /> Pendientes (
                      {teacherData.studentsMetrics.pendiente})
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA: ADMINISTRACIÓN DE USUARIOS */}
        {activeTab === "admin" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Gestion de Usuarios y Asignacion de Roles
              </h2>
              <p className="text-xs text-slate-500">
                Administracion centralizada con proteccion contra elevacion indebida de privilegios.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Correo</th>
                      <th className="py-3 px-4">Rol Asignado</th>
                      <th className="py-3 px-4">Tareas</th>
                      <th className="py-3 px-4">Registro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{u.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={u.id === currentUser.id}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 font-medium"
                          >
                            <option value="estudiante">Estudiante</option>
                            <option value="docente">Docente</option>
                            <option value="administrador">Administrador</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">{u._count?.tasks || 0}</td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: AUDITORÍA */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Trazabilidad y Registros de Auditoria
              </h2>
              <p className="text-xs text-slate-500">
                Pista de auditoria de operaciones criticas y eventos de seguridad.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-3 px-4">Accion</th>
                      <th className="py-3 px-4">Usuario</th>
                      <th className="py-3 px-4">Direccion IP</th>
                      <th className="py-3 px-4">Detalles</th>
                      <th className="py-3 px-4">Fecha y Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                              log.action.includes("FAIL") || log.action.includes("BLOCKED")
                                ? "bg-red-50 text-red-700"
                                : log.action.includes("SUCCESS")
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-700">
                          {log.user ? `${log.user.name} (${log.user.email})` : "Anonimo / Sistema"}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-500">{log.ipAddress || "—"}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                          {log.details || "—"}
                        </td>
                        <td className="py-2.5 px-4 text-slate-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA: PERFIL */}
        {activeTab === "profile" && (
          <div className="max-w-xl space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Perfil y Seguridad</h2>
              <p className="text-xs text-slate-500">
                Informacion de tu cuenta y actualizacion de credenciales.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Datos de Usuario</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Nombre:</span>
                  <p className="font-semibold text-slate-800">{currentUser.name}</p>
                </div>
                <div>
                  <span className="text-slate-400">Correo:</span>
                  <p className="font-semibold text-slate-800 font-mono">{currentUser.email}</p>
                </div>
                <div>
                  <span className="text-slate-400">Rol:</span>
                  <p className="font-semibold text-slate-800 uppercase">{currentUser.role}</p>
                </div>
                <div>
                  <span className="text-slate-400">Fecha de Alta:</span>
                  <p className="font-semibold text-slate-800">
                    {new Date(currentUser.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-slate-600" /> Cambiar Contrasena
              </h3>

              {profileMsg && (
                <div className="p-3 text-xs bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                  {profileMsg}
                </div>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 font-medium mb-1">
                    Contrasena Actual
                  </label>
                  <input
                    type="password"
                    required
                    value={profileForm.currentPassword}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, currentPassword: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-600 font-medium mb-1">
                    Nueva Contrasena (Min. 8 caracteres, mayuscula, numero, simbolo)
                  </label>
                  <input
                    type="password"
                    required
                    value={profileForm.newPassword}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, newPassword: e.target.value })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition"
                >
                  Actualizar Clave
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* MODAL CREAR / EDITAR TAREA */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-200 shadow-xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              {editingTask ? "Editar Tarea" : "Nueva Tarea"}
            </h3>

            <form onSubmit={handleSaveTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Titulo</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="Ej: Auditoria de vulnerabilidades"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Descripcion</label>
                <textarea
                  rows={3}
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Detalles y requerimientos de la tarea..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Estado</label>
                <select
                  value={taskForm.status}
                  onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_progreso">En Progreso</option>
                  <option value="completada">Completada</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
                >
                  Guardar Tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
