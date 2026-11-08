/* Shared practice data requests for Listening and Writing. */
globalThis.PracticeFiles = class PracticeFiles {
  constructor(reportError) {
    this.reportError = reportError;
    this.ready = false;
    this.summary = {};
    this.pending = Promise.resolve();
  }

  request(action, data = {}) {
    const work = this.pending.then(async () => {
      const body = JSON.stringify({...data, action});
      const response = await englishPracticeFetch('progress', {
        method: 'POST', cache: 'no-store',
        headers: {'Content-Type': 'application/json'},
        body,
        keepalive: action === 'config' && body.length < 16000
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to load or save practice data.');
      return result;
    });
    this.pending = work.catch(() => {});
    return work;
  }

  async open() {
    const state = await this.request('state');
    this.ready = true;
    this.summary = state.summary;
    return state.config;
  }

  config(config) {
    if (this.ready) return this.request('config', {config}).catch(this.reportError);
  }

  async lesson(action, lesson, fields = {}) {
    const response = await this.request(action, {lesson: lesson.id, revision: lesson.revision, ...fields});
    this.summary[lesson.id] = {revision: lesson.revision, done: response.done};
    return response.results;
  }

  done(lesson) {
    const entry = this.summary[lesson.id];
    return entry && entry.revision === lesson.revision ? entry.done : 0;
  }
};
