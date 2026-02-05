"""
Generador de diagrama de circuito para mini protoboard
Mini protoboard: 2 secciones de 5 filas x 18 columnas (sin buses +/-)
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Configuración de tamaños
CELL_SIZE = 28
HOLE_RADIUS = 4
PADDING = 60
GAP_BETWEEN_SECTIONS = 20

# Dimensiones de la protoboard
ROWS = 5
COLS = 18
SECTIONS = 2

# Colores
COLORS = {
    'background': '#1a1a2e',
    'protoboard': '#e8e0d5',
    'hole': '#2d2d2d',
    'hole_used': '#4a4a4a',
    'wire_red': '#ff3333',
    'wire_black': '#333333',
    'wire_yellow': '#ffcc00',
    'wire_green': '#33cc33',
    'wire_blue': '#3399ff',
    'wire_orange': '#ff8800',
    'component_resistor': '#d4a574',
    'component_led_red': '#ff0000',
    'component_led_glow': '#ff6666',
    'component_diode': '#2d2d2d',
    'component_diode_band': '#cccccc',
    'component_fuse': '#ffeecc',
    'component_solenoid': '#4477aa',
    'text': '#ffffff',
    'label': '#000000',
    'title': '#00ffcc',
}

def create_protoboard_image():
    # Calcular dimensiones totales
    board_width = COLS * CELL_SIZE
    board_height = ROWS * CELL_SIZE * SECTIONS + GAP_BETWEEN_SECTIONS
    
    img_width = board_width + PADDING * 2
    img_height = board_height + PADDING * 3 + 200  # Extra espacio para leyenda
    
    # Crear imagen
    img = Image.new('RGB', (img_width, img_height), COLORS['background'])
    draw = ImageDraw.Draw(img)
    
    # Intentar cargar fuente, usar default si no está disponible
    try:
        font_title = ImageFont.truetype("arial.ttf", 20)
        font_label = ImageFont.truetype("arial.ttf", 12)
        font_small = ImageFont.truetype("arial.ttf", 10)
        font_legend = ImageFont.truetype("arial.ttf", 11)
    except:
        font_title = ImageFont.load_default()
        font_label = font_title
        font_small = font_title
        font_legend = font_title
    
    # Título
    draw.text((img_width // 2, 20), "CIRCUITO SOLENOIDE 12V + LED", 
              fill=COLORS['title'], font=font_title, anchor="mm")
    draw.text((img_width // 2, 42), "Mini Protoboard (5×18) × 2 secciones", 
              fill='#888888', font=font_small, anchor="mm")
    
    # Offset para el contenido
    start_y = 70
    
    # Dibujar las dos secciones de la protoboard
    for section in range(SECTIONS):
        section_y = start_y + section * (ROWS * CELL_SIZE + GAP_BETWEEN_SECTIONS)
        
        # Fondo de la sección
        draw.rounded_rectangle(
            [PADDING - 10, section_y - 10, 
             PADDING + board_width + 10, section_y + ROWS * CELL_SIZE + 10],
            radius=8,
            fill=COLORS['protoboard']
        )
        
        # Etiqueta de sección
        section_label = "SECCIÓN SUPERIOR" if section == 0 else "SECCIÓN INFERIOR"
        draw.text((PADDING - 5, section_y - 8), section_label, 
                  fill='#666666', font=font_small)
        
        # Dibujar agujeros
        for row in range(ROWS):
            # Etiquetas de fila (A-E)
            row_label = chr(65 + row)  # A, B, C, D, E
            draw.text((PADDING - 20, section_y + row * CELL_SIZE + CELL_SIZE // 2),
                      row_label, fill=COLORS['label'], font=font_label, anchor="mm")
            
            for col in range(COLS):
                x = PADDING + col * CELL_SIZE + CELL_SIZE // 2
                y = section_y + row * CELL_SIZE + CELL_SIZE // 2
                
                # Etiquetas de columna (solo en primera fila de primera sección)
                if section == 0 and row == 0:
                    draw.text((x, section_y - 18), str(col + 1), 
                              fill='#888888', font=font_small, anchor="mm")
                
                # Dibujar agujero
                draw.ellipse([x - HOLE_RADIUS, y - HOLE_RADIUS, 
                              x + HOLE_RADIUS, y + HOLE_RADIUS],
                             fill=COLORS['hole'])
    
    # Función auxiliar para obtener coordenadas de un agujero
    def get_hole_pos(section, row, col):
        """section: 0=superior, 1=inferior; row: 0-4 (A-E); col: 0-17 (1-18)"""
        section_y = start_y + section * (ROWS * CELL_SIZE + GAP_BETWEEN_SECTIONS)
        x = PADDING + col * CELL_SIZE + CELL_SIZE // 2
        y = section_y + row * CELL_SIZE + CELL_SIZE // 2
        return x, y
    
    # Función para dibujar cables
    def draw_wire(start, end, color, width=3):
        draw.line([start, end], fill=color, width=width)
        # Puntos en los extremos
        draw.ellipse([start[0]-4, start[1]-4, start[0]+4, start[1]+4], fill=color)
        draw.ellipse([end[0]-4, end[1]-4, end[0]+4, end[1]+4], fill=color)
    
    # Función para dibujar componentes
    def draw_resistor(pos1, pos2, label="470Ω"):
        x1, y1 = pos1
        x2, y2 = pos2
        # Cuerpo de la resistencia
        mid_x = (x1 + x2) // 2
        draw.rectangle([x1 + 15, y1 - 6, x2 - 15, y2 + 6], 
                       fill=COLORS['component_resistor'], outline='#8b6914', width=2)
        # Bandas de color
        for i, color in enumerate(['#8b4513', '#000000', '#8b4513', '#ffd700']):
            bx = x1 + 20 + i * 12
            draw.rectangle([bx, y1 - 5, bx + 6, y2 + 5], fill=color)
        # Patas
        draw.line([x1, y1, x1 + 15, y1], fill='#888888', width=2)
        draw.line([x2 - 15, y2, x2, y2], fill='#888888', width=2)
        # Etiqueta
        draw.text((mid_x, y1 - 15), label, fill=COLORS['text'], font=font_small, anchor="mm")
    
    def draw_led(pos1, pos2, label="LED"):
        x1, y1 = pos1
        x2, y2 = pos2
        mid_x = (x1 + x2) // 2
        # Brillo del LED
        draw.ellipse([mid_x - 15, y1 - 15, mid_x + 15, y1 + 15], 
                     fill=COLORS['component_led_glow'])
        # Cuerpo del LED
        draw.ellipse([mid_x - 8, y1 - 8, mid_x + 8, y1 + 8], 
                     fill=COLORS['component_led_red'], outline='#cc0000', width=2)
        # Patas
        draw.line([x1, y1, mid_x - 8, y1], fill='#888888', width=2)
        draw.line([mid_x + 8, y2, x2, y2], fill='#888888', width=2)
        # Etiqueta con polaridad
        draw.text((mid_x, y1 - 22), f"{label} (A→C)", fill=COLORS['text'], font=font_small, anchor="mm")
    
    def draw_diode(pos1, pos2, label="1N4007"):
        x1, y1 = pos1
        x2, y2 = pos2
        mid_x = (x1 + x2) // 2
        # Cuerpo del diodo
        draw.rectangle([x1 + 10, y1 - 5, x2 - 10, y2 + 5], 
                       fill=COLORS['component_diode'], outline='#444444', width=1)
        # Banda del cátodo (lado derecho = hacia el +)
        draw.rectangle([x2 - 18, y1 - 5, x2 - 12, y2 + 5], 
                       fill=COLORS['component_diode_band'])
        # Patas
        draw.line([x1, y1, x1 + 10, y1], fill='#888888', width=2)
        draw.line([x2 - 10, y2, x2, y2], fill='#888888', width=2)
        # Etiqueta
        draw.text((mid_x, y1 - 15), f"{label} (A→C)", fill=COLORS['text'], font=font_small, anchor="mm")
    
    def draw_fuse(pos1, pos2, label="3A"):
        x1, y1 = pos1
        x2, y2 = pos2
        mid_x = (x1 + x2) // 2
        # Cuerpo del fusible
        draw.rounded_rectangle([x1 + 8, y1 - 6, x2 - 8, y2 + 6], 
                               radius=3, fill=COLORS['component_fuse'], 
                               outline='#ccaa66', width=2)
        # Hilo interno
        draw.line([x1 + 12, y1, x2 - 12, y1], fill='#888888', width=1)
        # Patas
        draw.line([x1, y1, x1 + 8, y1], fill='#888888', width=2)
        draw.line([x2 - 8, y2, x2, y2], fill='#888888', width=2)
        # Etiqueta
        draw.text((mid_x, y1 - 15), f"FUSIBLE {label}", fill=COLORS['text'], font=font_small, anchor="mm")
    
    def draw_solenoid_connector(pos, label, is_positive=True):
        x, y = pos
        color = COLORS['wire_red'] if is_positive else COLORS['wire_black']
        # Conector
        draw.rectangle([x - 8, y - 10, x + 8, y + 10], fill=color, outline='#ffffff', width=1)
        # Texto
        symbol = "+" if is_positive else "-"
        draw.text((x, y), symbol, fill='#ffffff', font=font_label, anchor="mm")
        # Etiqueta
        draw.text((x, y + 20), label, fill=COLORS['text'], font=font_small, anchor="mm")
    
    # ==================== DIBUJAR CIRCUITO ====================
    
    # SECCIÓN SUPERIOR: Entrada + Fusible + Resistencia + LED
    
    # Entrada +12V (columna 1, fila A) - cable rojo de entrada
    entrada_pos = get_hole_pos(0, 0, 0)  # A1
    draw.text((entrada_pos[0], entrada_pos[1] - 25), "+12V", 
              fill=COLORS['wire_red'], font=font_label, anchor="mm")
    draw.text((entrada_pos[0], entrada_pos[1] - 38), "(del relé)", 
              fill='#888888', font=font_small, anchor="mm")
    draw.ellipse([entrada_pos[0]-6, entrada_pos[1]-6, entrada_pos[0]+6, entrada_pos[1]+6], 
                 fill=COLORS['wire_red'])
    
    # Fusible (A2 a A5)
    fuse_start = get_hole_pos(0, 0, 1)  # A2
    fuse_end = get_hole_pos(0, 0, 4)    # A5
    draw_fuse(fuse_start, fuse_end)
    
    # Cable de A1 a A2 (entrada a fusible)
    draw_wire(entrada_pos, fuse_start, COLORS['wire_red'])
    
    # Cable de A5 a A7 (después del fusible, distribución)
    post_fuse = get_hole_pos(0, 0, 6)  # A7
    draw_wire(fuse_end, post_fuse, COLORS['wire_red'])
    
    # Resistencia (A8 a A11)
    res_start = get_hole_pos(0, 0, 7)   # A8
    res_end = get_hole_pos(0, 0, 10)    # A11
    draw_resistor(res_start, res_end)
    
    # Cable de A7 a A8
    draw_wire(post_fuse, res_start, COLORS['wire_red'])
    
    # LED (A12 a A14)
    led_start = get_hole_pos(0, 0, 11)  # A12
    led_end = get_hole_pos(0, 0, 13)    # A14
    draw_led(led_start, led_end)
    
    # Cable de A11 a A12
    draw_wire(res_end, led_start, COLORS['wire_yellow'])
    
    # GND del LED (A14) - bajamos a sección inferior para GND común
    led_gnd = get_hole_pos(0, 0, 13)    # A14
    gnd_led_bridge = get_hole_pos(0, 4, 13)  # E14
    draw_wire(led_gnd, gnd_led_bridge, COLORS['wire_black'])
    
    # Entrada GND (columna 18, fila E superior)
    entrada_gnd = get_hole_pos(0, 4, 17)  # E18
    draw.text((entrada_gnd[0] + 5, entrada_gnd[1] - 25), "GND", 
              fill=COLORS['wire_black'], font=font_label, anchor="mm")
    draw.text((entrada_gnd[0] + 5, entrada_gnd[1] - 38), "(del relé)", 
              fill='#888888', font=font_small, anchor="mm")
    draw.ellipse([entrada_gnd[0]-6, entrada_gnd[1]-6, entrada_gnd[0]+6, entrada_gnd[1]+6], 
                 fill=COLORS['wire_black'])
    
    # Cable GND de E18 a E14 (línea GND horizontal)
    draw_wire(entrada_gnd, gnd_led_bridge, COLORS['wire_black'])
    
    # SECCIÓN INFERIOR: Solenoide + Diodo de protección
    
    # Bajamos +12V de A7 a sección inferior
    power_bridge_top = get_hole_pos(0, 4, 6)  # E7 superior
    power_bridge_bot = get_hole_pos(1, 0, 6)  # A7 inferior
    draw_wire(post_fuse, power_bridge_top, COLORS['wire_red'])
    draw_wire(power_bridge_top, power_bridge_bot, COLORS['wire_red'])
    
    # Conector SOLENOIDE + (B7 inferior)
    sol_plus = get_hole_pos(1, 1, 6)   # B7 inferior
    draw_solenoid_connector(sol_plus, "SOLENOIDE +", True)
    draw_wire(power_bridge_bot, sol_plus, COLORS['wire_red'])
    
    # Conector SOLENOIDE - (B12 inferior)
    sol_minus = get_hole_pos(1, 1, 11)  # B12 inferior
    draw_solenoid_connector(sol_minus, "SOLENOIDE -", False)
    
    # Diodo 1N4007 (A8 a A11 inferior) - EN PARALELO con el solenoide
    diode_start = get_hole_pos(1, 0, 7)   # A8 inferior (ánodo)
    diode_end = get_hole_pos(1, 0, 10)    # A11 inferior (cátodo)
    draw_diode(diode_start, diode_end)
    
    # Conexiones del diodo:
    # Cátodo (banda) → al + del solenoide
    draw_wire(diode_end, power_bridge_bot, COLORS['wire_orange'])
    draw.text((diode_end[0] + 25, diode_end[1]), "C→+", 
              fill=COLORS['wire_orange'], font=font_small, anchor="mm")
    
    # Ánodo → al - del solenoide
    draw_wire(diode_start, get_hole_pos(1, 1, 7), COLORS['wire_orange'])
    
    # Cable del - del solenoide al ánodo del diodo
    sol_minus_bridge = get_hole_pos(1, 0, 11)  # A12 inferior
    draw_wire(sol_minus, sol_minus_bridge, COLORS['wire_black'])
    draw_wire(sol_minus_bridge, diode_start, COLORS['wire_orange'])
    
    # GND del solenoide - conectar a GND común
    gnd_sol = get_hole_pos(1, 4, 11)  # E12 inferior
    draw_wire(sol_minus, gnd_sol, COLORS['wire_black'])
    
    # Puente GND entre secciones (E14 superior a E14 inferior, luego a E12 inferior)
    gnd_bridge_inf = get_hole_pos(1, 4, 13)  # E14 inferior
    draw_wire(gnd_led_bridge, gnd_bridge_inf, COLORS['wire_black'])
    draw_wire(gnd_bridge_inf, gnd_sol, COLORS['wire_black'])
    
    # ==================== LEYENDA ====================
    legend_y = start_y + board_height + 50
    
    draw.text((PADDING, legend_y), "LEYENDA:", fill=COLORS['title'], font=font_title)
    
    legend_items = [
        (COLORS['wire_red'], "Cable +12V (entrada del relé)"),
        (COLORS['wire_black'], "Cable GND (tierra)"),
        (COLORS['wire_yellow'], "Conexión Resistencia-LED"),
        (COLORS['wire_orange'], "Conexiones del diodo flyback"),
        (COLORS['component_resistor'], "Resistencia 470Ω (protección LED)"),
        (COLORS['component_led_red'], "LED indicador"),
        (COLORS['component_diode'], "Diodo 1N4007 (¡BANDA hacia +12V!)"),
        (COLORS['component_fuse'], "Fusible 3A (protección)"),
    ]
    
    for i, (color, text) in enumerate(legend_items):
        x = PADDING + (i % 2) * 280
        y = legend_y + 30 + (i // 2) * 22
        draw.rectangle([x, y - 6, x + 20, y + 6], fill=color, outline='#ffffff', width=1)
        draw.text((x + 28, y), text, fill=COLORS['text'], font=font_legend, anchor="lm")
    
    # Nota importante
    note_y = legend_y + 130
    draw.rectangle([PADDING - 5, note_y - 5, img_width - PADDING + 5, note_y + 45], 
                   fill='#332200', outline=COLORS['wire_orange'], width=2)
    draw.text((PADDING + 5, note_y + 5), "⚠️ IMPORTANTE:", fill=COLORS['wire_orange'], font=font_label)
    draw.text((PADDING + 5, note_y + 22), 
              "El diodo 1N4007 debe tener la BANDA BLANCA (cátodo) hacia el +12V del solenoide.",
              fill=COLORS['text'], font=font_small)
    draw.text((PADDING + 5, note_y + 35), 
              "Esto protege contra picos de voltaje cuando el solenoide se apaga.",
              fill='#888888', font=font_small)
    
    return img


if __name__ == "__main__":
    print("Generando diagrama del circuito...")
    img = create_protoboard_image()
    
    # Guardar imagen
    output_path = os.path.join(os.path.dirname(__file__), "diagrama_circuito.png")
    img.save(output_path, "PNG", quality=95)
    print(f"✅ Diagrama guardado en: {output_path}")
    
    # Mostrar imagen si es posible
    try:
        img.show()
    except:
        print("(No se pudo abrir la imagen automáticamente)")
