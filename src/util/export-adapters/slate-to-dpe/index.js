
import { Node } from 'slate';
import slateToText from '../txt';
import alignWords from '../../update-time-stamps/stt-align-node';
import alignDiraizedText from '../../update-time-stamps/align-diarized-text/add-timecodes-to-quotes';
// importing this way, coz it runs as client side code, and the module, align-diarized-text index.js contains and import to a
// helper module to generate html view, that contains and fs, and it breaks storybook webpack.
// TODO: refactor in ` align-diarized-text` so that it can work outside node only, but also in browser, without workaround
// const alignDiraizedText = require('../../../../node_modules/align-diarized-text/src/add-timecodes-to-quotes');
// const alignDiraizedText = require('align-diarized-text');
import updateTimestamps from '../../update-time-stamps/index.js';
// TODO: this function needs to be brough into alignDiraizedText
// and applied to paragraphs - to avoid boundaries overlapp
function adjustTimecodesBoundaries(words) {
    return words.map((word, index, arr) => {
        // excluding first element
        if (index != 0 ) {
        const previousWord = arr[index - 1];
        const currentWord = word;
        if (previousWord.end > currentWord.start) {
            word.start = previousWord.end;
        }
    
        return word;
        }
    
        return word;
    });
}

const prepSlateParagraphForAlignement = (slateData)=>{
    const result = [];
    slateData.forEach((el, index)=>{
       const newEl = {
            text:  Node.string(el),
            start: `${el.start}`,// workaround 
            speaker: el.speaker,
           id: `${index}`
       }
        result.push(newEl)
    })
    return result;
}
const deepClone = (json)=>{
    return JSON.parse(JSON.stringify(json));
}

const createContentFromEntityList = (slateJS, sttJson) => {
    const blocksArray =slateJS;
    const newEntities = sttJson;
    // Update entites to block structure.
    const updatedBlockArray = [];
    let totalWords = 0;
  
    blocksArray.forEach((block, index)=>{
    // for (const blockIndex in blocksArray) {
      // const block = blocksArray[blockIndex];
      // if copy and pasting large chunk of text
      // currentContentBlock, would not have speaker and start/end time info
      // so for updatedBlock, getting start time from first word in blockEntities
    //   const wordsInBlock = (block.children[0].text.match(/\S+/g) || []).length;
      const wordsInBlock = (block.children[0].text.split(' ') || []).length;
      const blockEntites = newEntities.slice(totalWords, totalWords + wordsInBlock);
      let speaker = block.speaker;
      if (!speaker) {
        speaker = 'U_UKN';
      }
    //   const updatedBlock = {
    //     text: blockEntites.map((entry) => entry.punct).join(' '),
    //     type: 'paragraph',
    //     data: {
    //       speaker: speaker,
    //       words: blockEntites,
    //       start: blockEntites[0]? blockEntites[0].start : 0
    //     },
    //     entityRanges: []
    //   };

    const updatedBlock = {
        start: blockEntites[0]? blockEntites[0].start : 0,
        end: blockEntites[blockEntites.length-1]? blockEntites[blockEntites.length-1].start : 0,
        id: index,
        speaker:speaker
      };
  
    
      updatedBlockArray.push(updatedBlock);
      totalWords += wordsInBlock;
    // }
  })
  
  
    return updatedBlockArray;
  };

const converSlateToDpe = (data,sttJson)=>{
    // const linesWithSpeaker = prepSlateParagraphForAlignement(data);
    let slateJsData = deepClone(data)
    let sttJsonData = deepClone(sttJson)

    const currentText = slateToText({value: slateJsData, speakers:false, timecodes:false, atlasFormat:false});
    const result = alignWords({sttWords: sttJsonData.words, transcript: currentText});
    console.log('res',result)
const slateJsDataPreppedForDiarization = slateJsData.map((p)=>{
    return {
        text: p.children[0].text,
        speaker: p.start
    }
})

const paragraphs = createContentFromEntityList(slateJsData,result)


// console.log('slateJsDataPreppedForDiarization',slateJsDataPreppedForDiarization)
//    const diarized = alignDiraizedText(slateJsDataPreppedForDiarization, sttJson)
//    console.log('diarized',diarized)
    // TODO: some way of interpolating paragraphs with alignement 
    return {words: result, paragraphs };
}

export default converSlateToDpe;