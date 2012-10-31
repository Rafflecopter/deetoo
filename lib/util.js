var _ = require('underscore')
,   _slice = Array.prototype.slice

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
   partial: partial
  ,arrfill: arrfill
}


