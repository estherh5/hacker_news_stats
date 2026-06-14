vi.mock('highcharts', () => ({
  default: {
    chart: vi.fn(() => ({ setSize: vi.fn() })),
    setOptions: vi.fn(),
  },
}));
vi.mock('highcharts/highcharts-more', () => ({}));
vi.mock('highcharts/modules/wordcloud', () => ({}));

import {
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
