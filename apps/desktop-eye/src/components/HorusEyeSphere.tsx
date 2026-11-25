import React, { useEffect, useRef, useState } from 'react';
import type { EyeState } from '@aurion/shared-protocol';
import { subscribeCursorVector } from '../lib/tauriBridge';

interface HorusEyeSphereProps {
  eyeState: EyeState;
  activeTunnelsCount: number;
  focusRemainingSec: number | null;
  audioLevel?: number;
  banner?: string | null;
  compact?: boolean;
  isDragOver?: boolean;
  onClick: () => void;
  onPanicTrigger?: (reason: string) => void;
  onFileDrop?: (file: File) => void;
  onDragStateChange?: (over: boolean) => void;
}

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Ray-marched Schwarzschild Gravitational Lensing + Volumetric Accretion Galaxy Shader
const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_res;
uniform vec2 u_mouse;
uniform vec2 u_flow;
uniform float u_hover;
uniform float u_energy;
uniform float u_alert;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.04 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_res.x / u_res.y;

  // Cursor spacetime curvature: passing the pointer gently bends local space-time
  vec2 mPos = u_mouse * vec2(u_res.x / u_res.y, 1.0) * 0.65;
  vec2 toMouse = uv - mPos;
  float mDist = length(toMouse) + 0.14;
  float cursorLens = (0.022 * u_hover) / (mDist * mDist + 0.06);
  uv -= normalize(toMouse + 1e-4) * cursorLens;
  uv += u_flow * 0.035 * exp(-mDist * 2.2);

  // Roll angle matching Gargantua Print 1 (-21 deg) + subtle mouse flow tilt
  float roll = -0.37 + u_mouse.x * 0.07 + u_flow.y * 0.08;
  vec2 p2d = rot2(roll) * uv;

  // Camera setup looking at the singularity from slightly above the disk plane
  float pitch = 0.21 + u_mouse.y * 0.06;
  vec3 ro = vec3(0.0, sin(pitch) * 4.2, cos(pitch) * 4.2);
  vec3 fwd = normalize(-ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd * 1.95 + right * p2d.x + up * p2d.y);

  // Ray-march curved geodesics around the Schwarzschild Event Horizon
  vec3 pos = ro;
  vec3 dir = rd;
  float bhRadius = 0.56;
  float gm = 0.175 + u_hover * 0.018;

  vec3 accCol = vec3(0.0);
  float accGlow = 0.0;
  bool swallowed = false;
  float minR = 100.0;

  for (int i = 0; i < 40; i++) {
    float r = length(pos);
    minR = min(minR, r);

    if (r < bhRadius) {
      swallowed = true;
      break;
    }

    //Adaptive step size
    float dt = clamp(r * 0.11, 0.035, 0.24);
    vec3 nextPos = pos + dir * dt;

    // Gravitational deflection of light (spacetime bending!)
    vec3 accel = -pos * (gm / (r * r * r + 0.004));
    dir = normalize(dir + accel * dt * 2.15);

    // Check equatorial accretion disk crossing / slab density
    float slab = exp(-abs(pos.y) * 16.5);
    float rDisk = length(pos.xz);

    if (slab > 0.01 && rDisk > bhRadius * 1.18 && rDisk < 2.65) {
      float radialNorm = (rDisk - bhRadius * 1.18) / (2.65 - bhRadius * 1.18);
      float fade = smoothstep(0.0, 0.11, radialNorm) * pow(1.0 - radialNorm, 1.45);

      // Slow, majestic Keplerian differential rotation (inner faster, outer slow)
      float angle = atan(pos.z, pos.x);
      float keplerSpeed = 0.34 / pow(rDisk, 1.25);
      float swirlPhase = angle - u_time * keplerSpeed + 3.6 / (rDisk + 0.25);

      vec2 polarUv = vec2(rDisk * 3.8, swirlPhase * 1.5);
      float dust = fbm(polarUv + vec2(0.0, -u_time * 0.09));
      float fineRings = 0.55 + 0.45 * sin(rDisk * 26.0 - dust * 4.5 - u_time * 0.45);
      float filaments = pow(clamp(dust * 1.25, 0.0, 1.0), 1.5) * fineRings;

      // Relativistic Doppler beaming (left side approaching = hotter/brighter lilac-white)
      float doppler = clamp(1.0 - pos.x * 0.36, 0.48, 1.58);

      // Official AURION CO. Cosmic Purple -> Magenta -> Incandescent Lilac-White palette
      vec3 deepViolet = mix(vec3(0.22, 0.03, 0.42), vec3(0.45, 0.02, 0.12), u_alert);
      vec3 aurionMagenta = mix(vec3(0.76, 0.14, 0.84), vec3(0.95, 0.18, 0.36), u_alert);
      vec3 hotCore = mix(vec3(0.99, 0.88, 1.0), vec3(1.0, 0.82, 0.88), u_alert);

      float heat = clamp(filaments * doppler * (1.15 - radialNorm * 0.65), 0.0, 1.35);
      vec3 localCol = mix(deepViolet, aurionMagenta, smoothstep(0.08, 0.55, heat));
      localCol = mix(localCol, hotCore, smoothstep(0.58, 1.18, heat));

      float density = slab * fade * (0.28 + filaments * 1.15) * dt * (3.1 + u_energy * 0.9);
      accCol += localCol * density * doppler;
      accGlow += density;
    }

    pos = nextPos;
    if (r > 5.4 && dot(pos, dir) > 0.0) break;
  }

  // Razor-thin Relativistic Photon Ring / Einstein Ring hugging the Event Horizon
  float photonDist = abs(minR - bhRadius * 1.045);
  float photonRing = exp(-photonDist * 38.0) * (0.85 + 0.25 * u_hover + 0.3 * u_energy);
  vec3 photonCol = mix(vec3(0.95, 0.72, 1.0), vec3(1.0, 0.45, 0.55), u_alert) * photonRing;

  // Warped distant micro-stars lensed by the black hole's gravity (Einstein arcs)
  vec3 starCol = vec3(0.0);
  if (!swallowed) {
    vec2 skyUv = dir.xy / (abs(dir.z) + 0.6) * 14.0;
    float s = pow(hash21(floor(skyUv)), 26.0);
    float twinkle = 0.65 + 0.35 * sin(u_time * 1.4 + s * 40.0);
    float lensMask = exp(-length(v_uv) * 2.3);
    starCol = vec3(0.92, 0.78, 1.0) * s * twinkle * lensMask * 0.55;
  }

  // Soft outer purple atmospheric nebula halo
  float centerDist = length(vec2(p2d.x * 0.68, p2d.y * 1.25));
  float outerHalo = exp(-centerDist * 3.1) * (0.22 + u_hover * 0.12 + u_energy * 0.12);
  vec3 haloCol = mix(vec3(0.52, 0.08, 0.68), vec3(0.85, 0.12, 0.3), u_alert) * outerHalo;

  vec3 col = accCol + photonCol + starCol + haloCol;

  // Cinematic ACES-like tone mapping so highlights glow silky white-lilac without harsh clipping
  col = 1.0 - exp(-col * 1.35);

  // Smooth window-edge vignette so ZERO rectangular boundary ever appears on transparent desktop
  float edgeFade = smoothstep(1.0, 0.66, length(v_uv * vec2(0.96, 1.06)));
  float luminance = max(col.r, max(col.g, col.b));
  float coreOpaque = swallowed ? 0.98 : 0.0;
  float alpha = clamp(max(coreOpaque, smoothstep(0.015, 0.38, luminance) * 1.15), 0.0, 1.0) * edgeFade;

  // Premultiplied alpha output for crisp WebGL compositing over Windows desktop
  fragColor = vec4(col * alpha, alpha);
}
`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export const HorusEyeSphere: React.FC<HorusEyeSphereProps> = ({
  eyeState,
  activeTunnelsCount,
  focusRemainingSec,
  audioLevel = 0,
  banner,
  compact = false,
  isDragOver = false,
  onClick,
  onPanicTrigger,
  onFileDrop,
  onDragStateChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetVec = useRef({ x: 0, y: 0 });
  const currentVec = useRef({ x: 0, y: 0 });
  const hoverTarget = useRef(0);
  const hoverBoost = useRef(0);
  const flowTarget = useRef({ x: 0, y: 0 });
  const flowCurrent = useRef({ x: 0, y: 0 });
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const stateRef = useRef({ eyeState, activeTunnelsCount, audioLevel });
  stateRef.current = { eyeState, activeTunnelsCount, audioLevel };

  const [emblemOffset, setEmblemOffset] = useState({ x: 0, y: 0 });

  // Global 60Hz cursor-vector subscription
  useEffect(() => {
    return subscribeCursorVector(
      (vec) => {
        targetVec.current = vec;
      },
      onPanicTrigger
    );
  }, [onPanicTrigger]);

  // Real-time 60fps WebGL2 Gravitational Lensing Spacetime Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });
    if (!gl) return;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uMouse = gl.getUniformLocation(prog, 'u_mouse');
    const uFlow = gl.getUniformLocation(prog, 'u_flow');
    const uHover = gl.getUniformLocation(prog, 'u_hover');
    const uEnergy = gl.getUniformLocation(prog, 'u_energy');
    const uAlert = gl.getUniformLocation(prog, 'u_alert');

    let raf = 0;
    let simTime = 0;
    let lastNow = performance.now();
    let alertSmooth = 0;
    let frameCount = 0;

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(canvas.clientWidth * dpr);
      const ch = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        gl.viewport(0, 0, cw, ch);
      }

      // Ultra-smooth organic inertia for spacetime warping
      hoverBoost.current += (hoverTarget.current - hoverBoost.current) * 0.06;
      flowTarget.current.x *= 0.92;
      flowTarget.current.y *= 0.92;
      flowCurrent.current.x += (flowTarget.current.x - flowCurrent.current.x) * 0.09;
      flowCurrent.current.y += (flowTarget.current.y - flowCurrent.current.y) * 0.09;

      currentVec.current.x += (targetVec.current.x - currentVec.current.x) * 0.07;
      currentVec.current.y += (targetVec.current.y - currentVec.current.y) * 0.07;

      const { eyeState: st, activeTunnelsCount: tunnels, audioLevel: audio } = stateRef.current;

      // Slow, heavy cosmic time flow — gently accelerates when cursor warps near the horizon
      const baseRate =
        st === 'THINKING'
          ? 2.1
          : st === 'SPEAKING'
          ? 1.5
          : st === 'LISTENING' || tunnels > 0
          ? 1.25
          : 0.55;

      const flowMag = Math.hypot(flowCurrent.current.x, flowCurrent.current.y);
      simTime += dt * baseRate * (1 + hoverBoost.current * 1.85 + flowMag * 0.6);

      const alertTarget = st === 'ALERT' ? 1 : 0;
      alertSmooth += (alertTarget - alertSmooth) * 0.08;

      const energy =
        st === 'SPEAKING'
          ? 0.45 + audio * 1.4
          : st === 'LISTENING' || st === 'THINKING'
          ? 0.45
          : hoverBoost.current * 0.35;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(uTime, simTime);
      gl.uniform2f(uRes, cw, ch);
      gl.uniform2f(uMouse, currentVec.current.x, -currentVec.current.y);
      gl.uniform2f(uFlow, flowCurrent.current.x, -flowCurrent.current.y);
      gl.uniform1f(uHover, hoverBoost.current);
      gl.uniform1f(uEnergy, energy);
      gl.uniform1f(uAlert, alertSmooth);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Update AURION "A" subtle parallax every 2nd frame for minimal React overhead
      frameCount = (frameCount + 1) % 2;
      if (frameCount === 0) {
        setEmblemOffset({
          x: currentVec.current.x * (compact ? 2.2 : 3.4),
          y: currentVec.current.y * (compact ? 1.8 : 2.8),
        });
      }

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [compact]);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const relY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    targetVec.current = { x: relX, y: relY };

    if (lastPointer.current) {
      const dx = (e.clientX - lastPointer.current.x) / rect.width;
      const dy = (e.clientY - lastPointer.current.y) / rect.height;
      flowTarget.current = {
        x: Math.max(-1.6, Math.min(1.6, flowTarget.current.x + dx * 5.5)),
        y: Math.max(-1.6, Math.min(1.6, flowTarget.current.y + dy * 5.5)),
      };
    }
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const widthPx = compact ? 132 : 184;
  const heightPx = compact ? 102 : 142;
  const focusPct =
    focusRemainingSec !== null ? Math.max(0, Math.min(1, focusRemainingSec / (25 * 60))) : 0;

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      onDragOver={(e) => {
        e.preventDefault();
        onDragStateChange?.(true);
      }}
      onDragLeave={() => onDragStateChange?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragStateChange?.(false);
        const f = e.dataTransfer.files?.[0];
        if (f && onFileDrop) onFileDrop(f);
      }}
    >
      {banner && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-[#0D0418]/95 border border-[#E879F9]/50 text-[10px] font-medium text-[#F5D0FE] tracking-wide whitespace-nowrap shadow-[0_0_14px_rgba(217,70,239,0.35)]">
          {banner}
        </div>
      )}

      {isDragOver && (
        <div className="mb-1 px-2.5 py-0.5 rounded-full bg-[#C026D3] text-white text-[10px] font-bold tracking-wider whitespace-nowrap animate-pulse shadow-[0_0_18px_#F0ABFC]">
          Solte no Horizonte de Eventos
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        onPointerEnter={() => {
          hoverTarget.current = 1;
        }}
        onPointerLeave={() => {
          hoverTarget.current = 0;
          lastPointer.current = null;
        }}
        onPointerMove={handlePointerMove}
        title="AURION Singularity — Clique para abrir o HUB Orbital"
        style={{ width: widthPx, height: heightPx }}
        className={`relative flex items-center justify-center transition-transform duration-300 active:scale-95 focus:outline-none cursor-pointer ${
          isDragOver ? 'scale-110' : ''
        }`}
      >
        {/* Real-time WebGL2 Spacetime Gravitational Lensing Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Listening subtle gravitational wave pulse */}
        {eyeState === 'LISTENING' && (
          <span className="absolute w-[34%] h-[44%] rounded-full border border-[#F5D0FE]/60 animate-ping pointer-events-none" />
        )}

        {/* Official AURION "A" Emblem suspended inside the Event Horizon */}
        <svg
          viewBox="-32 -32 64 64"
          style={{
            width: compact ? 24 : 33,
            height: compact ? 24 : 33,
            transform: `translate(${emblemOffset.x.toFixed(2)}px, ${emblemOffset.y.toFixed(2)}px)`,
          }}
          className="relative z-10 pointer-events-none drop-shadow-[0_0_8px_rgba(245,208,254,0.65)]"
        >
          <defs>
            <linearGradient id="aurionCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="60%" stopColor="#F5D0FE" />
              <stop offset="100%" stopColor="#D946EF" />
            </linearGradient>
          </defs>

          {focusRemainingSec !== null && focusRemainingSec > 0 && (
            <circle
              cx="0"
              cy="0"
              r="29"
              fill="none"
              stroke="#F0ABFC"
              strokeWidth="2.2"
              strokeDasharray={182}
              strokeDashoffset={182 * (1 - focusPct)}
              strokeLinecap="round"
              transform="rotate(-90)"
            />
          )}

          {/* AURION "A" Geometric Body + Signature Swoosh */}
          <path
            d="M 0 -22 L -18.5 16.5 L -10.2 16.5 L 0 -5.5 L 4.6 3.6 L 11 1.2 Z"
            fill="url(#aurionCoreGrad)"
            opacity="0.95"
          />
          <path
            d="M 7.4 8.2 L 11.6 16.5 L 19.8 16.5 L 14 4.8 Z"
            fill="url(#aurionCoreGrad)"
            opacity="0.95"
          />
          <path
            d="M -17.5 16.5 C -6.5 3.6, 9.2 -3.6, 28.5 -8.2 C 12.8 -0.8, -1.8 7.4, -10.2 16.5 Z"
            fill="#FFFFFF"
          />
        </svg>
      </button>

      {focusRemainingSec !== null && focusRemainingSec > 0 && !compact && (
        <div className="mt-0.5 px-2 py-0.5 rounded bg-[#0D0418]/90 border border-[#D946EF]/50 text-[10px] font-mono text-[#F5D0FE]">
          {Math.floor(focusRemainingSec / 60)
            .toString()
            .padStart(2, '0')}
          :{(focusRemainingSec % 60).toString().padStart(2, '0')}
        </div>
      )}
    </div>
  );
};
