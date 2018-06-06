import { getPostTypes, getCommentCounts, getCommentWords,
  getUserCommentCounts } from '../src/main';


// Clear fetch cache before each test
beforeEach(() => {
  fetch.resetMocks();
});


/* Test getPostTypes function for each time period ('hour, 'day', 'week',
'all') */
test('fetch post types for each time period', async () => {
  var postTypes = [
    {
      "type": "article",
      "type_count": 83
    },
    {
      "type": "show",
      "type_count": 5
    },
    {
      "type": "ask",
      "type_count": 2
    }
  ];

  var timePeriods = ['hour', 'day', 'week', 'all'];

  fetch.mockResponse(JSON.stringify(postTypes));

  // Fetch post types for each time period
  for (var i = 0; i < timePeriods.length; i++) {
    var response = await getPostTypes(timePeriods[i]);

    // Ensure URL for each fetch request is correct
    expect(fetch.mock.calls[i][0]).toEqual(
      'https://hn-scrape.herokuapp.com/api/hacker_news/stats/' +
      timePeriods[i] + '/post_types');

    // Ensure each fetch request doesn't throw an error
    expect(fetch.mock.results[i].isThrow).toEqual(false);
  }

  // Ensure 4 fetch requests were sent, one for each time period
  expect(fetch.mock.calls.length).toEqual(4);

  return;
});


/* Test getCommentCounts function for each time period ('hour, 'day', 'week',
'all') */
test('fetch posts with highest comment counts for each time period',
  async () => {
    var posts = [
      {
        "comment_count": 1,
        "created": "Mon, 01 Jun 2018 12:00:00 GMT",
        "feed_rank": 1,
        "id": 1,
        "link": "https://test.com",
        "point_count": 1,
        "title": "Test",
        "type": "article",
        "username": "test",
        "website": "test.com"
      }
    ];

    var timePeriods = ['hour', 'day', 'week', 'all'];

    fetch.mockResponse(JSON.stringify(posts));

    // Fetch posts for each time period
    for (var i = 0; i < timePeriods.length; i++) {
      var response = await getCommentCounts(timePeriods[i]);

      // Ensure URL for each fetch request is correct
      expect(fetch.mock.calls[i][0]).toEqual(
        'https://hn-scrape.herokuapp.com/api/hacker_news/stats/' +
        timePeriods[i] + '/posts_highest_comment_count?count=5');

      // Ensure each fetch request doesn't throw an error
      expect(fetch.mock.results[i].isThrow).toEqual(false);
    }

    // Ensure 4 fetch requests were sent, one for each time period
    expect(fetch.mock.calls.length).toEqual(4);

    return;
});


/* Test getCommentWords function for each time period ('hour, 'day', 'week',
'all') */
test('fetch most used words in comments for each time period', async () => {
  var words = [
    {
      "ndoc": 100,
      "nentry": 100,
      "word": "test"
    }
  ];

  var timePeriods = ['hour', 'day', 'week', 'all'];

  fetch.mockResponse(JSON.stringify(words));

  // Fetch words for each time period
  for (var i = 0; i < timePeriods.length; i++) {
    var response = await getCommentWords(timePeriods[i]);

    // Ensure URL for each fetch request is correct
    expect(fetch.mock.calls[i][0]).toEqual(
      'https://hn-scrape.herokuapp.com/api/hacker_news/stats/' +
      timePeriods[i] + '/comment_words?count=50');

    // Ensure each fetch request doesn't throw an error
    expect(fetch.mock.results[i].isThrow).toEqual(false);
  }

  // Ensure 4 fetch requests were sent, one for each time period
  expect(fetch.mock.calls.length).toEqual(4);

  return;
});


/* Test getUserCommentCounts function for each time period ('hour, 'day',
'week', 'all') */
test('fetch users with most comments for each time period', async () => {
  var users = [
    {
      "comment_count": 100,
      "username": "test",
      "word_count": 1000
    }
  ];

  var timePeriods = ['hour', 'day', 'week', 'all'];

  fetch.mockResponse(JSON.stringify(users));

  // Fetch users for each time period
  for (var i = 0; i < timePeriods.length; i++) {
    var response = await getUserCommentCounts(timePeriods[i]);

    // Ensure URL for each fetch request is correct
    expect(fetch.mock.calls[i][0]).toEqual(
      'https://hn-scrape.herokuapp.com/api/hacker_news/stats/' +
      timePeriods[i] + '/users_most_comments?count=5');

    // Ensure each fetch request doesn't throw an error
    expect(fetch.mock.results[i].isThrow).toEqual(false);
  }

  // Ensure 4 fetch requests were sent, one for each time period
  expect(fetch.mock.calls.length).toEqual(4);

  return;
});
