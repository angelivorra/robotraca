# Circuito de Control: Relé → Solenoide 12V + LED

## 📋 Descripción del Proyecto

Este circuito recibe alimentación de 12V desde un relé y controla:
- **Motor solenoide** de 12V / 2A
- **LED indicador** de 12V

Incluye protección contra picos de voltaje inductivos.

---

## 🔧 Lista de Componentes

| Ref. | Componente | Valor/Modelo | Cantidad | Notas |
|------|------------|--------------|----------|-------|
| J1 | Conector entrada | 2 pines | 1 | Para cables del relé (+/-) |
| R1 | Resistencia | 470Ω ¼W | 1 | Para LED (si no es LED de 12V integrado) |
| D1 | LED | 3mm o 5mm | 1 | Indicador de activación |
| SOL1 | Solenoide | 12V 2A | 1 | Motor actuador |
| D2 | Diodo | 1N4007 o 1N5408 | 1 | Protección flyback |
| F1 | Fusible | 3A | 1 | Protección cortocircuito |

---

## ⚡ Esquema del Circuito

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                         │
   +12V ●────┬──────────────────────┬─────────────────────────────┤
   (relé)    │                      │                             │
             │                  [FUSIBLE]                         │
             │                    3A                              │
             │                      │                             │
           [R1]                     │                             │
           470Ω                     │                         ▲  ─┤─  Diodo
             │                      │                         │   │   1N4007
           [LED]              ┌─────┴─────┐                   │   │
             │                │ SOLENOIDE │                   │   │
             │                │  12V 2A   │                   └───┤
             │                └─────┬─────┘                       │
             │                      │                             │
    GND ●────┴──────────────────────┴─────────────────────────────┘
   (relé)
```

---

## 🛡️ Protecciones Implementadas

### 1. Diodo Flyback (D2 - 1N4007)
**¿Por qué es necesario?**
- Los solenoides son cargas inductivas
- Al desconectarse, generan un pico de voltaje inverso (puede ser >100V)
- Este pico puede dañar el relé y otros componentes

**Conexión:**
- **Cátodo (banda)** → Terminal positivo del solenoide
- **Ánodo** → Terminal negativo del solenoide

### 2. Fusible (F1 - 3A)
- Protege contra cortocircuitos
- Valor: 150% de la corriente nominal (2A × 1.5 = 3A)

### 3. Mejoras Opcionales
- **Varistor MOV 14V**: Protección adicional contra transitorios
- **Condensador 100nF**: Filtrado de ruido (paralelo a la entrada)

---

## 📐 Cómo usar EasyEDA

### Abrir el proyecto:

1. **Ve a** [https://easyeda.com/editor](https://easyeda.com/editor)
2. **Menú**: `File` → `Open` → `EasyEDA Source (JSON)`
3. **Selecciona** el archivo `circuito_rele_solenoide.json`

### Crear desde cero (recomendado para aprender):

#### Paso 1: Crear nuevo proyecto
1. Click en `File` → `New` → `Schematic`
2. Nombra el proyecto "Control Solenoide 12V"

#### Paso 2: Añadir componentes
1. Click en `Library` (panel izquierdo)
2. Busca cada componente:
   - Buscar: "1N4007" → Seleccionar → `Place`
   - Buscar: "LED" → Seleccionar → `Place`
   - Buscar: "Resistor" → Seleccionar → `Place`
   - Buscar: "Fuse" → Seleccionar → `Place`
   - Buscar: "2pin connector" → Seleccionar → `Place`

#### Paso 3: Conectar componentes
1. Usa la herramienta `Wire` (tecla `W`)
2. Click en un pin, arrastra hasta otro pin
3. Click para fijar la conexión

#### Paso 4: Editar valores
1. Click derecho en componente
2. `Edit Properties`
3. Cambiar valor (ej: "470" para resistencia)

---

## 🧪 Simulación en EasyEDA

### Preparar simulación:

1. **Añadir fuente de voltaje:**
   - `Library` → Buscar "VCC" y "GND"
   - Colocar VCC en la entrada +12V
   - Colocar GND en la entrada negativa

2. **Configurar simulación:**
   - `Simulate` → `Transient...`
   - Start: 0
   - Stop: 1s
   - Step: 1ms

3. **Ejecutar:**
   - Click en `Run`
   - Observa las formas de onda

### Qué verificar:

| Punto de medición | Valor esperado |
|-------------------|----------------|
| Voltaje en LED | ~2V (caída LED) + ~10V en R1 |
| Corriente en solenoide | ~2A |
| Pico al desconectar (sin diodo) | >50V |
| Pico al desconectar (con diodo) | <13V |

---

## 🔌 Montaje Físico

### Opción 1: Mini Protoboard (pruebas)

#### Anatomía de la Mini Protoboard
```
    Bus +  Bus -
     │      │
     ▼      ▼
   ┌─┬─┬─────────────────────────────┐
   │+│-│  a  b  c  d  e │ f  g  h  i │
   ├─┼─┼─────────────────────────────┤
   │●│●│  1  ●──●──●──●─┼─●──●──●──● │  ← Fila 1 conectada (a-e) y (f-i)
   │●│●│  2  ●──●──●──●─┼─●──●──●──● │
   │●│●│  3  ●──●──●──●─┼─●──●──●──● │
   │●│●│  ...                        │
   │●│●│  17 ●──●──●──●─┼─●──●──●──● │
   └─┴─┴─────────────────────────────┘
    ▲  ▲           ▲           ▲
    │  │           │           │
   Buses      Conectados   Conectados
   verticales  horizontal   horizontal
