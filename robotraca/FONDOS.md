# Fondos del Reproductor Cassette

## Archivos de fondo

El reproductor utiliza dos imágenes de fondo diferentes según el dispositivo:

### Para escritorio (PC/laptop)
- **Archivo**: `images/bg.png`
- **Comportamiento**: Se muestra a pantalla completa con `background-size: cover`
- **Características**: La imagen cubre toda la pantalla manteniendo su proporción

### Para móviles
- **Archivo**: `images/bg-mobile.png`
- **Comportamiento**: Se ajusta al 100% del ancho y alto con `background-size: 100% 100%`
- **Características**: La imagen se estira para cubrir exactamente el ancho y alto de la pantalla

## Cómo personalizar los fondos

1. **Para escritorio**: Reemplaza `images/bg.png` con tu imagen PNG
   - Recomendado: Imágenes de alta resolución (1920x1080 o superior)
   - La imagen se escalará manteniendo su proporción

2. **Para móvil**: Reemplaza `images/bg-mobile.png` con tu imagen PNG
   - Recomendado: Imágenes optimizadas para móvil
   - La imagen se ajustará exactamente al tamaño de la pantalla del dispositivo

## Breakpoints

- **Escritorio**: > 768px de ancho
- **Tablet/Móvil**: ≤ 768px de ancho
- **Móvil pequeño**: ≤ 480px de ancho (ajustes adicionales de UI)

## Nota

Actualmente ambos archivos son copias de `bg.jpg`. Puedes reemplazarlos con tus propias imágenes PNG personalizadas.
