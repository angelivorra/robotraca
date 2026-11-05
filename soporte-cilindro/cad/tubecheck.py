exec(open("conjunto.py").read().replace('if __name__=="__main__":','if False:'))
import numpy as np
def rmin(pts):
    path=Spline(*[Vector(*p) for p in pts]); P=np.array([tuple(path.position_at(i/200)) for i in range(201)]); r=1e9; L=np.sum(np.linalg.norm(np.diff(P,axis=0),axis=1))
    for i in range(2,len(P)-2):
        A,B,Cc=P[i-2],P[i],P[i+2]; a_=np.linalg.norm(B-Cc); b_=np.linalg.norm(A-Cc); c_=np.linalg.norm(A-B); area=np.linalg.norm(np.cross(B-A,Cc-A))/2
        if area>1e-6: r=min(r,a_*b_*c_/(4*area))
    return L,r
V=parts["Electrovalvula (cuerpo)"][0]+parts["Electrovalvula (bobina)"][0]+parts["Racores G1/8 valvula"][0]+parts["Silenciadores 5 y 3"][0]+parts["Racor entrada 1"][0]
Vbody=parts["Electrovalvula (cuerpo)"][0]+parts["Electrovalvula (bobina)"][0]
others={"Panel+":pan_l,"Panel-":pan_r,"Tie":parts["Pasador trasero"][0]+parts["Separador del pasador"][0],"M6":parts["Tornillos M6"][0]+parts["Tuercas autoblocantes"][0]+parts["Arandelas y separadores"][0],"Pedal":parts["Pedal (placa)"][0]+parts["Pedal (mecanismo)"][0],"Tablero":parts["Tablero"][0],"Bombo":parts["Bombo (referencia)"][0]+parts["Aro del bombo"][0],"M4":parts["Tornillos valvula M4x35"][0]+parts["Tuercas valvula M4"][0]+parts["Arandelas valvula M4"][0]}
print("valvula vs panel+ (debe ser 0):",round((V&pan_l).volume,1),"| valvula vs tornilleria M6:",round((V&others["M6"]).volume,1),"| valvula vs tie:",round((V&others["Tie"]).volume,1))
bb=V.bounding_box(); print("valvula bbox x",round(bb.min.X),round(bb.max.X)," y",round(bb.min.Y),round(bb.max.Y)," z",round(bb.min.Z),round(bb.max.Z))
res=[]; Ls=[]; rs=[]
for a,sl in ((20,15),(10,15),(30,15),(10,-35),(30,-35),(20,-10),(30,0),(10,0)):
    tp=tube_points(a,sl); sol={k:tube_solid(p) for k,p in tp.items()}
    for k,p in tp.items():
        L,r=rmin(p); Ls.append(L); rs.append(r)
    Lc=loc_for(a,sl); cyl=(Lc*cp["cuerpo"], Lc*legs, Lc*cp["vastago"], Lc*cp["racores"])
    for k,t in sol.items():
        for n,sh in others.items():
            v=(t&sh).volume
            if v>1: res.append((a,sl,k,n,round(v)))
        v=(t&Vbody).volume
        if v>40: res.append((a,sl,k,"valvula (cuerpo)",round(v)))
        for ci,c in zip(("cuerpo","aletas","vastago","racores"),cyl):
            v=(t&c).volume
            if v>20: res.append((a,sl,k,ci,round(v)))
    v=(sol['R']&sol['F']).volume
    if v>1: res.append((a,sl,"R-F",round(v)))
print("choques tubos:",res or "ninguno"); print("longitud mm: min",round(min(Ls)),"max",round(max(Ls)),"| radio minimo",round(min(rs)))
