import Highcharts from 'highcharts';
import 'highcharts/highcharts-more';
import 'highcharts/modules/wordcloud';
import 'highcharts/modules/accessibility';
import loadingImageUrl from './images/loading.svg';
import './fleet/fleet-menu.js';
import fleetFallback from './fleet/fleet-fallback.json';
import './fleet/fleet.css';
import './style.scss';

const FLEET_KEY = 'hn-stats';
const signInUrl = 'https://account.crystalprism.io/sign-in/';
let fleetMenu;
let menuUsername = null;
let signingOut = false;
let selectedButton = document.getElementById('day');
let lastScrapedAt = null;
let barChart;
let wordCloud;
let bubbleChart;

// Determine API endpoint based on window location
const api = import.meta.env.VITE_API_URL ?? (
  window.location.hostname === 'hn-stats.crystalprism.io'
    ? 'https://hn-api.crystalprism.io/api'
    : 'http://localhost:5000/api'
);

/* Accounts live on the Crystal Prism API, a different service from the one
above -- this page reads stats from hn-api and identity from api. */
const accountApi = import.meta.env.VITE_ACCOUNT_API_URL ??
  'https://api.crystalprism.io/api';

function initialize() {
  // Remove sessionStorage data to load latest data
  clearSessionStats();

  // Create page header with the fleet apps + account menu
  createPageHeader();

  // Check if user is logged into Crystal Prism
  checkIfLoggedIn();

  // Open on the period in the URL, or the past day
  selectPeriod(periodFromUrl());
  loadPeriod(selectedButton.id);
  checkForNewScrape();

  createPageFooter();
}

window.addEventListener('DOMContentLoaded', initialize);


// Fleet apps menu at the header's trailing end. It replaces the hand-ported
// site menu and the account links; its rows follow the Crystal Prism session.
function createPageHeader() {
  const header = document.createElement('header');
  header.id = 'header';

  fleetMenu = window.FleetKit.mountMenu(header, {
    apps: window.FleetKit.shapeFleet(null, FLEET_KEY, fleetFallback),
    user: null,
    rows: [],
    placement: 'down-end',
    triggerClass: 'hn-fleet-trigger',
  });

  // Swap in the live list from crystalprism.io/apps.json when it arrives
  const menu = fleetMenu;
  window.FleetKit.getFleetApps(FLEET_KEY, { fallback: fleetFallback })
    .then(function(apps) {
      if (fleetMenu === menu) {
        menu.setApps(apps);
      }
    });

  // Insert header before first element in body
  document.body.insertAdjacentElement('afterbegin', header);

  return header;
}


// Crystal Prism footer from the fleet kit, in flow below the dashboard
function createPageFooter() {
  return window.FleetKit.renderFooter(document.getElementById('footer'));
}


// Show the signed-out menu: one Sign in row
function setSignedOutMenu() {
  fleetMenu.setUser(null, [{ label: 'Sign in', href: signInUrl }]);
}


// Show the signed-in menu for a known username: Settings and Sign out, which
// the kit holds open on "Signing out…" while a sign-out is under way
function setSignedInMenu(username) {
  menuUsername = username;
  fleetMenu.setUser({ label: username }, [
    { label: 'Settings', href: 'https://account.crystalprism.io/my-account/' },
    { label: 'Sign out', busyLabel: 'Signing out…', onSelect: signOut },
  ]);
}


/* Sign out: a POST to the API, the only thing that can clear the HttpOnly
cp_session cookie. Then land on the account site's Sign In page, which reads
the outcome from its own session check: signed out, or "still signed in" if
the request failed. A request that stalls is abandoned after 4s */
function signOut() {
  if (signingOut) {
    return Promise.resolve();
  }
  signingOut = true;
  document.body.style.cursor = 'progress';

  return fetchWithTimeout(accountApi + '/logout', { method: 'POST' })
    .then(function(response) {
      if (response.ok) {
        localStorage.removeItem('username');
      }
    })
    .catch(function() {})
    .then(function() {
      window.location.assign(signInUrl + '?signed-out');

      // The page is leaving; reset in case the navigation never happens
      signingOut = false;
      document.body.style.cursor = '';
    });
}


