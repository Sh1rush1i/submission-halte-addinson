import {
  Component,
  computed,
  signal,
  OnInit,
  OnDestroy,
  NgZone,
  ElementRef,
  viewChild,
  DestroyRef,
  inject,
  afterRenderEffect,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';

import { FullPageLoading } from '../../misc/full-page-loading/full-page-loading';
import { ExportService } from '../../../service/export.service';
import { DynamicDialogServices } from '../../../service/dynamic-dialog.service';
import { HalteEntry, TripRecord, TripService } from '../../../service/trip.service';
import { ImportService } from '../../../service/import.service';
import * as THREE from 'three';

type ViewMode = 'table' | 'card';
type ColumnType = 'index' | 'text' | 'date' | 'progress' | 'action';

type TripRow = TripRecord & { filledCount: number };

interface ColumnDef {
  field: keyof TripRow | 'no' | 'action';
  header: string;
  type: ColumnType;
  widthClass: string;
  minWidth: string;
  align?: 'center';
  rowClass: string;
}

interface Floater {
  obj: THREE.Object3D;
  nx: number;
  ny: number;
  z: number;
  speed: number;
  phase: number;
  spin: number;
  base: number;
}

// Greeting Constants
const GREETING_DURATION_S = 10;
const GREETING_LEAVE_MS = 600;
const GREETING_TEXT = 'Halo Ges, Semangat hari ini ';

@Component({
  selector: 'app-trip-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    TooltipModule,
    ToastModule,
  ],
  templateUrl: './trip-page.html',
  styleUrl: './trip-page.css',
  providers: [DatePipe, DialogService, MessageService],
})
export class TripPage implements OnInit, OnDestroy {
  // View Signals
  readonly viewMode = signal<ViewMode>('table');
  readonly records = signal<TripRow[]>([]);
  readonly isLoading = signal(true);
  readonly isDraggingFile = signal(false);

  // Greeting State
  readonly showGreetingCard = signal(true);
  readonly greetingLeaving = signal(false);
  readonly greetingCountdown = signal(GREETING_DURATION_S);
  readonly greetingDuration = GREETING_DURATION_S;
  readonly greetingText = GREETING_TEXT;

  /** Split text per word -> per character for individual animation */
  readonly greetingWords = (() => {
    let i = 0;
    return GREETING_TEXT.split(' ').map((word) => Array.from(word).map((c) => ({ c, i: i++ })));
  })();
  readonly greetingCharCount = this.greetingWords.reduce((n, w) => n + w.length, 0);

  private greetingInterval?: ReturnType<typeof setInterval>;
  private greetingLeaveTimeout?: ReturnType<typeof setTimeout>;

  ref: DynamicDialogRef | undefined | null;

  // Table Configuration
  columnsField: ColumnDef[] = [
    {
      field: 'no',
      header: 'No',
      type: 'index',
      widthClass: 'w-12 text-gray-400',
      minWidth: '36px',
      align: 'center',
      rowClass: '',
    },
    {
      field: 'kodeTrip',
      header: 'Trip Code',
      type: 'text',
      widthClass: 'w-28 font-mono text-sky-200',
      minWidth: '210px',
      rowClass: 'text-sky-100',
    },
    {
      field: 'namaSurveyor',
      header: 'Surveyor',
      type: 'text',
      widthClass: 'w-36 text-amber-200',
      minWidth: '220px',
      rowClass: 'text-amber-100',
    },
    {
      field: 'hariTanggal',
      header: 'Date',
      type: 'date',
      widthClass: 'w-32 text-green-200',
      minWidth: '140px',
      rowClass: '',
    },
    {
      field: 'nomorKendaraan',
      header: 'Vehicle No',
      type: 'text',
      widthClass: 'w-28 text-sky-300',
      minWidth: '150px',
      align: 'center',
      rowClass: 'text-sky-100',
    },
    {
      field: 'filledCount',
      header: 'Stops Filled',
      type: 'progress',
      widthClass: 'w-32 text-red-200',
      minWidth: '160px',
      align: 'center',
      rowClass: '',
    },
    {
      field: 'action',
      header: '#',
      type: 'action',
      widthClass: 'w-12 text-purple-200',
      minWidth: '36px',
      align: 'center',
      rowClass: '',
    },
  ];

