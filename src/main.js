import Highcharts from 'highcharts';
import 'highcharts/highcharts-more';
import 'highcharts/modules/wordcloud';
import loadingImageUrl from './images/loading.svg';
import './fleet/fleet-menu.js';
import fleetFallback from './fleet/fleet-fallback.json';
import './fleet/fleet.css';
import './style.scss';

const FLEET_KEY = 'hn-stats';
const signInUrl = 'https://account.crystalprism.io/sign-in/';
let fleetMenu;
let selectedButton = document.getElementById('hour');
let pieChart;
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
const currentPath = window.location.pathname.split('/').filter(Boolean).at(-1);

function initialize() {
  // Remove sessionStorage data to load latest data
  let i = sessionStorage.length;

  while(i--) {
    const key = sessionStorage.key(i);
    if(/hn-/.test(key)) {
      sessionStorage.removeItem(key);
    }
  }

  // Create page header with the fleet apps + account menu
  createPageHeader();

  // Check if user is logged into Crystal Prism
  checkIfLoggedIn();

  // Get breakdown of post types from the past hour
  getPostTypes('hour');

  // Get posts with highest number of comments from the past hour
  getCommentCounts('hour');

  // Get most frequent words used in comments from the past hour
  getCommentWords('hour');

  // Get users with highest comment counts from the past hour
  getUserCommentCounts('hour');

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


// Show the signed-in menu for a known username: Settings and Sign out
function setSignedInMenu(username) {
  fleetMenu.setUser({ label: username }, [
    { label: 'Settings', href: 'https://account.crystalprism.io/my-account/' },
    { label: 'Sign out', onSelect: signOut },
  ]);
}


/* Sign out: forget this origin's session, ask the account site to log out,
and land on its Sign In page as the old "Sign Out" link did */
function signOut() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  sessionStorage.setItem('account-request', 'logout');
  window.location.assign(signInUrl);
}


// Check if user is logged into Crystal Prism by assessing JWT token's validity
function checkIfLoggedIn() {
  // If user does not have a token stored locally, set account menu to default
  if (!localStorage.getItem('token')) {
    setSignedOutMenu();

    return false;
  }

  /* Otherwise, check if the user is logged in by sending their token to the
  server */
  return fetch(accountApi + '/user/verify', {
    headers: {'Authorization': 'Bearer ' + localStorage.getItem('token')},
    method: 'GET',
  })

    .then(function(response) {
      /* If server verifies token is correct, display link to profile, My
      Account page, and Sign In page (with "Sign Out" title) */
      if (response.ok) {
        return response.json().then(function(payload) {
          // Set localStorage username to payload username
          localStorage.setItem('username', payload.username);

          setSignedInMenu(payload.username);

          return true;
        });
      }

      /* If server responds with unauthorized status, the token is genuinely
      dead -- discard it and set the account menu to default */
      if (response.status === 401) {
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        setSignedOutMenu();

        // Redirect to Sign In page if user is on My Account page
        if (currentPath === 'my-account') {
          sessionStorage.setItem('account-request', 'logout');
          window.location = '../sign-in/';
        }

        return false;
      }

      /* Any other status means the server answered but could not tell us
      anything about this token. Treat it like an unreachable server. */
      throw new Error('Unexpected verify status: ' + response.status);
    })

    /* The account server is unreachable or errored. This does NOT mean the
    user is signed out, so do not discard their token and do not invite them
    to create a second account -- fall back to the username cached by the last
    successful verify, and only show the signed-out menu if we have no idea
    who they are. */
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


// Set button as selected when it is clicked and get requested stats
for (let i = 0; i < document.getElementsByTagName('button').length; i++) {
  document.getElementsByTagName('button')[i]
    .addEventListener('click', function() {
      selectedButton.classList.remove('selected');
      this.classList.add('selected');
      selectedButton = this;

      getPostTypes(this.id);
      getCommentCounts(this.id);
      getCommentWords(this.id);
      getUserCommentCounts(this.id);

      return;
    }, false);
}


async function loadStats({
  cacheKey,
  containerId,
  display,
  endpoint,
  errorMessage,
}, timePeriod) {
  const container = document.getElementById(containerId);
  const storageKey = `${cacheKey}-${timePeriod}`;
  const loadingImage = document.createElement('img');
  loadingImage.src = loadingImageUrl;
  loadingImage.className = 'loading-image';
  loadingImage.alt = 'Loading';
  container.classList.add('is-loading');
  container.appendChild(loadingImage);

  const displayData = (data) => {
    container.classList.remove('is-loading');
    loadingImage.remove();
    display(data);
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
      return displayData(JSON.parse(localData));
    }

    container.classList.remove('is-loading');
    const message = document.createElement('span');
    message.id = 'error-message';
    message.textContent = errorMessage;
    container.replaceChildren(message);
    return undefined;
  }
}


// Get breakdown of post types for given time period (hour, day, week, all)
function getPostTypes(timePeriod) {
  return loadStats({
    cacheKey: 'hn-post-types',
    containerId: 'post-types-pie',
    display: displayPieChart,
    endpoint: 'post_types',
    errorMessage: 'There was an error loading the post types breakdown. ' +
      'Please refresh the page.',
  }, timePeriod);
}