/* Check if user is logged into Crystal Prism. The session is the API's
HttpOnly cp_session cookie, shared by every crystalprism.io subdomain, so
script never sees it: /user/verify is the answer, and the stored username is
only this origin's hint for when the API cannot be reached */
function checkIfLoggedIn() {
  // Pre-cookie sessions kept a token here; none is valid any longer
  localStorage.removeItem('token');

  return fetchWithTimeout(accountApi + '/user/verify', { method: 'GET' })
    .then(function(response) {
      // If server verifies the session, show the username, Settings, Sign out
      if (response.ok) {
        return response.json().then(function(payload) {
          localStorage.setItem('username', payload.username);
          setSignedInMenu(payload.username);
          return true;
        });
      }

      // If server responds with unauthorized status, the visitor is signed out
      if (response.status === 401) {
        localStorage.removeItem('username');
        setSignedOutMenu();
        return false;
      }

      /* Any other status means the server answered but could not tell us
      anything about this session. Treat it like an unreachable server. */
      throw new Error('Unexpected verify status: ' + response.status);
    })

    /* The account server is unreachable, stalled or errored. This does NOT
    mean the visitor is signed out, so fall back to the username cached by the
    last successful verify, and only show the signed-out menu if we have no
    idea who they are. */
    .catch(function(error) {
      console.warn('Could not verify Crystal Prism session:', error);

      const cachedUsername = localStorage.getItem('username');

      if (cachedUsername) {
        setSignedInMenu(cachedUsername);
        return true;
      }

      setSignedOutMenu();
      return false;
    });
}


// Fetch from the account API with the session cookie, abandoning after 4s
function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, 4000);

  return fetch(url, Object.assign({
    credentials: 'include',
    signal: controller.signal,
  }, options))
    .finally(function() {
      clearTimeout(timer);
    });
}


// The period named by ?period= in the URL, or the past day
function periodFromUrl() {
  const period = new URLSearchParams(window.location.search).get('period');
  return Object.hasOwn(periodNames, period) ? period : 'day';
}


// Mark a period's button as the selected one
function selectPeriod(period) {
  selectedButton.classList.remove('selected');
  selectedButton.setAttribute('aria-pressed', 'false');
  selectedButton = document.getElementById(period);
  selectedButton.classList.add('selected');
  selectedButton.setAttribute('aria-pressed', 'true');
}


// Load every panel for a period
function loadPeriod(period) {
  getPostTypes(period);
  getCommentCounts(period);
  getCommentWords(period);
  getUserCommentCounts(period);
}


/* Show when the newest snapshot was taken. Each period is kept for the
session, so when a newer snapshot has landed since, drop the kept copies and
reload the period on screen. */
async function checkForNewScrape() {
  let scrapedAt;

  try {
    const response = await fetch(`${api}/hacker_news/last_scrape`);
    if (!response.ok) {
      return;
    }
    scrapedAt = (await response.json()).scraped_at;
  } catch {
    return;
  }

  if (!scrapedAt || scrapedAt === lastScrapedAt) {
    return;
  }

  const firstCheck = lastScrapedAt === null;
  lastScrapedAt = scrapedAt;
  showLastScrape(scrapedAt);

  if (!firstCheck) {
    clearSessionStats();
    loadPeriod(selectedButton.id);
  }
}


function showLastScrape(scrapedAt) {
  const time = document.createElement('time');
  time.dateTime = scrapedAt;
  time.textContent = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(scrapedAt));

  document.getElementById('last-scrape')
    .replaceChildren('Latest snapshot ', time);
}


function clearSessionStats() {
  let i = sessionStorage.length;

  while(i--) {
    const key = sessionStorage.key(i);
    if(/hn-/.test(key)) {
      sessionStorage.removeItem(key);
    }
  }
}


// Set a period button as selected when it is clicked, put it in the URL so
// the view can be shared, and get its stats
for (const button of document.querySelectorAll('#buttons .period')) {
  button.addEventListener('click', function() {
      selectPeriod(this.id);

      const url = new URL(window.location.href);
      if (this.id === 'day') {
        url.searchParams.delete('period');
      } else {
        url.searchParams.set('period', this.id);
      }
      history.replaceState(null, '', url);

      loadPeriod(this.id);
      checkForNewScrape();

      return;
    }, false);
}


// A tab coming back into view checks for a newer snapshot
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') {
    checkForNewScrape();
  }
});


// The latest request per panel; a slower earlier one must not overwrite it
const latestRequest = {};

const periodNames = {
  hour: 'the past hour',
  day: 'the past day',
  week: 'the past week',
  all: 'all time',
};


