vi.mock('highcharts', () => ({
  default: {
    chart: vi.fn(() => ({ setSize: vi.fn() })),
    setOptions: vi.fn(),
  },
}));
vi.mock('highcharts/highcharts-more', () => ({}));
vi.mock('highcharts/modules/wordcloud', () => ({}));

import Highcharts from 'highcharts';
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


describe('panel states', () => {
  const container = () => document.getElementById('post-types-pie');

  test('an empty period says so instead of drawing an empty chart', async () => {
    fetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue([]) });

    await getPostTypes('hour');

    expect(container().querySelector('.panel-message').textContent)
      .toBe('No post types in the past hour. Scraping stopped in May 2024.');
    expect(container().querySelector('.retry-button')).toBeNull();
    expect(container().querySelector('.loading-image')).toBeNull();
    expect(container().hasAttribute('aria-busy')).toBe(false);
  });

  test('a failure with no cache shows Try again, which reloads the panel', async () => {
    fetch.mockRejectedValueOnce(new Error('offline'));

    await getPostTypes('day');

    const retry = container().querySelector('.retry-button');
    expect(container().querySelector('[role="alert"]').textContent)
      .toContain('Couldn\u2019t load the post types.');
    expect(retry.textContent).toBe('Try again');

    const data = [{ type: 'article', type_count: 3 }];
    fetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(data) });
    retry.click();

    expect(container().querySelector('.panel-message')).toBeNull();
    expect(container().querySelector('.loading-image')).not.toBeNull();
    await vi.waitFor(() =>
      expect(container().querySelector('.loading-image')).toBeNull());
    expect(fetch).toHaveBeenLastCalledWith(
      'http://localhost:5000/api/hacker_news/stats/day/post_types');
  });

  test('a slow earlier period never overwrites the one picked after it', async () => {
    let resolveSlow;
    fetch
      .mockReturnValueOnce(new Promise((resolve) => { resolveSlow = resolve; }))
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue([]) });

    const slow = getPostTypes('week');
    await getPostTypes('hour');
    Highcharts.chart.mockClear();
    resolveSlow({ ok: true, json: vi.fn().mockResolvedValue([{ type: 'ask', type_count: 1 }]) });
    await slow;

    expect(Highcharts.chart).not.toHaveBeenCalled();
    expect(container().querySelector('.panel-message').textContent)
      .toBe('No post types in the past hour. Scraping stopped in May 2024.');
  });
});

