import { NotFoundException, UpstreamException } from '@/errors/http-exceptions';

type Game = {
  slug: string;
  name: string;
  category: string;
  price: string;
  shortDescription: string;
  rating: number;
  likesCount: number;
  cardImage: string;
};

const makeGame = (slug: string, name: string, category: string, rating: number): Game => ({
  slug,
  name,
  category,
  price: 'Free',
  shortDescription: `${name} short`,
  rating,
  likesCount: 100,
  cardImage: `/assets/${slug}.jpg`,
});

/** In-memory stand-in for the MiniGames upstream: same paths and shapes, plus call tracking. */
export class FakeUpstream {
  games: Game[] = [];
  likes = new Map<string, Set<string>>();
  calls: { method: 'GET' | 'POST'; path: string; query?: object; body?: unknown }[] = [];
  comments: {
    commentId: string;
    slug: string;
    authorName: string;
    text: string;
    likes: Set<string>;
    createdAt: string;
  }[] = [];
  /** When set, every call throws this (simulates the upstream being down). */
  failure: Error | null = null;

  constructor() {
    this.reset();
  }

  reset() {
    this.games = [
      makeGame('alpha-quest', 'Alpha Quest', 'puzzle', 4.9),
      makeGame('beta-farm', 'Beta Farm', 'farm', 4.5),
      makeGame('gamma-cards', 'Gamma Cards', 'card', 4.1),
      makeGame('delta-arcade', 'Delta Arcade', 'arcade', 3.8),
    ];
    this.likes = new Map();
    this.comments = [];
    this.calls = [];
    this.failure = null;
  }

  callsTo(method: 'GET' | 'POST', path: string) {
    return this.calls.filter((call) => call.method === method && call.path === path);
  }

  likeCount(slug: string) {
    return (
      (this.games.find((game) => game.slug === slug)?.likesCount ?? 0) + this.emails(slug).size
    );
  }

  emails(slug: string) {
    return this.likes.get(slug) ?? new Set<string>();
  }

  async get<T>(path: string, query: Record<string, unknown> = {}): Promise<T> {
    this.calls.push({ method: 'GET', path, query });
    if (this.failure) throw this.failure;

    if (path === '/api/categories') {
      return {
        data: [
          { slug: 'all', label: 'All', isDefault: true },
          { slug: 'puzzle', label: 'Puzzle', isDefault: false },
        ],
        meta: { totalItems: 2 },
      } as T;
    }
    if (path === '/api/leaderboard') {
      return { data: [{ rank: 1, playerName: 'Alex' }], meta: { totalItems: 1 } } as T;
    }
    if (path === '/api/games') {
      return this.listGames(query) as T;
    }
    const match = /^\/api\/games\/([^/]+)$/.exec(path);
    if (match) {
      const game = this.games.find((item) => item.slug === decodeURIComponent(match[1]!));
      if (!game) throw new NotFoundException('Game not found');
      return {
        data: {
          slug: game.slug,
          name: game.name,
          likesCount: this.likeCount(game.slug),
          isLikedByCurrentUser: false,
        },
      } as T;
    }
    const list = /^\/api\/games\/([^/]+)\/comments$/.exec(path);
    if (list) {
      const slug = decodeURIComponent(list[1]!);
      if (!this.games.some((game) => game.slug === slug)) throw new NotFoundException();
      let items = this.comments.filter((comment) => comment.slug === slug);
      if (query.sort === 'newest') items = [...items].reverse();
      const total = items.length;
      if (query.limit !== undefined) items = items.slice(0, Number(query.limit));
      return {
        data: items.map((comment) => this.commentView(comment, query.userEmail as string)),
        meta: { totalComments: total, returnedCount: items.length },
      } as T;
    }
    throw new Error(`FakeUpstream: unhandled GET ${path}`);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    this.calls.push({ method: 'POST', path, body });
    if (this.failure) throw this.failure;

    const like = /^\/api\/comments\/([^/]+)\/like$/.exec(path);
    if (like) {
      const comment = this.comments.find((item) => item.commentId === like[1]);
      if (!comment) throw new NotFoundException();
      const email = (body as { userEmail: string }).userEmail;
      if (!comment.likes.delete(email)) comment.likes.add(email);
      return {
        data: { isLikedByCurrentUser: comment.likes.has(email), likesCount: comment.likes.size },
      } as T;
    }
    const add = /^\/api\/games\/([^/]+)\/comments$/.exec(path);
    if (add) {
      const slug = decodeURIComponent(add[1]!);
      if (!this.games.some((game) => game.slug === slug)) throw new NotFoundException();
      const input = body as { authorName: string; text: string };
      const comment = {
        commentId: `00000000-0000-4000-8000-${String(this.comments.length + 1).padStart(12, '0')}`,
        slug,
        authorName: input.authorName,
        text: input.text,
        likes: new Set<string>(),
        createdAt: new Date().toISOString(),
      };
      this.comments.push(comment);
      return { data: this.commentView(comment, '') } as T;
    }
    const match = /^\/api\/games\/([^/]+)\/favorite$/.exec(path);
    if (!match) throw new Error(`FakeUpstream: unhandled POST ${path}`);
    const slug = decodeURIComponent(match[1]!);
    if (!this.games.some((game) => game.slug === slug)) throw new NotFoundException();

    const email = (body as { userEmail: string }).userEmail;
    const set = this.likes.get(slug) ?? new Set<string>();
    this.likes.set(slug, set);
    const isFavorited = !set.has(email);
    if (isFavorited) set.add(email);
    else set.delete(email);
    return { data: { gameSlug: slug, isFavorited, likesCount: this.likeCount(slug) } } as T;
  }

  fail() {
    this.failure = new UpstreamException('boom');
  }

  private commentView(comment: FakeUpstream['comments'][number], email: string) {
    return {
      commentId: comment.commentId,
      authorName: comment.authorName,
      text: comment.text,
      likesCount: comment.likes.size,
      isLikedByCurrentUser: comment.likes.has(email),
      createdAt: comment.createdAt,
    };
  }

  private listGames(query: Record<string, unknown>) {
    if (query.featured === true) {
      return { data: this.games.slice(0, 2), meta: { totalItems: 2 } };
    }
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const category = String(query.category ?? 'all');
    const sort = String(query.sort ?? 'rating-desc');

    const filtered = this.games.filter((game) => category === 'all' || game.category === category);
    const sorted = [...filtered].sort((a, b) =>
      sort === 'rating-asc'
        ? a.rating - b.rating
        : sort === 'name-asc'
          ? a.name.localeCompare(b.name)
          : sort === 'name-desc'
            ? b.name.localeCompare(a.name)
            : b.rating - a.rating,
    );
    return {
      data: sorted.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        limit,
        totalItems: sorted.length,
        totalPages: Math.max(1, Math.ceil(sorted.length / limit)),
      },
    };
  }
}

export const fakeUpstream = new FakeUpstream();
