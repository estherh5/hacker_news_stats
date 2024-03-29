// Define global variables
var siteMenuOpen = false; // Stores if site menu is open or closed
var profileLink;
var accountLink;
var signInLink;
var selectedButton = document.getElementById('hour');
var pieError;
var pieChart;
var barError;
var barChart;
var wordError;
var wordCloud;
var bubbleError;
var bubbleChart;

var Highcharts = require('highcharts'); // Highcharts
require('highcharts/highcharts-more')(Highcharts); // Highcharts extras
require('highcharts/modules/wordcloud')(Highcharts); // Highcharts word cloud
require("babel-polyfill"); // Babel polyfill
require('whatwg-fetch'); // Fetch polyfill

// Determine API endpoint based on window location
if (window.location.hostname == 'hn-stats.crystalprism.io') {
  var api = 'https://hn-scrape.herokuapp.com/api';
} else {
  var api = 'http://localhost:5000/api';
}

// Define load functions
window.onload = function() {
  // Remove sessionStorage data to load latest data
  var i = sessionStorage.length;

  while(i--) {
    var key = sessionStorage.key(i);
    if(/hn-/.test(key)) {
      sessionStorage.removeItem(key);
    }
  }

  // Create page header with site menu and account menu
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

  return;
}


// Create page header with site menu and account menu
function createPageHeader() {
  var header = document.createElement('div');
  header.id = 'header';
  var headerContainer = document.createElement('div');
  headerContainer.id = 'header-container';
  header.appendChild(headerContainer);

  // Create project navigation menu
  var iconContainer = document.createElement('div');
  iconContainer.id = 'site-menu-icon-container';

  var menuIcon = document.createElement('img');
  menuIcon.id = 'site-menu-icon';
  menuIcon.title = 'Site menu';
  menuIcon.src = 'https://crystalprism.io/images/site-menu-icon-shadow.svg';

  headerContainer.appendChild(iconContainer);
  iconContainer.appendChild(menuIcon);

  // Create site menu table
  var siteMenu = document.createElement('table');
  siteMenu.id = 'site-menu';
  siteMenu.classList.add('closed');

  var siteMenuSpacer = document.createElement('tr');
  siteMenuSpacer.id = 'site-menu-spacer-row';

  headerContainer.appendChild(siteMenu);
  siteMenu.appendChild(siteMenuSpacer);

  // Create menu rows with icons and links to each project
  var projectLinks = ['/', '/timespace/', '/shapes-in-rain/',
    '/rhythm-of-life/', '/canvashare/', '/thought-writer/', '/vicarious/',
    'https://hn-stats.crystalprism.io/', 'https://pause.crystalprism.io/',
    'https://marian.crystalprism.io/', 'https://vroom.crystalprism.io/', '/'];

  // Add domain root to each link unless it is already provided
  projectLinks = projectLinks.map(function(link) {
    if (!link.includes('https')) {
      return 'https://crystalprism.io/' + link;
    }

    return link;
  });

  var projectTitles = ['Home', 'Timespace', 'Shapes In Rain',
    'Rhythm of Life', 'CanvaShare', 'Thought Writer', 'Vicarious',
    'Hacker News Stats', 'Pause', 'Marian', 'Vroom', 'Account'];

  for (var i = 0; i < projectLinks.length; i++) {
    var menuRow = document.createElement('tr');
    menuRow.classList.add('site-menu-row');

    if (i == projectLinks.length - 1) {
      menuRow.dataset.link = projectLinks[i] + 'user/sign-in/';
    } else {
      menuRow.dataset.link = projectLinks[i];
    }

    menuRow.addEventListener('click', function() {
      window.location = this.dataset.link;
      return;
    }, false);

    var menuImageCell = document.createElement('td');
    menuImageCell.classList.add('site-menu-image-cell');

    var menuImage = document.createElement('img');
    menuImage.classList.add('site-menu-image');
    menuImage.src = projectLinks[i] + 'favicon.ico';

    var menuTextCell = document.createElement('td');
    menuTextCell.classList.add('site-menu-text-cell');

    var menuText = document.createElement('div');
    menuText.classList.add('site-menu-text');
    menuText.innerHTML = projectTitles[i];

    menuRow.appendChild(menuImageCell);
    menuImageCell.appendChild(menuImage);
    menuRow.appendChild(menuTextCell);
    menuTextCell.appendChild(menuText);
    siteMenu.appendChild(menuRow);
  }

  // Toggle site menu when user clicks menu icon
  menuIcon.onmousedown = toggleSiteMenu;

  /* Create account menu with links to profile, create account page, and sign
  in page */
  var accountMenu = document.createElement('div');
  accountMenu.id = 'account-menu';
  profileLink = document.createElement('a');
  profileLink.id = 'profile-link';
  accountLink = document.createElement('a');
  accountLink.id = 'account-link';
  accountLink.href = 'https://crystalprism.io/user/create-account/';
  signInLink = document.createElement('a');
  signInLink.id = 'sign-in-link';
  signInLink.href = 'https://crystalprism.io/user/sign-in/';
  headerContainer.appendChild(accountMenu);
  accountMenu.appendChild(profileLink);
  accountMenu.appendChild(accountLink);
  accountMenu.appendChild(signInLink);

  // Insert header before first element in body
  document.body.insertAdjacentElement('afterbegin', header);

  return;
}