async function loadStats({
  cacheKey,
  containerId,
  display,
  endpoint,
  subject,
  load,
}, timePeriod) {
  const container = document.getElementById(containerId);
  const storageKey = `${cacheKey}-${timePeriod}`;
  const requestId = (latestRequest[containerId] ?? 0) + 1;
  latestRequest[containerId] = requestId;

  container.querySelectorAll('.loading-image, .panel-message')
    .forEach((element) => element.remove());
  container.parentElement.querySelector('.stale-note')?.remove();
  const loadingImage = document.createElement('img');
  loadingImage.src = loadingImageUrl;
  loadingImage.className = 'loading-image';
  loadingImage.alt = 'Loading';
  container.classList.add('is-loading');
  container.setAttribute('aria-busy', 'true');
  container.appendChild(loadingImage);

  const settle = (render) => {
    if (latestRequest[containerId] !== requestId) {
      return false;
    }
    container.classList.remove('is-loading');
    container.removeAttribute('aria-busy');
    loadingImage.remove();
    render();
    return true;
  };

  const displayData = (data, stale = false) => {
    settle(() => {
      if (data.length === 0) {
        showPanelMessage(container,
          `No ${subject} in ${periodNames[timePeriod]}.`);
      } else {
        display(data);
      }
      if (stale) {
        showStaleNote(container, () => load(timePeriod));
      }
    });
    return data;
  };

  const sessionData = sessionStorage.getItem(storageKey);
  if (sessionData) {
    return displayData(JSON.parse(sessionData));
  }

  try {
    const response = await fetch(`${api}/hacker_news/stats/${timePeriod}/${endpoint}`);
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    const serializedData = JSON.stringify(data);
    sessionStorage.setItem(storageKey, serializedData);
    localStorage.setItem(storageKey, serializedData);
    return displayData(data);
  } catch (error) {
    const localData = localStorage.getItem(storageKey);
    if (localData) {
      return displayData(JSON.parse(localData), true);
    }

    settle(() => {
      showPanelMessage(container,
        `Couldn’t load the ${subject}. Check your connection.`,
        () => load(timePeriod));
    });
    return undefined;
  }
}


// Replace a panel's chart with a message, and a Try again button if given one
function showPanelMessage(container, text, retry) {
  const existingChart = Highcharts.charts?.find(
    (chart) => chart && chart.renderTo === container);
  existingChart?.destroy();

  const message = document.createElement('div');
  message.className = 'panel-message';
  message.setAttribute('role', retry ? 'alert' : 'status');

  const messageText = document.createElement('p');
  messageText.textContent = text;
  message.appendChild(messageText);

  if (retry) {
    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.className = 'retry-button';
    retryButton.textContent = 'Try again';
    retryButton.addEventListener('click', retry);
    message.appendChild(retryButton);
  }

  container.replaceChildren(message);
}


// Say under a panel that it shows a saved copy because the API was unreachable
function showStaleNote(container, retry) {
  const note = document.createElement('div');
  note.className = 'stale-note';
  note.setAttribute('role', 'status');

  const noteText = document.createElement('p');
  noteText.textContent = 'Saved copy. Couldn\u2019t reach the server.';
  note.appendChild(noteText);

  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'retry-button';
  retryButton.textContent = 'Try again';
  retryButton.addEventListener('click', retry);
  note.appendChild(retryButton);

  container.insertAdjacentElement('afterend', note);
}


// Get breakdown of post types for given time period (hour, day, week, all)
function getPostTypes(timePeriod) {
  return loadStats({
    cacheKey: 'hn-post-types',
    containerId: 'post-types',
    display: displayPostTypes,
    endpoint: 'post_types',
    load: getPostTypes,
    subject: 'post types',
  }, timePeriod);
}


const postTypeNames = [
  ['article', 'articles'],
  ['show', 'Show HN'],
  ['ask', 'Ask HN'],
  ['job', 'jobs'],
];


/* Post types as counts, not a pie: articles outnumber the rest about 90:1,
so a pie is one slice and three slivers. Every type is listed, zeros too, in
the same order for every period. */
function displayPostTypes(data) {
  const counts = Object.fromEntries(
    data.map((row) => [row.type, row.type_count]));

  const title = document.createElement('h2');
  title.className = 'panel-title';
  title.textContent = 'Post types';

  const list = document.createElement('dl');
  list.className = 'post-type-counts';

  for (const [type, name] of postTypeNames) {
    const count = document.createElement('dd');
    count.textContent = (counts[type] ?? 0).toLocaleString('en-US');
    const label = document.createElement('dt');
    label.textContent = name;
    const row = document.createElement('div');
    row.append(count, label);
    list.appendChild(row);
  }

  document.getElementById('post-types').replaceChildren(title, list);
}


