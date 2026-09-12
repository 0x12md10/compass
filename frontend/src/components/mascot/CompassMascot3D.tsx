"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type CompassState = "idle" | "thinking" | "talking";

const COLOR = {
  ring: "#9381ff",
  face: "#ffeedd",
  ink: "#2e2a5c",
  peach: "#ffd8be",
  eyeWhite: "#ffffff",
};

const UP = new THREE.Vector3(0, 1, 0);

/** A cylinder oriented and sized to connect two points in space — this is
 * what was missing before: limbs were single straight meshes rotated only
 * around Z, so they clipped into the body at a hard angle with a visible
 * seam instead of reading as a joint. Pair with a sphere at each end
 * (same material) to cap the seam. */
function Bone({
  from,
  to,
  radiusStart = 0.12,
  radiusEnd = 0.12,
  color,
  physical = true,
}: {
  from: [number, number, number];
  to: [number, number, number];
  radiusStart?: number;
  radiusEnd?: number;
  color: string;
  physical?: boolean;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
    return { position: mid.toArray() as [number, number, number], quaternion: quat, length: len };
  }, [from, to]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <cylinderGeometry args={[radiusEnd, radiusStart, length, 20]} />
      {physical ? (
        <meshPhysicalMaterial color={color} roughness={0.42} clearcoat={0.32} clearcoatRoughness={0.45} />
      ) : (
        <meshStandardMaterial color={color} roughness={0.5} />
      )}
    </mesh>
  );
}

function Joint({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <sphereGeometry args={[radius, 24, 24]} />
      <meshPhysicalMaterial color={color} roughness={0.42} clearcoat={0.32} clearcoatRoughness={0.45} />
    </mesh>
  );
}

/** An open hand — a flattened palm with four fanned fingers and a thumb,
 * each an oriented capsule (not a straight offset copy), so it reads as a
 * hand rather than a sphere with lint stuck to it. */
