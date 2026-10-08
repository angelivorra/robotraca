// Metallic silver look for the grey/white faces of the robot, on top of a plain Lambert
// material (cheap: one extra block of maths per pixel, no extra lights or textures).
//
// A pixel counts as "silver" when its texture colour is a mid-light grey (the box faces).
// Saturated colours (yellow ears, purple base, red wire), near-black (eyes) and near-white
// (eye glints) are left untouched. The sheen is computed from the view-space normal, so it
// slides across the surface as the head moves.
export function makeSilver(material) {
    material.userData.silver = true;
    material.customProgramCacheKey = () => 'robot-silver';
    material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <opaque_fragment>',
            /* glsl */`
            {
                float lumS = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
                float satS = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b)
                           - min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);
                float silver = (1.0 - smoothstep(0.04, 0.09, satS))
                             * smoothstep(0.24, 0.32, lumS)
                             * (1.0 - smoothstep(0.62, 0.74, lumS));
                vec3 nS = normalize(normal);
                // Cool mid-grey base: darker underneath, lighter on top, bright rim, hot spot
                float up   = clamp(nS.y * 0.5 + 0.5, 0.0, 1.0);
                float spot = pow(clamp(dot(nS, normalize(vec3(-0.35, 0.55, 0.75))), 0.0, 1.0), 18.0);
                float rim  = pow(1.0 - clamp(nS.z, 0.0, 1.0), 2.5);
                vec3 metal = vec3(0.17, 0.19, 0.23) * (0.30 + 1.0 * up)
                           + vec3(0.55, 0.60, 0.70) * spot * 0.7
                           + vec3(0.12, 0.16, 0.26) * rim;
                // Soft diagonal streaks of light that slide over the faces as the head moves
                float diag  = -vViewPosition.x * 0.8 - vViewPosition.y * 0.6;
                float glint = pow(0.5 + 0.5 * sin(diag * 2.2), 8.0);
                metal += vec3(0.45, 0.50, 0.58) * glint * 0.55;
                metal *= 0.35 + lumS * 1.3;           // keep the texture's scratches and shading
                outgoingLight = mix(outgoingLight, metal, silver);
            }
            #include <opaque_fragment>`
        );
    };
    material.needsUpdate = true;
    return material;
}