// Open/close site menu
function toggleSiteMenu() {
  var siteMenu = document.getElementById('site-menu');

  // Close menu if it is open
  if (siteMenuOpen) {
    siteMenu.classList.remove('opened');
    siteMenu.classList.add('closed');

    // Set menu icon back to shadow version
    document.getElementById('site-menu-icon')
      .src = 'https://crystalprism.io/images/site-menu-icon-shadow.svg';

    siteMenuOpen = false;

    return;
  }

  // Otherwise, open menu
  siteMenu.classList.remove('closed');
  siteMenu.classList.add('opened');

  // Set menu icon to non-shadow version
  document.getElementById('site-menu-icon')
    .src = 'https://crystalprism.io/images/site-menu-icon.svg';

  siteMenuOpen = true;

  return;
}


// Close site menu when user clicks outside of it
window.addEventListener('click', function(e) {
  if (siteMenuOpen && e.target != document.getElementById('site-menu-icon') &&
    !document.getElementById('site-menu').contains(e.target)) {
      toggleSiteMenu();
    }

  return;

}, false);


// Check if user is logged into Crystal Prism by assessing JWT token's validity
function checkIfLoggedIn() {
  // If user does not have a token stored locally, set account menu to default
  if (!localStorage.getItem('token')) {
    accountLink.innerHTML = 'Create Account';
    signInLink.innerHTML = 'Sign In';

    // Store current window for user to return to after logging in
    signInLink.onclick = function() {
      sessionStorage.setItem('previous-window', window.location.href);
      return;
    }

    return false;
  }

  /* Otherwise, check if the user is logged in by sending their token to the
  server */
  return fetch('https://api.crystalprism.io/api/user/verify', {
    headers: {'Authorization': 'Bearer ' + localStorage.getItem('token')},
    method: 'GET',
  })

    // Set account menu to default if server is down
    .catch(function(error) {
      accountLink.innerHTML = 'Create Account';
      signInLink.innerHTML = 'Sign In';

      // Store current window for user to return to after logging in
      signInLink.onclick = function() {
        sessionStorage.setItem('previous-window', window.location.href);
        return;
      }

      return false;
    })

    .then(function(response) {
      /* If server verifies token is correct, display link to profile, My
      Account page, and Sign In page (with "Sign Out" title) */
      if (response.ok) {
        response.json().then(function(payload) {
          // Set localStorage username to payload username
          localStorage.setItem('username', payload['username']);

          profileLink.innerHTML = payload['username'];
          profileLink.href = 'https://crystalprism.io/user/?username=' +
            payload['username'];
          accountLink.innerHTML = 'My Account';
          accountLink.href = 'https://crystalprism.io/user/my-account/';
          signInLink.innerHTML = 'Sign Out';

          /* Send request to log user out when Sign In page link ("Sign Out"
          title) is clicked */
          signInLink.onclick = function() {
            sessionStorage.setItem('account-request', 'logout');
            return;
          }
        });
        return true;
      }

      /* If server responds with unauthorized status, set account menu to
      default and remove username and token from localStorage */
      if (response.status == 401) {
        localStorage.removeItem('username');
        localStorage.removeItem('token');
        accountLink.innerHTML = 'Create Account';
        signInLink.innerHTML = 'Sign In';

        // Store current window for user to return to after logging in
        signInLink.onclick = function() {
          sessionStorage.setItem('previous-window', window.location.href);
          return;
        }

        // Redirect to Sign In page if user is on My Account page
        if (currentPath == 'my-account') {
          sessionStorage.setItem('account-request', 'logout');
          window.location = '../sign-in/';
        }
      }

      return false;
    });
}