function Hand({ position, side }: { position: [number, number, number]; side: 1 | -1 }) {
  const fingers = [-34, -11, 11, 34];
  return (
    <group position={position}>
      <mesh castShadow receiveShadow scale={[1, 0.82, 0.62]}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshStandardMaterial color={COLOR.peach} roughness={0.5} />
      </mesh>
      {fingers.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dir: [number, number, number] = [Math.sin(rad), Math.cos(rad), 0];
        const base: [number, number, number] = [dir[0] * 0.16, dir[1] * 0.16, 0.02];
        const tip: [number, number, number] = [dir[0] * 0.44, dir[1] * 0.44, 0.02];
        return <Bone key={deg} from={base} to={tip} radiusStart={0.05} radiusEnd={0.045} color={COLOR.peach} physical={false} />;
      })}
      {/* thumb, angled out to the side rather than fanned with the fingers */}
      <Bone
        from={[side * 0.12, -0.08, 0.06]}
        to={[side * 0.34, -0.2, 0.1]}
        radiusStart={0.06}
        radiusEnd={0.052}
        color={COLOR.peach}
        physical={false}
      />
    </group>
  );
}

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
        rightArm.current.rotation.z = Math.sin(t * 10) * 0.22;
        leftArm.current.rotation.z = Math.sin(t * 4) * 0.05;
      } else if (state === "thinking") {
        rightArm.current.rotation.z = -0.08;
        leftArm.current.rotation.z = Math.sin(t * 2) * 0.04;
      } else {
        rightArm.current.rotation.z = Math.sin(t * 1.6) * 0.06;
        leftArm.current.rotation.z = Math.sin(t * 1.6 + Math.PI) * 0.06;
      }
    }

    // blink, independent of state
    const blinkPhase = (t % 4.2) / 4.2;
    const blink = blinkPhase > 0.94 ? 1 - (blinkPhase - 0.94) / 0.06 : blinkPhase > 0.9 ? (blinkPhase - 0.9) / 0.04 : 0;
    const scaleY = Math.max(0.05, 1 - blink);
    if (leftLid.current) leftLid.current.scale.y = scaleY;
    if (rightLid.current) rightLid.current.scale.y = scaleY;
  });

  // Arm pose, defined as real 3D joint points rather than a single rotated
  // rod: shoulder sits pulled slightly inside the ring's outer surface (so
  // the joint sphere overlaps the torus and hides the seam), then an upper
  // arm + forearm bend up toward a raised "jazz hands" hand position.
  const armPose = (side: 1 | -1) => {
    const shoulder: [number, number, number] = [side * 1.0, 0.72, 0.08];
    const elbow: [number, number, number] = [side * 1.32, 1.22, 0.14];
    const hand: [number, number, number] = [side * 1.24, 1.78, 0.2];
    return { shoulder, elbow, hand };
  };
  const rightPose = armPose(1);
  const leftPose = armPose(-1);

  return (
    <group ref={group}>
      {/* legs — a hip joint sphere overlapping the ring's underside, then a
          single tapered bone to an ankle joint and a foot. */}
      {[-1, 1].map((side) => {
        const hip: [number, number, number] = [side * 0.34, -0.98, 0.04];
        const ankle: [number, number, number] = [side * 0.34, -1.62, 0.04];
        return (
          <group key={side}>
            <Joint position={hip} radius={0.19} color={COLOR.ink} />
            <Bone from={hip} to={ankle} radiusStart={0.15} radiusEnd={0.13} color={COLOR.ink} physical={false} />
            <mesh position={[side * 0.34, -1.71, 0.09]} castShadow receiveShadow scale={[1, 0.6, 1.3]}>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshStandardMaterial color={COLOR.ink} roughness={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* ring body */}
      <mesh castShadow receiveShadow>
        <torusGeometry args={[1.05, 0.32, 40, 80]} />
        <meshPhysicalMaterial color={COLOR.ring} roughness={0.38} clearcoat={0.35} clearcoatRoughness={0.4} />
      </mesh>

      {/* face plate */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.82, 0.82, 0.22, 48]} />
        <meshStandardMaterial color={COLOR.face} roughness={0.62} />
      </mesh>

      {/* eyebrows */}
      <mesh position={[-0.28, 0.42, 0.24]} rotation={[0, 0, 0.25]}>
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        <meshStandardMaterial color={COLOR.ring} roughness={0.45} />
      </mesh>
      <mesh position={[0.28, 0.42, 0.24]} rotation={[0, 0, -0.25]}>
        <capsuleGeometry args={[0.03, 0.22, 4, 8]} />
        <meshStandardMaterial color={COLOR.ring} roughness={0.45} />
      </mesh>

      {/* eyes */}
      {[-0.28, 0.28].map((x) => (
        <group key={x} position={[x, 0.2, 0.2]}>
          <mesh position={[0, 0, 0.06]}>
            <sphereGeometry args={[0.19, 24, 24]} />
            <meshStandardMaterial color={COLOR.eyeWhite} roughness={0.25} />
          </mesh>
          <mesh position={[0.02, -0.02, 0.2]}>
            <sphereGeometry args={[0.115, 20, 20]} />
            <meshStandardMaterial color={COLOR.ink} roughness={0.2} />
          </mesh>
          <mesh position={[-0.02, 0.04, 0.3]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.1} />
          </mesh>
          <mesh ref={x < 0 ? leftLid : rightLid} position={[0, 0.02, 0.11]}>
            <sphereGeometry args={[0.21, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={COLOR.face} roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}

      {/* nose / needle — a group pivoted at the bead so "thinking" can spin
          just the needle around its own base, not the whole face. */}
      <group ref={nose} position={[0, 0.14, 0.3]}>
        <mesh position={[0.03, -0.19, 0.12]} rotation={[0.5, 0, -0.35]}>
          <coneGeometry args={[0.13, 0.55, 20]} />
          <meshStandardMaterial color={COLOR.peach} roughness={0.45} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial color={COLOR.ink} roughness={0.45} />
        </mesh>
      </group>

      {/* arms — real 3D joints (shoulder/elbow spheres + two bones) instead
          of one straight rod, so the limb reads as growing out of the body
          instead of clipping through it. Each side's whole pose is wrapped
          in a ref'd group, pivoted at the shoulder, purely for the gentle
          per-state sway/wave — the joints themselves stay fixed. */}
      <group ref={rightArm} position={rightPose.shoulder}>
        {(() => {
          const shoulder: [number, number, number] = [0, 0, 0];
          const elbow: [number, number, number] = [
            rightPose.elbow[0] - rightPose.shoulder[0],
            rightPose.elbow[1] - rightPose.shoulder[1],
            rightPose.elbow[2] - rightPose.shoulder[2],
          ];
          const hand: [number, number, number] = [
            rightPose.hand[0] - rightPose.shoulder[0],
            rightPose.hand[1] - rightPose.shoulder[1],
            rightPose.hand[2] - rightPose.shoulder[2],
          ];
          return (
            <>
              <Joint position={shoulder} radius={0.24} color={COLOR.ring} />
              <Bone from={shoulder} to={elbow} radiusStart={0.15} radiusEnd={0.13} color={COLOR.ring} />
              <Joint position={elbow} radius={0.14} color={COLOR.ring} />
              <Bone from={elbow} to={hand} radiusStart={0.12} radiusEnd={0.1} color={COLOR.ring} />
              <Hand position={hand} side={1} />
            </>
          );
        })()}
      </group>
      <group ref={leftArm} position={leftPose.shoulder}>
        {(() => {
          const shoulder: [number, number, number] = [0, 0, 0];
          const elbow: [number, number, number] = [
            leftPose.elbow[0] - leftPose.shoulder[0],
            leftPose.elbow[1] - leftPose.shoulder[1],
            leftPose.elbow[2] - leftPose.shoulder[2],
          ];
          const hand: [number, number, number] = [
            leftPose.hand[0] - leftPose.shoulder[0],
            leftPose.hand[1] - leftPose.shoulder[1],
            leftPose.hand[2] - leftPose.shoulder[2],
          ];
          return (
            <>
              <Joint position={shoulder} radius={0.24} color={COLOR.ring} />
              <Bone from={shoulder} to={elbow} radiusStart={0.15} radiusEnd={0.13} color={COLOR.ring} />
              <Joint position={elbow} radius={0.14} color={COLOR.ring} />
              <Bone from={elbow} to={hand} radiusStart={0.12} radiusEnd={0.1} color={COLOR.ring} />
              <Hand position={hand} side={-1} />
            </>
          );
        })()}
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
        shadows="soft"
        camera={{ position: [0, 0, 10.5], fov: 30 }}
        gl={{ alpha: true, antialias: true }}
      >
        {/* Manual lighting rig, deliberately not drei's <Environment> — that
            component fetches an HDRI from a remote CDN, which left the whole
            Suspense tree stuck on its `null` fallback (i.e. a blank canvas)
            wherever that fetch can't complete. A hemisphere light (sky/
            ground bounce, free — no env map) plus a key/fill/rim setup
            instead: no network dependency, still reads as "lit," not flat. */}
        <hemisphereLight args={["#d9d3ff", "#372f66", 0.65]} />
        <ambientLight intensity={0.25} />
        <directionalLight position={[3, 4, 5]} intensity={1.15} castShadow shadow-mapSize={[512, 512]} />
        <directionalLight position={[-3.5, 1.5, 2]} intensity={0.35} color="#ffffff" />
        <pointLight position={[0, 1, -3]} intensity={0.4} color="#b8b8ff" />
        {/* Raised-hands pose is close to vertically balanced around the
            ring's own center (hands top out around y=2.0, feet bottom out
            around y=-1.9), so only a small recenter nudge is needed —
            unlike the old pose, which was leg-heavy. */}
        <group position={[0, -0.05, 0]}>
          <Character state={state} />
        </group>
        <ContactShadows position={[0, -1.95, 0]} opacity={0.4} scale={4.5} blur={2.2} far={2} />
      </Canvas>
    </div>
  );
}
