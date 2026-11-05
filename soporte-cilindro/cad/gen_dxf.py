"""Desarrollos planos (orientativos) de las 4 piezas de chapa de acero de 4 mm. Unidades: mm.
Radio interior de plegado r = 4 mm y factor K = 0.4 (el taller debe ajustarlos a su utillaje).
Capas del DXF: CORTE (contorno y agujeros), PLEGADO (lineas de plegado), NOTAS.
Uso: python gen_dxf.py <carpeta_de_salida>   (necesita build123d y ezdxf)"""
import sys, math, ezdxf
exec(open("conjunto.py").read().replace('if __name__=="__main__":','if False:'))
OUT = sys.argv[1] if len(sys.argv) > 1 else "."
r_, K_ = 4.0, 0.4
BA = math.pi/2*(r_ + K_*T)                      # tolerancia de plegado, 8.796 mm

def arc(cx, cy, R, a0, a1, n=24):
    return [(cx+R*math.cos(math.radians(a0+(a1-a0)*i/n)), cy+R*math.sin(math.radians(a0+(a1-a0)*i/n))) for i in range(n+1)]
def rsquare(cx, cy, s=8.6, rad=3.3):             # agujero cuadrado redondeado (holgura de +-1 mm para un M6)
    h = s/2 - rad; pts = []
    for sx, sy, a0 in ((1,1,0), (-1,1,90), (-1,-1,180), (1,-1,270)):
        pts += arc(cx+sx*h, cy+sy*h, rad, a0, a0+90, 8)
    return pts
def slot(c0, c1, w):                              # ranura recta entre dos centros
    a = math.degrees(math.atan2(c1[1]-c0[1], c1[0]-c0[0])); R = w/2
    return arc(c1[0], c1[1], R, a-90, a+90, 12) + arc(c0[0], c0[1], R, a+90, a+270, 12)
def arcslot(cx, cy, R, a0, a1, w):               # ranura curva; angulos desde la vertical hacia abajo, hacia +x
    rh = lambda a: (math.sin(math.radians(a)), -math.cos(math.radians(a)))
    th = lambda a: (math.cos(math.radians(a)), math.sin(math.radians(a)))
    pt = lambda a, rr: (cx+rr*rh(a)[0], cy+rr*rh(a)[1])
    ang = [a0+(a1-a0)*i/40 for i in range(41)]
    pts = [pt(a, R+w/2) for a in ang]
    e1 = pt(a1, R)
    pts += [(e1[0]+w/2*(math.cos(f)*rh(a1)[0]+math.sin(f)*th(a1)[0]), e1[1]+w/2*(math.cos(f)*rh(a1)[1]+math.sin(f)*th(a1)[1])) for f in [math.pi*i/12 for i in range(1,12)]]
    pts += [pt(a, R-w/2) for a in reversed(ang)]
    e0 = pt(a0, R)
    pts += [(e0[0]+w/2*(-math.cos(f)*rh(a0)[0]-math.sin(f)*th(a0)[0]), e0[1]+w/2*(-math.cos(f)*rh(a0)[1]-math.sin(f)*th(a0)[1])) for f in [math.pi*i/12 for i in range(1,12)]]
    return pts
def save(name, outline, holes, bends, notes):
    doc = ezdxf.new("R2010"); doc.units = ezdxf.units.MM
    doc.layers.add("CORTE", color=7); doc.layers.add("PLEGADO", color=1); doc.layers.add("NOTAS", color=3)
    msp = doc.modelspace()
    msp.add_lwpolyline(outline, close=True, dxfattribs={"layer": "CORTE"})
    for h in holes:
        if isinstance(h, tuple): msp.add_circle(h[0], h[1], dxfattribs={"layer": "CORTE"})
        else: msp.add_lwpolyline(h, close=True, dxfattribs={"layer": "CORTE"})
    for a, b in bends: msp.add_line(a, b, dxfattribs={"layer": "PLEGADO"})
    y = -12
    for line in notes:
        msp.add_text(line, height=4, dxfattribs={"layer": "NOTAS", "insert": (0, y)}); y -= 7
    doc.saveas(f"{OUT}/{name}.dxf")

