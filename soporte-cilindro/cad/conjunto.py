from math import sin, cos, radians, atan2, degrees, hypot
from build123d import *
import cilindro as C

# ================= PARAMETROS (mm) =================
BOARD = (900, 900, 18)
ALPHA = 20.0                       # inclinacion cilindro desde la vertical hacia el pedal
T = 4.0                            # chapa
PEDAL_W = 140                      # (*) ancho pedal -> condiciona el hueco entre paneles
PANEL_IN = 75                      # cara interior panel (y=+-75) -> hueco 150
LEG_IN, LEG_OUT = 34, 38           # aleta del soporte: y 34..38
SPACER_L = PANEL_IN - LEG_OUT      # 22
P0 = (20, 18 + 334)                # pivote (x,z) mundo
R_ARC = 80; ARC = (10, 30)          # ranura curva (grados desde vertical)
Z_PIV, Z_ARC = -165, -85           # posicion de los 2 tornillos en el cilindro (z local)
SLOT = 50
PL, PH = 200, 382                  # largo base y alto del panel
FLANGE = 26
BASE_X = (30, 100, 170)
HOLE = 6.5
BZ = BOARD[2]

al = radians(ALPHA)
d = (sin(al), 0, -cos(al))
F0 = (P0[0] - Z_PIV*d[0], 0, P0[1] - Z_PIV*d[2])
def loc_for(a_deg, sl=0.0):
    a = radians(a_deg); dd = (sin(a), 0, -cos(a))
    O = (P0[0] + (-Z_PIV + sl)*dd[0], 0, P0[1] + (-Z_PIV + sl)*dd[2])
    return Pos(*O) * Rot(0, 180 - a_deg, 0)
LOC = loc_for(ALPHA, 0.0)      # local cilindro -> mundo
TIE = (18, BZ + 110)           # pasador de union trasero (entre paneles)

def cylY(x, y, z, dia, h): return Pos(x, y, z) * (Rot(90, 0, 0) * Cylinder(dia/2, h))
def hexp(af, h): return extrude(RegularPolygon(af/1.7320508, 6), amount=h)

parts = {}   # nombre -> (shape, color)

# ----- tablero + silentblocks
X_H = 233                      # cara exterior del aro del bombo (x)
BOARD_CX = 330
parts["Tablero"] = (Pos(BOARD_CX,0,BZ/2)*Box(*BOARD), "#c8a46e")
sb=None
for x in (BOARD_CX-400,BOARD_CX,BOARD_CX+400):
    for y in (-400,0,400):
        c=Pos(x,y,-12.5)*Cylinder(15,25); sb=c if sb is None else sb+c
parts["Silentblocks"]=(sb,"#222222")

# ----- panel triangular (lado +Y)
_R=24; _top=BZ+PH
_pts=[(0,BZ),(PL,BZ),(26+_R*0.4,_top)]
import math
_pts+= [(_R-_R*math.cos(math.radians(t)), _top-_R+_R*math.sin(math.radians(t))) for t in range(90,-1,-10)]  # esquina redondeada sup-izq
_pts=_pts[:-0 or None]
_pts=[(0,BZ),(PL,BZ),(26,_top)]+[(_R-_R*math.cos(math.radians(t)), _top-_R+_R*math.sin(math.radians(t))) for t in range(90,-1,-10)]
tri = Polygon(*_pts, align=None)
plate = Pos(0, PANEL_IN+T, 0)*(Rot(90,0,0)*extrude(tri, amount=T))
fl = Pos(PL/2, PANEL_IN+T+FLANGE/2-T/2+T/2-0, BZ+T/2)*Box(PL, FLANGE+T-0, T)   # y: PANEL_IN .. PANEL_IN+T+FLANGE
fl = Pos(PL/2, PANEL_IN + (T+FLANGE)/2, BZ+T/2)*Box(PL, T+FLANGE, T)
panel = plate + fl
# rigidizador: pestana a 90 grados a lo largo de la hipotenusa (hacia fuera)
hx0, hz0 = PL, BZ
hx1, hz1 = 26, BZ+PH
hl = hypot(hx1-hx0, hz1-hz0); ang = degrees(atan2(hz1-hz0, hx1-hx0))
LIP = 14
lip = Pos((hx0+hx1)/2, PANEL_IN+T+LIP/2, (hz0+hz1)/2) * (Rot(0,-ang,0)*Box(hl, LIP, T))
# desplazar hacia el interior del triangulo (para que no sobresalga de la hipotenusa)
nx, nz = -(hz1-hz0)/hl, (hx1-hx0)/hl      # normal hacia fuera (arriba-derecha)
lip = Pos(-nx*T/2, 0, -nz*T/2)*lip
panel += lip
yc = PANEL_IN + T/2
panel -= cylY(P0[0], yc, P0[1], HOLE, 20)
panel -= cylY(TIE[0], yc, TIE[1], HOLE, 20)
for i in range(31):
    a = radians(ARC[0]+(ARC[1]-ARC[0])*i/30)
    panel -= cylY(P0[0]+R_ARC*sin(a), yc, P0[1]-R_ARC*cos(a), HOLE, 20)