describe('fleet apps + account menu', () => {
  const verifyUrl = 'https://api.crystalprism.io/api/user/verify';
  const signInUrl = 'https://account.crystalprism.io/sign-in/';
  const logoutUrl = 'https://api.crystalprism.io/api/logout';

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

  test('signed out (401) shows a single Sign in row', async () => {
    localStorage.setItem('username', 'dang');
    stubFetch({ ok: false, status: 401 });
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(false);
    const panel = openPanel();
    expect(panel.querySelector('.fleet-email')).toBeNull();
    expect(rows(panel)).toEqual([
      { label: 'Sign in', tag: 'A', href: signInUrl },
    ]);
    expect(localStorage.getItem('username')).toBeNull();
  });

  test('asks the API with the shared session cookie, never a stored token', async () => {
    // A pre-cookie token left on this origin is dropped, not sent
    localStorage.setItem('token', 'stale');
    stubFetch({ ok: false, status: 401 });
    createPageHeader();

    await checkIfLoggedIn();
    expect(fetch).toHaveBeenCalledWith(verifyUrl, expect.objectContaining({
      credentials: 'include',
      method: 'GET',
    }));
    const [, options] = fetch.mock.calls.find(([url]) => url === verifyUrl);
    expect(options.headers).toBeUndefined();
    expect(localStorage.getItem('token')).toBeNull();
  });

  test('signed in shows the username, Settings and Sign out', async () => {
    stubFetch({ ok: true, json: () => Promise.resolve({ username: 'dang' }) });
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(true);
    const trigger = document.querySelector('#header .fleet-trigger');
    expect(trigger.getAttribute('aria-label'))
      .toBe('Apps and account, dang');
    expect(trigger.textContent).toBe('');
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(trigger.classList.contains('hn-fleet-trigger')).toBe(true);

    const panel = openPanel();
    expect(panel.querySelector('.fleet-email').textContent).toBe('dang');
    expect(rows(panel)).toEqual([
      { label: 'Settings', tag: 'A',
        href: 'https://account.crystalprism.io/my-account/' },
      { label: 'Sign out', tag: 'BUTTON', href: null },
    ]);
    expect(localStorage.getItem('username')).toBe('dang');
  });

  test('Sign out POSTs to the API once, then lands on Sign In', async () => {
    let finishLogout;
    fetch.mockImplementation((url) => {
      if (url === verifyUrl) {
        return Promise.resolve(
          { ok: true, json: () => Promise.resolve({ username: 'dang' }) });
      }
      if (url === logoutUrl) {
        return new Promise((resolve) => { finishLogout = resolve; });
      }
      return Promise.reject(new Error('offline'));
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    createPageHeader();
    await checkIfLoggedIn();

    const signOutRow = Array.from(openPanel().querySelectorAll('.fleet-row'))
      .find((row) => row.textContent === 'Sign out');
    signOutRow.click();

    // While the request is out, the menu stays open on the row, which says so
    // and ignores a second click
    expect(document.querySelector('.fleet-panel')).not.toBeNull();
    expect(signOutRow.textContent).toBe('Signing out…');
    expect(signOutRow.getAttribute('aria-disabled')).toBe('true');
    signOutRow.click();
    const logoutCalls = () => fetch.mock.calls
      .filter(([url]) => url === logoutUrl);
    expect(logoutCalls()).toHaveLength(1);
    expect(logoutCalls()[0][1]).toEqual(expect.objectContaining({
      credentials: 'include',
      method: 'POST',
    }));
    expect(assign).not.toHaveBeenCalled();

    finishLogout({ ok: true });
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(assign).toHaveBeenCalledWith(signInUrl + '?signed-out');
    expect(localStorage.getItem('username')).toBeNull();
  });

  test('a failed sign-out keeps the username and still lands on Sign In', async () => {
    fetch.mockImplementation((url) => {
      if (url === verifyUrl) {
        return Promise.resolve(
          { ok: true, json: () => Promise.resolve({ username: 'dang' }) });
      }
      return Promise.reject(new Error('offline'));
    });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    createPageHeader();
    await checkIfLoggedIn();

    Array.from(openPanel().querySelectorAll('.fleet-row'))
      .find((row) => row.textContent === 'Sign out').click();

    // Sign In's own session check reports "still signed in"
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(assign).toHaveBeenCalledWith(signInUrl + '?signed-out');
    expect(localStorage.getItem('username')).toBe('dang');
  });

  test('an unreachable account server keeps the cached username signed in', async () => {
    localStorage.setItem('username', 'dang');
    stubFetch(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(true);
    expect(rows(openPanel()).map((row) => row.label))
      .toEqual(['Settings', 'Sign out']);
  });

  test('an unreachable server with no cached username shows Sign in', async () => {
    stubFetch(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    createPageHeader();

    await expect(checkIfLoggedIn()).resolves.toBe(false);
    expect(rows(openPanel()).map((row) => row.label)).toEqual(['Sign in']);
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
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://crystalprism.io',
    ]);
    expect(footers[0].textContent).not.toContain('All apps');
    expect(footers[0].querySelector('a[href="https://crystalprism.io/#projects"]')).toBeNull();
    expect(footers[0].querySelector('span[aria-hidden="true"]')).toBeNull();
    expect(document.body.textContent).not.toContain('© Copyright');
    expect(document.getElementById('copyright-year')).toBeNull();
  });
});
