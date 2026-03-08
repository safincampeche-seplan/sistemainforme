from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class NarrativeItem(BaseModel):
    title_code: str
    title_name: str
    theme_code: str
    theme_name: Optional[str] = None
    subtheme_code: Optional[str] = None
    subtheme_name: Optional[str] = None
    program_name: Optional[str] = None
    content: str
    highlighted: Optional[str] = None

class ExportRequest(BaseModel):
    mission_name: str
    title_color: Optional[str] = "1E293B" # Indigo/Slate default
    theme_color: Optional[str] = "475569"
    subtheme_color: Optional[str] = "64748B"
    items: List[NarrativeItem]

class ExcelExportRequest(BaseModel):
    entity_name: str
    headers: List[str]
    rows: List[Dict[str, Any]]
    report_title: Optional[str] = "Reporte de Anexo Estadístico"
    mission_context: Optional[str] = None

class ConsolidatedExcelExportRequest(BaseModel):
    items: List[ExcelExportRequest]
    report_title: Optional[str] = "Anexo Estadístico Consolidado"
