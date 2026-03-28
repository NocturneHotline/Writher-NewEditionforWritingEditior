import React, { useEffect, useRef } from 'react';

interface ShaderCanvasProps {
  mode: 'rainy' | 'snowy';
  blur: number;
  intensity: number;
  backgroundImageUrl: string;
  backgroundMode: 'default' | 'custom';
}

interface UniformLocations {
  iResolution: WebGLUniformLocation | null;
  iImageResolution: WebGLUniformLocation | null;
  iTime: WebGLUniformLocation | null;
  iIntensity: WebGLUniformLocation | null;
  iBlur: WebGLUniformLocation | null;
  iChannel0: WebGLUniformLocation | null;
}

const ShaderCanvas: React.FC<ShaderCanvasProps> = ({ mode, blur, intensity, backgroundImageUrl, backgroundMode }) => {
  const finalBackgroundSource = backgroundImageUrl;
  console.log("ShaderCanvas Render - mode:", mode, "backgroundMode:", backgroundMode, "backgroundImageUrl:", finalBackgroundSource?.substring(0, 50) + "...");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const textureRef = useRef<WebGLTexture | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const uniformLocsRef = useRef<UniformLocations | null>(null);
  const lastLoggedUrlRef = useRef<string | null>(null);

  const rainyShader = `
    precision highp float;
    uniform vec2 iResolution;
    uniform vec2 iImageResolution;
    uniform float iTime;
    uniform float iIntensity;
    uniform sampler2D iChannel0;

    #define S(a, b, t) smoothstep(a, b, t)

    vec3 N13(float p) {
       vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
       p3 += dot(p3, p3.yzx + 19.19);
       return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
    }

    float N(float t) {
        return fract(sin(t*12345.564)*7658.76);
    }

    float Saw(float b, float t) {
        return S(0., b, t)*S(1., b, t);
    }

    vec2 DropLayer2(vec2 uv, float t) {
        vec2 UV = uv;
        uv.y += t*0.75;
        vec2 a = vec2(6., 1.);
        vec2 grid = a*2.;
        vec2 id = floor(uv*grid);
        float colShift = N(id.x); 
        uv.y += colShift;
        id = floor(uv*grid);
        vec3 n = N13(id.x*35.2+id.y*2376.1);
        vec2 st = fract(uv*grid)-vec2(.5, 0);
        float x = n.x-.5;
        float y = UV.y*20.;
        float wiggle = sin(y+sin(y));
        x += wiggle*(.5-abs(x))*(n.z-.5);
        x *= .7;
        float ti = fract(t+n.z);
        y = (Saw(.85, ti)-.5)*.9+.5;
        vec2 p = vec2(x, y);
        float d = length((st-p)*a.yx);
        float mainDrop = S(.4, .0, d);
        float r = sqrt(S(1., y, st.y));
        float cd = abs(st.x-x);
        float trail = S(.23*r, .15*r*r, cd);
        float trailFront = S(-.02, .02, st.y-y);
        trail *= trailFront*r*r;
        y = UV.y;
        float trail2 = S(.2*r, .0, cd);
        float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
        y = fract(y*10.)+(st.y-.5);
        float dd = length(st-vec2(x, y));
        droplets = S(.3, 0., dd);
        return vec2(mainDrop+droplets*r*trailFront, trail);
    }

    float StaticDrops(vec2 uv, float t) {
        uv *= 40.;
        vec2 id = floor(uv);
        uv = fract(uv)-.5;
        vec3 n = N13(id.x*107.45+id.y*3543.654);
        vec2 p = (n.xy-.5)*.7;
        float d = length(uv-p);
        float fade = Saw(.025, fract(t+n.z));
        return S(.3, 0., d)*fract(n.z*10.)*fade;
    }

    vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
        float s = StaticDrops(uv, t)*l0; 
        vec2 m1 = DropLayer2(uv, t)*l1;
        vec2 m2 = DropLayer2(uv*1.85, t)*l2;
        float c = s+m1.x+m2.x;
        c = S(.3, 1., c);
        return vec2(c, max(m1.y*l0, m2.y*l1));
    }

    vec2 getCoverUV(vec2 fragCoord, vec2 resolution, vec2 imageResolution) {
        vec2 uv = fragCoord / resolution;
        if (imageResolution.x <= 0.0 || imageResolution.y <= 0.0) return uv;
        float screenAspect = resolution.x / resolution.y;
        float imageAspect = imageResolution.x / imageResolution.y;
        if (screenAspect > imageAspect) {
            float scale = screenAspect / imageAspect;
            uv.y = (uv.y - 0.5) / scale + 0.5;
        } else {
            float scale = imageAspect / screenAspect;
            uv.x = (uv.x - 0.5) / scale + 0.5;
        }
        return uv;
    }

    void main() {
        vec2 uv = (gl_FragCoord.xy-.5*iResolution.xy) / iResolution.y;
        vec2 UV = getCoverUV(gl_FragCoord.xy, iResolution, iImageResolution);
        float T = iTime * 0.2;
        
        float rainAmount = iIntensity;
        
        float staticDrops = S(-.5, 1., rainAmount)*2.;
        float layer1 = S(.25, .75, rainAmount);
        float layer2 = S(.0, .5, rainAmount);
        
        vec2 c = Drops(uv, T, staticDrops, layer1, layer2);
        vec2 e = vec2(.001, 0.);
        float cx = Drops(uv+e, T, staticDrops, layer1, layer2).x;
        float cy = Drops(uv+e.yx, T, staticDrops, layer1, layer2).x;
        vec2 n = vec2(cx-c.x, cy-c.x);
        
        // Final background sampling - single sample with minimal refraction
        // Clamp UV to prevent streaking at edges
        vec2 finalUV = clamp(UV + n * 0.1, 0.001, 0.999);
        vec3 col = texture2D(iChannel0, finalUV).rgb;
        
        // Post processing
        col *= 1.-0.4*dot(UV-=.5, UV); // very subtle vignette
        gl_FragColor = vec4(col, 1.);
    }
  `;

  const snowyShader = `
    precision highp float;
    uniform vec2 iResolution;
    uniform vec2 iImageResolution;
    uniform float iTime;
    uniform float iIntensity;
    uniform float iBlur;
    uniform sampler2D iChannel0;

    // Adapted from Andrew Baldwin's "Just snow"
    #define LAYERS 50
    #define DEPTH .5
    #define WIDTH .3
    #define SPEED .6

    vec2 getCoverUV(vec2 fragCoord, vec2 resolution, vec2 imageResolution) {
        vec2 uv = fragCoord / resolution;
        if (imageResolution.x <= 0.0 || imageResolution.y <= 0.0) return uv;
        float screenAspect = resolution.x / resolution.y;
        float imageAspect = imageResolution.x / imageResolution.y;
        if (screenAspect > imageAspect) {
            float scale = screenAspect / imageAspect;
            uv.y = (uv.y - 0.5) / scale + 0.5;
        } else {
            float scale = imageAspect / screenAspect;
            uv.x = (uv.x - 0.5) / scale + 0.5;
        }
        return uv;
    }

    void main() {
        const mat3 p = mat3(13.323122,23.5112,21.71123,21.1212,28.7312,11.9312,21.8112,14.7212,61.3934);
        vec2 UV = getCoverUV(gl_FragCoord.xy, iResolution, iImageResolution);
        // Center the view slightly and adjust aspect ratio
        vec2 uv = vec2(1., iResolution.y/iResolution.x) * gl_FragCoord.xy / iResolution.xy;
        vec3 acc = vec3(0.0);
        float dof = 5.*sin(iTime*.1);
        
        for (int i=0; i<LAYERS; i++) {
            float fi = float(i);
            // Scale layer count with intensity - cast LAYERS to float to avoid type mismatch
            if (fi > float(LAYERS) * iIntensity) break;

            vec2 q = uv*(1.+fi*DEPTH);
            q += vec2(q.y*(WIDTH*mod(fi*7.238917,1.)-WIDTH*.5), SPEED*iTime/(1.+fi*DEPTH*.03));
            vec3 n = vec3(floor(q), 31.189+fi);
            vec3 m = floor(n)*.00001 + fract(n);
            vec3 mp = (31415.9+m)/fract(p*m);
            vec3 r = fract(mp);
            vec2 s = abs(mod(q,1.)-.5+.9*r.xy-.45);
            s += .01*abs(2.*fract(10.*q.yx)-1.); 
            float d = .8*max(s.x-s.y,s.x+s.y)+max(s.x,s.y)-.005;
            
            float edge = (.002 + .01 * iBlur) + .05*min(.5*abs(fi-5.-dof), 1.);
            acc += vec3(smoothstep(edge, -edge, d) * (r.x/(1.+.02*fi*DEPTH)));
        }
        
        // Background sampling - single sample for maximum clarity
        // Clamp UV to prevent streaking
        vec2 finalUV = clamp(UV, 0.001, 0.999);
        vec3 bg = texture2D(iChannel0, finalUV).rgb;
        
        // Darken background slightly for snow visibility (subtle)
        bg *= 0.9;
        gl_FragColor = vec4(bg + acc, 1.0);
    }
  `;

  // Initialize GL context and program
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      console.warn('WebGL context lost');
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored');
      window.location.reload(); // Simplest way to recover full state
    };

    canvas.addEventListener('webglcontextlost', handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', handleContextRestored, false);

    const gl = canvas.getContext('webgl', { 
      preserveDrawingBuffer: true,
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      failIfMajorPerformanceCaveat: false
    });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    const createShader = (gl: WebGLRenderingContext, type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, mode === 'rainy' ? rainyShader : snowyShader);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    
    programRef.current = program;
    gl.useProgram(program);

    // Get uniform locations once
    uniformLocsRef.current = {
      iResolution: gl.getUniformLocation(program, 'iResolution'),
      iImageResolution: gl.getUniformLocation(program, 'iImageResolution'),
      iTime: gl.getUniformLocation(program, 'iTime'),
      iIntensity: gl.getUniformLocation(program, 'iIntensity'),
      iBlur: gl.getUniformLocation(program, 'iBlur'),
      iChannel0: gl.getUniformLocation(program, 'iChannel0'),
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Initial texture setup (solid color)
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([15, 15, 18, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    textureRef.current = texture;

    // Ensure textures are flipped correctly for WebGL
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    window.addEventListener('resize', resize);
    resize();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      if (glRef.current) {
        const gl = glRef.current;
        if (programRef.current) gl.deleteProgram(programRef.current);
        if (vs) gl.deleteShader(vs);
        if (fs) gl.deleteShader(fs);
        if (textureRef.current) gl.deleteTexture(textureRef.current);
      }
    };
  }, [mode]);

  // Handle image loading and texture updates
  useEffect(() => {
    console.log("ShaderCanvas - Loading background source:", finalBackgroundSource?.substring(0, 50) + "...");
    
    let isCancelled = false;
    const gl = glRef.current;
    const texture = textureRef.current;
    if (!gl || !texture) return;

    const img = new Image();
    imgRef.current = img;
    
    if (!finalBackgroundSource.startsWith('data:') && !finalBackgroundSource.startsWith('blob:')) {
      img.crossOrigin = "anonymous";
    }

    const isPowerOf2 = (value: number) => (value & (value - 1)) === 0;

    img.onload = () => {
      if (isCancelled || !glRef.current || !textureRef.current) return;
      console.log("ShaderCanvas - Image loaded successfully:", finalBackgroundSource?.substring(0, 50) + "...");
      const gl = glRef.current;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      
      // Ensure flipY is set before uploading
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      
      // WebGL 1: Mipmaps only work for power-of-two textures
      if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const max = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
      }
    };

    img.onerror = () => {
      if (isCancelled) return;
      console.error("Image load error for URL:", finalBackgroundSource.substring(0, 50) + "...");
    };

    img.src = finalBackgroundSource;

    return () => {
      isCancelled = true;
    };
  }, [finalBackgroundSource]);

  // Render loop
  useEffect(() => {
    const render = (time: number) => {
      const gl = glRef.current;
      const program = programRef.current;
      const canvas = canvasRef.current;
      const texture = textureRef.current;
      const img = imgRef.current;
      const locs = uniformLocsRef.current;

      if (!gl || !program || !canvas || !texture || !locs) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      gl.useProgram(program);
      
      if (lastLoggedUrlRef.current !== backgroundImageUrl) {
        console.log("ShaderCanvas Render Loop - background changed to:", backgroundImageUrl?.substring(0, 50) + "...");
        lastLoggedUrlRef.current = backgroundImageUrl;
      }

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (locs.iChannel0) gl.uniform1i(locs.iChannel0, 0);

      if (locs.iResolution) gl.uniform2f(locs.iResolution, canvas.width, canvas.height);
      
      // Use naturalWidth/Height only if the image is actually loaded
      const isLoaded = img && img.complete && img.naturalWidth > 0;
      const imgW = isLoaded ? img.naturalWidth : 1920;
      const imgH = isLoaded ? img.naturalHeight : 1080;
      
      if (locs.iImageResolution) {
        gl.uniform2f(locs.iImageResolution, imgW, imgH);
      }

      if (locs.iTime) gl.uniform1f(locs.iTime, time * 0.001);
      if (locs.iIntensity) gl.uniform1f(locs.iIntensity, intensity / 100);
      if (locs.iBlur) gl.uniform1f(locs.iBlur, blur / 10);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [intensity, blur, backgroundImageUrl, mode]);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full -z-10" />;
};

export default ShaderCanvas;
