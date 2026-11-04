# Soporte de cilindro para pedal de bombo

Visor 3D (`index.html`) del soporte de un cilindro neumático 32/80 que acciona el pedal de un bombo.

- Dos paneles triangulares de acero de 4 mm sobre un tablero de contrachapado de 18 mm, con 150 mm de hueco libre para el pedal.
- Aletas de chapa en C atornilladas a las tapas del cilindro (M6 a 40 mm), con ranuras para ajustar alcance y ángulo.
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
- `conjunto_soporte.step` y `cilindro_32x80.step`: para abrir en FreeCAD u otro CAD.

Las medidas marcadas con `(*)` son estimadas y están por verificar.
