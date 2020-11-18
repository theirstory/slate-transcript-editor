function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import path from 'path';
import Button from 'react-bootstrap/Button';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Dropdown from 'react-bootstrap/Dropdown';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import Tooltip from 'react-bootstrap/Tooltip';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ListGroup from 'react-bootstrap/ListGroup';
import Accordion from 'react-bootstrap/Accordion';
import { createEditor, Editor, Node, Transforms } from 'slate'; // https://docs.slatejs.org/walkthroughs/01-installing-slate
// Import the Slate components and React plugin.

import { Slate, Editable, withReact, ReactEditor } from 'slate-react';
import { withHistory } from 'slate-history';
import { faSave, faShare, faUndo, faSync, faInfoCircle, faICursor, faMehBlank, faPause, faMusic, faClosedCaptioning } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { shortTimecode } from '../util/timecode-converter';
import slateToText from '../util/export-adapters/txt';
import download from '../util/downlaod/index.js';
import convertDpeToSlate from '../util/dpe-to-slate';
import converSlateToDpe from '../util/export-adapters/slate-to-dpe/index.js';
import slateToDocx from '../util/export-adapters/docx';
import restoreTimecodes from '../util/restore-timcodes';
import insertTimecodesInline from '../util/inline-interval-timecodes';
import pluck from '../util/pluk';
import subtitlesGenerator from '../util/export-adapters/subtitles-generator/index.js';
import subtitlesExportOptionsList from '../util/export-adapters/subtitles-generator/list.js';
const PLAYBACK_RATE_VALUES = [0.2, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3, 3.5];
const SEEK_BACK_SEC = 15;
const PAUSE_WHILTE_TYPING_TIMEOUT_MILLISECONDS = 1500;
const MAX_DURATION_FOR_PERFORMANCE_OPTIMIZATION_IN_SECONDS = 3600;
const TOOTLIP_DELAY = 1000;
const TOOTLIP_LONGER_DELAY = 2000;
const mediaRef = React.createRef();

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