```

**Importante:**
- Los buses laterales (+/-) están conectados **verticalmente**
- Las filas centrales están conectadas **horizontalmente** (a-e juntas, f-i juntas)
- Hay una separación en el medio (entre e y f)

---

#### 📍 Diagrama de Conexión en Mini Protoboard

```
   MINI PROTOBOARD - VISTA SUPERIOR
   ═══════════════════════════════════════════════════════

   Bus(+)  Bus(-)     a    b    c    d    e  │  f    g    h    i
   ──────────────────────────────────────────┼────────────────────
     ●       ●    1   ○    ○    ○    ○    ○  │  ○    ○    ○    ○
     │       │        
     │       │    2   ○    ○    ○    ○    ○  │  ○    ○    ○    ○
     │       │    
   ┌─┴─┐     │    3  [+]━━[FUSIBLE 3A]━━[+] │  ○    ○    ○    ○
   │+12V     │        a3                 e3
   │del │    │
   │relé│    │    4   ●━━━━━━━━━━━━━━━━━━●  │  ○    ○    ○    ○
   └───┘     │        ▲ Puente de e3 a a4   
             │    
             │    5  [R]━━━[470Ω]━━━━━━[R] │  ○    ○    ○    ○
             │        a5               d5
             │
             │    6   ●    ○   [A]   [C]  ●  │  ○    ○    ○    ○
             │        │        LED──────▶│
             │        │         ▲        │
             │        │     (pata larga  │
             │        │      = ánodo)    │
             │    7   ●━━━━━━━━━━━━━━━━━━●  │  ○    ○    ○    ○
             │        ▲ Puente de d5 a c6
             │        ▲ Puente de e6 a a7
             │
             │    8   ○    ○    ○    ○    ○  │  ○    ○    ○    ○
             │
   ┌───┐     │    9  [+]━━[SOLENOIDE]━━[-] │ [C]━━[1N4007]━━[A]
   │GND│     │        a9    12V 2A     e9 │  f9    ▲         i9
   │del◄─────┘                             │       │
   │relé│                                  │    DIODO
   └─┬─┘     │   10   ●━━━━━━━━━━━━━━━━━━●  │  ●━━━━━━━━━━━━━━●
     │       │        ▲                  ▲     ▲              ▲
     │       │        │                  └─────┘              │
     │       │    Puente a10 a Bus(-)   e9-f9              i9 a a9
     │       │
     └───────┴───▶ Bus(-) conecta: fila 7, fila 10

   ═══════════════════════════════════════════════════════

   LEYENDA:
   ━━━  = Componente ocupando esos huecos
   ●    = Punto de conexión / puente
   ○    = Hueco libre
   [+]  = Terminal positivo
   [-]  = Terminal negativo
   [A]  = Ánodo (pata larga LED / sin banda diodo)
   [C]  = Cátodo (pata corta LED / banda blanca diodo)
