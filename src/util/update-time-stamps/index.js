import slateToText from '../export-adapters/txt';
import alignWords from './stt-align-node';



// const convertContentToText = (content) => {
//   // let text = [];
//   // for (const blockIndex in content.blocks) {
//   //   const block = content.blocks[blockIndex];
//   //   const blockArray = block.text.match(/\S+/g) || [];
//   //   text = text.concat(blockArray);
//   // }
//   // return text;
//   return content.getPlainText();
// };

const createEntity = (start, end, confidence, word, wordIndex) => {
  // return ({
  //   start: start,
  //   end: end,
  //   confidence: confidence,
  //   word: word.toLowerCase().replace(/[.?!]/g, ''),
  //   punct: word,
  //   index: wordIndex,
  // });

};

const createContentFromEntityList = ( slateJsData, newEntities) => {
  const blocksArray =  slateJsData;
  // Update entites to block structure.
  const updatedBlockArray = [];
  let totalWords = 0;

  blocksArray.forEach((block)=>{
    console.log('block', block)
  // for (const blockIndex in blocksArray) {
    // const block = blocksArray[blockIndex];
    // if copy and pasting large chunk of text
    //  slateJsDataBlock, would not have speaker and start/end time info
    // so for updatedBlock, getting start time from first word in blockEntities
    const wordsInBlock = (block.children[0].text.match(/\S+/g) || []).length;
    const blockEntites = newEntities.slice(totalWords, totalWords + wordsInBlock);
    console.log('blockEntites',blockEntites)
    let speaker = block.speaker;
    if (!speaker) {
      speaker = 'U_UKN';
    }
    // const updatedBlock = {
    //   text: blockEntites.map((entry) => entry.text).join(' '),
    //   type: 'paragraph',
    //   data: {
    //     speaker: speaker,
    //     words: blockEntites,
    //     start: blockEntites[0]? blockEntites[0].start : 0
    //   },
    //   entityRanges: []
    // };

    const updatedBlock =  {
      "speaker": speaker,
      "start": blockEntites[0]? blockEntites[0].start : 0,
      // "end": end,
      "previousTimings": "0 1 2 3 4 5 6 7 8 9 10 11 12",//TODO:
      "startTimecode": "00:00:13", // TODO:
      "type": "timedText",
      "children": [
        {
          "text": blockEntites.map((entry) => entry.text).join(' ')
        }
      ]
    }

    updatedBlockArray.push(updatedBlock);
    totalWords += wordsInBlock;
  // }
})


  return updatedBlockArray;
};

const deepClone = (json)=>{
  return JSON.parse(JSON.stringify(json));
}

// Update timestamps using modified version of stt-align (bbc).
const updateTimestamps = (  slateJsData, sttJson) => {
  // const currentText = convertContentToText( slateJsData);
  const currentText = slateToText({value: slateJsData, speakers:false, timecodes:false, atlasFormat:false});
  const entities = deepClone(sttJson)

  const result = alignWords({sttWords: entities.words, transcript: currentText});
  // const result = entities;
  // const newEntities = result.map((entry, index) => {
  //   return createEntity(entry.start, entry.end, 0.0, entry.word, index);
  // });
  const updatedContent = createContentFromEntityList( slateJsData, result);
  return updatedContent;
};

export default updateTimestamps;
