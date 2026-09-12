"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

export type CompassState = "idle" | "thinking" | "talking";

const COLOR = {
  ring: "#9381ff",
  face: "#ffeedd",
  ink: "#2e2a5c",
  peach: "#ffd8be",
  eyeWhite: "#ffffff",
};

interface CharacterProps {
  state: CompassState;
}

function Character({ state }: CharacterProps) {
  const group = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLid = useRef<THREE.Mesh>(null);
  const rightLid = useRef<THREE.Mesh>(null);
  const nose = useRef<THREE.Group>(null);
  const t0 = useRef(0);
  const reducedMotion = useRef(false);

  if (typeof window !== "undefined" && reducedMotion.current === false) {
    reducedMotion.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  useFrame((_, rawDelta) => {
    const delta = reducedMotion.current ? 0 : rawDelta;
    t0.current += delta;
    const t = t0.current;
    const g = group.current;
    if (!g) return;

    // The body is a flat torus/disc — spinning IT on the Y axis makes it
    // pass edge-on (a near-invisible sliver) partway through every turn.
    // "Thinking" spins only the nose/needle instead (closer to the
    // original "searching needle" concept anyway); the body just tilts.
    if (state === "idle") {
      g.rotation.y = Math.sin(t * 0.5) * 0.35;
      g.position.y = Math.sin(t * 1.6) * 0.06;
      g.rotation.z = Math.sin(t * 1.6) * 0.02;
    } else if (state === "thinking") {
      g.rotation.y = Math.sin(t * 1.8) * 0.18;
      g.position.y = Math.sin(t * 3) * 0.03;
    } else {
      g.rotation.y = Math.sin(t * 3) * 0.15;
      g.position.y = Math.abs(Math.sin(t * 6)) * 0.14;
    }

    if (nose.current) {
      nose.current.rotation.z = state === "thinking" ? t * 9 : 0;
    }

    if (leftArm.current && rightArm.current) {
      if (state === "talking") {
        rightArm.current.rotation.z = -0.5 + Math.sin(t * 10) * 0.35;
        leftArm.current.rotation.z = 0.5 + Math.sin(t * 4) * 0.08;
      } else if (state === "thinking") {
        rightArm.current.rotation.z = -0.6;
        leftArm.current.rotation.z = 0.5 + Math.sin(t * 2) * 0.05;
      } else {
        rightArm.current.rotation.z = -0.5 + Math.sin(t * 1.6) * 0.08;
        leftArm.current.rotation.z = 0.5 + Math.sin(t * 1.6 + Math.PI) * 0.08;
      }
    }

    // blink, independent of state
    const blinkPhase = (t % 4.2) / 4.2;
    const blink = blinkPhase > 0.94 ? 1 - (blinkPhase - 0.94) / 0.06 : blinkPhase > 0.9 ? (blinkPhase - 0.9) / 0.04 : 0;
    const scaleY = Math.max(0.05, 1 - blink);
    if (leftLid.current) leftLid.current.scale.y = scaleY;
    if (rightLid.current) rightLid.current.scale.y = scaleY;
  });

  return (
    <group ref={group}>
      {/* legs */}
      <group position={[-0.32, -1.15, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.5, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.55, 0.05]} castShadow>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.55} />
        </mesh>
      </group>
      <group position={[0.32, -1.15, 0]}>
        <mesh position={[0, -0.28, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.5, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.55, 0.05]} castShadow>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.55} />
        </mesh>
      </group>

      {/* ring body */}
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.05, 0.32, 32, 64]} />
        <meshPhysicalMaterial color={COLOR.ring} roughness={0.32} metalness={0.08} clearcoat={0.55} clearcoatRoughness={0.25} />
      </mesh>

      {/* face plate */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.82, 0.82, 0.22, 48]} />
        <meshStandardMaterial color={COLOR.face} roughness={0.5} />
      </mesh>

      {/* eyebrows */}
      <mesh position={[-0.28, 0.42, 0.24]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        <meshStandardMaterial color={COLOR.ring} roughness={0.4} />
      </mesh>
      <mesh position={[0.28, 0.42, 0.24]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        <meshStandardMaterial color={COLOR.ring} roughness={0.4} />
      </mesh>

      {/* eyes */}
      {[-0.28, 0.28].map((x) => (
        <group key={x} position={[x, 0.2, 0.2]}>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.19, 24, 24]} />
            <meshStandardMaterial color={COLOR.eyeWhite} roughness={0.3} />
          </mesh>
          <mesh position={[0.02, -0.02, 0.2]}>
            <sphereGeometry args={[0.115, 20, 20]} />
            <meshStandardMaterial color={COLOR.ink} roughness={0.25} />
          </mesh>
          <mesh position={[-0.02, 0.04, 0.3]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} />
          </mesh>
          <mesh ref={x < 0 ? leftLid : rightLid} position={[0, 0.02, 0.11]}>
            <sphereGeometry args={[0.21, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLOR.face} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* nose / needle — a group pivoted at the bead so "thinking" can spin
          just the needle around its own base, not the whole face. */}
      <group ref={nose} position={[0, 0.14, 0.3]}>
        <mesh position={[0.03, -0.19, 0.12]} rotation={[0.5, 0, -0.35]}>
          <coneGeometry args={[0.13, 0.55, 20]} />
          <meshStandardMaterial color={COLOR.peach} roughness={0.4} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.4} />
        </mesh>
      </group>

      {/* arms — anchored just outside the ring's own silhouette (ring outer
          radius is 1.05 + 0.32 = 1.37) so the limb isn't half-swallowed by
          the torus geometry; angled up and out for a raised "jazz hands"
          pose, matching the mascot's established reference pose. */}
      <group ref={leftArm} position={[-1.28, 0.55, 0.15]}>
        <mesh position={[-0.22, 0.22, 0]} rotation={[0, 0, -0.95]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.75, 16]} />
          <meshPhysicalMaterial color={COLOR.ring} roughness={0.32} clearcoat={0.5} />
        </mesh>
        <mesh position={[-0.45, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial color={COLOR.peach} roughness={0.45} />
        </mesh>
        {[-0.15, 0.05, 0.25].map((dy, i) => (
          <mesh key={i} position={[-0.5, 0.68 + dy * 0.4, 0]} rotation={[0, 0, -0.2 + i * 0.35]} castShadow>
            <capsuleGeometry args={[0.05, 0.2, 4, 8]} />
            <meshStandardMaterial color={COLOR.peach} roughness={0.45} />
          </mesh>
        ))}
      </group>
      <group ref={rightArm} position={[1.28, 0.55, 0.15]}>
        <mesh position={[0.22, 0.22, 0]} rotation={[0, 0, 0.95]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.75, 16]} />
          <meshPhysicalMaterial color={COLOR.ring} roughness={0.32} clearcoat={0.5} />
        </mesh>
        <mesh position={[0.45, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial color={COLOR.peach} roughness={0.45} />
        </mesh>
        {[-0.15, 0.05, 0.25].map((dy, i) => (
          <mesh key={i} position={[0.5, 0.68 + dy * 0.4, 0]} rotation={[0, 0, 0.2 - i * 0.35]} castShadow>
            <capsuleGeometry args={[0.05, 0.2, 4, 8]} />
            <meshStandardMaterial color={COLOR.peach} roughness={0.45} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

interface CompassMascot3DProps {
  state: CompassState;
  size?: number;
}

/** Real 3D mascot (React Three Fiber) — replaces the flat generated-PNG
 * avatar, which lost its hands whenever it was displayed smaller than the
 * crop it was scaled/cropped for. Every part is a primitive geometry
 * (torus/sphere/cylinder/cone/capsule) so there is no external asset to
 * go stale or crop badly — it recomposes at any size. */
export function CompassMascot3D({ state, size = 64 }: CompassMascot3DProps) {
  return (
    <div style={{ width: size, height: size }} className="shrink-0">
      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={{ position: [0, 0, 9.5], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
      >
        {/* Manual lighting rig, deliberately not drei's <Environment> — that
            component fetches an HDRI from a remote CDN, which left the whole
            Suspense tree stuck on its `null` fallback (i.e. a blank canvas)
            wherever that fetch can't complete. Three point lights instead:
            no network dependency, always renders. */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[2.5, 3.5, 4]} intensity={1.3} castShadow />
        <pointLight position={[-3, 1.5, 2]} intensity={0.5} color="#ffffff" />
        <pointLight position={[0, -2, 3]} intensity={0.25} color="#b8b8ff" />
        {/* The legs pull the visual mass down more than the ring extends up,
            so recenter the whole character rather than the camera — keeps
            the animation's own local transforms untouched. */}
        <group position={[0, 0.28, 0]}>
          <Character state={state} />
        </group>
        <ContactShadows position={[0, -1.42, 0]} opacity={0.35} scale={4} blur={2.4} far={2} />
      </Canvas>
    </div>
  );
}
