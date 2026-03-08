'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    FileText,
    Download,
    Printer,
    Calendar,
    Building2,
    Table as TableIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';

interface Property {
    id: string;
    column_name: string;
    column_type: string;
}

interface Entity {
    id: string;
    name: string;
    source: string;
    notes: string;
    dependency: {
        name: string;
    };
    properties: Property[];
}

export default function AdminAnexoDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [entity, setEntity] = useState<Entity | null>(null);
    const [rows, setRows] = useState<any[]>([]);
    const [period, setPeriod] = useState("2026");
    const [mounted, setMounted] = useState(false);

    // Esperar hidratación del cliente antes de intentar fetch
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const baseUrl = typeof window !== 'undefined'
                    ? `${window.location.protocol}//${window.location.hostname}:3001`
                    : 'http://localhost:3001';

                // Leer token primero de context, luego de localStorage (ya estamos en cliente)
                const authToken = token || localStorage.getItem('v2_token');
                if (!authToken) {
                    console.error('No hay token disponible. ¿Está la sesión iniciada?');
                    setLoading(false);
                    return;
                }
                const headers: any = { 'Authorization': `Bearer ${authToken}` };

                // 1. Fetch Entity Details
                const entityRes = await fetch(`${baseUrl}/api/entities/${id}`, { headers });
                const entityCt = entityRes.headers.get('content-type') || '';
                if (!entityRes.ok || !entityCt.includes('application/json')) {
                    console.error('Entity fetch failed:', entityRes.status, await entityRes.text());
                    setLoading(false);
                    return;
                }
                const entityData = await entityRes.json();
                setEntity(entityData);

                // 2. Fetch Entries
                const entriesRes = await fetch(`${baseUrl}/api/entries/${id}?periodo=${period}`, { headers });
                const entriesCt = entriesRes.headers.get('content-type') || '';
                if (entriesRes.ok && entriesCt.includes('application/json')) {
                    const entriesData = await entriesRes.json();
                    setRows(Array.isArray(entriesData) ? entriesData : []);
                } else {
                    setRows([]);
                }
            } catch (error) {
                console.error("Error fetching admin anexo detail:", error);
            } finally {
                setLoading(false);
            }
        };

        // Solo ejecutar cuando estemos montados (cliente) y tengamos id
        if (id && mounted) fetchData();
    }, [id, period, token, mounted]);


    const handlePrint = () => {
        window.print();
    };

    const calculateTotal = (propId: string) => {
        const prop = entity?.properties.find(p => p.id === propId);
        if (!prop || (prop.column_type !== 'Decimal' && prop.column_type !== 'Number' && prop.column_type !== 'Integer' && prop.column_type !== 'decimal' && prop.column_type !== 'number' && prop.column_type !== 'integer')) return null;

        const total = rows.reduce((sum, row) => {
            const val = parseFloat(row[propId] || "0");
            return sum + (isNaN(val) ? 0 : val);
        }, 0);

        return total.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    if (loading) {
        return (
            <div className="p-8 space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-[600px] w-full" />
            </div>
        );
    }

    if (!entity) return <div>No se encontró la matriz solicitada.</div>;

    return (
        <ProtectedRoute module="REVISION_ANEXO">
            <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 print:p-0 print:bg-white">
                <div className="flex items-center justify-between mb-8 print:hidden">
                    <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver
                    </Button>
                    <div className="flex gap-3">
                        <Button variant="outline" className="gap-2" onClick={handlePrint}>
                            <Printer className="w-4 h-4" /> Imprimir / PDF
                        </Button>
                    </div>
                </div>

                <Card className="border-none shadow-xl overflow-hidden print:shadow-none print:border">
                    <CardHeader className="bg-white border-b space-y-4 py-8">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="space-y-2">
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 mb-2">
                                    Anexo Estadístico V2
                                </Badge>
                                <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                                    {entity.name}
                                </h1>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4" /> {entity.dependency?.name || "Global"}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" /> Ciclo Informe {period}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b">
                                        {entity.properties.map((prop) => (
                                            <th key={prop.id} className="px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-wider border-r last:border-r-0">
                                                {prop.column_name}
                                            </th>
                                        ))}
                                        <th className="px-6 py-4 text-left font-bold text-slate-700 uppercase tracking-wider">
                                            Observaciones
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {rows.length > 0 ? (
                                        rows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                {entity.properties.map((prop) => (
                                                    <td key={prop.id} className="px-6 py-4 text-slate-600 border-r last:border-r-0">
                                                        {row[prop.id] || "0"}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-4 text-slate-400 italic">
                                                    -
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={(entity.properties?.length || 0) + 1} className="px-6 py-12 text-center text-slate-400">
                                                No hay datos registrados para este periodo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>

                                {rows.length > 0 && (
                                    <tfoot className="bg-slate-50/80 font-bold border-t-2 border-slate-300">
                                        <tr>
                                            {entity.properties.map((prop, idx) => {
                                                const total = calculateTotal(prop.id);
                                                return (
                                                    <td key={prop.id} className="px-6 py-4 text-slate-900 border-r last:border-r-0">
                                                        {total ? `TOT: ${total}` : (idx === 0 ? "TOTALES" : "-")}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-6 py-4"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>

                        <div className="p-8 border-t bg-slate-50/30 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fuente de Información</h4>
                                    <p className="text-sm text-slate-600">{entity.source || "SEPLAN"}</p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Notas</h4>
                                    <p className="text-sm text-slate-600">{entity.notes || "Cifras oficiales de revisión."}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8 flex items-center gap-2 text-blue-600 bg-blue-50 p-4 rounded-lg border border-blue-200 print:hidden">
                    <TableIcon className="w-5 h-5" />
                    <span className="text-sm font-medium">Esta es la vista de reporte oficial generada a partir de sus datos capturados.</span>
                </div>
            </div>
        </ProtectedRoute>
    );
}