// Display pie chart of passed data
function displayPieChart(data) {
  const pieContainer = document.getElementById('post-types-pie');

  const pieData = [];

  for (let i = 0; i < data.length; i++) {
    if (data[i].type === 'article') {
      pieData.push({name: 'Articles', y: data[i].type_count});
    }

    else if (data[i].type === 'ask') {
      pieData.push({name: 'Ask HN', y: data[i].type_count});
    }

    else if (data[i].type === 'show') {
      pieData.push({name: 'Show HN', y: data[i].type_count});
    }

    else {
      pieData.push({name: 'Jobs', y: data[i].type_count});
    }
  }

  pieChart = Highcharts.chart('post-types-pie', {
    chart: {
      animation: 'true',
      backgroundColor: 'none',
      events: {
        load: function() {
          resize(this, pieContainer);
          return;
        }
      },
      reflow: 'true',
      type: 'pie'
    },
    credits: {
      enabled: false
    },
    title: {
      text: 'Post types',
      style: {
        cursor: 'default',
        fontFamily: 'Cutive Mono'
      },
    },
    tooltip: {
      pointFormat: '<span style="color:{point.color}">\u25CF' +
        '</span> Posts: <b>{point.y} ({point.percentage:,.1f}%)' +
        '</b><br/>',
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        borderColor: '#f0f0f0',
        colors: ['#ff8d00', '#f9cf68', '#beeb9f', '#79bd8f'],
        dataLabels: {
          enabled: false
        },
        showInLegend: true,
        legend: {
          style: {
            fontWeight: 'normal',
            textOutline: '0px'
          }
        },
        cursor: 'pointer',
      }
    },
    series: [{
      name: 'Post types',
      data: pieData
    }]
  });

  // Resize chart whenever window is resized
  window.addEventListener('resize', function() {
    resize(pieChart, pieContainer);
    return;
  }, false);

  return;
}


// Get top 5 posts with most comments and their comment counts
function getCommentCounts(timePeriod) {
  return loadStats({
    cacheKey: 'hn-post-comment-counts',
    containerId: 'comment-count-bar',
    display: displayBarChart,
    endpoint: 'posts_highest_comment_count?count=5',
    errorMessage: 'There was an error loading the posts with the highest ' +
      'comment counts. Please refresh the page.',
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
      type: 'column',
      marginLeft: 80
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
                '?id=' + this.key, '_blank');
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
      labels: {
        rotation: -45,
        style: {
          fontFamily: 'Lekton, sans-serif',
          textOverflow: 'ellipsis'
        },
        formatter: function () {
          return '<a href="' + links[this.value] +
            '" target="blank" style="text-overflow: ellipsis;">' +
            this.value + '</a>';
        },
        useHTML: true
      }
    },
    yAxis: {
      allowDecimals: false,
      min: 0,
      title: {
        text: ''
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
      pointFormat: '<span style="color:{point.color}">\u25CF' +
        '</span> {series.name}: <b>{point.y:,.0f}</b><br/>',
      style: {
        fontFamily: 'Lekton, sans-serif'
      }
    },
    series: [{
      name: 'Comment count',
      data: barData,
      dataLabels: {
        enabled: true,
        y: 30,
        style: {
          fontFamily: 'Lekton, sans-serif',
          fontWeight: 'normal',
          textOutline: '0px'
        }
      }
    }]
  });

  // Resize chart whenever window is resized
  window.addEventListener('resize', function() {
    resize(barChart, barContainer);
    return;
  }, false);

  return;
}


// Get 50 most used words in comments
function getCommentWords(timePeriod) {
  return loadStats({
    cacheKey: 'hn-comment-words',
    containerId: 'comment-word-cloud',
    display: displayWordCloud,
    endpoint: 'comment_words?count=50',
    errorMessage: 'There was an error loading the most frequently used ' +
      'comment words. Please refresh the page.',
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

  // Resize chart whenever window is resized
  window.addEventListener('resize', function() {
    resize(wordCloud, wordContainer);
    return;
  }, false);

  return;
}


// Get users with most comments
function getUserCommentCounts(timePeriod) {
  return loadStats({
    cacheKey: 'hn-user-comment-counts',
    containerId: 'user-comment-bubble',
    display: displayBubbleChart,
    endpoint: 'users_most_comments?count=5',
    errorMessage: 'There was an error loading the users with the most ' +
      'comments. Please refresh the page.',
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
                '?id=' + this.category, '_blank');
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
    xAxis: {
      categories: names,
      labels: {
        rotation: -45,
        style: {
          fontFamily: 'Lekton, sans-serif',
        },
        y: 25,
        formatter: function () {
          return '<a href="' + 'https://news.ycombinator.com/' +
            'user?id=' + this.value + '" target="blank">' +
            this.value + '</a>';
        },
        useHTML: true
      }
    },
    yAxis: {
      allowDecimals: false,
      title: {
        text: ''
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
      minSize: '10%',
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

  // Resize chart whenever window is resized
  window.addEventListener('resize', function() {
    resize(bubbleChart, bubbleContainer);
    return;
  }, false);

  return;
}


// Resize specified chart to container size on window resize
function resize(chart, container) {
  const height = container.offsetHeight;
  const width = container.offsetWidth;
  chart.setSize(width, height);
}


export { getPostTypes, getCommentCounts, getCommentWords,
  getUserCommentCounts, createPageHeader, createPageFooter, checkIfLoggedIn };
