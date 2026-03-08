import sys
import os
from models import ExportRequest, NarrativeItem
from doc_generator import generate_word_doc

# Mock request based on SEPLAN real patterns
test_request = ExportRequest(
    mission_name="GOBERNANZA Y SEGURIDAD",
    title_color="1E293B", # Slate 900
    theme_color="475569", # Slate 600
    subtheme_color="64748B", # Slate 500
    items=[
        NarrativeItem(
            title_code="1",
            title_name="Paz, Justicia e Instituciones Sólidas",
            theme_code="1",
            theme_name="Seguridad Ciudadana",
            subtheme_code="1",
            subtheme_name="Prevención del Delito",
            content="Durante el presente periodo se han implementado 45 nuevos programas de vigilancia comunitaria, impactando positivamente en la percepción de seguridad de 12 municipios críticos. La coordinación entre los tres órdenes de gobierno ha permitido una reducción del 12% en la incidencia delictiva general.",
            highlighted="La paz social es el cimiento sobre el cual construimos el futuro de nuestro estado."
        ),
        NarrativeItem(
            title_code="1",
            title_name="Paz, Justicia e Instituciones Sólidas",
            theme_code="2",
            theme_name="Justicia Transparente",
            content="Se digitalizaron el 100% de los trámites ante el Registro Civil, reduciendo los tiempos de espera de 15 días a solo 24 horas para la obtención de actas certificadas."
        )
    ]
)

try:
    print("Generando documento de prueba...")
    doc_buffer = generate_word_doc(test_request)
    with open("test_output.docx", "wb") as f:
        f.write(doc_buffer.getbuffer())
    print("¡Éxito! El archivo 'test_output.docx' ha sido generado en el directorio python_services.")
except Exception as e:
    print(f"Error durante la generación: {e}")
    sys.exit(1)
