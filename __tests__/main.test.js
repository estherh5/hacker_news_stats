vi.mock('highcharts', () => ({
  default: {
    chart: vi.fn(() => ({ setSize: vi.fn() })),
    setOptions: vi.fn(),
  },
}));
vi.mock('highcharts/highcharts-more', () => ({}));
vi.mock('highcharts/modules/wordcloud', () => ({}));

import {
  checkIfLoggedIn,
  createPageFooter,
  createPageHeader,
  getCommentCounts,
  getCommentWords,
  getPostTypes,
  getUserCommentCounts,
} from '../src/main.js';

const timePeriods = ['hour', 'day', 'week', 'all'];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.querySelectorAll('.chart-container').forEach((container) => {
    container.replaceChildren();
    container.classList.remove('is-loading');
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each([
  {
    name: 'post types',
    load: getPostTypes,
    endpoint: 'post_types',
    data: [{ type: 'article', type_count: 83 }],
  },
  {
    name: 'posts with highest comment counts',
    load: getCommentCounts,
    endpoint: 'posts_highest_comment_count?count=5',
    data: [{
      comment_count: 1,
      id: 1,
      link: 'https://test.com',
      title: 'Test',
    }],
  },
  {
    name: 'most used comment words',
    load: getCommentWords,
    endpoint: 'comment_words?count=50',
    data: [{ nentry: 100, word: 'test' }],
  },
  {
    name: 'users with most comments',
    load: getUserCommentCounts,
    endpoint: 'users_most_comments?count=5',
    data: [{ comment_count: 100, username: 'test', word_count: 1000 }],
  },
])('$name', ({ load, endpoint, data }) => {
  test.each(timePeriods)('fetches the %s data', async (timePeriod) => {
    fetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(data),
    });

    await expect(load(timePeriod)).resolves.toEqual(data);
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:5000/api/hacker_news/stats/${timePeriod}/${endpoint}`,
    );
  });

  test('uses local cache when the API is unavailable', async () => {
    localStorage.setItem(`hn-${({
      post_types: 'post-types',
      'posts_highest_comment_count?count=5': 'post-comment-counts',
      'comment_words?count=50': 'comment-words',
      'users_most_comments?count=5': 'user-comment-counts',
    })[endpoint]}-hour`, JSON.stringify(data));
    fetch.mockRejectedValue(new Error('offline'));

    await expect(load('hour')).resolves.toEqual(data);
  });

  test('keeps the existing chart visible while new data loads', async () => {
    const container = document.getElementById(({
      post_types: 'post-types-pie',
      'posts_highest_comment_count?count=5': 'comment-count-bar',
      'comment_words?count=50': 'comment-word-cloud',
      'users_most_comments?count=5': 'user-comment-bubble',
    })[endpoint]);
    const existingChart = document.createElement('div');
    existingChart.className = 'existing-chart';
    container.appendChild(existingChart);

    let resolveResponse;
    fetch.mockReturnValue(new Promise((resolve) => {
      resolveResponse = resolve;
    }));

    const request = load('hour');

    expect(container.contains(existingChart)).toBe(true);
    expect(container.querySelector('.loading-image')).not.toBeNull();

    resolveResponse({
      ok: true,
      json: vi.fn().mockResolvedValue(data),
    });
    await request;
  });
});


describe('fleet apps + account menu', () => {
  const verifyUrl = 'https://api.crystalprism.io/api/user/verify';
  const signInUrl = 'https://account.crystalprism.io/sign-in/';

  // apps.json fails over to the bundled fallback; verify answers per test
  const stubFetch = (verifyResponse) => {
    fetch.mockImplementation((url) => {
      if (url === verifyUrl) {
        return verifyResponse instanceof Error
          ? Promise.reject(verifyResponse)
          : Promise.resolve(verifyResponse);
      }
      return Promise.reject(new Error('offline'));
    });
  };

  const openPanel = () => {
    document.querySelector('#header .fleet-trigger').click();
    return document.querySelector('.fleet-panel');
  };

  const rows = (panel) => Array.from(panel.querySelectorAll('.fleet-row'))
    .map((row) => ({
      label: row.textContent,
      tag: row.tagName,
      href: row.getAttribute('href'),
    }));

  beforeEach(() => {
    stubFetch(new Error('unused'));
  });

  afterEach(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelectorAll('#header, .fleet-panel, .fleet-scrim')
      .forEach((node) => node.remove());
    document.getElementById('footer').replaceChildren();
  });

  test('mounts one trigger at the header\'s trailing end, replacing the old menus', () => {
    const header = createPageHeader();

    expect(document.querySelectorAll('.fleet-trigger')).toHaveLength(1);
    expect(header.lastElementChild.classList.contains('fleet-trigger'))
      .toBe(true);
    expect(header.lastElementChild.getAttribute('aria-label'))
      .toBe('Apps and sign in');
    expect(document.body.firstElementChild).toBe(header);
    for (const id of ['site-menu', 'site-menu-icon', 'account-menu',
      'profile-link', 'account-link', 'sign-in-link']) {
      expect(document.getElementById(id)).toBeNull();
    }
  });

  test('lists the fleet with Hacker News Stats as the current app', () => {
    createPageHeader();
    const panel = openPanel();

    const tiles = panel.querySelectorAll('.fleet-app');
    expect(tiles.length).toBeGreaterThan(10);
    const current = panel.querySelectorAll('.fleet-app[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe('Hacker News Stats');
    expect(current[0].getAttribute('href'))
      .toBe('https://hn-stats.crystalprism.io/');
  });

  test('signed out (no token) shows a single Sign in row', async () => {
    createPageHeader();
    await checkIfLoggedIn();
    const panel = openPanel();

    expect(panel.querySelector('.fleet-email')).toBeNull();
    expect(rows(panel)).toEqual([
      { label: 'Sign in', tag: 'A', href: signInUrl },
    ]);
    expect(fetch).not.toHaveBeenCalledWith(verifyUrl, expect.anything());
  });

  test('signed in shows the username, Settings and Sign out', async () => {
    localStorage.setItem('token', 'good');
    stubFetch({ ok: true, json: () => Promise.resolve({ username: 'dang' }) });
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(true);
    const trigger = document.querySelector('#header .fleet-trigger');
    expect(trigger.getAttribute('aria-label'))
      .toBe('Apps and account, dang');
    expect(trigger.textContent).toBe('D');

    const panel = openPanel();
    expect(panel.querySelector('.fleet-email').textContent).toBe('dang');
    expect(rows(panel)).toEqual([
      { label: 'Settings', tag: 'A',
        href: 'https://account.crystalprism.io/my-account/' },
      { label: 'Sign out', tag: 'BUTTON', href: null },
    ]);
  });

  test('Sign out forgets the session and asks the account site to log out', async () => {
    localStorage.setItem('token', 'good');
    stubFetch({ ok: true, json: () => Promise.resolve({ username: 'dang' }) });
    createPageHeader();
    await checkIfLoggedIn();
    const panel = openPanel();

    // jsdom cannot navigate, so the Sign In redirect only logs to stderr here
    const signOutRow = Array.from(panel.querySelectorAll('.fleet-row'))
      .find((row) => row.textContent === 'Sign out');
    signOutRow.click();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('username')).toBeNull();
    expect(sessionStorage.getItem('account-request')).toBe('logout');
    expect(document.querySelector('.fleet-panel')).toBeNull();
  });

  test('a dead token (401) falls back to the Sign in row', async () => {
    localStorage.setItem('token', 'dead');
    localStorage.setItem('username', 'dang');
    stubFetch({ ok: false, status: 401 });
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(false);
    expect(localStorage.getItem('token')).toBeNull();
    expect(rows(openPanel()).map((row) => row.label)).toEqual(['Sign in']);
  });

  test('an unreachable account server keeps the cached username signed in', async () => {
    localStorage.setItem('token', 'good');
    localStorage.setItem('username', 'dang');
    stubFetch(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(true);
    expect(localStorage.getItem('token')).toBe('good');
    expect(rows(openPanel()).map((row) => row.label))
      .toEqual(['Settings', 'Sign out']);
  });
});

describe('fleet footer', () => {
  afterEach(() => {
    document.getElementById('footer').replaceChildren();
  });

  test('renders the kit footer once, replacing the old copyright line', () => {
    createPageFooter();

    const footers = document.querySelectorAll('footer.fleet-footer');
    expect(footers).toHaveLength(1);
    expect(footers[0].parentElement.id).toBe('footer');
    const links = Array.from(footers[0].querySelectorAll('a'));
    expect(links.map((a) => a.textContent)).toEqual([
      `© 2017–${new Date().getFullYear()} Crystal Prism`,
      'All apps',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://crystalprism.io',
      'https://crystalprism.io/#projects',
    ]);
    expect(document.body.textContent).not.toContain('© Copyright');
    expect(document.getElementById('copyright-year')).toBeNull();
  });
});