// Get top 5 posts with most comments and their comment counts
function getCommentCounts(timePeriod) {
  return loadStats({
    cacheKey: 'hn-post-comment-counts',
    containerId: 'comment-count-bar',
    display: displayBarChart,
    endpoint: 'posts_highest_comment_count?count=5',
    load: getCommentCounts,
    subject: 'posts with comments',
  }, timePeriod);
}


// Display bar chart of passed data
function displayBarChart(data) {
  const barContainer = document.getElementById('comment-count-bar');

  const barData = [];

  const links = {};

  for (let i = 0; i < data.length; i++) {
    barData.push({name: data[i].title, y: data[i].comment_count,
      key: data[i].id});
    links[data[i].title] = data[i].link;
  }

  // Set thousands separator to comma
  Highcharts.setOptions({
    lang: {
      thousandsSep: ','
    }
  });

  barChart = Highcharts.chart('comment-count-bar', {
    chart: {
      animation: 'true',
      backgroundColor: 'none',
      events: {
        load: function() {
          resize(this, barContainer);
          return;
        }
      },
      reflow: 'true',
      // Room for the last tick label and the longest bar's count
      spacingRight: 36,
      type: 'bar'
    },
    credits: {
      enabled: false
    },
    plotOptions: {
      series: {
        cursor: 'pointer',
        point: {
          events: {
            click: function () {
              window.open('https://news.ycombinator.com/item' +
                '?id=' + this.key, '_blank', 'noopener');
              return;
            }
          }
        }
      }
    },
    title: {
      style: {
        cursor: 'default',
        fontFamily: 'Cutive Mono'
      },
      text: 'Posts with most comments'
    },
    xAxis: {
      type: 'category',
      title: {
        text: null
      },
      labels: {
        // Whole titles, wrapped over up to three lines beside each bar
        formatter: function () {
          return '<a class="bar-title" href="' + links[this.value] +
            '" target="_blank">' + this.value + '</a>';
        },
        style: {
          fontFamily: 'Lekton, sans-serif',
          textOverflow: 'none',
          width: Math.round(barContainer.offsetWidth * 0.45) + 'px'
        },
        useHTML: true
      }
    },
    yAxis: {
      allowDecimals: false,
      // Each bar carries its own count, so gridlines only cross the labels
      gridLineWidth: 0,
      min: 0,
      title: {
        text: 'Comments',
        style: {
          fontFamily: 'Lekton, sans-serif'
        }
      },
      labels: {
        // Ticks are short numbers; never ellipsize them
        overflow: 'allow',
        style: {
          fontFamily: 'Lekton, sans-serif',
          textOverflow: 'none'
        }
      }
    },
    legend: {
      enabled: false
    },
    tooltip: {
      pointFormat: '<span style="color:{point.color}">\u25CF' +
        '</span> {series.name}: <b>{point.y:,.0f}</b><br/>',
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    },
    series: [{
      name: 'Comment count',
      borderWidth: 0,
      data: barData,
      dataLabels: {
        enabled: true,
        // Always past the bar's end, on the ground, never inside the fill
        crop: false,
        inside: false,
        overflow: 'allow',
        style: {
          fontFamily: 'Lekton, sans-serif',
          fontWeight: 'normal',
          textOutline: '0px'
        }
      }
    }]
  });

  return;
}


// Get 50 most used words in comments
function getCommentWords(timePeriod) {
  return loadStats({
    cacheKey: 'hn-comment-words',
    containerId: 'comment-word-cloud',
    display: displayWordCloud,
    endpoint: 'comment_words?count=50',
    load: getCommentWords,
    subject: 'comment words',
  }, timePeriod);
}


// Display word cloud of passed words
function displayWordCloud(words) {
  const wordContainer = document.getElementById('comment-word-cloud');

  const data = [];

  for (let i = 0; i < words.length; i++) {
    data.push(
      {name: words[i].word, weight: words[i].nentry});
  }

  // Set thousands separator to comma
  Highcharts.setOptions({
    lang: {
      thousandsSep: ','
    }
  });

  wordCloud = Highcharts.chart('comment-word-cloud', {
    chart: {
      animation: 'true',
      backgroundColor: 'none',
      events: {
        load: function() {
          resize(this, wordContainer);
          return;
        }
      },
      reflow: 'true'
    },
    credits: {
      enabled: false
    },
    series: [{
      type: 'wordcloud',
      data: data,
      name: 'Occurrences',
      // Words smaller than this are dropped rather than drawn unreadably
      minFontSize: 10,
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    }],
    plotOptions: {
      series: {
        cursor: 'default'
      }
    },
    title: {
      style: {
        cursor: 'default',
        fontFamily: 'Cutive Mono'
      },
      text: 'Word frequency in comments'
    },
    tooltip: {
      pointFormat: '<span style="color:{point.color}">\u25CF' +
        '</span> {series.name}: <b>{point.weight:,.0f}</b><br/>',
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    },
  });

  return;
}