```

---

#### 📋 Lista de Conexiones Paso a Paso

| Paso | Componente | Desde | Hasta | Notas |
|------|------------|-------|-------|-------|
| 1 | Cable rojo +12V | Relé (+) | Bus (+) | Alimentación entrada |
| 2 | Cable negro GND | Relé (-) | Bus (-) | Tierra entrada |
| 3 | Fusible 3A | a3 | e3 | En línea con +12V |
| 4 | Puente | e3 | a4 | Continuar +12V |
| 5 | Resistencia 470Ω | a5 | d5 | Para el LED |
| 6 | Puente | a4 | a5 | Conectar +12V a resistencia |
| 7 | LED | c6 (A) | e6 (C) | Ánodo=pata larga, Cátodo=pata corta |
| 8 | Puente | d5 | c6 | Resistencia → LED ánodo |
| 9 | Puente | e6 | Bus(-) | LED cátodo → GND |
| 10 | Cable solenoide + | a9 | - | Terminal + del solenoide |
| 11 | Puente | a4 | a9 | +12V → Solenoide |
| 12 | Cable solenoide - | e9 | - | Terminal - del solenoide |
| 13 | Puente | e9 | Bus(-) | Solenoide → GND |
| 14 | Diodo 1N4007 | f9 (C) | i9 (A) | ¡Cátodo(banda) al lado del +! |
| 15 | Puente | a9 | i9 | Ánodo diodo → + solenoide |
| 16 | Puente | e9 | f9 | Cátodo diodo → - solenoide |

---

#### 🔍 Vista Simplificada de Conexiones

```
                    +12V Bus                          GND Bus
                       │                                 │
                       ▼                                 │
         ┌─────────[FUSIBLE]─────────┐                   │
         │                           │                   │
         │    ┌──────────────────────┼───────────────────┤
         │    │                      │                   │
         │    │                      ▼                   │
         │    │              ┌───[R 470Ω]───┐            │
         │    │              │              │            │
         │    │              │            [LED]          │
         │    │              │              │            │
         │    │              │              └────────────┤
         │    │              │                           │
         ▼    ▼              ▼                           │
    ┌────●────●──────────────●────┐                      │
    │         SOLENOIDE           │                      │
    │          12V 2A             │                      │
    └────●───────────────────●────┘                      │
         │    ┌──[1N4007]──┐ │                           │
         │    │  (banda→+) │ │                           │
         └────┴────────────┴─┴───────────────────────────┘
```

---

#### ⚠️ Errores Comunes a Evitar

| Error | Consecuencia | Solución |
|-------|--------------|----------|
| Diodo al revés | No protege, puede explotar | Banda blanca va al + |
| LED al revés | No enciende | Pata larga al + (resistencia) |
| Olvidar fusible | Riesgo de incendio si hay corto | Siempre usar fusible |
| Cables finos | Se calientan con 2A | Usar AWG 18 o más grueso |
| No verificar continuidad | Conexiones sueltas | Usar multímetro antes |

---

#### 🧪 Test antes de conectar el solenoide

1. **Sin solenoide conectado:**
   - Activa el relé
   - El LED debe encender
   - Mide 12V entre a9 y Bus(-)

2. **Con multímetro en modo continuidad:**
   - Verifica que Bus(+) → Fusible → a9 tiene continuidad
   - Verifica que e9 → Bus(-) tiene continuidad

3. **Conectar solenoide:**
   - Si todo está OK, conecta el solenoide
   - Debe activarse y el LED debe encender

---

### Opción 2: PCB (producción)
1. En EasyEDA: `Design` → `Convert to PCB`
2. Rutar las pistas
3. Exportar Gerber para fabricación

---

## ⚠️ Notas Importantes

1. **Polaridad del LED**: El cátodo (pata corta) va a GND
2. **Polaridad del diodo**: La banda (cátodo) va al positivo del solenoide
3. **Calibre del cable**: Usa AWG 18 mínimo para el solenoide (2A)
4. **Disipación térmica**: La resistencia del LED disipa ~0.25W (usa ¼W mínimo)

---

## 🧮 Cálculos

### Resistencia para LED:
```
R = (Vsource - Vled) / Iled
R = (12V - 2V) / 0.02A = 500Ω → usar 470Ω estándar

Potencia = I² × R = 0.02² × 470 = 0.188W → usar ¼W
```

### Corriente del diodo flyback:
El 1N4007 soporta 1A continuo y 30A pico, suficiente para los picos del solenoide.

---

## 📁 Archivos del Proyecto

- `circuito_rele_solenoide.json` - Proyecto EasyEDA importable
- `README_CIRCUITO.md` - Esta documentación

---

## 🎓 Recursos para aprender EasyEDA

- [Tutorial oficial EasyEDA](https://docs.easyeda.com/en/Tutorial/Introduction.html)
- [Simulación de circuitos](https://docs.easyeda.com/en/Simulation/Schematic-simulation.html)
- [Crear PCB](https://docs.easyeda.com/en/PCB/PCB-Design-Introduction.html)