  readonly hasData = computed(() => this.records().length > 0);
  readonly skeletonRows: Partial<TripRecord>[] = Array.from({ length: 10 }, (_, i) => ({ id: i }));

  private dragDepth = 0;

  private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  constructor(
    // Services injected via Angular inject()
    private router: Router,
    private messageService: MessageService,
    private importService: ImportService,
    private exportService: ExportService,
    private dynamicDialogServices: DynamicDialogServices,
    private tripService: TripService,
    private destroyRef: DestroyRef,
    private zone: NgZone,
  ) {
    this.startGreetingTimer();

    afterRenderEffect((onCleanup) => {
      const ref = this.canvasRef();
      if (!ref) {
        return;
      }

      const teardown = this.zone.runOutsideAngular(() => this.initThree(ref.nativeElement));
      onCleanup(teardown);
    });
  }

  ngOnInit() {
    this.getData();
  }

  ngOnDestroy() {
    if (this.greetingInterval) clearInterval(this.greetingInterval);
    if (this.greetingLeaveTimeout) clearTimeout(this.greetingLeaveTimeout);

    if (this.ref) {
      this.ref.close();
    }
  }

  private startGreetingTimer(): void {
    this.greetingInterval = setInterval(() => {
      const remaining = this.greetingCountdown() - 1;
      this.greetingCountdown.set(Math.max(remaining, 0));
      if (remaining <= 0) {
        this.dismissGreetingCard();
      }
    }, 1000);
  }

  dismissGreetingCard(): void {
    if (this.greetingLeaving()) return;
    if (this.greetingInterval) clearInterval(this.greetingInterval);
    this.greetingLeaving.set(true);
    this.greetingLeaveTimeout = setTimeout(
      () => this.showGreetingCard.set(false),
      GREETING_LEAVE_MS,
    );
  }

  private initThree(canvas: HTMLCanvasElement): () => void {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return () => {}; // WebGL non-functional: nothing was created, nothing to tear down
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const disposables: { dispose(): void }[] = [];
    const cleanupFns: (() => void)[] = [];
    const track = <T extends { dispose(): void }>(d: T): T => {
      disposables.push(d);
      return d;
    };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 200);
    camera.position.set(0, 0, 30);

    // Lights (no distance cutoff so far-right shards are still lit)
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const cyanLight = new THREE.PointLight(0x7dd3fc, 100, 0);
    const pinkLight = new THREE.PointLight(0xf9a8d4, 100, 0);
    scene.add(cyanLight, pinkLight);

    let halfH = 1;
    let halfW = 1;

