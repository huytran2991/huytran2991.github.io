(function (root) {
  'use strict';
  function key(lesson, sentence) {
    return JSON.stringify([lesson.id, sentence.id, sentence.vi]);
  }
  const api = {key};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Writing = api;
})(typeof window !== 'undefined' ? window : globalThis);
