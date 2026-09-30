import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { themes, playerTokens } from '../content/themes.js';

interface Props {
  themeId: string;
  score?: number;
  active?: boolean;
  reducedMotion?: boolean;
  compact?: boolean;
}
export default function ArenaCanvas({
  themeId,
  score = 72,
  active = false,
  reducedMotion = false,
  compact = false,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const theme = themes[themeId] ?? themes.festival!;
    const staticFrame = reducedMotion;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.backdrop);
    scene.fog = new THREE.Fog(theme.backdrop, 15, 38);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 8, 19);
    camera.lookAt(0, 1.1, 0);
    const forcedQuality = new URLSearchParams(window.location.search).get('quality');
    const renderer = new THREE.WebGLRenderer({
      antialias: forcedQuality !== 'low',
      alpha: false,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(
      forcedQuality === 'low'
        ? 1
        : forcedQuality === 'high'
          ? Math.min(window.devicePixelRatio, 2)
          : Math.min(window.devicePixelRatio, 1.5),
    );
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#d7dcff', '#25203b', 2));
    const key = new THREE.DirectionalLight('#fff1c4', 3);
    key.position.set(-4, 10, 7);
    scene.add(key);
    const pink = new THREE.PointLight(theme.light, 34, 20);
    pink.position.set(-7, 6, -2);
    scene.add(pink);
    const gold = new THREE.PointLight(theme.accent, 30, 20);
    gold.position.set(7, 5, -1);
    scene.add(gold);

    const box = (
      w: number,
      h: number,
      d: number,
      color: string,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.68 }),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const cylinder = (
      top: number,
      bottom: number,
      height: number,
      color: string,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = scene,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(top, bottom, height, 14),
        new THREE.MeshStandardMaterial({ color, roughness: 0.76 }),
      );
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    const tokenGeometry = (shape: string): THREE.BufferGeometry => {
      if (shape === 'triangle') return new THREE.ConeGeometry(0.13, 0.18, 3);
      if (shape === 'square') return new THREE.BoxGeometry(0.16, 0.16, 0.08);
      if (shape === 'diamond') return new THREE.OctahedronGeometry(0.12, 0);
      if (shape === 'star') {
        const star = new THREE.Shape();
        for (let point = 0; point < 10; point += 1) {
          const angle = (point / 10) * Math.PI * 2 - Math.PI / 2;
          const radius = point % 2 ? 0.055 : 0.13;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (point === 0) star.moveTo(x, y);
          else star.lineTo(x, y);
        }
        star.closePath();
        return new THREE.ShapeGeometry(star);
      }
      return new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12);
    };
    box(28, 0.6, 13, theme.floor, 0, -0.45, 0);
    box(24, 0.23, 5.2, '#30234b', 0, 0.05, -4.4);
    box(19, 4.5, 0.45, theme.backdrop, 0, 3.35, -7.2);
    box(10, 2.6, 0.12, '#171a41', 0, 3.7, -6.94);
    const banner = box(13, 0.28, 0.18, theme.accent, 0, 5.96, -7.0);
    banner.material = new THREE.MeshStandardMaterial({
      color: theme.accent,
      emissive: theme.accent,
      emissiveIntensity: 0.4,
    });
    for (const x of [-9, 9]) {
      cylinder(0.18, 0.24, 4.6, '#c18a3d', x, 2.5, -5.7);
      cylinder(0.7, 0.2, 0.6, '#ffb645', x, 4.9, -5.7);
      box(0.22, 5.8, 0.22, '#e5aa46', x, 3.2, -1.8);
      for (let i = 0; i < 7; i += 1) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 10, 8),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? '#ff4f94' : '#53ebda',
            emissive: i % 2 ? '#ff287e' : '#19dfcf',
            emissiveIntensity: 1.8,
          }),
        );
        bulb.position.set(x < 0 ? x + i * 0.45 : x - i * 0.45, 5.55 + Math.sin(i / 2) * 0.32, -5.5);
        scene.add(bulb);
      }
    }
    if (theme.props.includes('speakers')) {
      for (const x of [-8.25, 8.25]) {
        const horn = new THREE.Mesh(
          new THREE.ConeGeometry(0.5, 0.85, 8, 1, true),
          new THREE.MeshStandardMaterial({
            color: '#f6b449',
            side: THREE.DoubleSide,
            metalness: 0.3,
          }),
        );
        horn.rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        horn.position.set(x, 2.2, -4.8);
        scene.add(horn);
        cylinder(0.33, 0.4, 0.22, '#362447', x, 1.5, -4.8);
      }
    }
    if (theme.props.includes('screen')) {
      for (const x of [-6, 6]) box(1.15, 4.1, 0.36, '#8d203c', x, 3.4, -6.75);
      for (let i = 0; i < 17; i += 1) {
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 8, 6),
          new THREE.MeshStandardMaterial({
            color: '#ffe09b',
            emissive: '#ffc35a',
            emissiveIntensity: 1.3,
          }),
        );
        lamp.position.set(-4.6 + i * 0.575, 5.12, -6.58);
        scene.add(lamp);
      }
    }
    if (theme.props.includes('garlands')) {
      for (const x of [-7, -5.2, -3.4, 3.4, 5.2, 7]) {
        const bloom = new THREE.Mesh(
          new THREE.TorusGeometry(0.24, 0.08, 6, 12),
          new THREE.MeshStandardMaterial({ color: '#ef8f32', roughness: 0.95 }),
        );
        bloom.position.set(x, 3.9, -6.64);
        scene.add(bloom);
      }
    }
    // Kolam-inspired interlaced rings are abstract stage geometry, not religious iconography.
    for (let ring = 0; ring < 5; ring += 1) {
      const line = new THREE.Mesh(
        new THREE.TorusGeometry(1.25 + ring * 0.42, 0.035, 4, 80),
        new THREE.MeshStandardMaterial({
          color: ring < score / 22 ? theme.accent : '#574977',
          emissive: ring < score / 22 ? theme.accent : '#201633',
          emissiveIntensity: 0.3,
        }),
      );
      line.rotation.x = Math.PI / 2;
      line.position.set(0, 0.07 + ring * 0.008, -0.1);
      scene.add(line);
    }
    const performers: THREE.Group[] = [];
    for (let i = 0; i < 5; i += 1) {
      const angle = Math.PI * (0.78 + (0.44 * i) / 4);
      const x = Math.cos(angle) * 5.8;
      const z = -0.35 + Math.sin(angle) * 1.6;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      scene.add(group);
      performers.push(group);
      const token = playerTokens[i]!;
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.52, 1.05, 3, 8),
        new THREE.MeshStandardMaterial({
          color: ['#9e503e', '#734434', '#cf8b5a', '#bb7352', '#52372f'][i]!,
          roughness: 0.9,
        }),
      );
      body.position.y = 1.22;
      group.add(body);
      const bodyOutline = new THREE.Mesh(
        body.geometry,
        new THREE.MeshBasicMaterial({ color: '#100d20', side: THREE.BackSide }),
      );
      bodyOutline.position.copy(body.position);
      bodyOutline.scale.setScalar(1.055);
      group.add(bodyOutline);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 16, 12),
        new THREE.MeshStandardMaterial({
          color: ['#9e503e', '#734434', '#cf8b5a', '#bb7352', '#52372f'][i]!,
        }),
      );
      head.scale.set(0.92, 1.08, 0.87);
      head.position.set(0, 2.27, 0);
      group.add(head);
      const headOutline = new THREE.Mesh(
        head.geometry,
        new THREE.MeshBasicMaterial({ color: '#100d20', side: THREE.BackSide }),
      );
      headOutline.position.copy(head.position);
      headOutline.scale.set(0.97, 1.14, 0.93);
      group.add(headOutline);
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.57, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: i % 2 ? '#16101c' : '#251220' }),
      );
      hair.position.set(0, 2.42, -0.04);
      group.add(hair);
      box(0.24, 0.13, 0.06, '#fff4dc', -0.17, 2.28, 0.47, group);
      box(0.24, 0.13, 0.06, '#fff4dc', 0.17, 2.28, 0.47, group);
      const badge = new THREE.Mesh(
        tokenGeometry(token.shape),
        new THREE.MeshStandardMaterial({
          color: token.color,
          emissive: token.color,
          emissiveIntensity: 0.25,
        }),
      );
      badge.position.set(0, 1.26, 0.47);
      group.add(badge);
      cylinder(0.04, 0.04, 1.7, '#b9bfce', x < 0 ? 0.9 : -0.9, 1.15, 0.1);
      const standX = x < 0 ? 0.9 : -0.9;
      const arm = box(0.65, 0.045, 0.045, '#c8d2ed', x + standX / 2, 1.92, 0.1);
      arm.rotation.z = x < 0 ? -0.12 : 0.12;
    }
    // Three friendly judges sit at the stage-left dais.
    box(3.5, 0.72, 1.15, '#281d3d', -9.4, 1.05, -1.15);
    for (let i = 0; i < 3; i += 1) {
      const x = -10.5 + i * 1.1;
      cylinder(0.28, 0.34, 0.92, ['#a96542', '#b57853', '#79513b'][i]!, x, 1.75, -1.4);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 14, 10),
        new THREE.MeshStandardMaterial({ color: ['#a96542', '#b57853', '#79513b'][i]! }),
      );
      head.position.set(x, 2.47, -1.4);
      scene.add(head);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.045, 6, 24),
        new THREE.MeshStandardMaterial({
          color: ['#ff538b', '#58e6d4', '#ffcd57'][i]!,
          emissive: ['#ff538b', '#58e6d4', '#ffcd57'][i]!,
          emissiveIntensity: 0.8,
        }),
      );
      halo.position.set(x, 2.98, -1.4);
      scene.add(halo);
    }
    const fans = new THREE.InstancedMesh(
      new THREE.CapsuleGeometry(0.14, 0.28, 2, 4),
      new THREE.MeshStandardMaterial({ color: '#74658e', roughness: 0.85 }),
      Math.min(theme.crowdDensity, 240),
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < fans.count; i += 1) {
      const column = i % 30;
      const row = Math.floor(i / 30);
      dummy.position.set((column - 14.5) * 0.78, 0.28 + (i % 5) * 0.09, -8.2 - row * 1.1);
      dummy.scale.setScalar(0.75 + (i % 4) * 0.12);
      dummy.updateMatrix();
      fans.setMatrixAt(i, dummy.matrix);
      fans.setColorAt(i, new THREE.Color(['#766a91', '#9a7382', '#608a8e', '#aa8a5c'][i % 4]!));
    }
    scene.add(fans);
    const confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.12, 0.2),
      new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, vertexColors: true }),
      84,
    );
    for (let i = 0; i < confetti.count; i += 1) {
      dummy.position.set(((i * 17) % 16) - 8, 2 + ((i * 13) % 70) / 10, ((i * 7) % 9) - 4);
      dummy.rotation.set(i * 0.3, i * 0.17, i * 0.51);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
      confetti.setColorAt(i, new THREE.Color(['#ff4f94', '#ffcc4a', '#54e5d2', '#9a82ff'][i % 4]!));
    }
    scene.add(confetti);
    let frame = 0;
    let stopped = false;
    let lastFrameTime = 0;
    let slowFrames = 0;
    const resize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const animate = (now = performance.now()) => {
      if (stopped) return;
      if (lastFrameTime && forcedQuality === null) {
        slowFrames = now - lastFrameTime > 36 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames === 90) {
          renderer.setPixelRatio(1);
          resize();
        }
      }
      lastFrameTime = now;
      if (!staticFrame) {
        const t = frame * 0.018;
        performers.forEach((performer, index) => {
          performer.position.y = Math.sin(t * 2 + index) * (active && index === 0 ? 0.12 : 0.045);
          performer.rotation.z = Math.sin(t + index) * 0.025;
        });
        pink.intensity = 29 + Math.sin(t * 1.4) * 5;
        gold.intensity = 27 + Math.cos(t) * 4;
        camera.position.x = Math.sin(t * 0.14) * 0.2;
        if (frame % 4 === 0) {
          confetti.rotation.y += 0.008;
          confetti.position.y = Math.sin(t) * 0.12;
        }
      }
      renderer.render(scene, camera);
      frame += 1;
      if (staticFrame) return;
      requestAnimationFrame(animate);
    };
    animate();
    return () => {
      stopped = true;
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material))
            object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
    };
  }, [themeId, score, active, reducedMotion]);
  return (
    <div
      ref={host}
      className={`arena-canvas${compact ? ' arena-compact' : ''}`}
      aria-label={
        themeId === 'theatre'
          ? 'FDFS Theatre stage preview'
          : 'Thiruvizha Night festival stage preview'
      }
    >
      <span className="arena-banner-copy" aria-hidden="true">
        {(themes[themeId] ?? themes.festival!).banner}
      </span>
    </div>
  );
}
