"""Cilindro neumatico 32/080 (tipo tirantes). Eje Z; z=0 = cara exterior tapa delantera (nivel orejas),
vastago hacia +Z, cuerpo hacia -Z. Medidas en mm. (*) = estimado, por verificar."""
from build123d import *

CAP_W      = 52.0     # tapa cuadrada
HOLE_SP    = 40.0     # distancia entre agujeros de esquina
HOLE_D     = 5.0      # rosca M6 (broca ~5)
HOLE_DEPTH = 12.0     # (*)
BODY_L     = 210.0    # de tapa a tapa
CAP_T      = 20.0     # (*) grosor de cada tapa
TUBE_D     = 45.0
TIE_D      = 6.0      # (*)
BOSS_D, BOSS_H = 32.0, 14.2     # brida sobre las orejas
ROD_D      = 18.0     # vastago liso
ROD_OUT    = 54.2     # total sobre la brida
THREAD_D, THREAD_L = 15.0, 52.0 # rosca (14.6-15 medido)
STROKE     = 80.0
PORT_D, PORT_L = 10.0, 14.0     # racor push-in (*)

def build(extended=0.0):
    corners = [(sx*HOLE_SP/2, sy*HOLE_SP/2) for sx in (1,-1) for sy in (1,-1)]
    front = Pos(0,0,-CAP_T/2)*Box(CAP_W,CAP_W,CAP_T)
    rear  = Pos(0,0,-BODY_L+CAP_T/2)*Box(CAP_W,CAP_W,CAP_T)
    tube  = Pos(0,0,-BODY_L/2)*Cylinder(TUBE_D/2, BODY_L-2*CAP_T)
    ties = None
    for x,y in corners:
        t = Pos(x,y,-BODY_L/2)*Cylinder(TIE_D/2, BODY_L-2*CAP_T)
        ties = t if ties is None else ties+t
    boss = Pos(0,0,BOSS_H/2)*Cylinder(BOSS_D/2, BOSS_H)
    rod_smooth = ROD_OUT-THREAD_L
    z0 = BOSS_H - STROKE - 5          # el vastago continua por dentro del cuerpo (oculto) para que no quede hueco al extenderse
    rod = Pos(0,0,(z0+BOSS_H+extended)/2)*Cylinder(ROD_D/2, BOSS_H+extended-z0)
    # vastago liso + rosca (sobresalen ROD_OUT desde la brida; extended = carrera recorrida)
    rod_s = Pos(0,0,BOSS_H+extended+rod_smooth/2)*Cylinder(ROD_D/2, rod_smooth)
    rod_t = Pos(0,0,BOSS_H+extended+rod_smooth+THREAD_L/2)*Cylinder(THREAD_D/2, THREAD_L)
    body = front+rear+tube+ties+boss
    for x,y in corners:   # agujeros M6 (ambas tapas, por fuera)
        body -= Pos(x,y,-HOLE_DEPTH/2)*Cylinder(HOLE_D/2,HOLE_DEPTH)
        body -= Pos(x,y,-BODY_L+HOLE_DEPTH/2)*Cylinder(HOLE_D/2,HOLE_DEPTH)
    ports = None
    for z in (-CAP_T/2, -BODY_L+CAP_T/2):
        p = Pos(CAP_W/2+PORT_L/2,0,z)*(Rot(0,90,0)*Cylinder(PORT_D/2,PORT_L))
        ports = p if ports is None else ports+p
    return {"cuerpo":body, "vastago":rod+rod_s+rod_t, "racores":ports}

if __name__=="__main__":
    import sys, pickle
    parts = build(0.0)
    export_step(Compound(list(parts.values())), sys.argv[1]+"/cilindro_32x80.step")
    pickle.dump({k:([(q.X,q.Y,q.Z) for q in v],t) for k,p in parts.items() for v,t in [p.tessellate(0.3,0.2)]}, open("cil.pkl","wb"))
    bb=Compound(list(parts.values())).bounding_box(); print(bb.min,bb.max)
