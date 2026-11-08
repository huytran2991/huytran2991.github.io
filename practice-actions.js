import { readPractice, updatePractice } from './practice-store.js';
import {
  acceptedWords, appendTransfer, listLessons, PracticeError, practiceProgress, reviewPrompts,
  saveTextLesson, sourceLesson, speakingRequest, speakingReviewModels, trim, writingModels
} from './practice-data.js';
import { getGeminiKey, reviewSpeaking, reviewWriting } from './practice-ai.js';

const defaultWritingModel = Object.keys(writingModels)[0];
const receipts = new Map();
const dateFormat = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
});

function rememberAcceptance(uid, request) {
  const now = Date.now();
  for (const [token, receipt] of receipts) {
    if (receipt.expires <= now) receipts.delete(token);
  }
  if (receipts.size >= 100) receipts.delete(receipts.keys().next().value);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  receipts.set(token, { ...request, uid, answer: trim(request.answer), expires: now + 7200000 });
  return token;
}

function acceptance(uid, token) {
  const receipt = receipts.get(token);
  if (!receipt || receipt.uid !== uid || receipt.expires <= Date.now()) {
    throw new PracticeError('Review this translation successfully before saving or transferring it.', 409);
  }
  return receipt;
}

function writingSentence(lesson, sentenceId) {
  const sentence = lesson.sentences.find(item => item.id === sentenceId);
  if (!sentence) throw new PracticeError('Sentence not found. Reload lessons.');
  return sentence;
}

export async function practiceAction(uid, tool, action, query, options) {
  const { method, body, signal } = options;
  const posting = method === 'POST';
  const input = posting ? (body instanceof FormData ? Object.fromEntries(body) : JSON.parse(body)) : null;
  const read = async apply => {
    const files = await readPractice(uid);
    signal?.throwIfAborted();
    return apply(files);
  };
  const write = apply => updatePractice(uid, apply, signal);

  if (tool === 'speaking') {
    if (action === 'lessons') return (posting ? write : read)(files => speakingRequest(files, input, query));
    if (action === 'accepted-words') return (posting ? write : read)(files => acceptedWords(files, input));
  }

  if (tool === 'listening' || tool === 'writing') {
    if (action === 'lessons') {
      if (posting) {
        return write(async files => {
          const selected = await saveTextLesson(files, tool, input);
          return tool === 'listening' ? { selected, lessons: await listLessons(files, tool) } : { selected };
        });
      }
      return read(async files => {
        const lessons = await listLessons(files, tool);
        return tool === 'writing'
          ? { lessons, aiAvailable: !!getGeminiKey(uid), model: defaultWritingModel, models: writingModels }
          : { lessons, selected: null };
      });
    }

    if (action === 'progress' && posting) {
      const operate = files => practiceProgress(files, tool, input, lesson => {
        const receipt = acceptance(uid, input.receipt);
        if (receipt.lesson !== lesson.id || receipt.revision !== lesson.revision || receipt.sentence !== input.sentence) {
          throw new PracticeError('Review this translation before saving completion.', 409);
        }
      });
      return (input.action === 'state' ? read : write)(operate);
    }

    if (action === 'transfer' && posting && tool === 'listening') {
      return write(async files => {
        const lesson = await sourceLesson(files, tool, input.lesson, input.revision);
        const sentence = lesson.lines[input.index];
        if (!Number.isInteger(input.index) || !sentence) throw new PracticeError('Choose an available sentence.');
        const file = 'From Listening.txt';
        return { added: appendTransfer(files, 'speaking', file, sentence), file };
      });
    }

    if (action === 'review' && posting && tool === 'writing') {
      return read(async files => {
        const lesson = await sourceLesson(files, tool, input.lesson, input.revision);
        const sentence = writingSentence(lesson, input.sentence);
        const review = await reviewWriting(uid, sentence, input.answer, input.model, signal);
        signal?.throwIfAborted();
        return { review, model: input.model, transferToken: review.verdict === 'accepted' ? rememberAcceptance(uid, input) : null };
      });
    }

    if (action === 'transfer' && posting && tool === 'writing') {
      return write(async files => {
        const receipt = acceptance(uid, input.transferToken);
        const lesson = await sourceLesson(files, tool, receipt.lesson, receipt.revision);
        writingSentence(lesson, receipt.sentence);
        if (!['Listening', 'Speaking'].includes(input.target)) throw new PracticeError('Choose Speaking or Listening.');
        const date = Object.fromEntries(dateFormat.formatToParts().map(({ type, value }) => [type, value]));
        const file = `From Writing_${date.year}_${date.month}_${date.day}.txt`;
        return { added: appendTransfer(files, input.target.toLowerCase(), file, receipt.answer), target: input.target, file };
      });
    }
  }

  if (tool === 'speakingreview') {
    if (action === 'config' && !posting) {
      return read(async files => ({
        prompts: await reviewPrompts(files), models: speakingReviewModels, available: !!getGeminiKey(uid)
      }));
    }
    if (action === 'review' && posting) {
      return read(async files => {
        const prompt = (await reviewPrompts(files)).find(item => item.id === input.prompt);
        if (!prompt || prompt.revision !== input.revision) throw new PracticeError('This prompt changed. Reload prompts and try again.', 409);
        const review = await reviewSpeaking(uid, prompt, input.audio, input.model, signal);
        return { review, model: input.model, prompt: prompt.title };
      });
    }
  }

  throw new PracticeError('Unknown English Practice action.', 404);
}
