exec(open("conjunto.py").read().replace('if __name__=="__main__":','if False:'))
import itertools
def Cy_y(x,y0,y1,z,r):  # cilindro eje Y entre y0 e y1
    return cylY(x,(y0+y1)/2,z,2*r,abs(y1-y0))
def Cy_z(x,y,z0,z1,r):
    return Pos(x,y,(z0+z1)/2)*Cylinder(r,abs(z1-z0))
fast = Compound([parts[k][0] for k in parts if k in ("Tornillos valvula M4x35","Tuercas valvula M4","Arandelas valvula M4","Tornillos base M6x35","Tuercas base","Arandelas base","Pasador trasero")])
Tie=parts["Pasador trasero"][0]
V=parts["Electrovalvula (cuerpo)"][0]+parts["Electrovalvula (bobina)"][0]+parts["Racores G1/8 valvula"][0]+parts["Silenciadores 5 y 3"][0]+parts["Racor entrada 1"][0]
static_obs={"panel+Y":pan_l,"panel-Y":pan_r,"valvula":V,"separador":parts["Separador del pasador"][0],"pedal":parts["Pedal (placa)"][0]+parts["Pedal (mecanismo)"][0],"bombo":parts["Bombo (referencia)"][0]+parts["Aro del bombo"][0],"tablero":parts["Tablero"][0]}
poses=[(20,15),(10,15),(30,15),(10,-35),(30,-35)]
def dyn_obs(a,sl):
    L=loc_for(a,sl); tp=tube_points(a,sl)
    return {"cilindro":L*(cp["cuerpo"]+cp["racores"]),"vastago":L*cp["vastago"],"aletas":L*legs,"tubo R":tube_solid(tp['R']),"tubo F":tube_solid(tp['F'])}
# envolventes de herramienta (mundo). cada una: (nombre, solido, depende_de_pose?)
env=[]
YH=PANEL_IN+T            # cara exterior panel
for sg in (1,):
    # tuercas/cabezas M6 de la varilla de union (llave de vaso 10: radio 10, 35 mm)
    env.append(("tuerca tornillo de union",Cy_y(TIE[0],YH+1.6+6, YH+1.6+6+35, TIE[1],10),False))
    env.append(("cabeza pivote M6",Cy_y(P0[0],YH+1.6+4,YH+1.6+4+35,P0[1],10),False))
    for t in (10,20,30):
        env.append((f"cabeza tornillo ranura curva ({t} grados)",Cy_y(P0[0]+R_ARC*sin(radians(t)),YH+1.6+4,YH+1.6+4+35,P0[1]-R_ARC*cos(radians(t)),10),False))
    for i,bx in enumerate(BASE_X):
        env.append((f"cabeza tornillo base x={bx}",Cy_z(bx,BASE_Y,BZ+T+4,BZ+T+4+35,10),False))
    for i,(hx,hz) in enumerate(VHOLES):
        env.append((f"cabeza M4 valvula {i+1} (llave Allen)",Cy_y(hx,YV0+22+4,YV0+22+4+40,hz,4.5),False))
        env.append((f"tuerca M4 valvula {i+1} (llave de vaso)",Cy_y(hx,PANEL_IN-0.8-5,PANEL_IN-0.8-5-30,hz,7.5),False))
# tuercas del pivote/ranura dentro de la aleta (llave plana de 3.5 mm de grosor, entra de lado) y tornillos Allen de las tapas (llave de 8 mm) -> dependen de la pose
def pose_env(a,sl):
    L=loc_for(a,sl); out=[]
    for nm,zc in (("tuerca pivote",Z_PIV),("tuerca ranura curva",Z_ARC)):
        zz=zc-sl
        jaw=Pos(0,(LEG_IN-3),zz)*Box(220,3.5,18)   # llave plana a lo largo del ancho del cilindro
        out.append((nm+" (llave plana)",L*jaw))
    for nm,zface,dirz in (("tornillo Allen tapa trasera",-C.BODY_L,-1),("tornillo Allen tapa delantera",0.0,1)):
        for x in (-20,20):
            z0=zface+dirz*(T+6)
            out.append((f"{nm} x={x}",L*(Pos(x,20,z0+dirz*22)*Cylinder(4,44))))
    return out
res=[]
for (a,sl) in poses:
    dobs=dyn_obs(a,sl)
    obs={**static_obs,**dobs}
    for nm,e,_ in env:
        e2=e-fast
        for on,o in obs.items():
            v=(e2&o).volume
            if v>2: res.append((f"{a}/{sl}",nm,on,round(v)))
    for nm,e in pose_env(a,sl):
        e2=e-fast
        # quitar la propia tuerca/tornillo: se resta lo que no es obstaculo real (pernos/tuercas M6 del pivote)
        e2=e2-(LOC_FIX:=Compound([parts[k][0] for k in ("Tornillos M6","Tuercas autoblocantes","Arandelas y separadores")]) if False else Compound([parts[k][0] for k in ("Tornillos M6","Tuercas autoblocantes","Arandelas y separadores")])) if False else e2
        for on,o in obs.items():
            if on in ("aletas",) and "Allen" in nm: pass
            v=(e2&o).volume
            if v>2: res.append((f"{a}/{sl}",nm,on,round(v)))
seen={}
for r in res: seen.setdefault((r[1],r[2]),[]).append((r[0],r[3]))
if not seen: print("Acceso: sin interferencias")
for k,v in seen.items(): print(k, v[:4])
