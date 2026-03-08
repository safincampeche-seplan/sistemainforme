'use client';

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopHeader } from "@/components/TopHeader";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    BookOpen,
    Layers,
    MapPin,
    Calendar,
    FileText,
    ArrowRight,
    Loader2,
    Settings,
    Coins,
    Target,
    Users,
    Flag,
    Type,
    Tag,
    Hash,
    Building2
} from "lucide-react";

const CATALOG_METADATA: Record<string, { label: string, description: string, icon: any, color: string }> = {
    'sectors': {
        label: 'Sectores',
        description: 'Gestión de sectores económicos y sociales.',
        icon: BookOpen,
        color: 'text-blue-500 bg-blue-50'
    },
    'ppas-types': {
        label: 'Tipos de PPA',
        description: 'Categorización de los programas presupuestales.',
        icon: Layers,
        color: 'text-purple-500 bg-purple-50'
    },
    'locations': {
        label: 'Localidades',
        description: 'Municipios y poblaciones del estado.',
        icon: MapPin,
        color: 'text-emerald-500 bg-emerald-50'
    },
    'periods': {
        label: 'Periodos de Captura',
        description: 'Administración de ciclos y cierres.',
        icon: Calendar,
        color: 'text-amber-500 bg-amber-50'
    },
    'format-types': {
        label: 'Tipos de Formato',
        description: 'Estructuras de captura permitidas.',
        icon: FileText,
        color: 'text-rose-500 bg-rose-50'
    },
    'budget-programs': {
        label: 'Programas Presupuestarios',
        description: 'Catálogo de programas presupuestales vigentes.',
        icon: Target,
        color: 'text-indigo-500 bg-indigo-50'
    },
    'financing-sources': {
        label: 'Fuentes de Financiamiento',
        description: 'Orígenes de recursos para los proyectos.',
        icon: Coins,
        color: 'text-yellow-500 bg-yellow-50'
    },
    'axis': {
        label: 'Ejes Transversales',
        description: 'Ejes estratégicos de la administración.',
        icon: Hash,
        color: 'text-cyan-500 bg-cyan-50'
    },
    'dependencies': {
        label: 'Dependencias',
        description: 'Instituciones y dependencias oficiales.',
        icon: Building2,
        color: 'text-slate-500 bg-slate-100' // Building2 will be added to imports
    },
    'beneficiary-types': {
        label: 'Tipos de Beneficiario',
        description: 'Categorización de población beneficiada.',
        icon: Users,
        color: 'text-orange-500 bg-orange-50'
    },
    'missions': {
        label: 'Misiones (PED)',
        description: 'Ejes principales del Plan Estatal de Desarrollo.',
        icon: Flag,
        color: 'text-guinda-600 bg-guinda-50'
    },
    'narrative-titles': {
        label: 'Títulos de Narrativa',
        description: 'Catálogo de títulos para las capturas.',
        icon: Type,
        color: 'text-pink-500 bg-pink-50'
    },
    'narrative-themes': {
        label: 'Temas de Narrativa',
        description: 'Clasificación temática de las narrativas.',
        icon: Tag,
        color: 'text-violet-500 bg-violet-50'
    },
    'narrative-subthemes': {
        label: 'Subtemas de Narrativa',
        description: 'Sub-clasificación detallada de temas.',
        icon: Tag,
        color: 'text-purple-500 bg-purple-50'
    }
};

export default function CatalogosPage() {
    const { token } = useAuth();
    const router = useRouter();
    const [catalogs, setCatalogs] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCatalogs = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/admin/catalogs-list`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setCatalogs(data);
                }
            } catch (error) {
                console.error("Error fetching catalogs list:", error);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchCatalogs();
    }, [token]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-guinda-600" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <TopHeader title="Gestión de Catálogos" />

            <main className="p-6 md:p-10 max-w-6xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-guinda-600 mb-2">
                            <div className="bg-guinda-100 p-2 rounded-xl">
                                <Settings className="h-6 w-6" />
                            </div>
                            <span className="font-black uppercase tracking-widest text-sm">Administración</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Catálogos del Sistema</h1>
                        <p className="text-slate-500 font-medium max-w-2xl">
                            Administra los datos maestros que alimentan el Universo de Captura y el Anexo Estadístico.
                        </p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {catalogs.map((slug) => {
                        const meta = CATALOG_METADATA[slug] || {
                            label: slug,
                            description: 'Gestión de datos del catálogo.',
                            icon: Layers,
                            color: 'text-slate-500 bg-slate-50'
                        };
                        const Icon = meta.icon;

                        return (
                            <Card
                                key={slug}
                                className="border-none shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all rounded-3xl cursor-pointer group overflow-hidden"
                                onClick={() => router.push(`/admin/catalogos/${slug}`)}
                            >
                                <CardContent className="p-6 h-full flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <div className={`p-4 rounded-2xl w-fit ${meta.color}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-black text-slate-900 group-hover:text-guinda-600 transition-colors">
                                                {meta.label}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                                {meta.description}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-6 flex items-center justify-between text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-guinda-600 transition-colors">
                                        <span>Gestionar</span>
                                        <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                <div className="bg-amber-50/50 border border-amber-100 p-6 rounded-3xl flex gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl h-fit">
                        <Layers className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                        <h4 className="text-sm font-black text-amber-900 mb-1 tracking-tight uppercase">Control de Integridad</h4>
                        <p className="text-xs text-amber-700 font-medium leading-relaxed">
                            Los cambios en los catálogos se reflejan automáticamente en los formularios de captura. Tenga precaución al eliminar elementos que ya podrían estar vinculados a narrativas existentes.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