BASE_Y = PANEL_IN + T + FLANGE/2 + 0
for bx in BASE_X:
    panel -= Pos(bx, BASE_Y, BZ+T/2)*Cylinder(HOLE/2, 20)
pan_l = panel; pan_r = mirror(panel, Plane.XZ)
parts["Panel acero"] = (pan_l+pan_r, "#8f98a3")

# ----- soporte del cilindro (2 aletas con tabs), en marco LOCAL del cilindro
def leg(s):
    CW = C.CAP_W; zf, zr = 0.0, -C.BODY_L
    y_mid = s*(LEG_IN+LEG_OUT)/2
    body = Pos(0, y_mid, (zf+T+zr-T)/2)*Box(CW, T, (zf+T)-(zr-T))
    tab_y0, tab_y1 = 12.0, LEG_OUT
    tmid, tw = s*(tab_y0+tab_y1)/2, tab_y1-tab_y0
    front = Pos(0, tmid, zf+T/2)*Box(CW, tw, T)
    rear  = Pos(0, tmid, zr-T/2)*Box(CW, tw, T)
    front -= Pos(0,0,zf+T/2)*Cylinder(17.5, 10)           # paso de la brida
    b = body+front+rear
    for x in (-20,20):
        b -= Pos(x, s*20, zf+T/2)*Cylinder(3.3, 10)
        b -= Pos(x, s*20, zr-T/2)*Cylinder(3.3, 10)
    for zc in (Z_PIV+10, Z_ARC+10):
        for k in range(11):
            zz = zc-SLOT/2+SLOT*k/10
            b -= Pos(0, y_mid, zz)*(Rot(90,0,0)*Cylinder(HOLE/2, 12))
    return b
legs = leg(1)+leg(-1)
parts["Soporte cilindro (aletas)"] = (LOC*legs, "#3f7fd8")

# ----- cilindro
cp = C.build(0.0)
parts["Cilindro (cuerpo)"] = (LOC*cp["cuerpo"], "#2a2a2e")
parts["Vastago"] = (LOC*cp["vastago"], "#c9d0d8")
parts["Racores"] = (LOC*cp["racores"], "#e8e8e8")

# ----- tornilleria
def hexhead(y, z, x, sign, af=10, h=4):   # cabeza hexagonal con eje Y
    return None
bolts=None; nuts=None; washers=None; spacers=None
SPL={}
def add(a,b): return b if a is None else a+b
M6X = (P0[0], P0[0]+R_ARC*sin(al))  # x mundo de los 2 tornillos (solo para el panel); se coloca por local
for zc in (Z_PIV, Z_ARC):
    for s in (1,-1):
        # en marco local: eje Y
        y_head = s*(PANEL_IN+T)            # cara exterior panel
        wash = Pos(0, y_head+s*0.8, zc)*(Rot(90,0,0)*(Cylinder(6,1.6)-Cylinder(3.3,3)))
        head = Pos(0, y_head+s*(1.6+2), zc)*(Rot(90,0,0)*hexp(10,4).moved(Location((0,0,-2))))
        shank_len = (PANEL_IN+T+1.6) - (LEG_IN-6) + 2
        shank = cylY(0, s*((PANEL_IN+T+1.6) + (LEG_IN-6-2))/2, zc, 6, shank_len)
        nut = Pos(0, s*(LEG_IN-3), zc)*(Rot(90,0,0)*hexp(10,6).moved(Location((0,0,-3))))
        sp = Pos(0, s*(LEG_OUT+PANEL_IN)/2, zc)*(Rot(90,0,0)*(Cylinder(8,SPACER_L)-Cylinder(3.3,SPACER_L+2)))
        bolts = add(bolts, head+shank); washers = add(washers, wash); nuts = add(nuts, nut); spacers = add(spacers, sp)
        key = 'piv' if zc == Z_PIV else 'arc'
        for nm, shp in (('bolt', head+shank), ('wash', wash), ('nut', nut), ('wash', sp)):
            SPL[(nm, key)] = add(SPL.get((nm, key)), shp)
# tornillos M6x16 DIN912 a las tapas (8)
for s in (1,-1):
    for x in (-20,20):
        for zface, dirz in ((0.0,1),(-C.BODY_L,-1)):
            z0 = zface + dirz*T
            head = Pos(x, s*20, z0 + dirz*3)*Cylinder(5,6)
            shank = Pos(x, s*20, z0 - dirz*6)*Cylinder(3,12+0)
            bolts = add(bolts, head+shank)
            SPL[('bolt','cap')] = add(SPL.get(('bolt','cap')), head+shank)
parts["Tornillos M6"]=(None,"#d9a82a")
bolts_w = LOC*bolts
parts["Tornillos M6"]=(bolts_w,"#d9a82a")
parts["Tuercas autoblocantes"]=(LOC*nuts,"#e5c050")
parts["Arandelas y separadores"]=(LOC*washers+LOC*spacers,"#b0b6bd")

