import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { themes, playerTokens } from '../content/themes.js';

interface Props {
  themeId: string;
  score?: number;
  active?: boolean;
  level?: number;
  activeSinger?: number;
  reducedMotion?: boolean;
  compact?: boolean;
}
export default function ArenaCanvas({
  themeId,
  score = 72,
  active = false,
  level = 0,
  activeSinger = 0,
  reducedMotion = false,
  compact = false,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ score, active, level, activeSinger });
  live.current = { score, active, level, activeSinger };
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const theme = themes[themeId] ?? themes.festival!;
    const staticFrame = reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme.backdrop);
    scene.fog = new THREE.Fog(theme.backdrop, 25, 60);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 10, 23);
    camera.lookAt(0, 1.2, -1);
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
    box(28, 0.6, 23, '#11162d', 0, -0.65, 1);
    box(23, 0.55, 8, theme.floor, 0, -0.2, -3.5);
    box(23, 0.12, 0.18, '#53ebda', 0, 0.16, 0.5);
    box(21, 0.14, 0.9, '#393255', 0, -0.26, 1.0);
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
    const rings: THREE.Mesh[] = [];
    for (let ring = 0; ring < 5; ring += 1) {
      const line = new THREE.Mesh(
        new THREE.TorusGeometry(1.25 + ring * 0.42, 0.035, 4, 80),
        new THREE.MeshStandardMaterial({
          color: ring < live.current.score / 22 ? theme.accent : '#574977',
          emissive: ring < live.current.score / 22 ? theme.accent : '#201633',
          emissiveIntensity: 0.3,
        }),
      );
      line.rotation.x = Math.PI / 2;
      line.position.set(0, 0.10 + ring * 0.008, -2.5);
      scene.add(line);
      rings.push(line);
    }
    const performers: THREE.Group[] = [];
    const rigs: Array<{
      leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group;
      rightLeg: THREE.Group; mouth: THREE.Mesh; browLeft: THREE.Mesh;
      browRight: THREE.Mesh; head: THREE.Mesh; homeX: number; homeZ: number;
    }> = [];
    for (let i = 0; i < 5; i += 1) {
      const x = (i - 2) * 3;
      const z = -3.2 + Math.abs(i - 2) * 0.35;
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      scene.add(group);
      performers.push(group);
      const token = playerTokens[i]!;
      const skin = ['#a96748', '#704530', '#d89b70', '#b77250', '#57382e'][i]!;
      const outfit = ['#f84b8c', '#15afab', '#ffc556', '#8b78d6', '#3c8fbe'][i]!;
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.44, 0.56, 1.15, 12),
        new THREE.MeshStandardMaterial({
          color: outfit,
          roughness: 0.73,
        }),
      );
      body.position.y = 1.42;
      group.add(body);
      const bodyOutline = new THREE.Mesh(
        body.geometry,
        new THREE.MeshBasicMaterial({ color: '#100d20', side: THREE.BackSide }),
      );
      bodyOutline.position.copy(body.position);
      bodyOutline.scale.setScalar(1.06);
      group.add(bodyOutline);
      cylinder(0.17, 0.19, 0.35, skin, 0, 2.04, 0, group);
      box(1.1, 0.16, 0.66, i % 2 ? '#281d43' : '#f6ca6e', 0, 0.9, 0, group);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.56, 16, 12),
        new THREE.MeshStandardMaterial({
          color: skin,
          roughness: 0.91,
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
      if (i === 1 || i === 4) {
        const bun = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 9),
          new THREE.MeshStandardMaterial({ color: '#17111e' }));
        bun.position.set(0.3, 2.72, -0.29);
        group.add(bun);
      }
      const browLeft = box(0.27, 0.045, 0.07, '#25151b', -0.18, 2.42, 0.47, group);
      const browRight = box(0.27, 0.045, 0.07, '#25151b', 0.18, 2.42, 0.47, group);
      box(0.19, 0.10, 0.07, '#fff4dc', -0.18, 2.29, 0.49, group);
      box(0.19, 0.10, 0.07, '#fff4dc', 0.18, 2.29, 0.49, group);
      const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8),
        new THREE.MeshStandardMaterial({ color: '#421e2a', roughness: 0.8 }));
      mouth.position.set(0, 2.04, 0.51);
      mouth.scale.set(0.9, 0.25, 0.3);
      group.add(mouth);
      if (i === 2 || i === 4) {
        box(0.3, 0.045, 0.07, '#241519', 0, 2.16, 0.53, group);
      }
      const leftArm = new THREE.Group();
      leftArm.position.set(-0.57, 1.86, 0);
      group.add(leftArm);
      cylinder(0.14, 0.12, 0.77, outfit, 0, -0.37, 0, leftArm);
      cylinder(0.11, 0.11, 0.28, skin, 0, -0.83, 0.07, leftArm);
      const rightArm = new THREE.Group();
      rightArm.position.set(0.57, 1.86, 0);
      group.add(rightArm);
      cylinder(0.14, 0.12, 0.77, outfit, 0, -0.37, 0, rightArm);
      cylinder(0.11, 0.11, 0.28, skin, 0, -0.83, 0.07, rightArm);
      const leftLeg = new THREE.Group();
      leftLeg.position.set(-0.29, 0.91, 0);
      group.add(leftLeg);
      cylinder(0.2, 0.14, 0.66, '#29253c', 0, -0.31, 0, leftLeg);
      box(0.32, 0.17, 0.48, '#131421', 0, -0.68, 0.17, leftLeg);
      const rightLeg = new THREE.Group();
      rightLeg.position.set(0.29, 0.91, 0);
      group.add(rightLeg);
      cylinder(0.2, 0.14, 0.66, '#29253c', 0, -0.31, 0, rightLeg);
      box(0.32, 0.17, 0.48, '#131421', 0, -0.68, 0.17, rightLeg);
      rigs.push({ leftArm, rightArm, leftLeg, rightLeg, mouth, browLeft, browRight, head, homeX: x, homeZ: z });
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
      // Each stand belongs to its singer, so it follows their stage movement.
      const stand = new THREE.Group();
      stand.position.set(0.72, 0, 0.42);
      group.add(stand);
      cylinder(0.3, 0.36, 0.08, '#161c2e', 0, 0.09, 0, stand);
      cylinder(0.055, 0.07, 1.65, '#a5b2c9', 0, 0.94, 0, stand);
      const mic = new THREE.Group(); mic.position.set(-0.18, 1.98, 0); mic.rotation.z = -0.55;
      stand.add(mic);
      cylinder(0.09, 0.075, 0.42, '#172234', 0, -0.13, 0, mic);
      const grille = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.16, 4, 12), new THREE.MeshStandardMaterial({color:'#dbe5ee',metalness:0.7,roughness:0.3}));
      grille.position.y = 0.13; mic.add(grille);
      for(let band=0;band<4;band++) cylinder(0.144,0.144,0.022,'#4e6375',0,0.04+band*0.065,0,mic);
      cylinder(0.095,0.095,0.045,token.color,0,-0.3,0,mic);

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
      new THREE.CapsuleGeometry(0.23, 0.4, 3, 6),
      new THREE.MeshStandardMaterial({ color: '#74658e', roughness: 0.85 }),
      Math.min(theme.crowdDensity, 120),
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < fans.count; i += 1) {
      const column = i % 20;
      const row = Math.floor(i / 20);
      dummy.position.set((column - 9.5) * 0.97, 0.28 + (i % 5) * 0.09, 3.4 + row * 1.1);
      dummy.scale.setScalar(0.75 + (i % 4) * 0.12);
      dummy.updateMatrix();
      fans.setMatrixAt(i, dummy.matrix);
      fans.setColorAt(i, new THREE.Color(['#5e6eb8', '#c85185', '#39a8a6', '#d29e4b'][i % 4]!));
    }
    scene.add(fans);
    const fanHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshStandardMaterial({ color: '#c2937e' }), fans.count);
    const fanArms = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.6, 6), new THREE.MeshStandardMaterial({ color: '#bd9cc5' }), fans.count * 2);
    scene.add(fanHeads, fanArms);
    const tomatoes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 7, 5), new THREE.MeshStandardMaterial({ color: '#ed343d', roughness: 0.7 }), 24);
    scene.add(tomatoes);
    const confetti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.12, 0.2),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
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
    for (let i = 0; i < fans.count; i++) {
      fans.getMatrixAt(i, dummy.matrix); dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      dummy.position.y += 0.35; dummy.updateMatrix(); fanHeads.setMatrixAt(i, dummy.matrix);
      dummy.position.y -= 0.3;
      for (let side = 0; side < 2; side++) {
        dummy.position.x += side ? 0.4 : -0.2; dummy.updateMatrix(); fanArms.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    }
    let frame = 0;
    let stopped = false;
    let lastFrameTime = 0;
    let slowFrames = 0;
    let lastStageScore = Number.NaN;
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
      const { score: stageScore, active: stageActive, level: stageLevel, activeSinger: leadSinger } = live.current;
      if (stageScore !== lastStageScore) {
        rings.forEach((ring, index) => {
          const material = ring.material as THREE.MeshStandardMaterial;
          const lit = index < stageScore / 22;
          material.color.set(lit ? theme.accent : '#574977');
          material.emissive.set(lit ? theme.accent : '#201633');
        });
        lastStageScore = stageScore;
      }
      tomatoes.visible = stageScore < 40;
      confetti.visible = stageScore >= 80;
      if (!staticFrame) {
        const t = now / 1000;
        if (tomatoes.visible) {
          for (let i = 0; i < tomatoes.count; i++) {
            const flight = (t * 0.65 + i / tomatoes.count) % 1;
            dummy.position.set((i % 7 - 3) * 1.5 * (1 - flight), 0.4 + Math.sin(flight * Math.PI) * 4, 7 - flight * 10);
            dummy.scale.setScalar(1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
            tomatoes.setMatrixAt(i, dummy.matrix);
          }
          tomatoes.instanceMatrix.needsUpdate = true;
        }
        performers.forEach((performer, index) => {
          const rig = rigs[index]!;
          const lead = leadSinger < 0 || index === leadSinger;
          const singing = stageActive && lead;
          const dance = stageScore >= 80 && !stageActive;
          const flop = stageScore < 40 && !stageActive;
          const pace = singing ? 8.2 : dance ? 5.8 : 2.4;
          const stride = Math.sin(t * pace + index * 0.5);
          const step = singing ? 0.36 : dance ? 0.27 : 0.08;
          rig.leftLeg.rotation.x = stride * step;
          rig.rightLeg.rotation.x = -stride * step;
          rig.leftArm.rotation.x = -stride * (singing ? 0.54 : 0.23);
          rig.rightArm.rotation.x = singing ? -1.1 + Math.sin(t * 12) * 0.18 : stride * 0.23;
          rig.leftArm.rotation.z = dance ? -0.8 + Math.sin(t * 10) * 0.32 : 0.08;
          rig.rightArm.rotation.z = dance ? 0.8 - Math.sin(t * 10) * 0.32 : -0.08;
          rig.mouth.scale.y = singing ? 0.15 + Math.min(1, stageLevel * 2.5) * 2.8 : 0.25;
          rig.browLeft.position.y = 2.42 + (singing ? Math.min(0.1, stageLevel * 0.3) : 0);
          rig.browRight.position.y = rig.browLeft.position.y;
          rig.head.rotation.z = flop && lead ? -0.23 : singing ? Math.sin(t * 4) * 0.065 : 0;
          const centerX = lead && stageActive && leadSinger >= 0 ? 0 : rig.homeX;
          const centerZ = lead && stageActive && leadSinger >= 0 ? -0.8 : rig.homeZ;
          performer.position.x += (centerX - performer.position.x) * 0.08;
          performer.position.z += (centerZ - performer.position.z) * 0.08;
          performer.position.y = Math.abs(stride) * (singing ? 0.10 : dance ? 0.08 : 0.025);
          performer.rotation.z = flop && lead ? -0.22 : Math.sin(t + index) * 0.025;
        });
        pink.intensity = 29 + Math.sin(t * 1.4) * 5;
        gold.intensity = 27 + Math.cos(t) * 4;
        camera.position.x += (0 - camera.position.x) * 0.025;
        camera.lookAt(0, 1.2, -1);
        camera.position.z += ((stageActive ? 21 : 23) - camera.position.z) * 0.035;
        if (frame % 4 === 0) {
          confetti.rotation.y += 0.008;
          confetti.position.y = Math.sin(t) * 0.12;
        }
      }
      {
        const t = staticFrame ? 0 : now / 1000;
        if (staticFrame || frame % 2 === 0) {
          const energy = Math.min(1, Math.max(stageScore / 100, stageLevel));
          for (let index = 0; index < fans.count; index += 1) {
            const column = index % 20;
            const row = Math.floor(index / 20);
            dummy.position.set((column - 9.5) * 0.97,
              (stageScore >= 80 ? 1.12 : 0.48) + (index % 5) * 0.09 + (staticFrame ? 0 : Math.max(0, Math.sin(t * (3 + energy * 5) + index * 1.73))) * 0.24 * energy,
              3.4 + row * 1.1);
            dummy.scale.setScalar(0.75 + (index % 4) * 0.12);
            dummy.updateMatrix();
            fans.setMatrixAt(index, dummy.matrix);
            const fanY = dummy.position.y;
            const fanX = dummy.position.x;
            dummy.position.y = fanY + 0.5;
            dummy.updateMatrix(); fanHeads.setMatrixAt(index, dummy.matrix);
            for (let side = 0; side < 2; side++) {
              dummy.position.x = fanX + (side ? 0.34 : -0.34);
              dummy.position.y = fanY + (stageScore >= 80 ? 0.72 : 0.08);
              dummy.rotation.z = (side ? 1 : -1) * (stageScore >= 80 ? 0.65 + (staticFrame ? 0 : Math.sin(t * 9 + index)) * 0.3 : 0.22);
              dummy.updateMatrix(); fanArms.setMatrixAt(index * 2 + side, dummy.matrix);
            }
            dummy.rotation.set(0, 0, 0);
          }
          fans.instanceMatrix.needsUpdate = true;
          fanHeads.instanceMatrix.needsUpdate = true;
          fanArms.instanceMatrix.needsUpdate = true;
        }
      }
      renderer.render(scene, camera);
      frame += 1;

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
  }, [themeId, reducedMotion]);
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
      {!active && score >= 80 && <div className="arena-reaction ovation" role="status">👏 STANDING OVATION <small>The crowd is on its feet!</small></div>}
      {!active && score < 40 && <div className="arena-reaction tomato" role="status">🍅 TOMATO TIME <small>The crowd wants another try</small></div>}
      <span className="arena-banner-copy" aria-hidden="true">
        {(themes[themeId] ?? themes.festival!).banner}
      </span>
    </div>
  );
}
