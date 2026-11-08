/* Pure dictation helpers, also used by the focused Node tests. */
(function (root) {
  'use strict';
  function lines(text) {
    return text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/).map(line => line.trim()).filter(Boolean);
  }
  function words(text) {
    return text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
      .replace(/([\p{L}\p{N}])'(?=[\p{L}\p{N}])/gu, '$1')
      .match(/[\p{L}\p{N}]+/gu) || [];
  }
  function compare(expected, actual) {
    const a = words(expected), b = words(actual);
    // Sequence alignment keeps a missing word from shifting every later word.
    const table = Array.from({length: a.length + 1}, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) table[i][0] = i;
    for (let j = 0; j <= b.length; j++) table[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        table[i][j] = Math.min(table[i - 1][j] + 1, table[i][j - 1] + 1, table[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 2));
      }
    }
    const tokens = [];
    let i = a.length, j = b.length;
    while (i || j) {
      if (i && j && table[i][j] === table[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 2)) {
        tokens.push({kind: a[i - 1] === b[j - 1] ? 'correct' : 'wrong', expected: a[--i], actual: b[--j]});
      } else if (i && table[i][j] === table[i - 1][j] + 1) {
        tokens.push({kind: 'missing', expected: a[--i]});
      } else {
        tokens.push({kind: 'extra', actual: b[--j]});
      }
    }
    return {correct: a.length > 0 && table[a.length][b.length] === 0, tokens: tokens.reverse()};
  }
  const api = {lines, words, compare};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dictation = api;
})(typeof window !== 'undefined' ? window : globalThis);
