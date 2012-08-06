
function utc_timestamp(prefix) {
  var d = new Date()
    , utc = d.getTime() + (d.getTimezoneOffset() * 60 * 1000)

  if (prefix)
    return [prefix, utc].join('');
  else
    return utc;
}

function partialError($func) {
  // returns a partially-applied function // which can be called w/ just an 
  // 'err' as a first argument
  var args = Array.prototype.slice.call(arguments, 1)
  return function(err) {
    $func.apply(this, [err].concat(args))
  }
}


module.exports = {
   utc_timestamp: utc_timestamp
  ,partialError: partialError
}


