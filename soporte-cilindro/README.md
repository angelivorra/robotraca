# Soporte de cilindro para pedal de bombo

Visor 3D (`index.html`) del soporte de un cilindro neumático 32/80 que acciona el pedal de un bombo.

- Dos paneles triangulares de acero de 4 mm (base 200 mm, altura 382 mm) sobre un tablero de contrachapado de 90×90 cm y 18 mm, con 150 mm de hueco libre para el pedal.
- Aletas de chapa en C atornilladas a las tapas del cilindro (M6 a 40 mm), con ranuras para ajustar alcance y ángulo.
- Ajuste del cilindro: giro de 10° a 30° por la ranura curva y 50 mm de recorrido en las ranuras de las aletas (35 mm hacia arriba, 15 mm hacia abajo).
- Electroválvula Aignep 01V (5/2, G1/8) fijada a la cara exterior de un panel con 4 tornillos M4, y dos tubos de Ø6 mm que la unen a los racores del cilindro. Los tubos se deforman en el visor al mover el giro y las ranuras.
- El visor incluye el bombo, el aro y el pedal de referencia, con la placa inclinada y girando por el talón.
- Todo con tornillos y tuercas autoblocantes; las tuercas del tablero van por debajo, con arandela ancha.

## Carpeta `cad/`

Modelo paramétrico en [build123d](https://github.com/gumyr/build123d):

```bash
pip install build123d
cd cad
python export_viewer.py   # regenera viewer_data.json (malla para el visor)
```

- `conjunto.py`: paneles, soporte, tornillería y pedal de referencia. Las medidas están al principio.
- `cilindro.py`: el cilindro 32/80 con sus medidas reales.
- `conjunto_soporte.step` (soporte, cilindro y tornillería) y `cilindro_32x80.step` y `electrovalvula_aignep_01V.step` (cuerpo, bobina y racores; la bobina y el conector son estimados): para abrir en FreeCAD u otro CAD.

Las medidas marcadas con `(*)` son estimadas y están por verificar.