# tornillos base: cabeza arriba, arandela y tuerca abajo
bb=None; bn=None; bw=None
for sg in (1,-1):
    for bx in BASE_X:
        y=sg*BASE_Y
        h = Pos(bx,y,BZ+T+2)*hexp(10,4).moved(Location((0,0,-2)))
        sh = Pos(bx,y,(BZ+T-BZ-9)/2+0)*Cylinder(3,BZ+T+9)
        w  = Pos(bx,y,-0.8)*(Cylinder(9,1.6)-Cylinder(3.3,3))
        n  = Pos(bx,y,-1.6-3)*hexp(10,6).moved(Location((0,0,-3)))
        bb=add(bb,h+sh); bw=add(bw,w); bn=add(bn,n)
parts["Tornillos base M6x35"]=(bb,"#d9a82a")
parts["Tuercas base"]=(bn,"#e5c050")
parts["Arandelas base"]=(bw,"#b0b6bd")

tie_len = 2*(PANEL_IN+T) + 2*(1.6+6) + 4
tie = cylY(TIE[0], 0, TIE[1], 6, tie_len)
tie_w = None; tie_n = None
for sg in (1,-1):
    tie_w = add(tie_w, cylY(TIE[0], sg*(PANEL_IN+T+0.8), TIE[1], 12, 1.6) - cylY(TIE[0], sg*(PANEL_IN+T+0.8), TIE[1], 6.4, 3))
    tie_n = add(tie_n, Pos(TIE[0], sg*(PANEL_IN+T+1.6+3), TIE[1])*(Rot(90,0,0)*hexp(10,6).moved(Location((0,0,-3)))))
parts["Pasador trasero"] = (tie + tie_n + tie_w, "#c9a227")
parts["Separador del pasador"] = (cylY(TIE[0],0,TIE[1],16,2*PANEL_IN) - cylY(TIE[0],0,TIE[1],6.4,2*PANEL_IN+2), "#b0b6bd")

# --- pedal de referencia (placa 30 cm, ancho 14->7 cm, reposo 40 mm / pulsada 30 mm en el punto de golpeo) + mecanismo junto al aro
_w=[(0,70),(80,55),(130,50),(300,35)]
_pts=[(X_H-d,w) for d,w in _w]+[(X_H-d,-w) for d,w in reversed(_w)]
_plate0=Pos(0,0,BZ+10)*extrude(Polygon(*_pts, align=None),amount=15)   # cara superior a BZ+25 en la bisagra
HINGE=(X_H-300, BZ+25)                # eje de giro: talon, el extremo mas lejano del bombo
PLATE_TILT=5.0                         # grados, mas alta cerca del bombo
_plate=Pos(HINGE[0],0,HINGE[1])*Rot(0,-PLATE_TILT,0)*Pos(-HINGE[0],0,-HINGE[1])*_plate0
_mech=Pos(X_H-40,0,BZ+50)*Box(80,140,100)
parts["Pedal (placa)"]=(_plate,"#b03a3a")
parts["Pedal (mecanismo)"]=(_mech,"#7d2a2a")
parts["Pedal (referencia)"]=(_plate+_mech,"#b03a3a")
# --- bombo: 57 cm de diametro, 46 cm de fondo, apoyado en el tablero; aro en x=X_H
_shell=Pos(X_H+10+230,0,BZ+285)*(Rot(0,90,0)*Cylinder(285,460))
_hoop=Pos(X_H+10,0,BZ+285)*(Rot(0,90,0)*(Cylinder(295,20)-Cylinder(280,22)))
parts["Bombo (referencia)"]=(_shell,"#17171a")
parts["Aro del bombo"]=(_hoop,"#c4c8cc")

if __name__=="__main__":
    import sys
    # interferencias
    names=["Cilindro (cuerpo)","Vastago","Soporte cilindro (aletas)","Panel acero","Pedal (referencia)","Tablero","Tuercas autoblocantes","Racores"]
    pairs=[("Cilindro (cuerpo)","Soporte cilindro (aletas)"),("Cilindro (cuerpo)","Panel acero"),("Cilindro (cuerpo)","Tuercas autoblocantes"),
           ("Vastago","Panel acero"),("Vastago","Pedal (referencia)"),("Cilindro (cuerpo)","Pedal (referencia)"),("Cilindro (cuerpo)","Tablero"),
           ("Soporte cilindro (aletas)","Panel acero"),("Soporte cilindro (aletas)","Tablero"),("Racores","Panel acero"),("Racores","Soporte cilindro (aletas)"),
           ("Tuercas autoblocantes","Soporte cilindro (aletas)")]
    for a,b in pairs:
        try:
            v=(parts[a][0]&parts[b][0]).volume
        except Exception as e: v=f"err {e}"
        print(f"{a:28s} x {b:28s}: {v if isinstance(v,str) else round(v,1)} mm3")
    bb=Compound([p for k,(p,c) in parts.items()]).bounding_box()
    print("bbox", bb.min, bb.max)
    for k in ("Vastago",):
        b=parts[k][0].bounding_box(); print(k,b.min,b.max)
