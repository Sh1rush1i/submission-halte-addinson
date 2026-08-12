import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-auth-visual',
  standalone: true,
  templateUrl: './auth-visual.html',
  styleUrl: './auth-visual.css',
})
export class AuthVisual implements AfterViewInit, OnDestroy {
  @ViewChild('canvasHost', { static: true })
  private canvasHost!: ElementRef<HTMLDivElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;

  private orbitGroup!: THREE.Group;
  private particleGroup!: THREE.Points;

  private pointerTarget = { x: 0, y: 0 };
  private pointerCurrent = { x: 0, y: 0 };

  private frameId = 0;
  private resizeObserver?: ResizeObserver;

  // Palet gray/zinc — netral, dingin, modern
  private readonly colors = {
    ringOuter: 0x3f3f46, // zinc-700
    ringMid: 0x52525b, // zinc-600
    ringInner: 0x71717a, // zinc-500
    core: 0xd4d4d8, // zinc-300
    particle: 0xa1a1aa, // zinc-400
    node: 0xe4e4e7, // zinc-200
  };

  constructor(private readonly zone: NgZone) {}

  ngAfterViewInit(): void {
    this.initScene();
    this.buildOrbitLattice();
    this.bindEvents();

    this.zone.runOutsideAngular(() => this.animate());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('pointermove', this.onPointerMove);

    this.scene?.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry?.dispose();
        const material = obj.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material?.dispose();
        }
      }
    });
    this.renderer?.dispose();
  }

  // Setup

  private initScene(): void {
    const host = this.canvasHost.nativeElement;
    const { clientWidth: width, clientHeight: height } = host;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    host.appendChild(canvas);
  }

  private buildOrbitLattice(): void {
    this.orbitGroup = new THREE.Group();

    const ringConfigs = [
      { rx: 1.6, ry: 4.2, tiltX: -1.15, tiltY: 0.15, color: this.colors.ringInner, opacity: 0.55 },
      { rx: 3.1, ry: 4.2, tiltX: -1.0, tiltY: 0.4, color: this.colors.ringMid, opacity: 0.4 },
      { rx: 4.6, ry: 4.2, tiltX: -0.85, tiltY: 0.65, color: this.colors.ringOuter, opacity: 0.28 },
    ];

    for (const cfg of ringConfigs) {
      const curve = new THREE.EllipseCurve(0, 0, cfg.rx, cfg.ry, 0, Math.PI * 2, false, 0);
      const points = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: cfg.opacity,
      });
      const ring = new THREE.LineLoop(geometry, material);
      ring.rotation.x = cfg.tiltX;
      ring.rotation.y = cfg.tiltY;
      this.orbitGroup.add(ring);
    }

    const coreGeometry = new THREE.IcosahedronGeometry(0.55, 1);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: this.colors.core,
      wireframe: true,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    this.orbitGroup.add(core);

    const nodeGeometry = new THREE.SphereGeometry(0.07, 16, 16);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: this.colors.node });
    const nodePositions: [number, number, number][] = [
      [-1.9, 1.6, 1.1],
      [2.4, -1.4, -0.8],
    ];
    for (const [x, y, z] of nodePositions) {
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.set(x, y, z);
      this.orbitGroup.add(node);
    }

    this.scene.add(this.orbitGroup);

    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 3 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 1.3;
      positions[i * 3 + 2] = radius * Math.cos(phi) * 0.6;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: this.colors.particle,
      size: 0.035,
      transparent: true,
      opacity: 0.75,
      sizeAttenuation: true,
    });
    this.particleGroup = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particleGroup);
  }

  // Interaksi & animasi

  private bindEvents(): void {
    window.addEventListener('pointermove', this.onPointerMove);

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.canvasHost.nativeElement);
  }

  private onPointerMove = (event: PointerEvent): void => {
    this.pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.pointerTarget.y = (event.clientY / window.innerHeight) * 2 - 1;
  };

  private onResize(): void {
    const { clientWidth: width, clientHeight: height } = this.canvasHost.nativeElement;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = (): void => {
    this.frameId = requestAnimationFrame(this.animate);

    this.pointerCurrent.x += (this.pointerTarget.x - this.pointerCurrent.x) * 0.04;
    this.pointerCurrent.y += (this.pointerTarget.y - this.pointerCurrent.y) * 0.04;

    this.orbitGroup.rotation.y += 0.0018;
    this.orbitGroup.rotation.x = this.pointerCurrent.y * 0.15;
    this.orbitGroup.rotation.z = -this.pointerCurrent.x * 0.08;

    this.particleGroup.rotation.y -= 0.0009;

    this.camera.position.x = this.pointerCurrent.x * 0.4;
    this.camera.position.y = -this.pointerCurrent.y * 0.3;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  };
}
