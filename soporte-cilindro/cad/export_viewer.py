import json, os
exec(open("conjunto.py").read().replace('if __name__=="__main__":','if False:'))
def w2t(q): return (q.X, q.Z, -q.Y)
items=[]   # (nombre, forma, color, grupo)
def add_item(n,p,c,g): items.append((n,p,c,g))
for k,(p,c) in parts.items():
    if k in ("Tornillos M6","Tuercas autoblocantes","Arandelas y separadores","Pedal (referencia)","Tubos de aire"): continue
    if k=="Tablero": add_item(k,p,"#8f6f45","static"); continue
    if k=="Pedal (placa)": add_item(k,p,c,"plate"); continue
    if k=="Panel acero":
        add_item("Panel +Y",pan_l,c,"static"); add_item("Panel -Y",pan_r,c,"static"); continue
    g = "cyl" if k in ("Cilindro (cuerpo)","Racores","Soporte cilindro (aletas)") else ("rod" if k=="Vastago" else "static")
    add_item(k,p,("#1c1c20" if k=="Cilindro (cuerpo)" else ("#e3e8ec" if k=="Vastago" else c)),g)
GOLD,NUT,GREY="#d9a82a","#e5c050","#b0b6bd"
names={'bolt':("Tornillos M6",GOLD),'nut':("Tuercas autoblocantes",NUT),'wash':("Arandelas y separadores",GREY)}
grp={'piv':'fixed','arc':'arc','cap':'cyl'}
for (kind,key),shp in SPL.items():
    n,c=names[kind]; add_item(n, LOC*shp, c, grp[key])
out=[]
for n,p,c,g in items:
    v,t=p.tessellate(0.12,0.12)
    verts=[w2t(q) for q in v]; flat=[]
    for a,b,cc in t:
        for i in (a,b,cc): flat.extend(round(x,1) for x in verts[i])
    out.append({"name":n,"color":c,"grp":g,"pos":flat})
def W(x,y,z):
    q=(LOC*Pos(x,y,z)).position; return w2t(q)
pts={
 "p0":(P0[0],P0[1],0),"alpha":ALPHA,"r_arc":R_ARC,
 "pivot_out":W(0,PANEL_IN+T+2,Z_PIV),"pivot_nut":W(0,31,Z_PIV),"arc_out":W(0,PANEL_IN+T+2,Z_ARC),"arc_nut":W(0,31,Z_ARC),
 "rear_tab":W(0,20,-C.BODY_L-3),"front_tab":W(0,20,3),"base":(BASE_X[1],BZ+2,-BASE_Y),
 "tie":(TIE[0],TIE[1],0),"valve":(VX,VZ,-(YV0+11)),"tip":W(0,0,C.BOSS_H+C.ROD_OUT),"pedal_rest":40,"pedal_travel":10,"hinge":(HINGE[0],HINGE[1],0),"tilt":PLATE_TILT,"s_min":-35,"s_max":15,"min_tip":25,"board_top":BZ,"hoop_x":X_H,"arc0":ARC[0],"arc1":ARC[1],
}
pts={k:([round(x,1) for x in v] if isinstance(v,(tuple,list)) else v) for k,v in pts.items()}
tubes=[]
for k,zl in (('R',-C.BODY_L+C.CAP_T/2),('F',-C.CAP_T/2)):
    ee,oo=_cyl_port(ALPHA,0.0,zl)
    tubes.append({"name":k,"static":[[round(c,1) for c in w2t(type("Q",(),{"X":p[0],"Y":p[1],"Z":p[2]})())] for p in [(_vx,_YV,_vz[k])]+_STATIC[k]],
                  "att":[[round(c,1) for c in w2t(type("Q",(),{"X":p[0],"Y":p[1],"Z":p[2]})())] for p in (oo,ee)]})
json.dump({"meshes":out,"pts":pts,"tubes":tubes},open("viewer_data.json","w"),separators=(",",":"))
print(os.path.getsize("viewer_data.json")/1e6,"MB"); print(pts)
