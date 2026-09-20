import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { TooltipModule } from 'primeng/tooltip';

interface SkillItem {
  name: string;
  icon: string;
  needsLightBg?: boolean;
}

interface ExperienceItem {
  period: string;
  role: string;
  company: string;
  description: string;
  accent: string;
}

@Component({
  selector: 'app-about-page',
  imports: [CommonModule, TooltipModule],
  templateUrl: './about-page.html',
  styleUrl: './about-page.css',
})
export class AboutPage implements AfterViewInit, OnDestroy {
  @ViewChild('threeCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('nameSpan') nameSpan!: ElementRef<HTMLSpanElement>;
  @ViewChild('avatarInner') avatarInner!: ElementRef<HTMLDivElement>;

  constructor(private cdr: ChangeDetectorRef) {}

  names: string[] = ['sh1rush1', 'm4ul4'];
  currentNameIndex = 0;
  private nameIntervalId: any;

  avatarImages: string[] = ['/pernah malam.jpg', '/maret.jpg'];
  currentAvatarIndex = 0;

  skills: SkillItem[] = [
    { name: 'TypeScript', icon: 'devicon-typescript-plain colored' },
    { name: 'JavaScript', icon: 'devicon-javascript-plain colored' },
    { name: 'C#', icon: 'devicon-csharp-plain colored' },
    { name: 'HTML', icon: 'devicon-html5-plain colored' },
    { name: 'CSS', icon: 'devicon-css3-plain colored' },
    { name: 'Bootstrap CSS', icon: 'devicon-bootstrap-plain colored' },
    { name: 'Tailwind CSS', icon: 'devicon-tailwindcss-plain colored' },
    { name: 'Unity', icon: 'devicon-unity-plain' },
    { name: 'Angular', icon: 'devicon-angularjs-plain colored' },
    { name: 'Next.js', icon: 'devicon-nextjs-original-wordmark' },
    { name: 'React', icon: 'devicon-react-plain colored' },
    { name: 'Git', icon: 'devicon-git-plain colored' },
  ];

  experiences: ExperienceItem[] = [
    {
      period: '2025 — Now',
      role: 'Front-end Web Developer',
      company: 'PT. Unicorn Intertranz',
      description:
        'Developed an internal company management system with inventory tracking, data monitoring, homepage, and etc, using Angular and Bootstrap.',
      accent: '#7ec8e3',
    },
    {
      period: '2025',
      role: 'Freelance Front-end Web Developer',
      company: '-',
      description:
        'Developed CMS and landing pages using Laravel with Blade templates and Bootstrap, focusing on clean architecture, responsive design, and user friendly content management.',
      accent: '#7ec8e3',
    },
    {
      period: '2024 — 2025',
      role: 'Inter Front-end Web Dev & IT Support',
      company: 'Center of Excellence (CoE) Smart Tourism & Hospitality, Telkom University',
      description:
        'Designed tourism website in figma, and provided IT support for the organization.',
      accent: '#7ec8e3',
    },
    {
      period: '2022',
      role: 'Third Person Game Programming Mentor',
      company: 'Indonesia Cyber Education Institute',
      description: 'Mentored students in third-person game programming using Unity and C#.',
      accent: '#7ec8e3',
    },
  ];

  tiltX = 0;
  tiltY = 0;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private particles!: THREE.Points;
  private linesMesh!: THREE.LineSegments;
  private particleCount = 260;
  private particlePositions!: Float32Array;
  private particleVelocities!: Float32Array;
  private animationFrameId = 0;
  private mouseX = 0;
  private mouseY = 0;
  private scrollY = 0;
  private observer?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private container!: HTMLElement;

  ngAfterViewInit(): void {
    this.container = this.canvasRef.nativeElement.parentElement!;
    this.initThree();
    this.animate();
    this.initRevealObserver();

    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.container);

    this.nameIntervalId = setInterval(() => this.cycleName(), 3000);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.renderer?.dispose();
    this.observer?.disconnect();
    this.resizeObserver?.disconnect();
    clearInterval(this.nameIntervalId);
  }

  onResize(): void {
    const { width, height } = this.getContainerSize();
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY = window.scrollY;
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    this.mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    this.tiltY = this.mouseX * 6;
    this.tiltX = -this.mouseY * 6;
  }