// Get users with most comments
function getUserCommentCounts(timePeriod) {
  return loadStats({
    cacheKey: 'hn-user-comment-counts',
    containerId: 'user-comment-bubble',
    display: displayBubbleChart,
    endpoint: 'users_most_comments?count=5',
    load: getUserCommentCounts,
    subject: 'users with comments',
  }, timePeriod);
}


// Display bubble chart of passed data
function displayBubbleChart(data) {
  const bubbleContainer = document.getElementById('user-comment-bubble');

  const bubbleData = [];

  const names = [];

  for (let i = 0; i < data.length; i++) {
    bubbleData.push({x: i, y: data[i].comment_count,
      z: data[i].word_count});
    names.push(data[i].username);
  }

  // Set thousands separator to comma
  Highcharts.setOptions({
    lang: {
      thousandsSep: ','
    }
  });

  bubbleChart = Highcharts.chart('user-comment-bubble', {
    chart: {
      animation: 'true',
      events: {
        load: function() {
          resize(this, bubbleContainer);
          return;
        }
      },
      backgroundColor: 'none',
      reflow: 'true',
      type: 'bubble',
      zoomType: 'xy'
    },
    credits: {
      enabled: false
    },
    plotOptions: {
      series: {
        cursor: 'pointer',
        point: {
          events: {
            click: function () {
              window.open('https://news.ycombinator.com/user' +
                '?id=' + this.category, '_blank', 'noopener');
              return;
            }
          }
        }
      }
    },
    title: {
      style: {
        cursor: 'default',
        fontFamily: 'Cutive Mono'
      },
      text: 'Users with most comments'
    },
    subtitle: {
      text: 'Bubble size: words written',
      style: {
        cursor: 'default',
        fontFamily: 'Lekton, sans-serif'
      }
    },
    xAxis: {
      categories: names,
      // Only the users' own slots; bubble padding would add -1 and 5
      min: 0,
      max: names.length - 1,
      title: {
        text: 'User',
        style: {
          fontFamily: 'Lekton, sans-serif'
        }
      },
      labels: {
        rotation: -45,
        style: {
          fontFamily: 'Lekton, sans-serif',
        },
        y: 25,
        formatter: function () {
          if (!names.includes(this.value)) {
            return '';
          }
          return '<a href="' + 'https://news.ycombinator.com/' +
            'user?id=' + this.value + '" target="_blank">' +
            this.value + '</a>';
        },
        useHTML: true
      }
    },
    yAxis: {
      allowDecimals: false,
      // From zero, so the fifth user's count does not read as nothing
      min: 0,
      title: {
        text: 'Comments',
        style: {
          fontFamily: 'Lekton, sans-serif'
        }
      },
      labels: {
        style: {
          fontFamily: 'Lekton, sans-serif'
        }
      }
    },
    legend: {
      enabled: false
    },
    tooltip: {
      useHTML: true,
      headerFormat: '<div>',
      pointFormat: '<div><h3>{point.category}</h3></div>' +
        '<div>Comment count: {point.y}</div>' +
        '<div>Word count: {point.z}</div>',
      footerFormat: '</div>',
      followPointer: true,
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    },
    series: [{
      color: '#7cb5ec',
      marker: {
        fillOpacity: 0.8
      },
      // Big enough that the smallest bubble still holds its word count
      minSize: '15%',
      maxSize: '28%',
      name: 'User comment count',
      data: bubbleData,
      dataLabels: {
        enabled: true,
        y: -1,
        style: {
          fontFamily: 'Lekton, sans-serif',
          fontWeight: 'normal',
          textOutline: '0px'
        }
      }
    }]
  });

  return;
}


// Resize every chart to its container whenever the window is resized
window.addEventListener('resize', function() {
  Highcharts.charts?.forEach(function(chart) {
    if (chart) {
      resize(chart, chart.renderTo);
    }
  });
}, false);


// Resize specified chart to container size
function resize(chart, container) {
  const height = container.offsetHeight;
  const width = container.offsetWidth;
  chart.setSize(width, height);
}


export { getPostTypes, getCommentCounts, getCommentWords,
  getUserCommentCounts, createPageHeader, createPageFooter, checkIfLoggedIn,
  checkForNewScrape, periodFromUrl };