export default function SlateTranscriptEditor(props) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const editor = useMemo(() => withReact(withHistory(createEditor())), []);
  const [value, setValue] = useState([]);
  const defaultShowSpeakersPreference = typeof props.showSpeakers === 'boolean' ? props.showSpeakers : true;
  const defaultShowTimecodesPreference = typeof props.showTimecodes === 'boolean' ? props.showTimecodes : true;
  const [showSpeakers, setShowSpeakers] = useState(defaultShowSpeakersPreference);
  const [showTimecodes, setShowTimecodes] = useState(defaultShowTimecodesPreference);
  const [speakerOptions, setSpeakerOptions] = useState([]);
  const [showSpeakersCheatShet, setShowSpeakersCheatShet] = useState(false);
  const [saveTimer, setSaveTimer] = useState(null);
  const [isPauseWhiletyping, setIsPauseWhiletyping] = useState(false);
  useEffect(() => {
    if (props.transcriptData) {
      const res = convertDpeToSlate(props.transcriptData);
      setValue(res);
    }
  }, []); // handles interim results for worrking with a Live STT

  useEffect(() => {
    if (props.transcriptDataLive) {
      const nodes = convertDpeToSlate(props.transcriptDataLive); // if the user is selecting the / typing the text
      // Transforms.insertNodes would insert the node at seleciton point
      // instead we check if they are in the editor

      if (editor.selection) {
        // get the position of the last node
        const positionLastNode = [editor.children.length]; // insert the new nodes at the end of the document

        Transforms.insertNodes(editor, nodes, {
          at: positionLastNode
        });
      } // use not having selection in the editor allows us to also handle the initial use case
      // where the might be no initial results
      else {
          // if there is no selection the default for insertNodes is to add the nodes at the end
          Transforms.insertNodes(editor, nodes);
        }
    }
  }, [props.transcriptDataLive]);
  useEffect(() => {
    const getUniqueSpeakers = pluck('speaker');
    const uniqueSpeakers = getUniqueSpeakers(value);
    setSpeakerOptions(uniqueSpeakers);
  }, [showSpeakersCheatShet]);
  useEffect(() => {
    // Update the document title using the browser API
    if (mediaRef && mediaRef.current) {
      // setDuration(mediaRef.current.duration);
      mediaRef.current.addEventListener('timeupdate', handleTimeUpdated);
    }

    return function cleanup() {
      // removeEventListener
      mediaRef.current.removeEventListener('timeupdate', handleTimeUpdated);
    };
  }, []);
  useEffect(() => {
    // Update the document title using the browser API
    if (mediaRef && mediaRef.current) {
      // Not working
      setDuration(mediaRef.current.duration);

      if (mediaRef.current.duration >= MAX_DURATION_FOR_PERFORMANCE_OPTIMIZATION_IN_SECONDS) {
        setShowSpeakers(false);
        showTimecodes(false);
      }
    }
  }, [mediaRef]);

  const handleSetShowSpeakersCheatShet = () => {
    setShowSpeakersCheatShet(!showSpeakersCheatShet);
  };

  const handleTimeUpdated = e => {
    setCurrentTime(e.target.currentTime); // TODO: setting duration here as a workaround

    setDuration(mediaRef.current.duration);
  };

  const handleSetPlaybackRate = e => {
    const tmpNewPlaybackRateValue = parseFloat(e.target.value);

    if (mediaRef && mediaRef.current) {
      mediaRef.current.playbackRate = tmpNewPlaybackRateValue;
      setPlaybackRate(tmpNewPlaybackRateValue);
    }
  };

  const handleSeekBack = () => {
    if (mediaRef && mediaRef.current) {
      mediaRef.current.currentTime = mediaRef.current.currentTime - SEEK_BACK_SEC;
    }
  };

  const renderElement = useCallback(props => {
    switch (props.element.type) {
      case 'timedText':
        return React.createElement(TimedTextElement, props);

      default:
        return React.createElement(DefaultElement, props);
    }
  }, []);
  const renderLeaf = useCallback(({
    attributes,
    children,
    leaf
  }) => {
    return React.createElement("span", _extends({
      onDoubleClick: handleTimedTextClick,
      className: 'timecode text',
      "data-start": children.props.parent.start,
      "data-previous-timings": children.props.parent.previousTimings,
      title: children.props.parent.start
    }, attributes), children);
  }, []); //

  /**
   * `handleSetSpeakerName` is outside of TimedTextElement
   * to improve the overall performance of the editor,
   * especially on long transcripts
   * @param {*} element - props.element, from `renderElement` function
   */

  const handleSetSpeakerName = element => {
    const pathToCurrentNode = ReactEditor.findPath(editor, element);
    const oldSpeakerName = element.speaker.toUpperCase();
    const newSpeakerName = prompt('Change speaker name', oldSpeakerName);

    if (newSpeakerName) {
      const isUpdateAllSpeakerInstances = confirm(`Would you like to replace all occurrences of ${oldSpeakerName} with ${newSpeakerName}?`);

      if (isUpdateAllSpeakerInstances) {
        const rangeForTheWholeEditor = Editor.range(editor, []); // Apply transformation to the whole doc, where speaker matches old spekaer name, and set it to new one

        Transforms.setNodes(editor, {
          type: 'timedText',
          speaker: newSpeakerName
        }, {
          at: rangeForTheWholeEditor,
          match: node => node.type === 'timedText' && node.speaker === oldSpeakerName
        });
      } else {
        // only apply speaker name transformation to current element
        Transforms.setNodes(editor, {
          type: 'timedText',
          speaker: newSpeakerName
        }, {
          at: pathToCurrentNode
        });
      }
    }
  };

  const TimedTextElement = props => {
    let textLg = 12;
    let textXl = 12;

    if (!showSpeakers && !showTimecodes) {
      textLg = 12;
      textXl = 12;
    } else if (showSpeakers && !showTimecodes) {
      textLg = 9;
      textXl = 9;
    } else if (!showSpeakers && showTimecodes) {
      textLg = 9;
      textXl = 10;
    } else if (showSpeakers && showTimecodes) {
      textLg = 6;
      textXl = 7;
    }

    return React.createElement(Row, props.attributes, showTimecodes && React.createElement(Col, {
      contentEditable: false,
      xs: 4,
      sm: 2,
      md: 4,
      lg: 3,
      xl: 2,
      className: 'p-t-2 text-truncate'
    }, React.createElement("code", {
      contentEditable: false,
      style: {
        cursor: 'pointer'
      },
      className: 'timecode text-muted unselectable',
      onClick: handleTimedTextClick,
      title: props.element.startTimecode,
      "data-start": props.element.start
    }, props.element.startTimecode)), showSpeakers && React.createElement(Col, {
      contentEditable: false,
      xs: 8,
      sm: 10,
      md: 8,
      lg: 3,
      xl: 3,
      className: 'p-t-2 text-truncate'
    }, React.createElement("span", {
      contentEditable: false,
      className: 'text-truncate text-muted unselectable',
      style: {
        cursor: 'pointer',
        width: '100%'
      },
      title: props.element.speaker.toUpperCase(),
      onClick: handleSetSpeakerName.bind(this, props.element)
    }, ' ', props.element.speaker.toUpperCase())), React.createElement(Col, {
      xs: 12,
      sm: 12,
      md: 12,
      lg: textLg,
      xl: textXl,
      className: 'p-b-1 mx-auto'
    }, props.children));
  };

  const DefaultElement = props => {
    return React.createElement("p", props.attributes, props.children);
  };

  const handleTimedTextClick = e => {
    if (e.target.classList.contains('timecode')) {
      const start = e.target.dataset.start;

      if (mediaRef && mediaRef.current) {
        mediaRef.current.currentTime = parseInt(start);
        mediaRef.current.play();
      }
    } else if (e.target.dataset.slateString) {
      if (e.target.parentNode.dataset.start) {
        const start = e.target.parentNode.dataset.start;

        if (mediaRef && mediaRef.current && start) {
          mediaRef.current.currentTime = parseInt(start);
          mediaRef.current.play();
        }
      }
    }
  };

  const getEditorContent = ({
    type,
    speakers,
    timecodes,
    inline_timecodes: inline,
    hideTitle,
    atlasFormat
  }) => {
    switch (type) {
      case 'text':
        let tmpValue = value;

        if (timecodes || inline) {
          tmpValue = handleRestoreTimecodes(inline);
        }

        return slateToText({
          value: tmpValue,
          speakers,
          timecodes,
          atlasFormat
        });

      case 'json-slate':
        return value;

      case 'json-digitalpaperedit':
        return converSlateToDpe(value, props.transcriptData);

      case 'word':
        let docTmpValue = value;

        if (timecodes || inline) {
          docTmpValue = handleRestoreTimecodes(inline);
        }

        return slateToDocx({
          value: docTmpValue,
          speakers,
          timecodes,
          inline_speakers: inline,
          title: props.title,
          hideTitle
        });

      default:
        // some default, unlikely to be called
        return {};
    }
  };

  const getFileTitle = () => {
    if (props.title) {
      return props.title;
    }

    return path.basename(props.mediaUrl).trim();
  };

  const handleExport = ({
    type,
    ext,
    speakers,
    timecodes,
    inline_timecodes,
    hideTitle,
    atlasFormat
  }) => {
    let editorContnet = getEditorContent({
      type,
      speakers,
      inline_timecodes,
      timecodes,
      hideTitle,
      atlasFormat
    });

    if (ext === 'json') {
      editorContnet = JSON.stringify(editorContnet, null, 2);
    }

    if (ext !== 'docx') {
      download(editorContnet, `${getFileTitle()}.${ext}`);
    }
  };

  const handleSave = () => {
    const format = props.autoSaveContentType ? props.autoSaveContentType : 'digitalpaperedit';
    const editorContnet = getEditorContent({
      type: `json-${format}`
    });

    if (props.handleSaveEditor) {
      props.handleSaveEditor(editorContnet);
    }
  };

  const handleRestoreTimecodes = (inline_timecodes = false) => {
    if (inline_timecodes) {
      let transcriptData = insertTimecodesInline({
        transcriptData: props.transcriptData
      });
      const ret = restoreTimecodes({
        transcriptData,
        slateValue: convertDpeToSlate(transcriptData)
      });
      handleRestoreTimecodes(false);
      return ret;
    } else {
      const alignedSlateData = restoreTimecodes({
        slateValue: value,
        transcriptData: props.transcriptData
      });
      setValue(alignedSlateData);
      return alignedSlateData;
    }
  };

  const breakParagraph = () => {
    Editor.insertBreak(editor);
  };

  const insertTextInaudible = () => {
    Transforms.insertText(editor, '[INAUDIBLE]');
  }; // const handleInsertMusicNote = ()=>{
  //   Transforms.insertText(editor, '♫'); // or ♪
  // }

  /**
   * See explanation in `src/utils/dpe-to-slate/index.js` for how this function works with css injection
   * to provide current paragaph's highlight.
   * @param {Number} currentTime - float in seconds
   */


  const generatePreviousTimingsUpToCurrent = currentTime => {
    // edge case - empty transcription
    if (isEmpty(props.transcriptData)) {
      return '';
    }

    const lastWordStartTime = props.transcriptData.words[props.transcriptData.words.length - 1].start;
    const lastWordStartTimeInt = parseInt(lastWordStartTime);
    const emptyListOfTimes = Array(lastWordStartTimeInt);
    const listOfTimesInt = [...emptyListOfTimes.keys()];
    const listOfTimesUpToCurrentTimeInt = listOfTimesInt.splice(0, currentTime, 0);
    const stringlistOfTimesUpToCurrentTimeInt = listOfTimesUpToCurrentTimeInt.join(' ');
    return stringlistOfTimesUpToCurrentTimeInt;
  };

  const handleSetPauseWhileTyping = () => {
    setIsPauseWhiletyping(!isPauseWhiletyping);
  };

  const handleSubtitlesExport = ({
    type,
    ext
  }) => {
    let editorContent = getEditorContent({
      type: 'json-digitalpaperedit',
      speakers: true,
      timecodes: true
    });
    let subtitlesJson = subtitlesGenerator({
      words: editorContent.words,
      paragraphs: editorContent.paragraphs,
      type
    });

    if (type === 'json') {
      subtitlesJson = JSON.stringify(subtitlesJson, null, 2);
    }

    download(subtitlesJson, `${getFileTitle()}.${ext}`);
  };

  const getMediaType = () => {
    const clipExt = path.extname(props.mediaUrl);
    let tmpMediaType = props.mediaType ? props.mediaType : 'video';

    if (clipExt === '.wav' || clipExt === '.mp3' || clipExt === '.m4a' || clipExt === '.flac' || clipExt === '.aiff') {
      tmpMediaType = 'audio';
    }

    return tmpMediaType;
  };

  return React.createElement(Container, {
    fluid: true,
    style: {
      backgroundColor: '#eee',
      height: '100vh',
      paddingTop: '1em'
    }
  }, React.createElement("style", {
    scoped: true
  }, `
              /* Next words */
              .timecode[data-previous-timings*="${mediaRef && mediaRef.current && mediaRef.current.duration && generatePreviousTimingsUpToCurrent(parseInt(currentTime))}"]{
                  color:  #9E9E9E;
              }
          `), React.createElement("style", {
    scope: true
  }, `.editor-wrapper-container{
                padding: 8px 16px;
                background: #f9f9f9;
                box-shadow: 0 0 10px #ccc;
                height: 90vh;
                overflow: auto;
              }
              /* https://developer.mozilla.org/en-US/docs/Web/CSS/user-select
              TODO: only working in Chrome, not working in Firefox, and Safari - OSX
              if selecting text, not showing selection
              Commented out because it means cannot select speakers and timecode anymore
              which is the intended default behavior but needs to come with export
              functionality to export as plain text, word etc.. otherwise user won't be able
              to get text out of component with timecodes and speaker names in the interim */
              .unselectable {
                -moz-user-select: none;
                -webkit-user-select: none;
                -ms-user-select: none;
                user-select: none;
              }
              .timecode:hover{
                text-decoration: underline;
              }
              .timecode.text:hover{
                text-decoration:none;
              }
              `), props.showTitle ? React.createElement(OverlayTrigger, {
    delay: TOOTLIP_LONGER_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, " ", props.title)
  }, React.createElement("h3", {
    className: 'text-truncate text-left'
  }, React.createElement("small", {
    className: "text-muted"
  }, props.title))) : null, React.createElement(Row, null, React.createElement(Col, {
    xs: {
      span: 12,
      order: 1
    },
    sm: getMediaType() === 'audio' ? {
      span: 10,
      offset: 1
    } : 3,
    md: getMediaType() === 'audio' ? {
      span: 10,
      offset: 1
    } : 3,
    lg: getMediaType() === 'audio' ? {
      span: 8,
      offset: 2
    } : 3,
    xl: getMediaType() === 'audio' ? {
      span: 8,
      offset: 2
    } : 3
  }, React.createElement(Row, null, React.createElement("video", {
    ref: mediaRef,
    src: props.mediaUrl,
    width: '100%',
    height: getMediaType() === 'audio' ? '60em' : 'auto',
    controls: true,
    playsInline: true
  })), React.createElement(Row, null, React.createElement(Col, {
    xs: 5,
    sm: 4,
    md: 4,
    lg: 4,
    xl: 4,
    className: 'p-1 mx-auto'
  }, React.createElement(Badge, {
    variant: "light",
    pill: true
  }, React.createElement("code", {
    className: 'text-muted'
  }, shortTimecode(currentTime)), React.createElement("code", {
    className: 'text-muted'
  }, duration ? ` | ${shortTimecode(duration)}` : ''))), React.createElement(Col, {
    xs: 4,
    sm: 4,
    md: 4,
    lg: 4,
    xl: 4,
    className: 'p-1 mx-auto'
  }, React.createElement(Form.Control, {
    as: "select",
    defaultValue: playbackRate,
    onChange: handleSetPlaybackRate,
    title: 'Change the playback speed of the player'
  }, PLAYBACK_RATE_VALUES.map((playbackRateValue, index) => {
    return React.createElement("option", {
      key: index + playbackRateValue,
      value: playbackRateValue
    }, "x ", playbackRateValue);
  }))), React.createElement(Col, {
    xs: 3,
    sm: 3,
    md: 3,
    lg: 3,
    xl: 3,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    delay: TOOTLIP_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, `Seek back by ${SEEK_BACK_SEC} seconds`)
  }, React.createElement("span", {
    className: "d-inline-block"
  }, React.createElement(Button, {
    variant: "light",
    onClick: handleSeekBack,
    block: true
  }, SEEK_BACK_SEC, " ", React.createElement(FontAwesomeIcon, {
    icon: faUndo
  })))))), React.createElement(Row, null, React.createElement(Col, {
    xs: 12,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(Accordion, {
    onClick: handleSetShowSpeakersCheatShet
  }, React.createElement(Accordion.Toggle, {
    as: Button,
    variant: "link",
    eventKey: "0"
  }, React.createElement(Badge, {
    variant: "light"
  }, "Speakers")), React.createElement(Accordion.Collapse, {
    eventKey: "0"
  }, React.createElement(ListGroup, null, speakerOptions.map((speakerName, index) => {
    return React.createElement(ListGroup.Item, {
      key: index + speakerName,
      className: 'text-truncate',
      title: speakerName.toUpperCase()
    }, speakerName.toUpperCase());
  }))))))), React.createElement(Col, {
    xs: {
      span: 12,
      order: 3
    },
    sm: getMediaType() === 'audio' ? {
      span: 10,
      order: 2,
      offset: 1
    } : {
      span: 7,
      order: 2
    },
    md: getMediaType() === 'audio' ? {
      span: 10,
      order: 2,
      offset: 1
    } : {
      span: 7,
      order: 2
    },
    lg: getMediaType() === 'audio' ? {
      span: 8,
      order: 2,
      offset: 2
    } : {
      span: 8,
      order: 2
    },
    xl: getMediaType() === 'audio' ? {
      span: 8,
      order: 2,
      offset: 2
    } : {
      span: 7,
      order: 2
    }
  }, value.length !== 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, React.createElement("section", {
    className: "editor-wrapper-container"
  }, React.createElement(Slate, {
    editor: editor,
    value: value,
    onChange: value => {
      if (props.handleAutoSaveChanges) {
        props.handleAutoSaveChanges(value);
      }

      return setValue(value);
    }
  }, React.createElement(Editable, {
    readOnly: typeof props.isEditable === 'boolean' ? !props.isEditable : false,
    renderElement: renderElement,
    renderLeaf: renderLeaf,
    onKeyDown: event => {
      if (isPauseWhiletyping) {
        // logic for pause while typing
        // https://schier.co/blog/wait-for-user-to-stop-typing-using-javascript
        // TODO: currently eve the video was paused, and pause while typing is on,
        // it will play it when stopped typing. so added btn to turn feature on off.
        // and disabled as default.
        // also pause while typing might introduce performance issues on longer transcripts
        // if on every keystroke it's creating and destroing a timer.
        // should find a more efficient way to "debounce" or "throttle" this functionality
        if (mediaRef && mediaRef.current) {
          mediaRef.current.pause();
        }

        if (saveTimer !== null) {
          clearTimeout(saveTimer);
        }

        const tmpSaveTimer = setTimeout(() => {
          if (mediaRef && mediaRef.current) {
            mediaRef.current.play();
          }
        }, PAUSE_WHILTE_TYPING_TIMEOUT_MILLISECONDS);
        setSaveTimer(tmpSaveTimer);
      }
    }
  })))) : React.createElement("section", {
    className: "text-center"
  }, React.createElement("i", {
    className: "text-center"
  }, "Loading..."))), React.createElement(Col, {
    xs: {
      span: 12,
      order: 2
    },
    sm: {
      span: 2,
      order: 3
    },
    md: {
      span: 2,
      order: 3
    },
    lg: {
      span: 1,
      order: 3
    },
    xl: {
      span: 2,
      order: 3
    }
  }, React.createElement(Row, null, React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    OverlayTrigger: true,
    delay: TOOTLIP_LONGER_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Export options")
  }, React.createElement("span", {
    className: "d-inline-block"
  }, React.createElement(DropdownButton, {
    id: "dropdown-basic-button",
    title: React.createElement(FontAwesomeIcon, {
      icon: faShare
    }),
    variant: "light"
  }, React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'text',
        ext: 'txt',
        speakers: false,
        timecodes: false
      });
    }
  }, "Text (", React.createElement("code", null, ".txt"), ")"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'text',
        ext: 'txt',
        speakers: true,
        timecodes: false
      });
    }
  }, "Text (Speakers)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'text',
        ext: 'txt',
        speakers: false,
        timecodes: true
      });
    }
  }, "Text (Timecodes)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'text',
        ext: 'txt',
        speakers: true,
        timecodes: true
      });
    },
    disable: true
  }, "Text (Speakers & Timecodes)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'text',
        ext: 'txt',
        speakers: true,
        timecodes: true,
        atlasFormat: true
      });
    },
    disable: true
  }, "Text (Atlas format)"), React.createElement(Dropdown.Divider, null), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'word',
        ext: 'docx',
        speakers: false,
        timecodes: false
      });
    }
  }, "Word (", React.createElement("code", null, ".docx"), ")"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'word',
        ext: 'docx',
        speakers: true,
        timecodes: false
      });
    }
  }, "Word (Speakers)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'word',
        ext: 'docx',
        speakers: false,
        timecodes: true
      });
    }
  }, "Word (Timecodes)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'word',
        ext: 'docx',
        speakers: true,
        timecodes: true
      });
    }
  }, "Word (Speakers & Timecodes)"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'word',
        ext: 'docx',
        speakers: false,
        timecodes: false,
        inline_timecodes: true,
        hideTitle: true
      });
    }
  }, "Word (OHMS)"), React.createElement(Dropdown.Divider, null), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'json-slate',
        ext: 'json',
        speakers: true,
        timecodes: true
      });
    }
  }, "SlateJs (", React.createElement("code", null, ".json"), ")"), React.createElement(Dropdown.Item, {
    onClick: () => {
      handleExport({
        type: 'json-digitalpaperedit',
        ext: 'json',
        speakers: true,
        timecodes: true
      });
    }
  }, "DPE (", React.createElement("code", null, ".json"), ")"))))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    OverlayTrigger: true,
    delay: TOOTLIP_LONGER_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Export in caption format")
  }, React.createElement(DropdownButton, {
    id: "dropdown-basic-button",
    title: React.createElement(FontAwesomeIcon, {
      icon: faClosedCaptioning
    }),
    variant: "light"
  }, subtitlesExportOptionsList.map(({
    type,
    label,
    ext
  }, index) => {
    return React.createElement(Dropdown.Item, {
      key: index + label,
      onClick: () => {
        handleSubtitlesExport({
          type,
          ext
        });
      }
    }, label, " (", React.createElement("code", null, ".", ext), ")");
  })))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    OverlayTrigger: true,
    delay: TOOTLIP_LONGER_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Save")
  }, React.createElement(Button, {
    onClick: handleSave,
    variant: "light"
  }, React.createElement(FontAwesomeIcon, {
    icon: faSave
  })))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    delay: TOOTLIP_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "To insert a paragraph break, and split a pargraph in two, put the cursor at a point where you'd want to add a paragraph break in the text and either click this button or hit enter key")
  }, React.createElement(Button, {
    onClick: breakParagraph,
    variant: "light"
  }, "\u21B5"))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    delay: TOOTLIP_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Put the cursor at a point where you'd want to add [INAUDIBLE] text, and click this button")
  }, React.createElement(Button, {
    onClick: insertTextInaudible,
    variant: "light"
  }, React.createElement(FontAwesomeIcon, {
    icon: faMehBlank
  })))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    delay: TOOTLIP_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Turn ", isPauseWhiletyping ? 'off' : 'on', " pause while typing functionality. As you start typing the media while pause playback until you stop. Not reccomended on longer transcript as it might present performance issues.")
  }, React.createElement(Button, {
    onClick: handleSetPauseWhileTyping,
    variant: isPauseWhiletyping ? 'secondary' : 'light'
  }, React.createElement(FontAwesomeIcon, {
    icon: faPause
  })))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    delay: TOOTLIP_DELAY,
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Restore timecodes. At the moment for transcript over 1hour it could temporarily freeze the UI for a few seconds")
  }, React.createElement(Button, {
    onClick: handleRestoreTimecodes,
    variant: "light"
  }, React.createElement(FontAwesomeIcon, {
    icon: faSync
  })))), React.createElement(Col, {
    xs: 2,
    sm: 12,
    md: 12,
    lg: 12,
    xl: 12,
    className: 'p-1 mx-auto'
  }, React.createElement(OverlayTrigger, {
    placement: 'bottom',
    overlay: React.createElement(Tooltip, {
      id: "tooltip-disabled"
    }, "Double click on a paragraph to jump to the corresponding point at the beginning of that paragraph in the media")
  }, React.createElement(Button, {
    variant: "light"
  }, React.createElement(FontAwesomeIcon, {
    icon: faInfoCircle
  }))))), React.createElement("br", null))));
}
SlateTranscriptEditor.propTypes = {
  transcriptData: PropTypes.object.isRequired,
  mediaUrl: PropTypes.string.isRequired,
  handleSaveEditor: PropTypes.func,
  handleAutoSaveChanges: PropTypes.func,
  autoSaveContentType: PropTypes.string,
  isEditable: PropTypes.boolean,
  showTimecodes: PropTypes.boolean,
  showSpeakers: PropTypes.boolean,
  title: PropTypes.string,
  showTitle: PropTypes.boolean,
  mediaType: PropTypes.string,
  transcriptDataLive: PropTypes.object
};
SlateTranscriptEditor.defaultProps = {
  showTitle: false,
  showTimecodes: true,
  showSpeakers: true,
  mediaType: 'digitalpaperedit',
  isEditable: true
};