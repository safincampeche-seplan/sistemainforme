"use client";

import React, { useState, useEffect } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TopHeader } from "@/components/TopHeader";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { AccessDenied } from "@/components/AccessDenied";
import {
    UserPlus,
    Search,
    UserCog,
    UserX,
    UserCheck,
    Trash2,
    Shield,
    Mail,
    Building2,
    Loader2,
    UserCircle,
    X,
    Save
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";

interface UserProfile {
    id: number;
    name: string;
    email: string;
    roles: string[];
    dependency: string;
    status: string;
    created_at?: string;
}

export default function UsuariosPage() {
    const { token, user: currentUser } = useAuth();
    const isSuperAdmin = currentUser?.roles?.includes('SuperAdministrador');

    const [users, setUsers] = useState<UserProfile[]>([]);
    const [dependencies, setDependencies] = useState<{ id: number; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const { confirmEl, askConfirm } = useConfirmDialog();

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        roles: ["Capturista"],
        dependency: "",
        dependency_id: "",
        status: "Activo"
    });

    const [notification, setNotification] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "info";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "success"
    });

    const showNotification = (title: string, message: string, type: "success" | "error" | "info" = "success") => {
        setNotification({ isOpen: true, title, message, type });
    };

    const fetchUsers = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
            showNotification("Error", "No se pudo cargar la lista de usuarios", "error");
        } finally {
            setLoading(false);
        }
    };

    const fetchDependencies = async () => {
        if (!token) return;
        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/catalogs/dependencies?periodo=2026`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setDependencies(data.map((d: any) => ({ id: d.id, name: d.nombre || d.name || String(d) })).sort((a, b) => a.name.localeCompare(b.name)));
                }
            }
        } catch (err) {
            console.error("Failed to fetch dependencies", err);
        }
    };

    useEffect(() => {
        if (isSuperAdmin && token) {
            fetchUsers();
            fetchDependencies();
        }
    }, [token, isSuperAdmin]);

    const handleToggleRole = (role: string) => {
        setFormData(prev => {
            const currentRoles = prev.roles || [];
            if (currentRoles.includes(role)) {
                // Don't allow removing the last role
                if (currentRoles.length <= 1) return prev;
                return { ...prev, roles: currentRoles.filter(r => r !== role) };
            } else {
                return { ...prev, roles: [...currentRoles, role] };
            }
        });
    };

    const handleOpenCreateOrEdit = (userToEdit?: UserProfile) => {
        // Asegurar que las dependencias estén cargadas al abrir
        fetchDependencies();

        if (userToEdit) {
            setSelectedUser(userToEdit);
            setFormData({
                name: userToEdit.name,
                email: userToEdit.email,
                password: "", // Don't show password
                roles: userToEdit.roles,
                dependency: userToEdit.dependency,
                dependency_id: "", // ID not stored in UserProfile; backend handles by name on update
                status: userToEdit.status
            });
        } else {
            setSelectedUser(null);
            setFormData({
                name: "",
                email: "",
                password: "",
                roles: ["Capturista"],
                dependency: "",
                dependency_id: "",
                status: "Activo"
            });
        }
        setIsSidePanelOpen(true);
    };

    const handleSaveUser = async () => {
        if (!token) return;

        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const url = selectedUser ? `${baseUrl}/api/users/${selectedUser.id}` : `${baseUrl}/api/users`;
            const method = selectedUser ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                showNotification(
                    "Éxito",
                    `Usuario ${selectedUser ? 'actualizado' : 'creado'} correctamente`,
                    "success"
                );
                setIsSidePanelOpen(false);
                fetchUsers();
            } else {
                const errData = await res.json();
                showNotification("Error", errData.error || "No se pudo guardar el usuario", "error");
            }
        } catch (err) {
            showNotification("Error", "Fallo en la conexión con el servidor", "error");
        }
    };

    const handleToggleStatus = async (userToToggle: UserProfile) => {
        if (!token) return;
        const newStatus = userToToggle.status === 'Activo' ? 'Suspendido' : 'Activo';

        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/users/${userToToggle.id}/status`, {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                fetchUsers();
                showNotification("Estado Actualizado", `El usuario ahora está ${newStatus}`, "info");
            }
        } catch (err) {
            showNotification("Error", "No se pudo cambiar el estado", "error");
        }
    };

    const handleDeleteUser = async (userToDelete: UserProfile) => {
        if (!token) return;

        const confirmed = await askConfirm({
            title: "¿Eliminar Usuario?",
            message: `¿Estás seguro de eliminar permanentemente a ${userToDelete.name}? Esta acción revocará todos sus accesos de forma definitiva.`,
            confirmLabel: "Eliminar",
            variant: "danger"
        });

        if (!confirmed) return;

        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/users/${userToDelete.id}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (res.ok) {
                fetchUsers();
                showNotification("Eliminado", "Usuario eliminado correctamente", "success");
            }
        } catch (err) {
            showNotification("Error", "No se pudo eliminar el usuario", "error");
        }
    };


    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    const filtrados = users.filter(u =>
        (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (u.email?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (u.dependency?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    );

    const totalPages = Math.ceil(filtrados.length / itemsPerPage);
    const paginados = filtrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Reset pagination on search
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    if (!isSuperAdmin) return <AccessDenied />;

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950">
            <TopHeader title="Gestión de Usuarios" />

            <main className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                        <Input
                            placeholder="Buscar por nombre, correo o dependencia..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => handleOpenCreateOrEdit()} className="bg-guinda-600 hover:bg-guinda-700">
                        <UserPlus className="mr-2 size-4" /> Nuevo Usuario
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Usuarios del Sistema</CardTitle>
                        <CardDescription>
                            Administra las identidades, roles y estados de acceso de los colaboradores.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                                <Loader2 className="size-12 animate-spin text-guinda-600" />
                                <p className="text-slate-500">Cargando lista de usuarios...</p>
                            </div>
                        ) : (
                            <>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50 dark:bg-slate-900">
                                                <TableHead className="w-[300px]">Usuario</TableHead>
                                                <TableHead>Dependencia</TableHead>
                                                <TableHead>Rol Principal</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginados.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                                        No se encontraron usuarios.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                paginados.map((u) => (
                                                    <TableRow key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <div className="size-10 rounded-full bg-guinda-100 dark:bg-guinda-900/30 flex items-center justify-center text-guinda-600 font-bold">
                                                                    {u.name?.charAt(0).toUpperCase() || "U"}
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium">{u.name || "Sin nombre"}</span>
                                                                    <span className="text-xs text-slate-500">{u.email}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center text-slate-600 dark:text-slate-400">
                                                                <Building2 className="size-3 mr-2" />
                                                                {u.dependency || "No asignada"}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1">
                                                                {u.roles.map(r => (
                                                                    <Badge key={r} variant="outline" className="text-[10px] py-0">
                                                                        {r}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={u.status === 'Activo' ? 'outline' : 'destructive'}
                                                                className={`text-[10px] uppercase font-bold ${u.status === 'Activo' ? 'border-green-500 text-green-600' : ''}`}
                                                            >
                                                                {u.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleToggleStatus(u)}
                                                                    title={u.status === 'Activo' ? 'Suspender cuenta' : 'Reactivar cuenta'}
                                                                >
                                                                    {u.status === 'Activo' ? <UserX className="size-4 text-orange-500" /> : <UserCheck className="size-4 text-green-500" />}
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleOpenCreateOrEdit(u)}
                                                                >
                                                                    <UserCog className="size-4 text-guinda-600" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteUser(u)}
                                                                >
                                                                    <Trash2 className="size-4 text-slate-400 hover:text-red-500" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4">
                                        <p className="text-sm text-slate-500">
                                            Mostrando página {currentPage} de {totalPages} ({filtrados.length} usuarios)
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                                disabled={currentPage === 1}
                                            >
                                                Anterior
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={currentPage === totalPages}
                                            >
                                                Siguiente
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* Side Panel (Drawer) for Edit/Create */}
            {isSidePanelOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full md:w-[450px] h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-6 border-b flex justify-between items-center bg-guinda-50 dark:bg-guinda-900/20">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <UserCircle className="text-guinda-600" />
                                    {selectedUser ? "Editar Usuario" : "Crear Nuevo Usuario"}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {selectedUser ? "Actualiza los datos del colaborador." : "Ingresa los datos para el nuevo acceso."}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsSidePanelOpen(false)}>
                                <X className="size-5" />
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="space-y-4">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <UserCircle className="size-4 text-slate-400" /> Nombre Completo
                                </label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Ej. Juan Pérez"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Mail className="size-4 text-slate-400" /> Correo Electrónico
                                </label>
                                <Input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="juan.perez@seplan.gob.mx"
                                    disabled={!!selectedUser}
                                />
                                {selectedUser && <p className="text-[10px] text-slate-500 italic">El correo no puede ser modificado por integridad de logs.</p>}
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Shield className="size-4 text-slate-400" /> Contraseña {selectedUser && "(Dejar vacío para no cambiar)"}
                                </label>
                                <Input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <Building2 className="size-4 text-slate-400" /> Dependencia
                                </label>
                                <Select
                                    value={formData.dependency_id}
                                    onValueChange={(v) => {
                                        const dep = dependencies.find(d => String(d.id) === v);
                                        setFormData({ ...formData, dependency_id: v, dependency: dep?.name || v });
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona dependencia" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {dependencies.length > 0 ? (
                                            dependencies.map(dep => (
                                                <SelectItem key={dep.id} value={String(dep.id)}>{dep.name}</SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="">Cargando catálogo...</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-4">
                                <label className="text-sm font-medium flex items-center gap-2">
                                    <UserCog className="size-4 text-slate-400" /> Roles en el Sistema
                                </label>
                                <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-slate-50 dark:bg-slate-900/50">
                                    {["Capturista", "Validador", "Administrador", "SuperAdministrador", "SECONT", "SAFIN"].map((role) => {
                                        const isSelected = formData.roles.includes(role);
                                        return (
                                            <Badge
                                                key={role}
                                                variant={isSelected ? "default" : "outline"}
                                                className={`cursor-pointer px-3 py-1 text-xs transition-all ${isSelected
                                                    ? "bg-guinda-600 hover:bg-guinda-700 text-white shadow-sm"
                                                    : "hover:border-guinda-300 hover:text-guinda-600 bg-white dark:bg-slate-900"
                                                    }`}
                                                onClick={() => handleToggleRole(role)}
                                            >
                                                {role}
                                            </Badge>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-slate-500 italic">
                                    Haz clic para seleccionar o deseleccionar. Un usuario puede tener múltiples roles.
                                </p>
                            </div>

                            <div className="pt-4 border-t flex gap-3">
                                <Button className="flex-1 bg-guinda-600 hover:bg-guinda-700" onClick={handleSaveUser}>
                                    <Save className="mr-2 size-4" /> Guardar Cambios
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={() => setIsSidePanelOpen(false)}>
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <NotificationModal
                {...notification}
                onClose={() => setNotification({ ...notification, isOpen: false })}
            />
            {confirmEl}
        </div>
    );
}
