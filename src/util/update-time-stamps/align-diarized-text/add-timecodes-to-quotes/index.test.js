const addTimecodesToQuotes = require('./index.js');
const linesWithSpeaker = require('../../sample-data/input-example.json');
const sttJson = require('../../sample-data/stt-transcript.json')


const res = addTimecodesToQuotes(linesWithSpeaker, sttJson);

test('Expect same number of paragraphs as the input', () => {
  expect(linesWithSpeaker.length).toBe(res.length);
});

test('Expect last element in list not to be null', () => {
  expect(res[res.length-1]).not.toBeNull();
});

