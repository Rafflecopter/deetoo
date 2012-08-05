
function utc_timestamp(prefix) {
  var d = new Date()
    , utc = d.getTime() + (d.getTimezoneOffset() * 60 * 1000)

  if (prefix)
    return [prefix, utc].join('');
  else
    return utc;
}


module.exports = {utc_timestamp: utc_timestamp}