// Set button as selected when it is clicked and get requested stats
for (var i = 0; i < document.getElementsByTagName('button').length; i++) {
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


// Get breakdown of post types for given time period (hour, day, week, all)
function getPostTypes(timePeriod) {
  var pieContainer = document.getElementById('post-types-pie');
  pieContainer.innerHTML = '';

  // Display loading image
  var loadingImage = document.createElement('img');
  loadingImage.id = 'loading-image';
  loadingImage.src = 'images/loading.svg';
  loadingImage.classList.add('loading');
  loadingImage.style.animationPlayState = 'running';
  pieContainer.appendChild(loadingImage);

  /* Display cached post types data if stored in sessionStorage for this
  session */
  if (sessionStorage.getItem('hn-post-types-' + timePeriod)) {
    displayPieChart(JSON.parse(sessionStorage
      .getItem('hn-post-types-' + timePeriod)));
  }

  // Otherwise, load data from server
  else {
    return fetch(`${api}/hacker_news/stats/${timePeriod}/post_types`)

        /* Display error message if server is down and error isn't already
        displayed (i.e., prevent multiple errors from appearing) */
        .catch(function(error) {
          // Remove loading image
          if (pieContainer.contains(loadingImage)) {
            loadingImage.classList.remove('loading');
            pieContainer.removeChild(loadingImage);
          }

          // Display cached post types data if it is stored in localStorage
          if (localStorage.getItem('hn-post-types-' + timePeriod)) {
            displayPieChart(JSON.parse(localStorage
              .getItem('hn-post-types-' + timePeriod)));

            return;
          }

          // Otherwise, display error
          if (!pieError || pieError.parentNode != pieContainer) {
            pieError = document.createElement('text');
            pieError.id = 'error-message';
            pieError.innerHTML = 'There was an error loading the post ' +
              'types breakdown. Please refresh the page.';
            pieContainer.appendChild(pieError);
          }

          return;
        })

        .then(async function(response) {
          if (response) {
            if (response.ok) {
              var types = await response.json();

              // Remove loading image
              if (pieContainer.contains(loadingImage)) {
                loadingImage.classList.remove('loading');
                pieContainer.removeChild(loadingImage);
              }

              // Remove error message if it is displayed
              if (pieError && pieError.parentNode == pieContainer) {
                pieContainer.removeChild(pieError);
              }

              // Display pie chart of post types
              displayPieChart(types);

              // Store post types in sessionStorage for session loading
              sessionStorage.setItem('hn-post-types-' + timePeriod, JSON
                .stringify(types));

              // Store post types in localStorage for offline loading
              localStorage.setItem('hn-post-types-' + timePeriod, JSON
                .stringify(types));

              return types;
            }
          }

          else {
            // Remove loading image
            if (pieContainer.contains(loadingImage)) {
              loadingImage.classList.remove('loading');
              pieContainer.removeChild(loadingImage);
            }

            // Display error message if the server sends an error
            if (!pieError || pieError.parentNode != pieContainer) {
              pieError = document.createElement('text');
              pieError.id = 'error-message';
              pieError.innerHTML = 'There was an error loading the post ' +
                'types breakdown. Please refresh the page.';
              pieContainer.appendChild(pieError);
            }
          }
        });
  }
}


// Display pie chart of passed data
function displayPieChart(data) {
  var pieContainer = document.getElementById('post-types-pie');

  var pieData = [];

  for (var i = 0; i < data.length; i++) {
    if (data[i].type == 'article') {
      pieData.push({name: 'Articles', y: data[i].type_count});
    }

    else if (data[i].type == 'ask') {
      pieData.push({name: 'Ask HN', y: data[i].type_count});
    }

    else if (data[i].type == 'show') {
      pieData.push({name: 'Show HN', y: data[i].type_count});
    }

    else {
      pieData.push({name: 'Jobs', y: data[i].type_count});
    }
  }

  pieChart = new Highcharts.chart('post-types-pie', {
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
  var barContainer = document.getElementById('comment-count-bar');
  barContainer.innerHTML = '';

  // Display loading image
  var loadingImage = document.createElement('img');
  loadingImage.id = 'loading-image';
  loadingImage.src = 'images/loading.svg';
  loadingImage.classList.add('loading');
  loadingImage.style.animationPlayState = 'running';
  barContainer.appendChild(loadingImage);

  // Display cached post data if stored in sessionStorage for this session
  if (sessionStorage.getItem('hn-post-comment-counts-' + timePeriod)) {
    displayBarChart(JSON.parse(sessionStorage
      .getItem('hn-post-comment-counts-' + timePeriod)));

    return;
  }

  // Otherwise, load data from server
  else {
    return fetch(`${api}/hacker_news/stats/${timePeriod}/posts_highest_comment_count?count=5`)

        /* Display error message if server is down and error isn't already
        displayed (i.e., prevent multiple errors from appearing) */
        .catch(function(error) {
          // Remove loading image
          if (barContainer.contains(loadingImage)) {
            loadingImage.classList.remove('loading');
            barContainer.removeChild(loadingImage);
          }

          // Display cached post data if it is stored in localStorage
          if (localStorage.getItem('hn-post-comment-counts-' + timePeriod)) {
            displayBarChart(JSON.parse(localStorage
              .getItem('hn-post-comment-counts-' + timePeriod)));
          }

          // Otherwise, display error
          else {
            if (!barError || barError.parentNode != barContainer) {
              barError = document.createElement('text');
              barError.id = 'error-message';
              barError.innerHTML = 'There was an error loading the posts' +
                ' with the highest comment counts. Please refresh the page.';
              barContainer.appendChild(barError);
            }
          }

          return;
        })

        .then(async function(response) {
          if (response) {
            if (response.ok) {
              var posts = await response.json();

              // Remove loading image
              if (barContainer.contains(loadingImage)) {
                loadingImage.classList.remove('loading');
                barContainer.removeChild(loadingImage);
              }

              // Remove error message if it is displayed
              if (barError && barError.parentNode == barContainer) {
                barContainer.removeChild(barError);
              }

              // Display bar chart of posts
              displayBarChart(posts);

              // Store posts in sessionStorage for session loading
              sessionStorage.setItem('hn-post-comment-counts-' + timePeriod,
                JSON.stringify(posts));

              // Store posts in localStorage for offline loading
              localStorage.setItem('hn-post-comment-counts-' + timePeriod,
                JSON.stringify(posts));

              return posts;
            }
          }

          else {
            // Remove loading image
            if (barContainer.contains(loadingImage)) {
              loadingImage.classList.remove('loading');
              barContainer.removeChild(loadingImage);
            }

            // Display error message if the server sends an error
            if (!barError || barError.parentNode != barContainer) {
              barError = document.createElement('text');
              barError.id = 'error-message';
              barError.innerHTML = 'There was an error loading the posts ' +
                'with the highest comment counts. Please refresh the page.';
              barContainer.appendChild(barError);
            }
          }
        });
  }
}


// Display bar chart of passed data
function displayBarChart(data) {
  var barContainer = document.getElementById('comment-count-bar');

  var barData = [];

  var links = {};

  for (var i = 0; i < data.length; i++) {
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

  barChart = new Highcharts.chart('comment-count-bar', {
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
  var wordContainer = document.getElementById('comment-word-cloud');

  wordContainer.innerHTML = '';

  // Display loading image
  var loadingImage = document.createElement('img');
  loadingImage.id = 'loading-image';
  loadingImage.src = 'images/loading.svg';
  loadingImage.classList.add('loading');
  loadingImage.style.animationPlayState = 'running';
  wordContainer.appendChild(loadingImage);

  // Display cached comment words if stored in sessionStorage for this session
  if (sessionStorage.getItem('hn-comment-words-' + timePeriod)) {
    displayWordCloud(JSON.parse(sessionStorage
      .getItem('hn-comment-words-' + timePeriod)));

    return;
  }

  // Otherwise, load data from server
  else {
    return fetch(`${api}/hacker_news/stats/${timePeriod}/comment_words?count=50`)

        /* Display error message if server is down and error isn't already
        displayed (i.e., prevent multiple errors from appearing) */
        .catch(function(error) {
          // Remove loading image
          if (wordContainer.contains(loadingImage)) {
            loadingImage.classList.remove('loading');
            wordContainer.removeChild(loadingImage);
          }

          // Display cached comment words list if it is stored in localStorage
          if (localStorage.getItem('hn-comment-words-' + timePeriod)) {
            displayWordCloud(JSON.parse(localStorage
              .getItem('hn-comment-words-' + timePeriod)));
          }

          // Otherwise, display error
          else {
            if (!wordError || wordError.parentNode != wordContainer) {
              wordError = document.createElement('text');
              wordError.id = 'error-message';
              wordError.innerHTML = 'There was an error loading the most ' +
                'frequently used comment words. Please refresh the page.';
              wordContainer.appendChild(wordError);
            }
          }

          return;
        })

        .then(async function(response) {
          if (response) {
            if (response.ok) {
              var words = await response.json();

              // Remove loading image
              if (wordContainer.contains(loadingImage)) {
                loadingImage.classList.remove('loading');
                wordContainer.removeChild(loadingImage);
              }

              // Remove error message if it is displayed
              if (wordError && wordError.parentNode == wordContainer) {
                wordContainer.removeChild(wordError);
              }

              // Display word cloud of words
              displayWordCloud(words);

              // Store words in sessionStorage for session loading
              sessionStorage.setItem('hn-comment-words-' + timePeriod, JSON
                .stringify(words));

              // Store words in localStorage for offline loading
              localStorage.setItem('hn-comment-words-' + timePeriod, JSON
                .stringify(words));

              return words;
            }
          }

          else {
            // Remove loading image
            if (wordContainer.contains(loadingImage)) {
              loadingImage.classList.remove('loading');
              wordContainer.removeChild(loadingImage);
            }

            // Display error message if the server sends an error
            if (!wordError || wordError.parentNode != wordContainer) {
              wordError = document.createElement('text');
              wordError.id = 'error-message';
              wordError.innerHTML = 'There was an error loading the most ' +
                'frequently used comment words. Please refresh the page.';
              wordContainer.appendChild(wordError);
            }
          }
        });
  }
}


// Display word cloud of passed words
function displayWordCloud(words) {
  var wordContainer = document.getElementById('comment-word-cloud');

  var data = [];

  for (var i = 0; i < words.length; i++) {
    data.push(
      {name: words[i].word, weight: words[i].nentry});
  }

  // Set thousands separator to comma
  Highcharts.setOptions({
    lang: {
      thousandsSep: ','
    }
  });

  wordCloud = new Highcharts.chart('comment-word-cloud', {
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
  var bubbleContainer = document.getElementById('user-comment-bubble');
  bubbleContainer.innerHTML = '';

  // Display loading image
  var loadingImage = document.createElement('img');
  loadingImage.id = 'loading-image';
  loadingImage.src = 'images/loading.svg';
  loadingImage.classList.add('loading');
  loadingImage.style.animationPlayState = 'running';
  bubbleContainer.appendChild(loadingImage);

  // Display cached user data if stored in sessionStorage for this session
  if (sessionStorage.getItem('hn-user-comment-counts-' + timePeriod)) {
    displayBubbleChart(JSON.parse(sessionStorage
      .getItem('hn-user-comment-counts-' + timePeriod)));

    return;
  }

  // Otherwise, load data from server
  else {
    return fetch(`${api}/hacker_news/stats/${timePeriod}/users_most_comments?count=5`)

        /* Display error message if server is down and error isn't already
        displayed (i.e., prevent multiple errors from appearing) */
        .catch(function(error) {
          // Remove loading image
          if (bubbleContainer.contains(loadingImage)) {
            loadingImage.classList.remove('loading');
            bubbleContainer.removeChild(loadingImage);
          }

          // Display cached user data if it is stored in localStorage
          if (localStorage.getItem('hn-user-comment-counts-' + timePeriod)) {
            displayBubbleChart(JSON.parse(localStorage
              .getItem('hn-user-comment-counts-' + timePeriod)));
          }

          // Otherwise, display error
          else {
            if (!bubbleError || bubbleError.parentNode != bubbleContainer) {
              bubbleError = document.createElement('text');
              bubbleError.id = 'error-message';
              bubbleError.innerHTML = 'There was an error loading the users' +
                ' with the most comments. Please refresh the page.';
              bubbleContainer.appendChild(bubbleError);
            }
          }

          return;
        })

        .then(async function(response) {
          if (response) {
            if (response.ok) {
              var users = await response.json();

              // Remove loading image
              if (bubbleContainer.contains(loadingImage)) {
                loadingImage.classList.remove('loading');
                bubbleContainer.removeChild(loadingImage);
              }

              // Remove error message if it is displayed
              if (bubbleError && bubbleError
                .parentNode == bubbleContainer) {
                  bubbleContainer.removeChild(bubbleError);
                }

              /* Display bubble chart of user data, with bubble size
              representing user's overall word count */
              displayBubbleChart(users);

              // Store user data in sessionStorage for session loading
              sessionStorage.setItem('hn-user-comment-counts-' + timePeriod,
                JSON.stringify(users));

              // Store user data in localStorage for offline loading
              localStorage.setItem('hn-user-comment-counts-' + timePeriod,
                JSON.stringify(users));

              return users;
            }
          }

          else {
            // Remove loading image
            if (bubbleContainer.contains(loadingImage)) {
              loadingImage.classList.remove('loading');
              bubbleContainer.removeChild(loadingImage);
            }

            // Display error message if the server sends an error
            if (!bubbleError || bubbleError.parentNode != bubbleContainer) {
              bubbleError = document.createElement('text');
              bubbleError.id = 'error-message';
              bubbleError.innerHTML = 'There was an error loading the users ' +
                'with the most comments. Please refresh the page.';
              bubbleContainer.appendChild(bubbleError);
            }
          }
        });
  }
}


// Display bubble chart of passed data
function displayBubbleChart(data) {
  var bubbleContainer = document.getElementById('user-comment-bubble');

  var bubbleData = [];

  var names = [];

  for (var i = 0; i < data.length; i++) {
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

  bubbleChart = new Highcharts.chart('user-comment-bubble', {
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
  var height = container.offsetHeight;
  var width = container.offsetWidth;
  chart.setSize(width, height);
}


export { getPostTypes, getCommentCounts, getCommentWords,
  getUserCommentCounts };