  private cycleName(): void {
    this.currentNameIndex = (this.currentNameIndex + 1) % this.names.length;
    const avatarEl = this.avatarInner?.nativeElement;
    if (avatarEl) {
      avatarEl.classList.add('avatar-flipping');
      setTimeout(() => {
        this.currentAvatarIndex = this.currentNameIndex;
        this.cdr.detectChanges();

        avatarEl.classList.remove('avatar-flipping');
      }, 250);
    }

    this.cdr.detectChanges();

    const el = this.nameSpan?.nativeElement;
    if (!el) return;

    el.classList.remove('name-fade-up');
    void el.offsetWidth;
    el.classList.add('name-fade-up');
  }

  private getContainerSize(): { width: number; height: number } {
    return {
      width: this.container.clientWidth,
      height: this.container.clientHeight || window.innerHeight,
    };
  }
  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    const { width, height } = this.getContainerSize();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    this.camera.position.z = 8;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.particlePositions = new Float32Array(this.particleCount * 3);
    this.particleVelocities = new Float32Array(this.particleCount * 3);

    for (let i = 0; i < this.particleCount; i++) {
      this.particlePositions[i * 3] = (Math.random() - 0.5) * 22;
      this.particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 18;
      this.particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 12;

      this.particleVelocities[i * 3] = (Math.random() - 0.5) * 0.004;
      this.particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.004;
      this.particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0x7ec8e3, // ice blue — aksen utama Evernight
      size: 0.045,
      transparent: true,
      opacity: 0.85,
    });
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particles);

    const lineGeometry = new THREE.BufferGeometry();
    const maxLines = this.particleCount * 4;
    const linePositions = new Float32Array(maxLines * 2 * 3);
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xc1435a, // crimson — aksen kedua Evernight
      transparent: true,
      opacity: 0.15,
    });
    this.linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    this.scene.add(this.linesMesh);
  }

  private updateParticles(): void {
    const positions = this.particles.geometry.attributes['position'] as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;

    for (let i = 0; i < this.particleCount; i++) {
      arr[i * 3] += this.particleVelocities[i * 3];
      arr[i * 3 + 1] += this.particleVelocities[i * 3 + 1];
      arr[i * 3 + 2] += this.particleVelocities[i * 3 + 2];

      if (Math.abs(arr[i * 3]) > 11) this.particleVelocities[i * 3] *= -1;
      if (Math.abs(arr[i * 3 + 1]) > 9) this.particleVelocities[i * 3 + 1] *= -1;
      if (Math.abs(arr[i * 3 + 2]) > 6) this.particleVelocities[i * 3 + 2] *= -1;
    }
    positions.needsUpdate = true;

    const linePositions = this.linesMesh.geometry.attributes['position'] as THREE.BufferAttribute;
    const lineArr = linePositions.array as Float32Array;
    let lineIndex = 0;
    const maxDistance = 2.6;
    const maxSegments = lineArr.length / 6;

    for (let i = 0; i < this.particleCount && lineIndex < maxSegments; i++) {
      for (let j = i + 1; j < this.particleCount && lineIndex < maxSegments; j++) {
        const dx = arr[i * 3] - arr[j * 3];
        const dy = arr[i * 3 + 1] - arr[j * 3 + 1];
        const dz = arr[i * 3 + 2] - arr[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < maxDistance) {
          lineArr[lineIndex * 6] = arr[i * 3];
          lineArr[lineIndex * 6 + 1] = arr[i * 3 + 1];
          lineArr[lineIndex * 6 + 2] = arr[i * 3 + 2];
          lineArr[lineIndex * 6 + 3] = arr[j * 3];
          lineArr[lineIndex * 6 + 4] = arr[j * 3 + 1];
          lineArr[lineIndex * 6 + 5] = arr[j * 3 + 2];
          lineIndex++;
        }
      }
    }
    for (let k = lineIndex * 6; k < lineArr.length; k++) lineArr[k] = 0;
    linePositions.needsUpdate = true;
  }

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    this.updateParticles();
    this.particles.rotation.y += 0.0004;
    this.linesMesh.rotation.y += 0.0004;

    this.camera.position.x += (this.mouseX * 1.2 - this.camera.position.x) * 0.03;
    this.camera.position.y += (-this.mouseY * 1.2 - this.camera.position.y) * 0.03;

    const scrollFactor = Math.min(this.scrollY / 1200, 1);
    this.camera.position.z = 8 + scrollFactor * 4;
    this.scene.rotation.x = scrollFactor * 0.15;

    this.camera.lookAt(this.scene.position);
    this.renderer.render(this.scene, this.camera);
  };

  private initRevealObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    document.querySelectorAll('.reveal').forEach((el) => this.observer?.observe(el));
  }
}
