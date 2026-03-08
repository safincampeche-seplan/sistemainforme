from fpdf import FPDF
from models import ExportRequest, NarrativeItem
import io

class NarrativePDF(FPDF):
    def header(self):
        # Espacio superior
        pass

    def footer(self):
        # Posición a 1.5 cm del final
        self.set_y(-15)
        # Arial italic 8
        self.set_font("helvetica", "I", 8)
        self.set_text_color(100, 116, 139) # Slate-400
        # Número de página
        self.cell(0, 10, f"Página {self.page_no()}", align="C")

def hex_to_rgb(hex_str: str):
    if not hex_str:
        return (30, 41, 59)
    hex_str = hex_str.replace("#", "")
    if len(hex_str) != 6:
        return (30, 41, 59)
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def generate_pdf_doc(request: ExportRequest) -> io.BytesIO:
    # Crear instancia de FPDF con márgenes estilo reporte
    pdf = NarrativePDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    
    # Colores desde el request o defaults
    title_rgb = hex_to_rgb(request.title_color or "1E293B")
    theme_rgb = hex_to_rgb(request.theme_color or "475569")
    subtheme_rgb = hex_to_rgb(request.subtheme_color or "64748B")

    current_title_id = None
    current_theme_id = None
    current_subtheme_id = None

    for item in request.items:
        # Título (H1 equivalente)
        if current_title_id != item.title_code:
            current_title_id = item.title_code
            pdf.ln(5)
            pdf.set_font("helvetica", "B", 18)
            pdf.set_text_color(*title_rgb)
            text = f"{item.title_code}. {item.title_name.upper()}"
            pdf.multi_cell(0, 10, text, align="L")
            pdf.ln(2)

        # Tema (H2 equivalente)
        if item.theme_name and current_theme_id != item.theme_code:
            current_theme_id = item.theme_code
            pdf.set_font("helvetica", "B", 14)
            pdf.set_text_color(*theme_rgb)
            pdf.ln(4)
            text = f"{item.title_code}.{item.theme_code}. {item.theme_name.upper()}"
            pdf.multi_cell(0, 8, text, align="L")
            pdf.ln(1)

        # Subtema (H3 equivalente)
        if item.subtheme_name and current_subtheme_id != item.subtheme_code:
            current_subtheme_id = item.subtheme_code
            pdf.set_font("helvetica", "B", 12)
            pdf.set_text_color(*subtheme_rgb)
            pdf.ln(3)
            text = f"{item.title_code}.{item.theme_code}.{item.subtheme_code}. {item.subtheme_name}"
            pdf.multi_cell(0, 7, text, align="L")
            pdf.ln(1)

        # Narrativa (Cuerpo)
        if item.content:
            pdf.set_font("helvetica", "", 10)
            pdf.set_text_color(31, 41, 55) # Gray-800
            content = item.content.replace("\\n", "\n")
            # El interlineado 1.5 en Word es aprox 6-7 unidades en FPDF con fuente 10
            pdf.multi_cell(0, 6, content, align="J")
            pdf.ln(4)

        # Destacado (Quote)
        if item.highlighted:
            pdf.ln(6)
            # Dibujar un recuadro sutil
            pdf.set_fill_color(249, 250, 251) # Gray-50
            pdf.set_draw_color(*title_rgb)
            pdf.set_line_width(0.3)
            
            pdf.set_font("helvetica", "BI", 11)
            pdf.set_text_color(*title_rgb)
            
            text = f'"{item.highlighted.strip()}"'
            # Multi_cell con box
            pdf.multi_cell(0, 8, text, border=1, align="C", fill=True)
            pdf.ln(8)

    # Output a buffer
    output_bytes = pdf.output()
    # fpdf2.output() returns bytes if no dest is provided
    target = io.BytesIO(output_bytes)
    target.seek(0)
    return target
