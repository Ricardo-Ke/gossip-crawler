var superagent = require('superagent')
  , cheerio = require('cheerio')
  , mysql = require('mysql')
  , assert = require('assert')
  , EventEmitter = require('eventemitter3')
  , util = require('./utils/stringfy')
  , fs = require('fs')
  , path = require('path')
  , sites = require('./sites');

const DB_STR = 'mongodb://localhost:27017/gossip';
const DB_NUMS = 21;
var baseURL = 'http://blindgossip.com/';

var myEventEmitter = new EventEmitter();
var currentDay = new Date();
var getArticleCount = 0;
var articles = [];
var articNums = 0;
var currentPage = 1;
var isEarlyArti = true;
var preparedSQL = '';
var todayID = fs.readFileSync('./todayID.txt', 'utf-8');
var isTodayWrited = fs.readFileSync('./isTodayWrited.txt', 'utf-8');
var metaLessThanPost = 480;

// --------------main entry-----------------
startLoop();

function startLoop() {
  // if (isTodayWrited === 'YES') return;

  getArticles(baseURL);
}

// event on finishing getting all data
myEventEmitter.on('finishGet', function() {

  console.log("===========================finish getting all the data==========================");

  if (isTodayWrited !== "YES") {
    let fileName = './logs/' + currentDay.toISOString() + '.txt';

    fs.appendFile(fileName, currentDay.toISOString() + ' has crawled over', function(err) {
      if (err) throw err;
    })

    fs.writeFile('./isTodayWrited.txt', 'YES', function(err) {
      if (err) throw err;
    })
  }

  console.log('articles length is : ' + articles.length);

  connectToMysql(1);
})

// event on finishing one page's data
myEventEmitter.on('getArticleOnce', function(article) {

  if (article) {
    articles.push(article);
  }

  getArticleCount = (++getArticleCount) % articNums;

  if(getArticleCount == articNums - 1 && isEarlyArti) {

    baseURL = util.getNextPageUrl(baseURL);
    
    console.log('Current page is: -----------' + currentPage + '------------\n');   //stay refactored
    currentPage++;

    getArticles(baseURL);
  }
  
  if (!isEarlyArti) {
    myEventEmitter.emit('finishGet');
  }
})

// main function
function getArticles(baseURL) {

  superagent
  .get(baseURL)
  .end((err, res) => {
    if (err) throw err;

    let $ = cheerio.load(res.text)
      , detailPageHrefs = [];

    articNums = $('.content-sidebar-wrap .content article').length;

    $('.site-inner .content .entry-title a').each(function (i, ele) {
      let href = $(this).attr('href');
      detailPageHrefs.push(href);
    })

    getDetailArticle(detailPageHrefs, 0)
  })
}

// get detail page function
function getDetailArticle(hrefs, i) {
  if (i >= hrefs.length) return;
  console.log('Detail page: ' +i);

  superagent
    .get(hrefs[i])
    .end((err, nres) => {
      if(err) throw err;

      let $ = cheerio.load(nres.text);
      let article = {
        title: '',
        imgUrl: '',
        ID: '',
        time: '',
        context: ''
      };

      article.title  = $('.entry-title').text();
      article.imgUrl = $('.entry-content p img').attr('src');
      article.time   = $('.entry-header .entry-meta .entry-time').attr('datetime');

      $('.entry-content p').each(function(i, elem) {
        let parHtml = $(this);
        if (parHtml.find('a').length > 0) {
          parHtml.find('a').replaceWith('');
        }

        if (parHtml.find('img').length > 0) {
          article.context += parHtml.html().replace(/\[\w+?\]/g, '') + '\n\n';  
        }else {
          article.context += parHtml.text().replace(/\[\w+?\]/g, '') + '\n\n';
        }
      })

      let articDate = new Date(article.time);
      let currDate = currentDay;

      if (i === 0 && baseURL.indexOf('paged') == -1) {
        myEventEmitter.emit('getArticleOnce');
        getDetailArticle(hrefs, ++i);
        return;
      }

      if (articDate >= currDate) {
        myEventEmitter.emit('getArticleOnce', article);
        getDetailArticle(hrefs, ++i);

      }else {
        isEarlyArti = false;
        myEventEmitter.emit('getArticleOnce');
      }

      console.log("Early date : " + articDate);
      console.log("isEarlyArti: " + isEarlyArti + '\n');
    })
}

function connectToMysql(db_index) {
  if (db_index > DB_NUMS) return;

  preparedSQL = (preparedSQL == '' ? prepareInsertSql(articles) : preparedSQL);
  // console.log(preparedSQL);

  fs.writeFile('./todaySQL.txt', preparedSQL, () => {});

  //user manmao22_wp + num
  //passwords are all manmao11122
  var connection = mysql.createConnection({
    host: 'localhost',
    user: 'manmao22_wp' + db_index,
    password: 'manmao11122',
    database: 'manmao22_wp' + db_index
  });

  connection.connect();

  connection.query(preparedSQL, function(err, results, fields) {
    if (err) throw err;

    console.log(results);

    connection.end();

    // 重写 todayID
    fs.writeFile('./todayID.txt', todayID, function(err) {
      if (err) throw err;
    })
    // 重写 isTodayWrited
    fs.writeFile('./isTodayWrited', 'YES', function(err) {
      if (err) throw err;
    })
    
    connectToMysql(++db_index);
  });
}

function prepareInsertSql(articles) {
  let insertSQL = 'INSERT INTO wp_posts VALUES ';

  if (articles.length === 0) return insertSQL + '()';

  for (let i = 0;i < articles.length;i++) {
    articles[i].ID = todayID;

    insertSQL += '(' +
                 (todayID++) + ', ' +
                 '1,"' +
                 util.dateParser(articles[i].time) + '","' +
                 util.dateParser(articles[i].time) + '",\'' +
                 articles[i].context + '\',"' +
                 articles[i].title + '","' +
                 '","' +
                 'publish","' +
                 'open","' +
                 'open","' +
                 '","' +
                 articles[i].title.toLowerCase().split(' ').join('-') + '","' +
                 '","","' +
                 util.dateParser(articles[i].time) + '","' +
                 util.dateParser(articles[i].time) + '","' +
                 '", 0, "", 0, "post", "", 0),';
    insertSQL += '(' +
                 (todayID++) + ', ' +
                 '1,"' +
                 util.dateParser(articles[i].time) + '","' +
                 util.dateParser(articles[i].time) + '",' +
                 ',"' +
                 articles[i].title + '","' +
                 '","' +
                 'inherit","' +
                 'open","' +
                 'closed","' +
                 '","' +
                 articles[i].title.toLowerCase().split(' ').join('-') + '","' +
                 '","","' +
                 util.dateParser(articles[i].time) + '","' +
                 util.dateParser(articles[i].time) + '","' +
                 '", ' +
                 (todayID - 1) +', "", 0, "post", "", 0),';
  }
  return insertSQL.substr(0, insertSQL.length - 1);
}

