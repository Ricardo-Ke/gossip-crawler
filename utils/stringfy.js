/**
 * @param {string} url
 * @return {string}
 * @public
 */

exports.getNextPageUrl = function (url) {

  if (url.indexOf('paged=') == -1) {
    return url.concat('?paged=2');
  }else {
    let i = url.indexOf('=')
      , num = url.substr(i + 1)
      , nextUrl = url.substr(0, i + 1);
    
    num = parseInt(num) + 1;
    
    return (nextUrl + '' + num);
  }

}

exports.dateParser = function(date) {
  let dateObj = new Date(date);
  let d = dateObj.getFullYear() + '-' +
          addPrefix(1 + dateObj.getMonth()) + '-' +
          addPrefix(dateObj.getUTCDate()) + ' ' +
          addPrefix(dateObj.getUTCHours()) + ':' +
          addPrefix(dateObj.getUTCMinutes()) + ':' +
          addPrefix(dateObj.getUTCSeconds());
  return d;
}

function addPrefix(str) {
  let s = str.toString();

  if (s.length === 1 ){
    return '0' + s.toString();
  }else {
    return s;
  }
}