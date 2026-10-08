import { Component, DestroyRef, OnInit, computed, effect, signal, untracked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import {
  Observable,
  Subscription,
  catchError,
  filter,
  finalize,
  forkJoin,
  fromEvent,
  of,
  switchMap,
  throwError,
  timer,
} from 'rxjs';

// ─── API types ──────────────────────────────────────────────────────────────

interface GitHubCommitAuthor {
  login?: string;
  avatar_url?: string;
  html_url?: string;
}

interface RawCommitData {
  sha: string;
  html_url: string;
  commit: {
    author: { name: string; email: string; date: string };
    message: string;
  };
  author?: GitHubCommitAuthor | null;
}

interface RawDeployment {
  id: number;
  sha: string;
  environment: string;
  created_at: string;
}

interface PagedResult<T> {
  data: T[];
  rateLimited: boolean;
  resetHeader: string | null;
}

interface CacheKeys {
  commits: string;
  deployments: string;
  time: string;
}

// ─── Internal types ──────────────────────────────────────────────────────────

export type CommitCategory = 'all' | 'feat' | 'fix' | 'refactor' | 'other';

export interface DeploymentInfo {
  id: number;
  deployedAt: Date;
  environment: string;
  status: 'success' | 'failure' | 'pending' | 'other';
  environmentUrl?: string;
}

export interface ParsedCommit {
  sha: string;
  shortSha: string;
  htmlUrl: string;
  rawMessage: string;
  type: string;
  typeLabel: string;
  typeIcon: string;
  typeBadgeClass: string;
  scope?: string;
  title: string;
  body?: string;
  authorName: string;
  authorUsername?: string;
  authorAvatarUrl?: string;
  authorUrl?: string;
  date: Date;
  relativeTime: string;
  deployment?: DeploymentInfo;
}

@Component({
  selector: 'app-update-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, TooltipModule, ToastModule],
  providers: [DatePipe],
  templateUrl: './update-log-page.html',
  styleUrl: './update-log-page.css',
})
export class UpdateLogPage implements OnInit {
  constructor(
    private messageService: MessageService,
    private http: HttpClient,
    private destroyRef: DestroyRef,
  ) {
    // Balik ke halaman 1 setiap kali filter kategori atau pencarian berubah
    effect(() => {
      this.selectedCategory();
      this.searchQuery();
      untracked(() => this.currentPage.set(1));
    });
  }

  // Tempel di dalam class component (.ts)

  private readonly typeStyles: Record<string, { card: string; dot: string; ring: string }> = {
    fix: {
      card: 'bg-rose-500/5 hover:bg-rose-500/10',
      dot: 'bg-rose-400',
      ring: 'ring-rose-500/20',
    },
    feat: {
      card: 'bg-violet-500/5 hover:bg-violet-500/10',
      dot: 'bg-violet-400',
      ring: 'ring-violet-500/20',
    },
    refactor: {
      card: 'bg-cyan-500/5 hover:bg-cyan-500/10',
      dot: 'bg-cyan-400',
      ring: 'ring-cyan-500/20',
    },
    default: {
      card: 'bg-gray-500/5 hover:bg-gray-500/10',
      dot: 'bg-gray-500',
      ring: 'ring-gray-500/20',
    },
  };

  typeStyle(type: string) {
    return this.typeStyles[type] ?? this.typeStyles['default'];
  }

  readonly repoOwner = 'Sh1rush1i';
  readonly repoName = 'submission-halte-addinson';
  readonly repoUrl = `https://github.com/${this.repoOwner}/${this.repoName}`;
  readonly prodDeploymentsUrl = `https://github.com/${this.repoOwner}/${this.repoName}/deployments/Production`;

  // Branch yang dipakai untuk changelog (commits endpoint default-nya hanya branch utama)
  readonly branch = 'prod';

  private readonly githubToken = '';

  private readonly autoRefreshMs = this.githubToken.trim() ? 60_000 : 600_000;

  // Saat tab kembali aktif, refresh hanya kalau data lebih tua dari ini
  private readonly staleAfterMs = 60_000;

  // Max pages per endpoint (100 items per page)
  private readonly maxPages = 5;

  private fetchSub?: Subscription;

  readonly commits = signal<ParsedCommit[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isRateLimited = signal(false);
  readonly rateLimitResetTime = signal<Date | null>(null);

  readonly selectedCategory = signal<CommitCategory>('all');
  readonly searchQuery = signal('');
  readonly lastUpdated = signal<Date | null>(null);
  readonly copiedSha = signal<string | null>(null);

  // Total raw deployments from GitHub (before dedupe per SHA)
  readonly totalDeployments = signal(0);

  // Pagination
  readonly pageSizeOptions = [20, 50, 100];
  readonly pageSize = signal(20);
  readonly currentPage = signal(1);

  // Warna tab disamakan dengan warna badge tipe commit
  readonly categories: {
    id: CommitCategory;
    label: string;
    icon: string;
    activeClass: string;
    countClass: string;
  }[] = [
    {
      id: 'all',
      label: 'All',
      icon: 'pi pi-list',
      activeClass: 'bg-sky-500/20 text-sky-300',
      countClass: 'bg-sky-500/30 text-sky-200',
    },
    {
      id: 'feat',
      label: 'Features',
      icon: 'pi pi-sparkles',
      activeClass: 'bg-emerald-500/20 text-emerald-300',
      countClass: 'bg-emerald-500/30 text-emerald-200',
    },
    {
      id: 'fix',
      label: 'Bug Fixes',
      icon: 'pi pi-wrench',
      activeClass: 'bg-rose-500/20 text-rose-300',
      countClass: 'bg-rose-500/30 text-rose-200',
    },
    {
      id: 'refactor',
      label: 'Refactor',
      icon: 'pi pi-sync',
      activeClass: 'bg-cyan-500/20 text-cyan-300',
      countClass: 'bg-cyan-500/30 text-cyan-200',
    },
    {
      id: 'other',
      label: 'Others',
      icon: 'pi pi-cog',
      activeClass: 'bg-gray-500/25 text-gray-200',
      countClass: 'bg-gray-500/40 text-gray-100',
    },
  ];

  readonly totalCount = computed(() => this.commits().length);
  readonly featCount = computed(() => this.commits().filter((c) => c.type === 'feat').length);
  readonly fixCount = computed(() => this.commits().filter((c) => c.type === 'fix').length);
  readonly refactorCount = computed(
    () => this.commits().filter((c) => c.type === 'refactor').length,
  );
  readonly otherCount = computed(
    () => this.commits().filter((c) => !['feat', 'fix', 'refactor'].includes(c.type)).length,
  );
  readonly deployedCount = computed(
    () => this.commits().filter((c) => c.deployment?.status === 'success').length,
  );

  readonly filteredCommits = computed(() => {
    const list = this.commits();
    const cat = this.selectedCategory();
    const query = this.searchQuery().trim().toLowerCase();

    return list.filter((item) => {
      if (cat === 'feat' && item.type !== 'feat') return false;
      if (cat === 'fix' && item.type !== 'fix') return false;
      if (cat === 'refactor' && item.type !== 'refactor') return false;
      if (cat === 'other' && ['feat', 'fix', 'refactor'].includes(item.type)) return false;

      if (query) {
        return (
          item.title.toLowerCase().includes(query) ||
          (item.body?.toLowerCase().includes(query) ?? false) ||
          item.shortSha.toLowerCase().includes(query) ||
          item.authorName.toLowerCase().includes(query) ||
          (item.scope?.toLowerCase().includes(query) ?? false)
        );
      }

      return true;
    });
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredCommits().length / this.pageSize())),
  );

  // Halaman aktif yang sudah dijaga agar tidak melebihi total halaman
  readonly activePage = computed(() => Math.min(this.currentPage(), this.totalPages()));

  readonly pagedCommits = computed(() => {
    const size = this.pageSize();
    const start = (this.activePage() - 1) * size;
    return this.filteredCommits().slice(start, start + size);
  });

  readonly pageStart = computed(() =>
    this.filteredCommits().length === 0 ? 0 : (this.activePage() - 1) * this.pageSize() + 1,
  );

  readonly pageEnd = computed(() =>
    Math.min(this.activePage() * this.pageSize(), this.filteredCommits().length),
  );

  // Daftar nomor halaman; -1 berarti elipsis (...)
  readonly visiblePages = computed<number[]>(() => {
    const total = this.totalPages();
    const current = this.activePage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const sorted = [...new Set([1, total, current - 1, current, current + 1])]
      .filter((p) => p >= 1 && p <= total)
      .sort((a, b) => a - b);

    const result: number[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push(-1);
      result.push(p);
    });
    return result;
  });

  ngOnInit(): void {
    // Selalu ambil data terbaru dari GitHub tiap halaman dibuka
    this.fetchAll();

    // Auto-refresh periodik di background (dilewati kalau tab sedang tidak aktif)
    timer(this.autoRefreshMs, this.autoRefreshMs)
      .pipe(
        filter(() => !document.hidden),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.fetchAll(true));

    // Saat user kembali ke tab ini, refresh kalau datanya sudah lama
    fromEvent(document, 'visibilitychange')
      .pipe(
        filter(() => !document.hidden),
        filter(() => {
          const last = this.lastUpdated();
          return !last || Date.now() - last.getTime() > this.staleAfterMs;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.fetchAll(true));

    // Batalkan request yang masih jalan saat komponen dihancurkan
    this.destroyRef.onDestroy(() => this.fetchSub?.unsubscribe());
  }

  // ─── Fetching (HttpClient + rxjs) ──────────────────────────────────────────

  /**
   * Ambil semua halaman dari endpoint list GitHub (100 item per halaman).
   * Berhenti di halaman terakhir, saat error, atau saat maxPages tercapai.
   */
  private fetchAllPages$<T>(
    baseUrl: string,
    headers: Record<string, string>,
  ): Observable<PagedResult<T>> {
    const sep = baseUrl.includes('?') ? '&' : '?';

    const loadPage = (page: number, acc: T[]): Observable<PagedResult<T>> =>
      this.http
        .get<T[]>(`${baseUrl}${sep}per_page=100&page=${page}`, { headers, observe: 'response' })
        .pipe(
          switchMap((res) => {
            const chunk = res.body ?? [];
            const data = [...acc, ...chunk];
            const isLast = chunk.length < 100 || page >= this.maxPages;

            return isLast
              ? of<PagedResult<T>>({ data, rateLimited: false, resetHeader: null })
              : loadPage(page + 1, data);
          }),
          catchError((err: HttpErrorResponse) => {
            const remaining = err.headers?.get('x-ratelimit-remaining');
            const isRateLimit =
              err.status === 429 ||
              (err.status === 403 && (remaining === '0' || remaining === null));

            if (isRateLimit) {
              return of<PagedResult<T>>({
                data: acc,
                rateLimited: true,
                resetHeader: err.headers?.get('x-ratelimit-reset') ?? null,
              });
            }

            // Error di halaman 1 = gagal total; di halaman berikutnya pakai data yang sudah ada
            if (page === 1) return throwError(() => err);
            return of<PagedResult<T>>({ data: acc, rateLimited: false, resetHeader: null });
          }),
        );

    return loadPage(1, []);
  }

  fetchAll(silent = false): void {
    // Saat rate limit masih aktif, auto-refresh dilewati supaya tidak spam request
    const reset = this.rateLimitResetTime();
    if (silent && this.isRateLimited() && reset && reset.getTime() > Date.now()) {
      return;
    }

    this.fetchSub?.unsubscribe();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const keys = this.cacheKeys();

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    const token = this.githubToken.trim();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const base = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}`;

    this.fetchSub = forkJoin({
      // sha=<branch> -> ambil commit dari branch prod, bukan branch default
      commits: this.fetchAllPages$<RawCommitData>(
        `${base}/commits?sha=${encodeURIComponent(this.branch)}`,
        headers,
      ),
      deployments: this.fetchAllPages$<RawDeployment>(
        `${base}/deployments?environment=Production`,
        headers,
      ),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ commits, deployments }) => this.onFetched(commits, deployments, keys, silent),
        error: (err: unknown) => this.onFetchError(err, keys, silent),
      });
  }

  private onFetched(
    commitsResult: PagedResult<RawCommitData>,
    depsResult: PagedResult<RawDeployment>,
    keys: CacheKeys,
    silent: boolean,
  ): void {
    // Rate limit: baru di sini data localStorage dipakai (kalau belum ada data di layar)
    if (commitsResult.rateLimited || depsResult.rateLimited) {
      this.isRateLimited.set(true);

      const resetHeader = commitsResult.resetHeader || depsResult.resetHeader;
      if (resetHeader) {
        this.rateLimitResetTime.set(new Date(parseInt(resetHeader, 10) * 1000));
      }

      const hasData = this.commits().length > 0 || this.restoreCachedData(keys);
      const msg = 'GitHub API rate limit exceeded. Please wait until the quota resets.';

      if (!hasData) {
        this.errorMessage.set(msg);
      }
      if (!silent) {
        this.invokeToast(hasData ? `${msg} Showing cached data.` : msg, hasData ? 'warn' : 'error');
      }
      return;
    }

    this.isRateLimited.set(false);
    this.rateLimitResetTime.set(null);

    const rawCommits = commitsResult.data;
    const rawDeployments = depsResult.data;

    this.totalDeployments.set(rawDeployments.length);

    // Map deployments (API returns newest first, so the first per SHA is the latest)
    const depMap: Record<string, DeploymentInfo> = {};
    for (const dep of rawDeployments) {
      if (!depMap[dep.sha]) {
        depMap[dep.sha] = {
          id: dep.id,
          deployedAt: new Date(dep.created_at),
          environment: dep.environment || 'Production',
          status: 'success',
          environmentUrl: this.prodDeploymentsUrl,
        };
      }
    }

    this.processCommits(rawCommits, depMap);

    const now = new Date();
    this.lastUpdated.set(now);

    // Store only the fields we use, to keep localStorage small
    const slim: RawCommitData[] = rawCommits.map((c) => ({
      sha: c.sha,
      html_url: c.html_url,
      commit: { author: c.commit.author, message: c.commit.message },
      author: c.author
        ? {
            login: c.author.login,
            avatar_url: c.author.avatar_url,
            html_url: c.author.html_url,
          }
        : null,
    }));

    try {
      localStorage.setItem(keys.commits, JSON.stringify(slim));
      localStorage.setItem(keys.deployments, JSON.stringify(depMap));
      localStorage.setItem(keys.time, now.toISOString());
    } catch {
      // Storage penuh / diblokir: hapus cache parsial, data tetap tampil dari memori
      this.clearCache(keys);
      if (!silent) {
        this.invokeToast('Could not save the changelog to local cache.', 'warn');
      }
    }
  }

  private onFetchError(err: unknown, keys: CacheKeys, silent: boolean): void {
    let msg = 'Failed to connect to GitHub API.';

    if (err instanceof HttpErrorResponse && err.status !== 0) {
      msg = `GitHub API error (HTTP ${err.status})`;
    }

    // Gagal fetch (offline, dll): pakai data localStorage kalau ada
    const hasData = this.commits().length > 0 || this.restoreCachedData(keys);

    if (!hasData) {
      this.errorMessage.set(msg);
    }
    if (!silent) {
      this.invokeToast(hasData ? `${msg}. Showing cached data.` : msg, hasData ? 'warn' : 'error');
    }
  }

  // ─── Cache ─────────────────────────────────────────────────────────────────

  private cacheKeys(): CacheKeys {
    // Branch masuk ke cache key supaya cache branch lain tidak terpakai
    const prefix = `${this.repoOwner}_${this.repoName}_${this.branch}_v5`;
    return {
      commits: `gh_commits_${prefix}`,
      deployments: `gh_deployments_${prefix}`,
      time: `gh_commits_${prefix}_time`,
    };
  }

  private clearCache(keys: CacheKeys): void {
    try {
      localStorage.removeItem(keys.commits);
      localStorage.removeItem(keys.deployments);
      localStorage.removeItem(keys.time);
    } catch {
      // localStorage tidak bisa diakses, tidak ada yang perlu dibersihkan
    }
  }

  private restoreCachedData(keys: CacheKeys): boolean {
    try {
      const cachedCommits = localStorage.getItem(keys.commits);
      const cachedDeps = localStorage.getItem(keys.deployments);
      const cachedTime = localStorage.getItem(keys.time);

      if (cachedCommits) {
        const rawCommits: RawCommitData[] = JSON.parse(cachedCommits);
        const parsedDeps: Record<string, DeploymentInfo> = cachedDeps ? JSON.parse(cachedDeps) : {};

        // Dates become strings after JSON.parse, so convert them back
        const depMap: Record<string, DeploymentInfo> = {};
        for (const [sha, dep] of Object.entries(parsedDeps)) {
          depMap[sha] = { ...dep, deployedAt: new Date(dep.deployedAt) };
        }

        if (rawCommits.length > 0) {
          this.processCommits(rawCommits, depMap);
          if (cachedTime) {
            this.lastUpdated.set(new Date(cachedTime));
          }
          return true;
        }
      }
    } catch {
      // Cache rusak (JSON tidak valid): buang supaya tidak error terus di load berikutnya
      this.clearCache(keys);
    }
    return false;
  }

  // ─── Parsing ───────────────────────────────────────────────────────────────

  private processCommits(rawList: RawCommitData[], depMap: Record<string, DeploymentInfo>): void {
    const parsed: ParsedCommit[] = rawList.map((item) => {
      const date = new Date(item.commit.author.date);
      const parsedMsg = this.parseCommitMessage(item.commit.message);

      return {
        sha: item.sha,
        shortSha: item.sha.substring(0, 7),
        htmlUrl: item.html_url,
        rawMessage: item.commit.message,
        ...parsedMsg,
        authorName: item.commit.author.name,
        authorUsername: item.author?.login,
        authorAvatarUrl: item.author?.avatar_url,
        authorUrl: item.author?.html_url,
        date,
        relativeTime: this.getRelativeTime(date),
        deployment: depMap[item.sha],
      };
    });

    this.commits.set(parsed);
  }

  private parseCommitMessage(message: string): {
    type: string;
    typeLabel: string;
    typeIcon: string;
    typeBadgeClass: string;
    scope?: string;
    title: string;
    body?: string;
  } {
    const lines = message.split('\n');
    const firstLine = lines[0].trim();
    const remainingLines = lines.slice(1).join('\n').trim();

    const match = firstLine.match(/^([a-zA-Z]+)(?:\(([^)]+)\))?!?:?\s*(.*)$/);

    let rawType = 'update';
    let scope: string | undefined;
    let title = firstLine;

    if (match) {
      const t = match[1].toLowerCase();
      const known = [
        'feat',
        'fix',
        'refactor',
        'perf',
        'style',
        'docs',
        'chore',
        'test',
        'build',
        'ci',
      ];
      if (known.includes(t)) {
        rawType = t;
        scope = match[2]?.trim();
        title = match[3]?.trim() || firstLine;
      }
    }

    let typeLabel = 'Update';
    let typeIcon = 'pi pi-tag';
    let typeBadgeClass = 'bg-blue-500/10 text-blue-400 border-blue-500/30';

    switch (rawType) {
      case 'feat':
        typeLabel = 'Feature';
        typeIcon = 'pi pi-sparkles';
        typeBadgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
        break;
      case 'fix':
        typeLabel = 'Fix';
        typeIcon = 'pi pi-wrench';
        typeBadgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        break;
      case 'refactor':
        typeLabel = 'Refactor';
        typeIcon = 'pi pi-sync';
        typeBadgeClass = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
        break;
      case 'perf':
        typeLabel = 'Perf';
        typeIcon = 'pi pi-bolt';
        typeBadgeClass = 'bg-purple-500/10 text-purple-400 border-purple-500/30';
        break;
      case 'style':
        typeLabel = 'UI / Style';
        typeIcon = 'pi pi-palette';
        typeBadgeClass = 'bg-pink-500/10 text-pink-400 border-pink-500/30';
        break;
      case 'docs':
        typeLabel = 'Docs';
        typeIcon = 'pi pi-book';
        typeBadgeClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
        break;
      case 'chore':
      case 'build':
      case 'ci':
        typeLabel = 'Chore';
        typeIcon = 'pi pi-cog';
        typeBadgeClass = 'bg-gray-500/10 text-gray-400 border-gray-600/30';
        break;
    }

    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    return {
      type: rawType,
      typeLabel,
      typeIcon,
      typeBadgeClass,
      scope,
      title,
      body: remainingLines || undefined,
    };
  }

  private getRelativeTime(date: Date): string {
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD === 1) return 'Yesterday';
    if (diffD < 30) return `${diffD}d ago`;
    const diffMo = Math.floor(diffD / 30);
    if (diffMo < 12) return `${diffMo}mo ago`;
    return `${Math.floor(diffMo / 12)}y ago`;
  }

  // ─── Template helpers ──────────────────────────────────────────────────────

  deploymentDotClass(dep: DeploymentInfo | undefined): string {
    if (!dep) return 'bg-gray-500';
    if (dep.status === 'success') return 'bg-emerald-400';
    if (dep.status === 'failure') return 'bg-rose-400';
    if (dep.status === 'pending') return 'bg-amber-400 animate-pulse';
    return 'bg-gray-400';
  }

  deploymentLabel(dep: DeploymentInfo | undefined): string {
    if (!dep) return '';
    if (dep.status === 'success') return 'Deployed';
    if (dep.status === 'failure') return 'Failed';
    if (dep.status === 'pending') return 'Deploying';
    return 'Unknown';
  }

  deploymentBadgeClass(dep: DeploymentInfo | undefined): string {
    if (!dep) return '';
    if (dep.status === 'success') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (dep.status === 'failure') return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    if (dep.status === 'pending') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-gray-500/10 text-gray-400 border-gray-600/30';
  }

  deploymentIcon(dep: DeploymentInfo | undefined): string {
    if (!dep) return '';
    if (dep.status === 'success') return 'pi pi-check-circle';
    if (dep.status === 'failure') return 'pi pi-times-circle';
    if (dep.status === 'pending') return 'pi pi-spin pi-spinner';
    return 'pi pi-question-circle';
  }

  // Delay reveal per item (ms), dibatasi supaya item di bawah tidak menunggu terlalu lama
  revealDelay(index: number): number {
    return Math.min(index, 12) * 60;
  }

  selectCategory(category: CommitCategory): void {
    this.selectedCategory.set(category);
  }

  getCategoryCount(category: CommitCategory): number {
    switch (category) {
      case 'all':
        return this.totalCount();
      case 'feat':
        return this.featCount();
      case 'fix':
        return this.fixCount();
      case 'refactor':
        return this.refactorCount();
      case 'other':
        return this.otherCount();
    }
  }

  async copySha(sha: string): Promise<void> {
    if (!navigator?.clipboard?.writeText) {
      this.invokeToast('Clipboard is not available in this browser.', 'warn');
      return;
    }

    try {
      await navigator.clipboard.writeText(sha);
      this.copiedSha.set(sha);
      setTimeout(() => {
        if (this.copiedSha() === sha) {
          this.copiedSha.set(null);
        }
      }, 2000);
    } catch {
      this.invokeToast('Failed to copy SHA to clipboard.', 'error');
    }
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages());
    if (target === this.activePage()) return;
    this.currentPage.set(target);
    document.getElementById('timeline-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  invokeToast(message: string, severity: 'success' | 'info' | 'warn' | 'error') {
    this.messageService.add({
      severity,
      summary: 'Notification',
      detail: message,
    });
  }
}