# ---------------- ALETA (2 iguales) ----------------
def aleta():
    W = LEG_W; Wi = C.BODY_L + 0.4; F = 25.0              # interior entre pestanas 208.8 (cilindro 208.4); pestana de 25 desde la cara interior
    Lf = Wi + 2*F - 4*r_ + 2*BA
    u1 = F - r_ + BA/2; u2 = Lf - u1                      # lineas de plegado
    ue = F - r_ + BA - r_                                 # u de la cara interior de la pestana delantera (esquina virtual interior)
    a_end = math.degrees(math.asin(12/17.5))              # entalladura R17.5 para la brida, con el centro 12 mm fuera del borde
    outline = [(0, 0)] + arc(W/2, -12, 17.5, 180-a_end, a_end, 24) + [(W, 0), (W, Lf), (0, Lf)]
    hy = C.HOLE_SPY/2 - 12                                # distancia del centro del agujero al borde libre de la pestana
    holes = [rsquare(W/2+sx*C.HOLE_SPX/2, uc) for uc in (hy, Lf-hy) for sx in (-1, 1)]
    for w in (155.0, 75.0):                               # ranuras: centros a 155 y 75 mm de la cara interior de la pestana delantera
        uc = ue + w
        holes.append(slot((W/2, uc-25), (W/2, uc+25), 6.5))
    notes = ["ALETA (x2, iguales) - acero 4 mm", f"Desarrollo orientativo r=4 K=0.4: {Lf:.1f} x {W} mm",
             "Plegar las dos pestanas 90 grados hacia el mismo lado (pestana con entalladura = delantera)",
             "Interior entre pestanas 208.8 mm"]
    save("aleta_x2", outline, holes, [((0, u1), (W, u1)), ((0, u2), (W, u2))], notes)
    return Lf

# ---------------- PANELES ----------------
def panel(mirror, valve, name):
    off = (FLANGE - r_) + BA - r_                          # Y plano de la esquina virtual interior (z=22, cara superior de la pestana)
    Y = lambda z: z - (BZ + T) + off
    Zt, R = BZ + PH, 24.0
    p0 = (PL, Y(BZ)); p_top = (26.0, Y(Zt))
    L = math.hypot(p_top[0]-p0[0], p_top[1]-p0[1]); d = ((p_top[0]-p0[0])/L, (p_top[1]-p0[1])/L); n = (abs(d[1]), abs(d[0]))
    lipw = LIP - 2*r_ + BA
    P = lambda s: (p0[0]+d[0]*s, p0[1]+d[1]*s)
    Pa, Pb = P(LIP_T0), P(LIP_T1)
    Pa2 = (Pa[0]+n[0]*lipw, Pa[1]+n[1]*lipw); Pb2 = (Pb[0]+n[0]*lipw, Pb[1]+n[1]*lipw)
    corner = [(R-R*math.cos(math.radians(90-i*9)), Y(Zt)-R+R*math.sin(math.radians(90-i*9))) for i in range(11)]
    outline = [(0, 0), (PL, 0), p0, Pa, Pa2, Pb2, Pb, p_top] + corner
    holes = [((P0[0], Y(P0[1])), HOLE/2), ((TIE[0], Y(TIE[1])), HOLE/2), arcslot(P0[0], Y(P0[1]), R_ARC, ARC[0], ARC[1], HOLE)]
    holes += [((bx, FLANGE-16.0), HOLE/2) for bx in BASE_X]
    if valve: holes += [((hx, Y(hz)), 2.5) for hx, hz in VHOLES]
    yb = (FLANGE - r_) + BA/2
    sh = BA/2 - r_
    bends = [((0, yb), (PL-1.6, yb)), ((Pa[0]+n[0]*sh, Pa[1]+n[1]*sh), (Pb[0]+n[0]*sh, Pb[1]+n[1]*sh))]
    if mirror:
        f = lambda p: (PL + 8.0 - p[0], p[1])
        outline = [f(p) for p in outline]
        holes = [(f(h[0]), h[1]) if isinstance(h, tuple) else [f(p) for p in h] for h in holes]
        bends = [(f(a), f(b)) for a, b in bends]
    notes = [f"{name} - acero 4 mm (una pieza y su simetrica)", "Desarrollo orientativo r=4 K=0.4",
             "Plegar la pestana de base (32 mm) y la pestana de la hipotenusa (14 mm) 90 grados hacia el mismo lado",
             "Reliefs de plegado en los extremos de la pestana de la hipotenusa: a definir por el taller"]
    if valve: notes.append("Lleva 4 agujeros D5 para la electrovalvula")
    save(name, outline, holes, bends, notes)

if __name__ == "__main__":
    Lf = aleta()
    panel(False, True, "panel_A_con_valvula")
    panel(True, False, "panel_B_simetrico")
    print("aleta: desarrollo", round(Lf, 2), "x", LEG_W)
    export_step(leg(1), f"{OUT}/aleta.step")
    export_step(pan_l, f"{OUT}/panel_A_con_valvula.step")
    export_step(pan_r, f"{OUT}/panel_B_simetrico.step")
