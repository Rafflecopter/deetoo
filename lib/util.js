var _ = require('underscore')
,   _slice = Array.prototype.slice

function utc_timestamp(prefix) {
  var d = new Date()
    , utc = d.getTime() + (d.getTimezoneOffset() * 60 * 1000)

  if (prefix)
    return [prefix, utc].join('');
  else
    return utc;
}

// arrfill([undefined, 2, 3], [1, 4]) --> [1, 2, 3, 4]
function arrfill(arr, fill) {
  var ind=0, replace = function(i){ return i===undefined ? fill[ind++] : i }
  return _.map(arr, replace).concat(_slice.call(fill, ind))
}

// allows out-of-order arguments by using `undefined`
function partial(fn) {
  var preset=_slice.call(arguments, 1), self=this
  return function(){ return fn.apply(self, arrfill(preset, arguments)) }
}


module.exports = {
   utc_timestamp: utc_timestamp
  ,partial: partial
  ,arrfill: arrfill
}


