"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { TopHeader } from "@/components/TopHeader";
import { Sparkles, Save, ChevronRight, ChevronLeft, MapPin, Target, BookOpen, Loader2, CheckCircle2, Plus, Trash2, AlertTriangle, ShieldCheck } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { NotificationModal } from "@/components/ui/notification-modal";
import { useSearchParams } from "next/navigation";

export default function CapturaNarrativa() {
    return (
        <Suspense fallback={<div className="p-20 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto text-guinda-600" /></div>}>
            <CapturaNarrativaContent />
        </Suspense>
    );
}

function CapturaNarrativaContent() {
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');
    const { token, selectedPeriod, user } = useAuth();

    const [savedStatus, setSavedStatus] = useState<string>('');
    const isReviewMode = !!editId && user?.roles?.some(r => ['SAFIN', 'SECONT', 'Validador'].includes(r));
    const currentYear = (() => {
        const p = selectedPeriod as any;
        if (typeof p === 'string' && p.includes('-')) return parseInt(p.split('-')[0]) || 2024;
        return parseInt(p) || 2024;
    })();
    const isReadOnly = (currentYear < 2026) || isReviewMode || (savedStatus !== '' && savedStatus !== 'Borrador' && user?.roles?.includes('Capturista'));
    const [step, setStep] = useState(1);
    const [showAllMissions, setShowAllMissions] = useState(false);
    const [isDbOnline, setIsDbOnline] = useState(true);
    const [submittingAI, setSubmittingAI] = useState(false);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [savedIds, setSavedIds] = useState<number[]>([]);
    const [ppaSearchLoading, setPpaSearchLoading] = useState(false);
    const [suggestedPpas, setSuggestedPpas] = useState<any[]>([]);
    const [showPpaSearch, setShowPpaSearch] = useState(false);
    // Multi-PPA: array of selected PPAs { name, clave, tipo_ppa, monto, beneficiarios }
    const [selectedPpas, setSelectedPpas] = useState<any[]>([]);
    // Dependency-based filter: only show titles/themes that the user's dependency has PPAs for
    const [depFilter, setDepFilter] = useState<{
        allowedTitleIds: string[];
        allowedTemasByTitulo: Record<string, string[]>;
        allowedSubtemasByTema: Record<string, string[]>;
    } | null>(null);

    // Notification State
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

    // Dynamic Catalogs
    const [catalogs, setCatalogs] = useState<{
        titles: any[],
        themes: any[],
        subthemes: any[],
        financing: any[],
        ods: any[],
        missions: any[],
        pedObjectives: any[],
        pedStrategies: any[],
        pedActionLines: any[],
        ppas: any[],
        ppasTypes: any[],
        budgetPrograms: any[],
        municipalities: any[],
        localitiesByMun: Record<string, any[]>
    }>({ titles: [], themes: [], subthemes: [], financing: [], ods: [], missions: [], pedObjectives: [], pedStrategies: [], pedActionLines: [], ppas: [], ppasTypes: [], budgetPrograms: [], municipalities: [], localitiesByMun: {} });

    // State for all fields
    const [formData, setFormData] = useState({
        ppa_name: "",
        investment_amount: "",
        beneficiaries: "",
        narrative_breakdown: "",
        highlighted: "",
        mission_id: "",
        type_id: "",
        new_ppa_name: "",
        title_id: "",
        theme_id: "",
        subtheme_id: "",
        beneficiary_type_id: "",
        budget_program_id: "",
        custom_budget_program: "",
        locations: [] as any[],
        peds: [] as any[],
        ods_ids: [] as string[]
    });

    useEffect(() => {
        const fetchCatalogs = async () => {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const headers = { "Authorization": `Bearer ${token}` };
            const query = `?periodo=${selectedPeriod}`;
            try {
                const fetchWithCheck = async (url: string) => {
                    const res = await fetch(url, { headers });
                    if (!res.ok) {
                        const text = await res.text();
                        console.error(`Fetch failed for ${url}: ${res.status}`, text.substring(0, 100));
                        return [];
                    }
                    return res.json();
                };

                const [t, o, m, pObj, pStr, pAct, ty, bp, mun] = await Promise.all([
                    fetchWithCheck(`${baseUrl}/api/catalogs/narrative-titles${query}`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ods${query}`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ped/missions${query}`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ped/objectives`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ped/strategies`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ped/action-lines`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/ppas-types`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/budget-programs${query}`),
                    fetchWithCheck(`${baseUrl}/api/catalogs/municipalities`),
                ]);

                // Fetch themes if title is already selected (on edit)
                let initialThemes = [];
                if (formData.title_id) {
                    initialThemes = await fetch(`${baseUrl}/api/catalogs/narrative-themes${query}&title_id=${formData.title_id}`, { headers }).then(r => r.json());
                }

                // Fetch subthemes if theme is already selected (on edit)
                let initialSubthemes = [];
                if (formData.theme_id) {
                    initialSubthemes = await fetch(`${baseUrl}/api/catalogs/narrative-subthemes${query}&theme_id=${formData.theme_id}`, { headers }).then(r => r.json());
                }

                // Auto-preselect classification based on the user's dependency (only for new forms)
                if (!editId && !formData.title_id) {
                    try {
                        const defRes = await fetch(`${baseUrl}/api/catalogs/default-classification`, { headers });
                        if (defRes.ok) {
                            const def = await defRes.json();
                            if (def.found && def.title_id) {
                                // Load themes for the default title
                                initialThemes = await fetch(`${baseUrl}/api/catalogs/narrative-themes${query}&title_id=${def.title_id}`, { headers }).then(r => r.json()).catch(() => []);
                                // Load subthemes for the default theme
                                if (def.theme_id) {
                                    initialSubthemes = await fetch(`${baseUrl}/api/catalogs/narrative-subthemes${query}&theme_id=${def.theme_id}`, { headers }).then(r => r.json()).catch(() => []);
                                }
                                // Pre-populate formData with the defaults
                                setFormData(prev => ({
                                    ...prev,
                                    title_id: def.title_id || prev.title_id,
                                    theme_id: def.theme_id || prev.theme_id,
                                    subtheme_id: def.subtheme_id || prev.subtheme_id,
                                }));
                                // Store dependency filter so dropdowns only show allowed options
                                if (def.allowedTitleIds?.length > 0) {
                                    setDepFilter({
                                        allowedTitleIds: def.allowedTitleIds,
                                        allowedTemasByTitulo: def.allowedTemasByTitulo || {},
                                        allowedSubtemasByTema: def.allowedSubtemasByTema || {},
                                    });
                                }
                                console.log(`Auto-preselected classification for dep "${def.depName}": ${def.defaultTitulo} > ${def.defaultTema} > ${def.defaultSubtema}`);
                            }
                        }
                    } catch (defErr) {
                        console.warn("Could not load default classification:", defErr);
                    }
                }

                setCatalogs(prev => ({
                    ...prev,
                    titles: Array.isArray(t) ? t : [],
                    themes: Array.isArray(initialThemes) ? initialThemes : [],
                    subthemes: Array.isArray(initialSubthemes) ? initialSubthemes : [],
                    ods: Array.isArray(o) ? o : [],
                    missions: Array.isArray(m) ? m : [],
                    pedObjectives: Array.isArray(pObj) ? pObj : [],
                    pedStrategies: Array.isArray(pStr) ? pStr : [],
                    pedActionLines: Array.isArray(pAct) ? pAct : [],
                    ppasTypes: Array.isArray(ty) ? ty : [],
                    budgetPrograms: Array.isArray(bp) ? bp : [],
                    ppas: prev.ppas || [],
                    municipalities: Array.isArray(mun) ? mun : [],
                    localitiesByMun: prev.localitiesByMun || {}
                }));
            } catch (err) { console.error("Error fetching catalogs", err); }
        };
        if (token) fetchCatalogs();
    }, [token, selectedPeriod]);

    const [validatorComment, setValidatorComment] = useState("");

    useEffect(() => {
        if (!token || !editId) return;
        const fetchExisting = async () => {
            try {
                const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
                const headers = { "Authorization": `Bearer ${token}` };
                const res = await fetch(`${baseUrl}/api/tracking/narrativa/${editId}?periodo=${selectedPeriod}`, { headers });
                if (res.ok) {
                    const detail = await res.json();
                    setSavedStatus(detail.status || '');

                    // Fetch themes and subthemes for the loaded record to ensure dropdowns are populated
                    const t_id = (detail.narrative_title_id || detail.title_id)?.toString() || "";
                    const th_id = (detail.narrative_theme_id || detail.theme_id)?.toString() || "";
                    const sth_id = (detail.narrative_sub_theme_id || detail.subtheme_id)?.toString() || "";

                    if (t_id) {
                        fetch(`${baseUrl}/api/catalogs/narrative-themes?periodo=${selectedPeriod}&title_id=${t_id}`, { headers })
                            .then(r => r.json())
                            .then(themes => setCatalogs(prev => ({ ...prev, themes: Array.isArray(themes) ? themes : [] })))
                            .catch(err => console.error("Error fetching themes for edit:", err));
                    }
                    if (th_id) {
                        fetch(`${baseUrl}/api/catalogs/narrative-subthemes?periodo=${selectedPeriod}&theme_id=${th_id}`, { headers })
                            .then(r => r.json())
                            .then(subthemes => setCatalogs(prev => ({ ...prev, subthemes: Array.isArray(subthemes) ? subthemes : [] })))
                            .catch(err => console.error("Error fetching subthemes for edit:", err));
                    }

                    setFormData({
                        ppa_name: detail.ppa_name || "",
                        investment_amount: detail.investment_amount?.toString() || "",
                        beneficiaries: detail.beneficiaries?.toString() || "",
                        narrative_breakdown: detail.narrative_breakdown || "",
                        highlighted: detail.highlighted || "",
                        mission_id: detail.mission_id?.toString() || "",
                        type_id: detail.ppas_type_id?.toString() || "",
                        new_ppa_name: detail.new_ppa_name || "",
                        title_id: t_id,
                        theme_id: th_id,
                        subtheme_id: sth_id,
                        beneficiary_type_id: (detail.narrative_beneficiary_type_id || detail.beneficiary_type_id)?.toString() || "",
                        budget_program_id: detail.budget_program_id?.toString() || (detail.custom_budget_program ? "manual" : ""),
                        custom_budget_program: detail.custom_budget_program || "",
                        locations: (detail.locations || []).map((l: any) => ({
                            municipality_id: l.municipality_id?.toString(),
                            locality_id: l.locality_id?.toString()
                        })),
                        peds: detail.peds || [],
                        ods_ids: detail.ods_ids || []
                    });

                    // In edit mode, populate the selectedPpas array with the single PPA
                    if (detail.ppa_name) {
                        setSelectedPpas([
                            {
                                name: detail.ppa_name,
                                monto: detail.investment_amount,
                                beneficiarios: detail.beneficiaries,
                                programa_presupuestario: detail.budget_program_id
                            }
                        ]);
                    }


                    // Fetch dependent catalogs explicitly on edit load
                    if (t_id) {
                        fetch(`${baseUrl}/api/catalogs/narrative-themes?periodo=${selectedPeriod}&title_id=${t_id}`, { headers })
                            .then(r => r.json())
                            .then(themes => setCatalogs(prev => ({ ...prev, themes })));
                    }
                    if (th_id) {
                        fetch(`${baseUrl}/api/catalogs/narrative-subthemes?periodo=${selectedPeriod}&theme_id=${th_id}`, { headers })
                            .then(r => r.json())
                            .then(subthemes => setCatalogs(prev => ({ ...prev, subthemes })));
                    }
                    if (detail.status === 'Observado' && detail.validator_comment) {
                        setValidatorComment(detail.validator_comment);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch existing record", error);
            }
        };
        fetchExisting();
    }, [token, editId, selectedPeriod]);

    const handleInputChange = async (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
        const headers = { "Authorization": `Bearer ${token}` };
        const query = `?periodo=${selectedPeriod}`;

        // Búsqueda de PPAs en tiempo real
        if (field === "ppa_name") {
            if (value.length <= 2) {
                // Clear results when query is too short
                setCatalogs(prev => ({ ...prev, ppas: [] }));
            } else {
                setPpaSearchLoading(true);
                try {
                    const url = `${baseUrl}/api/catalogs/ppas${query}&q=${encodeURIComponent(value)}`;
                    console.log("Fetching PPAs from:", url);
                    const res = await fetch(url, { headers });
                    if (!res.ok) {
                        console.error("PPA fetch failed:", res.status, await res.text());
                        setCatalogs(prev => ({ ...prev, ppas: [] }));
                    } else {
                        const ppas = await res.json();
                        console.log("PPAs returned:", ppas.length);
                        setCatalogs(prev => ({ ...prev, ppas }));
                    }
                } catch (err) {
                    console.error("Error fetching PPAs", err);
                    setCatalogs(prev => ({ ...prev, ppas: [] }));
                } finally {
                    setPpaSearchLoading(false);
                }
            }
        }

        // Cascada de Clasificación
        if (field === "title_id") {
            setFormData(prev => ({ ...prev, theme_id: "", subtheme_id: "" }));
            try {
                const themes = await fetch(`${baseUrl}/api/catalogs/narrative-themes${query}&title_id=${value}`, { headers }).then(r => r.json());
                setCatalogs(prev => ({ ...prev, themes, subthemes: [] }));
            } catch (err) { console.error("Error fetching themes", err); }
        }

        if (field === "theme_id") {
            setFormData(prev => ({ ...prev, subtheme_id: "" }));
            try {
                const subthemes = await fetch(`${baseUrl}/api/catalogs/narrative-subthemes${query}&theme_id=${value}`, { headers }).then(r => r.json());
                setCatalogs(prev => ({ ...prev, subthemes }));
            } catch (err) { console.error("Error fetching subthemes", err); }
        }

        // Fetch localities when municipality is selected in any location row
        if (field === "locations") {
            const changedIdx = (value as any[]).findIndex((loc, i) => loc.municipality_id !== formData.locations[i]?.municipality_id);
            const mId = changedIdx !== -1 ? value[changedIdx].municipality_id : value[value.length - 1]?.municipality_id;

            if (mId && !catalogs.localitiesByMun[mId]) {
                try {
                    const localities = await fetch(`${baseUrl}/api/catalogs/localities/${mId}`, { headers }).then(r => r.json());
                    if (Array.isArray(localities)) {
                        setCatalogs(prev => ({
                            ...prev,
                            localitiesByMun: { ...prev.localitiesByMun, [mId]: localities }
                        }));
                    }
                } catch (err) { console.error("Error fetching localities", err); }
            }
        }
    };

    const selectPPA = (ppa: any) => {
        // Append to list if not already selected
        setSelectedPpas(prev => {
            if (prev.some(p => p.name === ppa.name)) return prev; // avoid duplicates
            return [...prev, ppa];
        });
        // Keep formData.ppa_name as SEARCH field only — clear after selection
        setFormData(prev => ({
            ...prev,
            ppa_name: "",  // clear search text after selecting
            investment_amount: prev.investment_amount || ppa.monto?.toString() || "",
            beneficiaries: prev.beneficiaries || (ppa.beneficiarios || ppa.beneficiaries || "").toString(),
            budget_program_id: prev.budget_program_id || ppa.programa_presupuestario || "",
        }));
        setCatalogs(prev => ({ ...prev, ppas: [] }));
        setShowPpaSearch(false); // return to suggestions view

        // Auto-link the classification (titulo -> title_id)
        if (ppa.titulo) {
            const t = catalogs.titles.find((x: any) => x.name?.toLowerCase() === ppa.titulo?.toLowerCase());
            if (t) handleInputChange("title_id", t.id.toString());
        }
    };

    const removePPA = (ppaName: string) => {
        setSelectedPpas(prev => prev.filter(p => p.name !== ppaName));
        setFormData(prev => {
            // If removing the primary PPA, promote the next one
            if (prev.ppa_name === ppaName) {
                const remaining = selectedPpas.filter(p => p.name !== ppaName);
                const next = remaining[0];
                return { ...prev, ppa_name: next?.name || "", investment_amount: next?.monto?.toString() || "", beneficiaries: (next?.beneficiarios || "").toString() };
            }
            return prev;
        });
        // Reload suggestions excluding still-selected ppas
        const remainingNames = selectedPpas.filter(p => p.name !== ppaName).map(p => p.name);
        loadSuggestions(remainingNames);
    };

    const addLocation = () => {
        setFormData(prev => ({ ...prev, locations: [...prev.locations, { municipality_id: "", locality_id: "" }] }));
    };

    const addPed = () => {
        setFormData(prev => ({ ...prev, peds: [...prev.peds, { mission_id: "", objective_id: "", strategy_id: "", action_line_id: "" }] }));
    };

    const handleOptimizeAI = async () => {
        if (!formData.narrative_breakdown || formData.narrative_breakdown.length < 10) return;
        setAiLoading(true);
        try {
            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/api/ai/optimize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ text: formData.narrative_breakdown }),
            });
            const data = await res.json();
            if (data.optimizedText) {
                handleInputChange("narrative_breakdown", data.optimizedText);
                showNotification("IA Optimizada", "La redacción técnica ha sido refinada con éxito.", "info");
            }
        } catch (error) {
            console.error("AI Optimization failed", error);
            showNotification("Fallo de IA", "No se pudo optimizar el texto en este momento.", "error");
        }
        finally { setAiLoading(false); }
    };

    // Shared function to load PPA suggestions for the current classification
    const loadSuggestions = async (sessionExclusions: string[] = []) => {
        const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
        const headers = { "Authorization": `Bearer ${token}` };

        const selectedTitle = catalogs.titles.find((t: any) => t.id?.toString() === formData.title_id);
        const selectedTheme = catalogs.themes.find((t: any) => t.id?.toString() === formData.theme_id);
        const selectedSubtheme = catalogs.subthemes.find((s: any) => s.id?.toString() === formData.subtheme_id);

        const params = new URLSearchParams();
        if (selectedTitle?.name) params.append('titulo', selectedTitle.name);
        if (selectedTheme?.name) params.append('tema', selectedTheme.name);
        if (selectedSubtheme?.name) params.append('subtema', selectedSubtheme.name);
        if (formData.title_id) params.append('title_id', formData.title_id);
        if (formData.theme_id) params.append('theme_id', formData.theme_id);
        if (sessionExclusions.length > 0) params.append('exclude', sessionExclusions.join(','));

        try {
            const res = await fetch(`${baseUrl}/api/catalogs/ppas-by-classification?${params}`, { headers });
            if (res.ok) {
                const suggested = await res.json();
                console.log("PPA suggestions loaded:", suggested.length, "| excluded:", sessionExclusions);
                setSuggestedPpas(suggested);
                setShowPpaSearch(suggested.length === 0);
            } else {
                setSuggestedPpas([]);
                setShowPpaSearch(true);
            }
        } catch {
            setSuggestedPpas([]);
            setShowPpaSearch(true);
        }
    };

    // Navigate to a step — when going to step 2, always load suggested PPAs (multi-PPA mode)
    const navigateToStep = async (targetStep: number) => {
        setStep(targetStep);
        if (targetStep === 2) {
            // Load suggestions excluding already-selected PPAs names
            const alreadySelected = selectedPpas.map((p: any) => p.name);
            await loadSuggestions(alreadySelected);
        }
    };

    const handleSave = async (action: 'Borrador' | 'Enviar a SAFIN' = "Enviar a SAFIN") => {
        setLoading(true);
        try {
            // Validar que todas las ubicaciones tengan municipio y localidad (obligatorios en DB)
            const invalidLocations = formData.locations.filter((l: any) => !l.municipality_id || !l.locality_id);
            if (invalidLocations.length > 0) {
                setLoading(false);
                showNotification("Faltan Datos", "Por favor, selecciona tanto el municipio como la localidad para todas las ubicaciones.", "info");
                return;
            }

            const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
            const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

            // First pass: Save as Draft
            let createdIds: number[] = [];

            const formatPpaName = (ppa: any) => {
                if (!ppa) return "";
                if (ppa.clave && !ppa.name?.startsWith(ppa.clave)) {
                    return `${ppa.clave} - ${ppa.name}`;
                }
                return ppa.name;
            };

            if (editId) {
                const mainPpa = selectedPpas[0];
                const submitData = {
                    ...formData,
                    ppa_name: mainPpa ? formatPpaName(mainPpa) : formData.ppa_name,
                    investment_amount: mainPpa?.monto?.toString() || formData.investment_amount,
                    beneficiaries: (mainPpa?.beneficiarios || mainPpa?.beneficiaries || formData.beneficiaries).toString(),
                    budget_program_id: (mainPpa?.programa_presupuestario && mainPpa.programa_presupuestario !== "") ? mainPpa.programa_presupuestario : formData.budget_program_id,
                    status: 'draft' // Always save as draft first
                };
                const res = await fetch(`${baseUrl}/api/narratives/${editId}`, {
                    method: "PUT", headers, body: JSON.stringify(submitData),
                });
                if (!res.ok) throw new Error("Failed to update");
                createdIds = [parseInt(editId as string)];
            } else {
                const url = `${baseUrl}/api/narratives`;
                if (selectedPpas.length > 0) {
                    const promises = selectedPpas.map(ppa => {
                        const submitData = {
                            ...formData,
                            ppa_name: formatPpaName(ppa),
                            investment_amount: ppa.monto?.toString() || "",
                            beneficiaries: (ppa.beneficiarios || ppa.beneficiaries || "").toString(),
                            budget_program_id: (ppa.programa_presupuestario && ppa.programa_presupuestario !== "") ? ppa.programa_presupuestario : formData.budget_program_id,
                            status: 'draft'
                        };
                        return fetch(url, { method: "POST", headers, body: JSON.stringify(submitData) });
                    });
                    const results = await Promise.all(promises);
                    if (results.some(r => !r.ok)) throw new Error("Failed to create some narratives");
                    const parsedResults = await Promise.all(results.map(r => r.json()));
                    createdIds = parsedResults.map(r => r.id);
                } else {
                    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...formData, status: 'draft' }) });
                    if (!res.ok) throw new Error("Failed to create");
                    const data = await res.json();
                    createdIds = [data.id];
                }
            }

            // Second pass: If 'Enviar a SAFIN', trigger the transition endpoint
            if (action === 'Enviar a SAFIN') {
                const submitPromises = createdIds.map(id =>
                    fetch(`${baseUrl}/api/narratives/${id}/submit`, { method: 'POST', headers })
                );
                const submitResults = await Promise.all(submitPromises);
                if (submitResults.some(r => !r.ok)) throw new Error("Failed to submit to SAFIN");
            }

            setSavedIds(createdIds);
            setSuccess(true);
            setSavedStatus(action); // store 'Borrador' | 'Enviar a SAFIN' for UI

            if (action === 'Borrador') {
                showNotification(`¡Borrador guardado!`, `Se guardaron ${createdIds.length || 1} borradores. No se han enviado a validación SAFIN.`, "success");
            } else {
                showNotification(`¡Enviado a SAFIN!`, `Se enviaron ${createdIds.length || 1} narrativas a validación oficial en SAFIN.`, "success");
            }
        } catch (error) {
            console.error("Save failed", error);
            showNotification("Error", "No se pudo guardar la información.", "error");
        }
        finally { setLoading(false); }
    };

    const steps = [
        { id: 1, title: "Clasificación", icon: BookOpen },
        { id: 2, title: "Detalles PPA", icon: Target },
        { id: 3, title: "Vinculación", icon: MapPin },
        { id: 4, title: "Narrativa Técnica", icon: Sparkles },
    ];

    if (success) {
        return (
            <div className="p-6 md:p-8 flex items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full text-center p-8 space-y-6 animate-in zoom-in duration-500">
                    <div className="mx-auto h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                    </div>
                    <div className="space-y-2">
                        <CardTitle className="text-2xl font-bold">
                            {savedStatus === 'Borrador' ? '¡Borrador Guardado!' : '¡Enviado a SAFIN con Éxito!'}
                        </CardTitle>
                        <CardDescription className="text-base text-slate-600 font-medium">
                            {savedStatus === 'Borrador'
                                ? 'La narrativa se ha guardado como borrador. Puedes continuar editándola más tarde en Mis Capturas.'
                                : 'La narrativa ha sido procesada y se ha enviado correctamente a la bandeja oficial de SAFIN para su validación.'}
                        </CardDescription>
                    </div>
                    {savedIds.length > 0 && (
                        <div className="flex flex-col gap-3 py-2">
                            {savedIds.map((id, index) => (
                                <Button
                                    key={id}
                                    onClick={() => {
                                        const baseUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:3001` : 'http://localhost:3001';
                                        window.open(`${baseUrl}/api/export/word/narrative/${id}?token=${token}`, '_blank');
                                    }}
                                    variant="outline"
                                    className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold h-11"
                                >
                                    <BookOpen className="h-4 w-4 mr-2" />
                                    Descargar Word (Nº {savedIds.length > 1 ? index + 1 : id})
                                </Button>
                            ))}
                        </div>
                    )}
                    <Button
                        onClick={() => { window.location.assign('/captura-narrativa'); }}
                        className="w-full bg-guinda-600 hover:bg-guinda-700 h-11 transition-all"
                    >
                        Nueva Captura
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <>
            <TopHeader title="Captura Superior: Programas y Proyectos V2" />

            <div className="p-6 md:p-8">
                <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">

                    {validatorComment && (
                        <div className="p-6 bg-red-50 border border-red-200 rounded-3xl animate-in fade-in slide-in-from-top-4 flex items-start gap-4 shadow-sm">
                            <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                                <AlertTriangle className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="text-red-800 font-bold text-lg">Narrativa Observada por Vallidador</h4>
                                <p className="text-red-600 font-medium">Por favor atiende los siguientes comentarios antes de volver a enviar:</p>
                                <p className="p-4 bg-white/60 border border-red-100 rounded-xl text-red-900 mt-2 font-medium italic">
                                    "{validatorComment}"
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Progress Timeline */}
                    <div className="flex flex-col xl:flex-row gap-8">

                        {/* Stepper Sidebar */}
                        <div className="w-full xl:w-80 flex flex-row xl:flex-col gap-3 overflow-x-auto pb-4 xl:pb-0 scrollbar-hide">
                            {steps.map((s) => {
                                const Icon = s.icon;
                                const isActive = step === s.id;
                                const isPast = step > s.id;

                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setStep(s.id)}
                                        className={`flex flex-1 xl:flex-none items-center gap-4 px-5 py-4 rounded-2xl transition-all text-sm font-semibold whitespace-nowrap border-2 ${isActive
                                            ? "bg-guinda-600 text-white border-guinda-600 shadow-xl shadow-indigo-100 dark:shadow-none translate-x-1"
                                            : isPast
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/10 dark:text-emerald-400 dark:border-emerald-900/30"
                                                : "bg-white text-slate-500 border-slate-100 hover:border-slate-200 dark:bg-slate-900 dark:border-slate-800"
                                            }`}
                                    >
                                        <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${isActive ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                                            }`}>
                                            <Icon className="h-4 w-4" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[10px] opacity-70 uppercase tracking-widest leading-none mb-1">Paso 0{s.id}</p>
                                            <p>{s.title}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Form Content */}
                        <div className="flex-1 space-y-4">
                            {isReadOnly && !!editId && (
                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-indigo-900">Modo de Solo Lectura</p>
                                            <p className="text-xs text-indigo-600 font-medium">Estás visualizando esta narrativa como validador/revisor.</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-indigo-200 text-indigo-700 font-black uppercase text-[10px] tracking-widest bg-white/50">Revisión</Badge>
                                </div>
                            )}
                            <Card className="border-none shadow-2xl shadow-slate-200/40 dark:shadow-none overflow-hidden rounded-3xl">
                                <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 p-8 border-b dark:border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <CardTitle className="text-2xl font-bold tracking-tight">{steps.find(s => s.id === step)?.title}</CardTitle>
                                            <CardDescription className="text-slate-500 font-medium italic">Superior Environment Capture System v2.0</CardDescription>
                                        </div>
                                        <div className="h-14 w-14 rounded-2xl bg-white dark:bg-slate-950 shadow-lg flex items-center justify-center text-guinda-600">
                                            {(() => {
                                                const Icon = steps.find(s => s.id === step)?.icon || BookOpen;
                                                return <Icon className="h-7 w-7" />;
                                            })()}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-8 lg:p-10">
                                    {isReadOnly && (
                                        <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-4 text-amber-800 animate-in fade-in slide-in-from-top-4">
                                            <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <p className="font-black text-sm uppercase tracking-tight">Modo de Visualización Histórica</p>
                                                <p className="text-xs font-medium opacity-80 mt-0.5">Los datos del ciclo {selectedPeriod} están protegidos y no pueden ser modificados para garantizar la integridad de la auditoría.</p>
                                            </div>
                                        </div>
                                    )}

                                    {step === 1 && (
                                        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="grid gap-4">
                                                <Label className="text-base font-bold text-slate-800 dark:text-slate-200">Clasificación Narrativa</Label>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div className="space-y-2 min-w-0">
                                                        <Label htmlFor="title">Título Estratégico</Label>
                                                        <Select onValueChange={(v) => handleInputChange("title_id", v)} value={formData.title_id} disabled={isReadOnly}>
                                                            <SelectTrigger className="h-12 border-slate-200 rounded-xl w-full">
                                                                <div className="truncate text-left w-full pr-4">
                                                                    <SelectValue placeholder="Selecciona un título" />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {(depFilter
                                                                    ? catalogs.titles.filter((t: any) => depFilter.allowedTitleIds.includes(t.id.toString()))
                                                                    : catalogs.titles
                                                                ).map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2 min-w-0">
                                                        <Label htmlFor="theme">Tema Institucional</Label>
                                                        <Select onValueChange={(v) => handleInputChange("theme_id", v)} value={formData.theme_id} disabled={isReadOnly || !formData.title_id}>
                                                            <SelectTrigger className="h-12 border-slate-200 rounded-xl w-full">
                                                                <div className="truncate text-left w-full pr-4">
                                                                    <SelectValue placeholder={!formData.title_id ? "Primero selecciona un título" : "Selecciona un tema"} />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {catalogs.themes.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2 min-w-0">
                                                        <Label htmlFor="subtheme">Subtema</Label>
                                                        <Select onValueChange={(v) => handleInputChange("subtheme_id", v)} value={formData.subtheme_id} disabled={isReadOnly || !formData.theme_id}>
                                                            <SelectTrigger className="h-12 border-slate-200 rounded-xl w-full">
                                                                <div className="truncate text-left w-full pr-4">
                                                                    <SelectValue placeholder={!formData.theme_id ? "Primero selecciona un tema" : "Selecciona un subtema"} />
                                                                </div>
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {catalogs.subthemes.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                                    <div className="space-y-2">
                                                        <Label>Tipo de PPA <span className="text-red-500">*</span></Label>
                                                        <Select onValueChange={(v) => handleInputChange("type_id", v)} value={formData.type_id} disabled={isReadOnly}>
                                                            <SelectTrigger className="h-12 border-slate-200 rounded-xl bg-white dark:bg-slate-950">
                                                                <SelectValue placeholder="Seleccionar tipo..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {catalogs.ppasTypes?.map((t: any) => (
                                                                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Nombre alternativo (Opcional)</Label>
                                                        <Input
                                                            placeholder="Si el nombre oficial difiere..."
                                                            value={formData.new_ppa_name || ""}
                                                            onChange={(e) => handleInputChange("new_ppa_name", e.target.value)}
                                                            className="h-12 border-slate-200 rounded-xl bg-white dark:bg-slate-950"
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {step === 2 && (
                                        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="grid gap-3">
                                                <div className="flex items-center justify-between">
                                                    <Label className="text-base font-bold">Nombre del Programa, Proyecto o Acción (PPA)</Label>
                                                    {selectedPpas.length > 0 && (
                                                        <span className="text-xs text-slate-500 font-medium">{selectedPpas.length} PPA{selectedPpas.length > 1 ? 's' : ''} seleccionado{selectedPpas.length > 1 ? 's' : ''}</span>
                                                    )}
                                                </div>

                                                {/* Multi-PPA chips */}
                                                {selectedPpas.length > 0 && (
                                                    <div className="flex flex-col gap-2">
                                                        {selectedPpas.map((ppa: any, idx: number) => (
                                                            <div key={ppa.name} className="p-3 bg-guinda-50 border border-guinda-200 rounded-2xl flex items-center gap-3">
                                                                <div className="h-7 w-7 rounded-xl bg-guinda-600 flex items-center justify-center shrink-0 text-white text-xs font-bold">{idx + 1}</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-bold text-guinda-900 text-sm leading-tight truncate">{ppa.name}</p>
                                                                    <div className="flex gap-2 text-xs text-guinda-600 mt-0.5">
                                                                        {ppa.clave && <span className="bg-white border border-guinda-200 px-2 py-0.5 rounded-full">{ppa.clave}</span>}
                                                                        {ppa.tipo_ppa && <span>{ppa.tipo_ppa}</span>}
                                                                    </div>
                                                                </div>
                                                                {!isReadOnly && (
                                                                    <button type="button" onClick={() => removePPA(ppa.name)}
                                                                        className="text-guinda-400 hover:text-red-600 transition-colors px-2 py-1 rounded-lg hover:bg-red-50 shrink-0 text-sm font-bold">
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Suggested PPAs - always visible, filtered to exclude already selected */}
                                                {!isReadOnly && suggestedPpas.filter(p => !selectedPpas.some(s => s.name === p.name)).length > 0 && !showPpaSearch && (
                                                    <div className="space-y-2">
                                                        <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                                                            <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                                                                {suggestedPpas.filter(p => !selectedPpas.some(s => s.name === p.name)).length}
                                                            </span>
                                                            {selectedPpas.length > 0 ? 'PPAs adicionales disponibles:' : 'PPAs sugeridos para la clasificación seleccionada:'}
                                                        </p>
                                                        <div className="bg-slate-50 border rounded-2xl max-h-64 overflow-auto divide-y">
                                                            {suggestedPpas.filter(p => !selectedPpas.some(s => s.name === p.name)).map((ppa: any) => (
                                                                <button key={ppa.id} type="button"
                                                                    className="w-full text-left px-5 py-4 hover:bg-white transition-colors flex flex-col gap-1"
                                                                    onClick={() => selectPPA(ppa)}>
                                                                    <span className="font-bold text-slate-900 text-sm">{ppa.name}</span>
                                                                    <div className="flex gap-2 text-xs text-slate-500">
                                                                        <span className="bg-white border px-2 py-0.5 rounded-full">{ppa.clave}</span>
                                                                        <span>{ppa.tipo_ppa}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button type="button" onClick={() => setShowPpaSearch(true)}
                                                            className="w-full text-center text-sm text-guinda-600 hover:text-guinda-800 font-semibold py-2 border border-dashed border-guinda-300 rounded-xl hover:bg-guinda-50 transition-colors">
                                                            + Buscar otro PPA en el catálogo completo
                                                        </button>
                                                    </div>
                                                )}


                                                {/* Free search - available to add additional PPAs from full catalog */}
                                                {!isReadOnly && (showPpaSearch || suggestedPpas.filter(p => !selectedPpas.some(s => s.name === p.name)).length === 0) && (
                                                    <div className="relative">
                                                        {suggestedPpas.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowPpaSearch(false)}
                                                                className="text-xs text-slate-500 hover:underline mb-2 flex items-center gap-1"
                                                            >
                                                                ← Ver PPAs sugeridos ({suggestedPpas.length})
                                                            </button>
                                                        )}
                                                        <Input
                                                            id="ppa_name"
                                                            placeholder="Escribe para buscar en el catálogo completo..."
                                                            className="h-14 text-lg rounded-2xl border-slate-200 focus:ring-guinda-500"
                                                            value={formData.ppa_name}
                                                            onChange={(e) => handleInputChange("ppa_name", e.target.value)}
                                                            autoComplete="off"
                                                            disabled={isReadOnly}
                                                            autoFocus
                                                        />
                                                        {ppaSearchLoading && (
                                                            <div className="absolute right-4 top-4">
                                                                <Loader2 className="h-5 w-5 animate-spin text-guinda-600" />
                                                            </div>
                                                        )}
                                                        {(catalogs.ppas || []).length > 0 && (
                                                            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 border rounded-2xl shadow-2xl max-h-64 overflow-auto">
                                                                {catalogs.ppas?.map((ppa: any) => (
                                                                    <button
                                                                        key={ppa.id}
                                                                        type="button"
                                                                        className="w-full text-left px-5 py-4 hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-0 transition-colors flex flex-col gap-1"
                                                                        onClick={() => selectPPA(ppa)}
                                                                    >
                                                                        <span className="font-bold text-slate-900 dark:text-slate-100">{ppa.name}</span>
                                                                        <div className="flex gap-3 text-xs text-slate-500 font-medium">
                                                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">{ppa.clave}</span>
                                                                            <span>{ppa.tipo_ppa}</span>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="monto">Inversión Alcanzada</Label>
                                                    <div className="relative">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                                        <Input
                                                            id="monto"
                                                            type="number"
                                                            className="pl-9 h-12 border-slate-200 rounded-xl"
                                                            value={formData.investment_amount}
                                                            onChange={(e) => handleInputChange("investment_amount", e.target.value)}
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="beneficiarios">Beneficiarios Totales</Label>
                                                    <Input
                                                        id="beneficiarios"
                                                        type="number"
                                                        className="h-12 border-slate-200 rounded-xl"
                                                        value={formData.beneficiaries}
                                                        onChange={(e) => handleInputChange("beneficiaries", e.target.value)}
                                                        disabled={isReadOnly}
                                                    />
                                                </div>
                                            </div>

                                            {/* Programa Presupuestario */}
                                            <div className="space-y-2">
                                                <Label htmlFor="budget_program">Programa Presupuestario</Label>
                                                <Select onValueChange={(v) => handleInputChange("budget_program_id", v)} value={formData.budget_program_id} disabled={isReadOnly}>
                                                    <SelectTrigger className="h-12 border-slate-200 rounded-xl">
                                                        <SelectValue placeholder="Seleccionar programa..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectLabel className="font-black text-xs uppercase tracking-wider text-slate-400 px-2 py-1">Otro</SelectLabel>
                                                            <SelectItem value="manual" className="font-medium text-blue-600">✏️ Escribir manualmente...</SelectItem>
                                                        </SelectGroup>
                                                        {["Estatal", "Federal"].map(tipo => {
                                                            const grupo = catalogs.budgetPrograms.filter((p: any) => p.type === tipo);
                                                            if (grupo.length === 0) return null;
                                                            return (
                                                                <SelectGroup key={tipo}>
                                                                    <SelectLabel className="font-black text-xs uppercase tracking-wider text-slate-400 px-2 py-1">{tipo}</SelectLabel>
                                                                    {grupo.map((p: any) => (
                                                                        <SelectItem key={p.id} value={p.id.toString()}>
                                                                            {String(p.code).padStart(3, "0")} — {p.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectGroup>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {formData.budget_program_id === 'manual' && (
                                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                    <Label htmlFor="custom_budget_program">Especifique el Programa Presupuestario</Label>
                                                    <Input
                                                        id="custom_budget_program"
                                                        placeholder="Escriba el nombre del programa aquí..."
                                                        className="h-12 border-blue-200 focus:border-blue-400 focus:ring-blue-100 rounded-xl bg-blue-50/30"
                                                        value={formData.custom_budget_program}
                                                        onChange={(e) => handleInputChange("custom_budget_program", e.target.value)}
                                                        disabled={isReadOnly}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {step === 3 && (
                                        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <Label className="text-base font-bold">Vinculación PED (Misión Institucional)</Label>
                                                        {!showAllMissions && (user as any)?.mission_id && (
                                                            <p className="text-xs text-slate-500">Filtrado automáticamente por tu sector institucional.</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {(user as any)?.mission_id && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-xs h-8 text-slate-500 hover:text-guinda-600"
                                                                onClick={() => setShowAllMissions(!showAllMissions)}
                                                            >
                                                                {showAllMissions ? "Restringir a mi sector" : "Ver catálogo completo"}
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="outline" className="h-9 rounded-lg gap-2 text-guinda-600 border-guinda-100" onClick={() => {
                                                            const userMissionId = (user as any)?.mission_id?.toString();
                                                            const initialMissionId = (!formData.peds.length && userMissionId && !showAllMissions) ? userMissionId : undefined;

                                                            const newPeds = [...formData.peds, {
                                                                mission_id: initialMissionId,
                                                                objective_id: undefined,
                                                                strategy_id: undefined,
                                                                action_line_id: undefined
                                                            }];
                                                            handleInputChange("peds", newPeds);
                                                        }} disabled={isReadOnly}>
                                                            <Plus className="h-4 w-4" /> Agregar Alineación
                                                        </Button>
                                                    </div>
                                                </div>
                                                {formData.peds.length === 0 && (
                                                    <div className="p-10 border-2 border-dashed border-slate-100 rounded-3xl text-center space-y-2">
                                                        <p className="text-slate-400 font-medium">No se han agregado vínculos PED.</p>
                                                        <Button variant="ghost" size="sm" onClick={addPed} disabled={isReadOnly}>Haz clic para agregar uno</Button>
                                                    </div>
                                                )}
                                                {formData.peds.map((p, idx) => (
                                                    <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 gap-4 relative group">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Misión</Label>
                                                            <Select onValueChange={(v) => {
                                                                const newPeds = [...formData.peds];
                                                                newPeds[idx].mission_id = v;
                                                                newPeds[idx].objective_id = undefined;
                                                                newPeds[idx].strategy_id = undefined;
                                                                newPeds[idx].action_line_id = undefined;
                                                                handleInputChange("peds", newPeds);
                                                            }} value={p.mission_id} disabled={isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Misión..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {(() => {
                                                                        const missionsToShow = showAllMissions
                                                                            ? catalogs.missions
                                                                            : catalogs.missions.filter((m: any) =>
                                                                                m.id.toString() === (user as any)?.mission_id?.toString() ||
                                                                                (user as any)?.roles?.includes('SuperAdministrador')
                                                                            );

                                                                        // Fallback: if filtered results are empty but we have missions, show all
                                                                        const finalMissions = (missionsToShow.length === 0 && catalogs.missions.length > 0)
                                                                            ? catalogs.missions
                                                                            : missionsToShow;

                                                                        return finalMissions.map((m: any) => (
                                                                            <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                                                                        ));
                                                                    })()}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Objetivo</Label>
                                                            <Select onValueChange={(v) => {
                                                                const newPeds = [...formData.peds];
                                                                newPeds[idx].objective_id = v;
                                                                newPeds[idx].strategy_id = undefined;
                                                                newPeds[idx].action_line_id = undefined;
                                                                handleInputChange("peds", newPeds);
                                                            }} value={p.objective_id} disabled={!p.mission_id || isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Objetivo..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {catalogs.pedObjectives?.filter((obj: any) => obj.mission_id?.toString() === p.mission_id).map((o: any) => <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Estrategia</Label>
                                                            <Select onValueChange={(v) => {
                                                                const newPeds = [...formData.peds];
                                                                newPeds[idx].strategy_id = v;
                                                                newPeds[idx].action_line_id = undefined;
                                                                handleInputChange("peds", newPeds);
                                                            }} value={p.strategy_id} disabled={!p.objective_id || isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Estrategia..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {catalogs.pedStrategies?.filter((str: any) => str.objective_id?.toString() === p.objective_id).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Línea de Acción</Label>
                                                            <Select onValueChange={(v) => {
                                                                const newPeds = [...formData.peds];
                                                                newPeds[idx].action_line_id = v;
                                                                handleInputChange("peds", newPeds);
                                                            }} value={p.action_line_id} disabled={!p.strategy_id || isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Línea de Acción..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {catalogs.pedActionLines?.filter((act: any) => act.narrative_strategy_id?.toString() === p.strategy_id).map((a: any) => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-md border text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                const newPeds = formData.peds.filter((_, i) => i !== idx);
                                                                handleInputChange("peds", newPeds);
                                                            }}
                                                            disabled={isReadOnly}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Municipalities Section */}
                                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                                <div className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <Label className="text-base font-bold">Ubicación Geográfica (Impacto)</Label>
                                                        <p className="text-xs text-slate-500">Selecciona el municipio y la localidad donde impacta esta narrativa.</p>
                                                    </div>
                                                    <Button size="sm" variant="outline" className="h-9 rounded-lg gap-2 text-guinda-600 border-guinda-100" onClick={addLocation} disabled={isReadOnly}>
                                                        <Plus className="h-4 w-4" /> Agregar Ubicación
                                                    </Button>
                                                </div>
                                                {formData.locations.length === 0 && (
                                                    <div className="p-10 border-2 border-dashed border-slate-100 rounded-3xl text-center space-y-2">
                                                        <p className="text-slate-400 font-medium">No se han agregado ubicaciones específicas.</p>
                                                        <Button variant="ghost" size="sm" onClick={addLocation} disabled={isReadOnly}>Haz clic para agregar una ubicación</Button>
                                                    </div>
                                                )}
                                                {formData.locations.map((loc, idx) => (
                                                    <div key={idx} className="p-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4 relative group">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Municipio</Label>
                                                            <Select onValueChange={async (v) => {
                                                                const newLocs = [...formData.locations];
                                                                newLocs[idx].municipality_id = v;
                                                                newLocs[idx].locality_id = "";
                                                                handleInputChange("locations", newLocs);
                                                            }} value={loc.municipality_id} disabled={isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Municipio..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {catalogs.municipalities.map((m: any) => (
                                                                        <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-slate-500">Localidad</Label>
                                                            <Select onValueChange={(v) => {
                                                                const newLocs = [...formData.locations];
                                                                newLocs[idx].locality_id = v;
                                                                handleInputChange("locations", newLocs);
                                                            }} value={loc.locality_id} disabled={!loc.municipality_id || isReadOnly}>
                                                                <SelectTrigger className="bg-white dark:bg-slate-950 w-full h-auto min-h-12 text-left px-4 py-2 border-slate-200 rounded-xl">
                                                                    <div className="whitespace-normal break-words w-full pr-6">
                                                                        <SelectValue placeholder="Seleccionar Localidad..." />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {catalogs.localitiesByMun?.[loc.municipality_id]?.map((l: any) => (
                                                                        <SelectItem key={l.id} value={l.id.toString()}>{l.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-md border text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                const newLocs = formData.locations.filter((_, i) => i !== idx);
                                                                handleInputChange("locations", newLocs);
                                                            }}
                                                            disabled={isReadOnly}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {step === 4 && (
                                        <div className="grid gap-8 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div>
                                                    <Label className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-guinda-600 to-guinda-600 uppercase tracking-tight">Desglose Narrativo de Impacto</Label>
                                                    <p className="text-xs text-slate-500 font-medium mt-1">Sugerencia: Usa el asistente de IA para refinar el tono institucional.</p>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    className="gap-2 bg-guinda-50 text-guinda-700 hover:bg-guinda-100 border-none shadow-sm h-11 px-6 rounded-xl font-bold"
                                                    onClick={handleOptimizeAI}
                                                    disabled={aiLoading || isReadOnly}
                                                >
                                                    {aiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5 fill-indigo-200" />}
                                                    IA: Pulir Redacción Técnica
                                                </Button>
                                            </div>

                                            <div className="space-y-4">
                                                <Textarea
                                                    placeholder="Redacta los logros, beneficiarios y el impacto real de esta acción..."
                                                    className="min-h-[300px] text-lg leading-relaxed p-6 rounded-3xl border-slate-200 focus-visible:ring-guinda-500 shadow-inner bg-slate-50/20"
                                                    value={formData.narrative_breakdown}
                                                    onChange={(e) => handleInputChange("narrative_breakdown", e.target.value)}
                                                    disabled={isReadOnly}
                                                />
                                            </div>

                                            <div className="p-8 bg-amber-50/50 border border-amber-100 rounded-[2rem] space-y-4">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
                                                        <Plus className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-base font-bold text-amber-900">Resaltado de Impacto (Quote)</Label>
                                                        <p className="text-xs text-amber-700/70 font-medium">Este texto aparecerá resaltado en el documento PDF/Word final.</p>
                                                    </div>
                                                </div>
                                                <Textarea
                                                    placeholder="Ej: 'Se logró beneficiar a más de 5,000 familias con la entrega de paquetes alimentarios...'"
                                                    className="min-h-[100px] text-base border-amber-200 bg-white/80 focus-visible:ring-amber-500 rounded-2xl shadow-sm"
                                                    value={formData.highlighted}
                                                    onChange={(e) => handleInputChange("highlighted", e.target.value)}
                                                    disabled={isReadOnly}
                                                    maxLength={250}
                                                />
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] text-amber-600/60 font-black uppercase tracking-widest">Contenido Destacado</span>
                                                    <span className={`text-[10px] font-black ${formData.highlighted.length > 200 ? 'text-red-500' : 'text-amber-600/60'}`}>
                                                        {formData.highlighted.length} / 250
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Navigation Footer */}
                                    <div className="flex items-center justify-between mt-12 pt-8 border-t dark:border-slate-800">
                                        <Button
                                            variant="ghost"
                                            onClick={() => setStep(Math.max(1, step - 1))}
                                            disabled={step === 1}
                                            className="gap-2 h-12 px-6 text-slate-500 font-bold hover:bg-slate-50"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                            Módulo Anterior
                                        </Button>

                                        {step < 4 ? (
                                            <Button
                                                onClick={() => navigateToStep(step + 1)}
                                                className="bg-guinda-600 hover:bg-guinda-700 text-white gap-3 h-12 px-8 rounded-2xl shadow-lg shadow-indigo-100 dark:shadow-none"
                                            >
                                                Próximo Paso
                                                <ChevronRight className="h-5 w-5" />
                                            </Button>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    onClick={() => handleSave('Borrador')}
                                                    disabled={loading || isReadOnly}
                                                    variant="outline"
                                                    className="border-guinda-100 text-guinda-700 hover:bg-guinda-50 gap-2 h-12 px-6 rounded-2xl font-bold"
                                                >
                                                    <Save className="h-4 w-4" />
                                                    Guardar Borrador
                                                </Button>
                                                <Button
                                                    onClick={() => handleSave('Enviar a SAFIN')}
                                                    disabled={loading || isReadOnly}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-3 h-12 px-10 rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-none font-bold"
                                                >
                                                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                                                    Finalizar y Enviar a SAFIN
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            <NotificationModal
                isOpen={notification.isOpen}
                onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
        </>
    );
}