    // ---- Shared soft-glow sprite texture (bokeh, snow, comet) ----
    const makeGlowTexture = (): THREE.CanvasTexture => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const cx = c.getContext('2d')!;
      const grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      cx.fillStyle = grad;
      cx.fillRect(0, 0, 64, 64);
      return track(new THREE.CanvasTexture(c));
    };
    const dotTex = makeGlowTexture();

    // ---- Snow ----
    const SNOW = 80;
    const snow = Array.from({ length: SNOW }, () => ({
      nx: Math.random() * 2 - 1,
      ny: Math.random() * 2.2 - 1.1,
      z: Math.random() * 6 - 3,
      speed: 0.06 + Math.random() * 0.16,
      sway: 0.5 + Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
    const snowPos = new THREE.BufferAttribute(new Float32Array(SNOW * 3), 3);
    const snowCol = new THREE.BufferAttribute(new Float32Array(SNOW * 3), 3);
    const palette = [
      new THREE.Color(0xbae6fd),
      new THREE.Color(0xffffff),
      new THREE.Color(0xfbcfe8),
    ];
    for (let i = 0; i < SNOW; i++) {
      const c = palette[i % palette.length];
      snowCol.setXYZ(i, c.r, c.g, c.b);
    }
    const snowGeo = track(new THREE.BufferGeometry());
    snowGeo.setAttribute('position', snowPos);
    snowGeo.setAttribute('color', snowCol);

    const snowMat = track(
      new THREE.PointsMaterial({
        size: 3, // pixels
        sizeAttenuation: false,
        map: dotTex,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const snowPoints = new THREE.Points(snowGeo, snowMat);
    snowPoints.frustumCulled = false; // positions are rewritten every frame
    scene.add(snowPoints);

    // ---- Bokeh camera-lights: soft discs drifting slowly ----
    const BOKEH = 6;
    const bokehPalette = [0x7dd3fc, 0xf9a8d4, 0xffffff, 0xbae6fd];
    const bokeh: Floater[] = Array.from({ length: BOKEH }, (_, i) => {
      const mat = track(
        new THREE.SpriteMaterial({
          map: dotTex,
          color: bokehPalette[i % bokehPalette.length],
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      const sprite = new THREE.Sprite(mat);
      const scale = 1.4 + Math.random() * 2.2;
      sprite.scale.set(scale, scale, 1);
      scene.add(sprite);
      return {
        obj: sprite,
        nx: Math.random() * 2 - 1,
        ny: Math.random() * 2 - 1,
        z: -2.5 + Math.random() * 2,
        speed: 0.04 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
        spin: 0,
        base: scale,
      };
    });

    // ---- Ice shards (kept on the right side, text lives on the left) ----
    const shardGeo = track(new THREE.OctahedronGeometry(1, 0));
    const edgeGeo = track(new THREE.EdgesGeometry(shardGeo));
    const mkShardMat = (color: number, emissive: number) =>
      track(
        new THREE.MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 0.4,
          roughness: 0.15,
          metalness: 0.1,
          flatShading: true,
          transparent: true,
          opacity: 0.45,
        }),
      );
    const mkEdgeMat = (color: number) =>
      track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 }));

    const iceMat = mkShardMat(0x9be7ff, 0x2a6f97);
    const pinkMat = mkShardMat(0xffc2e2, 0x9d2a6b);
    const iceEdge = mkEdgeMat(0xe0f7ff);
    const pinkEdge = mkEdgeMat(0xffe0f0);

    const shardSpots = [
      { nx: 0.3, ny: 0.45, pink: false },
      { nx: 0.48, ny: -0.5, pink: true },
      { nx: 0.62, ny: 0.35, pink: false },
      { nx: 0.9, ny: -0.4, pink: true },
    ];
    const shards: (Floater & {
      twinklePhase: number;
      twinkleSpeed: number;
      edgeMat: THREE.LineBasicMaterial;
    })[] = shardSpots.map((s) => {
      const edgeMat = s.pink ? pinkEdge : iceEdge;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(shardGeo, s.pink ? pinkMat : iceMat));
      g.add(new THREE.LineSegments(edgeGeo, edgeMat));
      scene.add(g);
      return {
        obj: g,
        nx: s.nx,
        ny: s.ny,
        z: Math.random() * 2 - 1,
        speed: 0.6 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2,
        spin: 0.3 + Math.random() * 0.5,
        base: 0.7 + Math.random() * 0.6, // size factor, applied in update()
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 1.2 + Math.random() * 1.8,
        edgeMat,
      };
    });

    // ---- 4-point sparkles ----
    const starShape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 1 : 0.22;
      const a = (Math.PI / 4) * i + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    starShape.closePath();
    const starGeo = track(new THREE.ShapeGeometry(starShape));
    const mkStarMat = (color: number) =>
      track(
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      );
    const starMats = [mkStarMat(0xf9a8d4), mkStarMat(0x7dd3fc), mkStarMat(0xffffff)];

    const sparkles: Floater[] = Array.from({ length: 8 }, (_, i) => {
      const mesh = new THREE.Mesh(starGeo, starMats[i % starMats.length]);
      scene.add(mesh);
      return {
        obj: mesh,
        nx: 0.1 + Math.random() * 0.85, // keep away from the text on the left
        ny: Math.random() * 1.6 - 0.8,
        z: Math.random() * 3 - 1,
        speed: 1.5 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
        base: 0.25 + Math.random() * 0.35,
      };
    });

    // ---- Wireframe crystal ----
    const hero = new THREE.LineSegments(
      track(new THREE.EdgesGeometry(track(new THREE.IcosahedronGeometry(2.6, 0)))),
      track(new THREE.LineBasicMaterial({ color: 0xf9a8d4, transparent: true, opacity: 0.35 })),
    );
    scene.add(hero);

    // ---- Camera aperture iris ----
    const apertureGroup = new THREE.Group();
    const apertureMat = track(
      new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.28 }),
    );
    const APERTURE_BLADES = 6;
    const apertureRadius = 1.15;
    for (let i = 0; i < APERTURE_BLADES; i++) {
      const a0 = (i / APERTURE_BLADES) * Math.PI * 2;
      const a1 = a0 + (Math.PI * 2) / APERTURE_BLADES - 0.35;
      const pts: THREE.Vector3[] = [];
      const SEG = 8;
      for (let j = 0; j <= SEG; j++) {
        const a = a0 + (a1 - a0) * (j / SEG);
        pts.push(new THREE.Vector3(Math.cos(a) * apertureRadius, Math.sin(a) * apertureRadius, 0));
      }
      const geo = track(new THREE.BufferGeometry().setFromPoints(pts));
      apertureGroup.add(new THREE.Line(geo, apertureMat));
    }
    scene.add(apertureGroup);

    // ---- Viewfinder corner brackets ----
    const bracketMat = track(
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    );
    const bracketLen = 0.32;
    const cornerSigns: [number, number][] = [
      [-1, 1],
      [1, 1],
      [-1, -1],
      [1, -1],
    ];
    const brackets = cornerSigns.map(([sx, sy]) => {
      const geo = track(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(-sx * bracketLen, 0, 0),
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, -sy * bracketLen, 0),
        ]),
      );
      const line = new THREE.Line(geo, bracketMat);
      scene.add(line);
      return { line, sx, sy };
    });

    // ---- Occasional shooting star with trail ----
    const COMET_TRAIL = 14;
    const cometPositions = new Float32Array(COMET_TRAIL * 3);
    const cometGeo = track(new THREE.BufferGeometry());
    cometGeo.setAttribute('position', new THREE.BufferAttribute(cometPositions, 3));
    const cometMat = track(
      new THREE.PointsMaterial({
        size: 5, // pixels
        sizeAttenuation: false,
        map: dotTex,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const cometPoints = new THREE.Points(cometGeo, cometMat);
    cometPoints.frustumCulled = false;
    cometPoints.visible = false;
    scene.add(cometPoints);
    let cometActive = false;
    let cometT = 0;
    let cometDuration = 1.2;
    const cometFrom = new THREE.Vector2();
    const cometTo = new THREE.Vector2();
    let cometNextAt = 2 + Math.random() * 4;
    const cometHistory: THREE.Vector3[] = Array.from(
      { length: COMET_TRAIL },
      () => new THREE.Vector3(),
    );

    const spawnComet = () => {
      cometActive = true;
      cometPoints.visible = true;
      cometT = 0;
      cometDuration = 0.9 + Math.random() * 0.6;
      const fromLeft = Math.random() > 0.5;
      cometFrom.set(fromLeft ? -1.1 : 1.1, 0.7 + Math.random() * 0.3);
      cometTo.set(fromLeft ? 1.1 : -1.1, -0.6 - Math.random() * 0.3);
      for (const p of cometHistory) p.set(cometFrom.x * halfW, cometFrom.y * halfH, 1);
    };

    // ---- Pointer parallax (relative to the card) ----
    const target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      target.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      target.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    const parent = canvas.parentElement ?? canvas;
    if (!reduceMotion) {
      parent.addEventListener('pointermove', onMove, { passive: true });
      cleanupFns.push(() => parent.removeEventListener('pointermove', onMove));
    }

    // ---- Frame update ----
    const update = (dt: number, t: number) => {
      for (let i = 0; i < SNOW; i++) {
        const s = snow[i];
        s.ny -= s.speed * dt;
        if (s.ny < -1.1) {
          s.ny = 1.1;
          s.nx = Math.random() * 2 - 1;
        }
        const swayX = Math.sin(t * s.sway + s.phase) * 0.01;
        snowPos.setXYZ(i, (s.nx + swayX) * halfW, s.ny * halfH, s.z);
      }
      snowPos.needsUpdate = true;

      for (const f of bokeh) {
        f.nx += Math.sin(t * f.speed + f.phase) * 0.0006;
        f.ny += Math.cos(t * f.speed * 0.8 + f.phase) * 0.0004;
        f.obj.position.set(f.nx * halfW, f.ny * halfH, f.z);
        const pulse = 0.75 + 0.25 * Math.sin(t * 0.6 + f.phase);
        (f.obj as THREE.Sprite).scale.setScalar(f.base * pulse * 0.5);
      }

      for (const f of shards) {
        f.obj.position.set(
          f.nx * halfW,
          f.ny * halfH + Math.sin(t * f.speed + f.phase) * 0.35,
          f.z,
        );
        f.obj.scale.set(0.5 * f.base, 1.4 * f.base, 0.5 * f.base).multiplyScalar(0.55);
        f.obj.rotation.y += f.spin * dt;
        f.obj.rotation.z = Math.sin(t * f.speed * 0.7 + f.phase) * 0.2;
        f.edgeMat.opacity = 0.35 + 0.4 * Math.max(0, Math.sin(t * f.twinkleSpeed + f.twinklePhase));
      }

      for (const f of sparkles) {
        f.obj.position.set(f.nx * halfW, f.ny * halfH, f.z);
        f.obj.scale.setScalar(f.base * (0.55 + 0.45 * Math.sin(t * f.speed + f.phase)));
        f.obj.rotation.z += f.spin * dt;
      }

      hero.position.set(0.78 * halfW, 0, -1);
      hero.scale.setScalar(0.55);
      hero.rotation.x += 0.15 * dt;
      hero.rotation.y += 0.25 * dt;

      // Aperture iris: sits mid-right, never taller than the card
      apertureGroup.position.set(0.52 * halfW, 0, 0.5);
      apertureGroup.scale.setScalar(halfH * 0.6);
      apertureGroup.rotation.z += dt * 0.12;
      apertureMat.opacity = 0.2 + 0.14 * (0.5 + 0.5 * Math.sin(t * 0.5));

      // Corner brackets: small, inset by a fixed fraction of card HEIGHT
      for (const b of brackets) {
        b.line.position.set(b.sx * (halfW - halfH * 0.3), b.sy * halfH * 0.7, 0.8);
        b.line.scale.setScalar(halfH * 0.3);
      }

      // Shooting star lifecycle
      if (!cometActive) {
        cometNextAt -= dt;
        if (cometNextAt <= 0 && !reduceMotion) spawnComet();
      } else {
        cometT += dt;
        const p = Math.min(1, cometT / cometDuration);
        const cx = THREE.MathUtils.lerp(cometFrom.x, cometTo.x, p) * halfW;
        const cy = THREE.MathUtils.lerp(cometFrom.y, cometTo.y, p) * halfH;
        for (let i = cometHistory.length - 1; i > 0; i--) {
          cometHistory[i].copy(cometHistory[i - 1]);
        }
        cometHistory[0].set(cx, cy, 1);
        for (let i = 0; i < COMET_TRAIL; i++) {
          const hp = cometHistory[i];
          cometPositions[i * 3] = hp.x;
          cometPositions[i * 3 + 1] = hp.y;
          cometPositions[i * 3 + 2] = hp.z;
        }
        cometGeo.attributes['position'].needsUpdate = true;
        cometMat.opacity = Math.max(0, 1 - p);
        if (p >= 1) {
          cometActive = false;
          cometPoints.visible = false;
          cometNextAt = 3 + Math.random() * 5;
        }
      }

      // Parallax scaled to card height
      const ease = Math.min(1, dt * 3);
      camera.position.x += (target.x * halfH * 0.3 - camera.position.x) * ease;
      camera.position.y += (-target.y * halfH * 0.15 - camera.position.y) * ease;
      camera.lookAt(0, 0, 0);
    };

    // ---- Resize: size from the CANVAS (the card), not the page host ----
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      halfW = halfH * camera.aspect;

      cyanLight.position.set(0.35 * halfW, 4, 10);
      pinkLight.position.set(0.85 * halfW, -4, 10);

      if (reduceMotion) {
        update(0, 0);
        renderer.render(scene, camera);
      }
    };
    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(canvas);
    resize();

    let frameId = 0;
    if (!reduceMotion) {
      let last = performance.now();
      const tick = (now: number) => {
        frameId = requestAnimationFrame(tick);
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        update(dt, now / 1000);
        renderer.render(scene, camera);
      };
      frameId = requestAnimationFrame(tick);
    }

    // Releases everything this scene allocated.
    return () => {
      cancelAnimationFrame(frameId);
      resizeObs.disconnect();
      cleanupFns.forEach((fn) => fn());
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }

  private toFilledCount(haltes: HalteEntry[]): number {
    if (!haltes?.length) return 0;
    return haltes.filter((h) => !!h.waktuKedatangan || !!h.waktuKeberangkatan).length;
  }

  private openConfirmModal(message: string, onConfirm: () => void, onClose?: () => void): void {
    this.ref = this.dynamicDialogServices.confirmModal(message);

    if (!this.ref) {
      onClose?.();
      return;
    }

    this.ref.onClose.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.isValid) {
        onConfirm();
      }
      onClose?.();
    });
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDragEnter(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth++;
    this.isDraggingFile.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragDepth--;
    if (this.dragDepth <= 0) {
      this.dragDepth = 0;
      this.isDraggingFile.set(false);
    }
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragDepth = 0;
    this.isDraggingFile.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
      this.invokeToast('Please drop a .csv or .xlsx file.', 'warn');
      return;
    }

    this.isLoading.set(true);

    try {
      const parsed = await this.importService.parseFile(file);

      if (parsed.length === 0) {
        this.isLoading.set(false);
        this.invokeToast('No trip data found in this file.', 'warn');
        return;
      }

      const { valid, invalid } = this.validateImportedTrips(parsed);

      if (valid.length === 0) {
        this.isLoading.set(false);
        this.invokeToast(
          `None of the ${parsed.length} trip(s) in this file could be imported. All had missing or invalid data.`,
          'error',
        );
        return;
      }

      this.isLoading.set(false);

      const message =
        invalid.length > 0
          ? `Import ${valid.length} valid trip(s) from "${file.name}"? ${invalid.length} trip(s) will be skipped due to missing/invalid data.`
          : `Import ${valid.length} trip${valid.length > 1 ? 's' : ''} from "${file.name}"?`;

      this.openConfirmModal(message, () => this.saveImportedTrips(valid, invalid));
    } catch (err) {
      this.isLoading.set(false);
      console.error(err);
      this.invokeToast(
        err instanceof Error ? err.message : 'Failed to read the dropped file.',
        'error',
      );
    }
  }

  private validateImportedTrips(trips: TripRecord[]): {
    valid: TripRecord[];
    invalid: { trip: TripRecord; reason: string }[];
  } {
    const existingCodes = new Set(this.records().map((r) => r.kodeTrip.trim().toLowerCase()));
    const valid: TripRecord[] = [];
    const invalid: { trip: TripRecord; reason: string }[] = [];

    trips.forEach((trip) => {
      const missing: string[] = [];
      if (!trip.kodeTrip?.trim()) missing.push('Trip Code');
      if (!trip.namaSurveyor?.trim()) missing.push('Surveyor');
      if (!trip.nomorKendaraan?.trim()) missing.push('Vehicle Number');
      if (!trip.hariTanggal || isNaN(new Date(trip.hariTanggal).getTime())) {
        missing.push('Date');
      }

      if (missing.length > 0) {
        invalid.push({ trip, reason: `Missing ${missing.join(', ')}` });
        return;
      }

      if (existingCodes.has(trip.kodeTrip.trim().toLowerCase())) {
        invalid.push({ trip, reason: `Trip Code "${trip.kodeTrip}" already exists` });
        return;
      }

      const cleanedHaltes = trip.haltes.map((halte) => {
        const kedatangan = halte.waktuKedatangan ? new Date(halte.waktuKedatangan) : null;
        const keberangkatan = halte.waktuKeberangkatan ? new Date(halte.waktuKeberangkatan) : null;

        if (kedatangan && keberangkatan && keberangkatan <= kedatangan) {
          return { ...halte, waktuKeberangkatan: null };
        }
        return halte;
      });

      existingCodes.add(trip.kodeTrip.trim().toLowerCase());
      valid.push({ ...trip, haltes: cleanedHaltes });
    });

    return { valid, invalid };
  }

  private saveImportedTrips(
    valid: TripRecord[],
    invalid: { trip: TripRecord; reason: string }[] = [],
  ): void {
    this.isLoading.set(true);

    const tripsToCreate = valid.map((t) => ({
      kodeTrip: t.kodeTrip,
      namaSurveyor: t.namaSurveyor,
      hariTanggal: t.hariTanggal,
      nomorKendaraan: t.nomorKendaraan,
      haltes: t.haltes,
    }));

    this.tripService
      .bulkCreateTrips(tripsToCreate)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (created) => {
          const current = this.records();
          const mapped = (created ?? []).map((t) => {
            const haltes = (t.haltes ?? []).map((h) => ({
              ...h,
              waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
              waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
            }));

            return {
              ...t,
              hariTanggal: t.hariTanggal ? new Date(t.hariTanggal) : new Date(),
              haltes,
              filledCount: this.toFilledCount(haltes),
            };
          });
          this.records.set([...mapped, ...current]);
          if (invalid.length > 0) {
            this.invokeToast(
              `${valid.length} trip(s) imported. ${invalid.length} trip(s) skipped: ${invalid.map((i) => i.reason).join('; ')}`,
              'warn',
            );
          } else {
            this.invokeToast(
              `${valid.length} trip${valid.length > 1 ? 's' : ''} imported successfully.`,
              'success',
            );
          }
        },
        error: (err) => {
          console.error('Bulk import failed:', err);
          this.invokeToast('Failed to import trips.', 'error');
        },
      });
  }

  exportCsv(): void {
    if (!this.hasData()) {
      this.invokeToast('No trips data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trips data to CSV?', () => {
      this.exportService.exportTripsCsv(this.records());
      this.invokeToast('CSV exported successfully.', 'success');
    });
  }

  exportExcel(): void {
    if (!this.hasData()) {
      this.invokeToast('No trips data to export.', 'warn');
      return;
    }

    this.openConfirmModal('Export this trips data to Excel?', () => {
      this.exportService.exportTripsExcel(this.records());
      this.invokeToast('Excel exported successfully.', 'success');
    });
  }

  getData(): void {
    this.isLoading.set(true);

    this.tripService
      .getAllTrips()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (trips) => {
          try {
            const mapped = (trips ?? []).map((t) => {
              const haltes = (t.haltes ?? []).map((h) => ({
                ...h,
                waktuKedatangan: h?.waktuKedatangan ? new Date(h.waktuKedatangan) : null,
                waktuKeberangkatan: h?.waktuKeberangkatan ? new Date(h.waktuKeberangkatan) : null,
              }));

              return {
                ...t,
                hariTanggal: t.hariTanggal ? new Date(t.hariTanggal) : new Date(),
                haltes,
                filledCount: this.toFilledCount(haltes),
              };
            });
            this.records.set(mapped);
          } catch (mapErr) {
            console.error('Failed while transforming trip data:', mapErr, trips);
            this.invokeToast('Received malformed trip data.', 'error');
          }
        },
        error: (err) => {
          console.error('HTTP error loading trips:', err);
          this.invokeToast('Failed to load trips.', 'error');
        },
      });
  }

  setView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  tabButtonClass(mode: ViewMode): string {
    const base = 'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors';
    return this.viewMode() === mode
      ? `${base} bg-gray-400/20 text-white shadow-sm`
      : `${base} text-gray-600/50 hover:bg-gray-500/5 hover:text-gray-200`;
  }

  routeTo(base: string, id?: string | number) {
    if (id) {
      this.router.navigate([base, id]);
    } else {
      this.router.navigate([base]);
    }
  }

  openItem(id: string | number) {
    this.router.navigate(['/trip', id]);
  }

  getFilledCount(record: TripRecord): number {
    return record.haltes.filter((h) => !!h.waktuKedatangan || !!h.waktuKeberangkatan).length;
  }

  getProgressPercent(record: TripRecord): number {
    if (!record.haltes || record.haltes.length === 0) return 0;
    return (this.getFilledCount(record) / record.haltes.length) * 100;
  }

  getHalteStatusClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);

    if (percent === 100) {
      return 'bg-emerald-900/30 text-emerald-400 border border-emerald-800';
    }
    if (percent > 0 && percent < 30) {
      return 'bg-amber-900/30 text-amber-400 border border-amber-800';
    }
    if (percent >= 30) {
      return 'bg-amber-800/30 text-amber-300 border border-amber-700';
    }
    return 'bg-gray-800/50 text-gray-500 border border-gray-700';
  }

  getTextColorClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);
    if (percent === 100) return 'text-emerald-400';
    if (percent > 0 && percent < 30) return 'text-red-500';
    if (percent > 0) return 'text-amber-400';
    return 'text-gray-500';
  }

  getProgressBarClass(record: TripRecord): string {
    const percent = this.getProgressPercent(record);
    if (percent === 100) return 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
    if (percent > 0 && percent < 30) return 'bg-red-500';
    if (percent >= 30) return 'bg-amber-500';
    return 'bg-gray-600';
  }

  trackById(_index: number, record: TripRecord): number {
    return record.id;
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity: severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
