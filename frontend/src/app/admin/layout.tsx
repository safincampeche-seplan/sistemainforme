"use client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    // We removed the global ProtectedRoute module="ADMIN" because 
    // sub-pages like /admin/anexo-estadistico need more granular permissions (REVISION_ANEXO)
    // each individual page under /admin should have its own ProtectedRoute if needed.
    return <>{children}</>;
}
