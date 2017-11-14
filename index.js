var clientId = '208753608879-qdaikplhf6krlpbl1s8u9n2hobu3ar5o.apps.googleusercontent.com';

if (!/^([0-9])$/.test(clientId[0])) {
    alert('Invalid Client ID - did you forget to insert your application Client ID?');
}
// Create a new instance of the realtime utility with your client ID.
var realtimeUtils = new utils.RealtimeUtils({ clientId: clientId });

//url for mediasite player
var url = "http://sofo.mediasite.com/Mediasite/Play/d64d7806bcc14f95a3c57633bcfd30c31d";

authorize();

// First function called - checks user authenticity
function authorize() {
    var button = document.getElementById('auth_button');
    // Attempt to authorize
    realtimeUtils.authorize(function(response){
        registerTypes();
        if(response.error){
            // Authorization failed because this is the first time the user has used your application,
            // show the authorize button to prompt them to authorize manually.
            button.style.visibility = 'visible';
            button.addEventListener('click', function () {
                realtimeUtils.authorize(function(response){
                    start();
                }, true);
            });
        } else {
            button.style.visibility = 'hidden';
            start();
        }
    }, false);
}

// Function called after authorization is completed
function start() {
    // With auth taken care of, load a file, or create one if there
    // is not an id in the URL.
    var id = realtimeUtils.getParam('id');
    if (id) {
        // Load the document id from the URL
        realtimeUtils.load(id.replace('/', ''), onFileLoaded, onFileInitialize);
    } else {
        // Create a new document, add it to the URL
        realtimeUtils.createRealtimeFile('New Transcript', function(createResponse) {
            window.history.pushState(null, null, '?id=' + createResponse.id);
            realtimeUtils.load(createResponse.id, onFileLoaded, onFileInitialize);
        });
    }
}

var app = {};

/**
 * Generate a random string, used for UUID generation
 */
function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}

/**
 * Realtime API Section object
 */
var Section = function () {};

Section.prototype = {
    initialize: function (startTime, speaker, words) {
        this.id = (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
        this.startTime = startTime;
        this.speaker = speaker;
        this.words = words;
    }
};

/**
 * Realtime API Word object
 */
var Word = function () {};

Word.prototype = {
    initialize: function (value, timestamp, confidence, id) {
        if (!id) {
            this.id = (S4() + S4() + "-" + S4() + "-4" + S4().substr(0,3) + "-" + S4() + "-" + S4() + S4() + S4()).toLowerCase();
        } else {
            this.id = id;
        }
        this.value = value;
        this.timestamp = timestamp;
        this.confidence = confidence;
    }
};

// You must register the custom object before loading or creating any file that
// uses this custom object.
function registerTypes () {
    var custom = gapi.drive.realtime.custom;

    custom.registerType(Section, 'Section');
    Section.prototype.id = custom.collaborativeField('id');
    Section.prototype.startTime = custom.collaborativeField('startTime');
    Section.prototype.speaker = custom.collaborativeField('speaker');
    Section.prototype.words = custom.collaborativeField('words');
    custom.setInitializer(Section, Section.prototype.initialize);

    custom.registerType(Word, 'Word');
    Word.prototype.id = custom.collaborativeField('id');
    Word.prototype.value = custom.collaborativeField('value');
    Word.prototype.timestamp = custom.collaborativeField('timestamp');
    Word.prototype.confidence = custom.collaborativeField('confidence');
    custom.setInitializer(Word, Word.prototype.initialize);
}

// --------------------------------------------- helper methods ----------------------------------------------------


/**
 * Find the index of the word in the section given the word and section idx
 * @param wordId id of the word
 * @param sectionIdx id of the section
 * @returns index of the word in the section
 */
function getWordIndexById(wordId, sectionIdx) {
    var words = app.transcript.get(sectionIdx).words;

    for (var i = 0; i < words.length; i++) {
        if (words.get(i).id === wordId)
            return i;
    }

    // if no word was found, then we assume it's the first word in the section
    return 0;
}

/**
 * Find the index of the section in the transcript given the section id
 * @param sectionId id of the section
 * @returns index of the section in the transcript
 */
function getSectionIndexById(sectionId) {
    var sections = app.transcript;
    for (var i = 0; i < sections.length; i++) {
        if (sections.get(i).id === sectionId)
            return i;
    }
}

/**
 * Create and return a span for a word
 * @param word A realtime api Word object
 * @returns A span object
 */
function createWordElement(word){

    // TODO: color code this here
    var hue = Math.floor((100 - word.confidence) * 120 / 100);  // go from green to red
    var saturation = word.confidence;   // fade to white as it approaches 50
    var color = 'hsl(' + hue + ',' + saturation + '%' + ',' + '0%)';

    var wordElement = $('<span style="display: inline-block">' + word.value + '</span>');
    wordElement.attr('id', word.id);
    wordElement.css('color', color);

    word.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, wordEventListener);

    return wordElement;
}

/**
 * Prints a transcript section by section
 */
function printTranscript(transcript){
    for (var i = 0; i < transcript.length; i++) {
        var section = transcript.get(i);
        // console.log("section id: " + section.id);

        for (var j = 0; j < section.words.length; j++) {
            // console.log(section.words.get(j).value);
        }
    }
}

/**
 * Find the index of the first different character between two strings
 * @param s1 Word 1
 * @param s2 Word 2
 */
function indexOfFirstDifference(s1, s2) {
    // TODO: If 'attt' and you put a 't' after the 'a', cursor will jump to end
    var minLength = Math.min(s1.length, s2.length);

    for (var i = 0; i < minLength; i++){
        if (s1.charAt(i) !== s2.charAt(i)) {
            return i;
        }
    }

    return minLength;
}

/**
 * Keeps the cursor in the expected place
 * @param wordElement The span containing the word being edited/created
 * @param wordLength The length of the edited/created word
 */
function moveCursorToWord(wordElement, wordLength) {

    var range = document.createRange();
    var node = document.getElementById(_.head(wordElement).id);

    range.setStart(node.firstChild, 0);
    range.setEnd(node.firstChild, wordLength);

    var sel = window.getSelection();

    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);

    //console.log(sel);
}

/**
 * Focus at the end of the section element
 *
 * @param sectionToFocus a Section element div that will be focused on
 */
function focusOnSection(sectionToFocus) {
    var sectionToFocusEditor = $('#' + sectionToFocus.id + ' .section-editor');

    // Need to move cursor to the end of previous section editor
    if(sectionToFocusEditor.children().length > 0) {
        var lastWordSpan = sectionToFocusEditor.children().last();
        var word = sectionToFocus.words.get(sectionToFocus.words.length - 1);
        moveCursorToWord(lastWordSpan, word.value.length);
    } else {
        sectionToFocusEditor.focus();
    }
}

// -------------------------------------------- event listener stuff -----------------------------------------------

var x = 1;

/**
 * Given a real time section object, add a listener to deal with adding words to that section
 * @param section A real time api section object
 */
function addListenersForNewWord(section){
    section.words.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, function (event) {
        // console.log(event);
        var wordIndex = event.index;

        for (var i = 0; i < event.values.length; i++) {
            var word = event.values[i];

            var newWordElement = createWordElement(word);

            if (wordIndex === 0) {

                // first word in the section
                $('#' + section.id + ' .section-editor').append(newWordElement);

            } else {

                // find the previous word's span and append after it
                var previousWordId = section.words.get(wordIndex - 1).id;
                $('#' + previousWordId).after(newWordElement);

            }

            wordIndex++;

            // if word was added by this user, move the cursor to the end of the word
            if (event.isLocal) {
                moveCursorToWord(newWordElement, word.value.length);
            }
        }

    });

    section.words.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, function (event) {

        // console.log(event);

        for (var j = 0; j < event.values.length; j++) {
            var deletedWord = event.values[j];
            var deletedWordSpan = $('#' + deletedWord.id);
            var wordListId = event.currentTarget.id;
            deletedWordSpan.remove();

            // find which section this word is in given the words list id
            for (var i = 0; i < app.transcript.length; i++) {
                if (app.transcript.get(i).words.id === wordListId) {
                    var currentSection = app.transcript.get(i);
                    break;
                }
            }

            var currentWordList = currentSection.words;

            if (event.isLocal) {
                var op = _.head(event.compoundOperationNames);
                if (event.index > 0 && op !== 'MERGE') {

                    var previousWord = currentWordList.get(event.index - 1);
                    var previousWordSpan = $('#' + previousWord.id);

                    moveCursorToWord(previousWordSpan, previousWord.value.length);
                }
            }
        }
    });
}

/**
 * Action listener for when a word changes
 * @param event A gapi.drive.realtime.EventType.VALUE_CHANGED event for a Word
 */
function wordEventListener(event) {
    //console.log(event);
    // get the updated word

    if (event.property === 'value') {
        var word = event.target;
        var span = $('#' + word.id);

        span.text(word.value);

        if (event.isLocal) {
            var op = _.head(event.compoundOperationNames);
            var pos = indexOfFirstDifference(event.oldValue, event.newValue);

            if (event.newValue.length < event.oldValue.length) {

                // updated word is smaller, so char deleted or, split

                if (op === 'SPLIT') {
                    //console.log('split word, so move forward one');
                    moveCursorToWord(span, pos + 1);
                } else {
                    //console.log('char deleted by backspace, so stay where you are');

                    var previousSpan = span.prev();

                    if (pos === 0 && previousSpan.length > 0) {

                        // move to the end of last word span
                        moveCursorToWord(previousSpan, previousSpan.text().length);
                    } else {

                        // stay where you are
                        moveCursorToWord(span, pos);
                    }
                }
            } else {

                // updated word is larger, so char added or, merged

                if (op === 'MERGE') {
                    //console.log('Merge, leave the cursor as it is');
                    moveCursorToWord(span, pos);
                } else {
                    //console.log('Char added, move cursor to right');
                    moveCursorToWord(span, pos + 1);
                }

            }
        }
    }
}

/**
 * Given a section object create the section header element
 * @param section A section object
 */
function createSectionHeaderElement(section) {
    var sectionHeaderElement = $('<div class="section-header"></div>');

    sectionHeaderElement.append(createSectionTimeStampElement(section));
    //sectionHeaderElement.append(createSectionSpeakerElement(section));

    return sectionHeaderElement;
}

function formatStartTime(startTime) {
    return secondsToHms(startTime);
}

/**
 * Create the start time label
 * @param section a section object
 */
function createSectionTimeStampElement(section) {
    var sectionTimestampElement = $('<input type="text" size="12" maxlength="16" class="section-timestamp" value="' + formatStartTime(section.startTime) + '" />');

    sectionTimestampElement.on('change textInput input', function() {
        var newStartTime = hmsToSeconds(this.value);

        if (newStartTime) {
            section.startTime = newStartTime;
        }
    });

    sectionTimestampElement.focusout(function () {
        var newStartTime = hmsToSeconds(this.value);

        if (!newStartTime) {
            this.value = secondsToHms(section.startTime);
        }
    });

    section.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function(event){
        if (event.property === 'startTime' && !event.isLocal) {
            sectionTimestampElement.val(formatStartTime(event.newValue));
        }
    });

    return sectionTimestampElement;
}

/**
 * Create the speaker label of a section
 * @param section a section object
 */
function createSectionSpeakerElement(section) {
    var sectionSpeakerElement = $('<input type="text" class="section-speaker" value="' +  section.speaker + '" />');

    sectionSpeakerElement.on('change textInput input', function() {
        if (this.value.length > 0) section.speaker = this.value;
    });

    section.addEventListener(gapi.drive.realtime.EventType.VALUE_CHANGED, function(event){
        if (event.property === 'speaker' && !event.isLocal) {
            sectionSpeakerElement.val(event.newValue);
        }
    });

    sectionSpeakerElement.focusout(function () {
        if (this.value === 0) {
            this.value = section.speaker;
        }
    });

    return sectionSpeakerElement;
}

/**
 * Given the start time and index, inserts a new section at that index
 * @param time the start time of the section
 * @param index where the section needs to be inserted
 */
function createSection(time, index, words) {
    // console.log("insert section");

    var newSection = app.doc.getModel().create(Section, time, 'S' + x++, words);
    app.transcript.insert(index, newSection);
}

/**
 * Splits the current section into two sections
 * @param currentSectionIdx Current section index
 * @param currentWordList Current section's word list
 * @param currentWordIdx Current word's index in the list
 */
function splitSection(currentSectionIdx, currentWordList, currentWordIdx) {
    // Create section on the backend when Enter pressed

    var words = app.doc.getModel().createList();

    app.doc.getModel().beginCompoundOperation('SPLIT:SECTION');

    if (currentWordList.length > 0) {
        words.pushAll(_.slice(currentWordList.asArray(), currentWordIdx == 0? currentWordIdx : currentWordIdx + 1));
        currentWordList.removeRange(currentWordIdx == 0? currentWordIdx : currentWordIdx + 1, currentWordList.length);
    }

    createSection(getPlayerTime(), currentSectionIdx + 1, words);

    app.doc.getModel().endCompoundOperation();
}

/**
 * Returns the previous and next character from the current cursor position.
 * If there is no previous or next character, it returns ' ' (space)
 * @param currentWordList the current section's word list
 * @param currentWordIdx the index of the current word
 * @param currentWord the current word object
 * @param insertIndex the current cursor insert index on the word span
 */
function findPreviousAndNextWords(currentWordList, currentWordIdx, currentWord, insertIndex) {
    var previousChar, nextCharacter;
    //if there is not currentword then the section is empty
    if (!currentWord) {
        previousChar = ' ';
        nextCharacter = ' ';
    } else {
        // find the previous character
        if (insertIndex === 0 && currentWordIdx > 0) {

            // caret at the start of a word and there's a previous word, so previous character = last char of previous word
            var previousWord = currentWordList.get(currentWordIdx - 1);
            previousChar = previousWord.value.charAt(previousWord.value.length - 1); // should always be a space actually

        } else if (insertIndex > 0) {

            // middle of a word, we don't care if anything is before it
            previousChar = currentWord.value.charAt(insertIndex - 1);
        } else {

            // nothing before this caret position, treat as space
            previousChar = ' ';
        }

        // find the next character
        if (insertIndex === currentWord.value.length && currentWordIdx < currentWordList.length - 1){

            //console.log("getting first char of next word");
            // caret at the end of a word and there's a next word. so next character is the first character of the next word
            var nextWord = currentWordList.get(currentWordIdx + 1);
            nextCharacter = nextWord.value.charAt(0);

        } else if (insertIndex < currentWord.value.length) {

            //console.log("getting next char of this word");
            // middle of a word, so we just take the next character of this word
            nextCharacter = currentWord.value.charAt(insertIndex);

        } else {
            // end of the last word in a section
            nextCharacter = ' ';
        }
    }

    return {
        previousChar: previousChar,
        nextChar: nextCharacter
    }
}

/**
 * Edits the current word in the backend
 * @param currentWord the current word
 * @param insertIndex the current cursor index
 * @param event the keypress event
 */
function editCurrentWord(currentWord, insertIndex, event) {
    var updatedWordValue = currentWord.value.substr(0, insertIndex) + event.key + currentWord.value.substr(insertIndex);
    currentWord.value = updatedWordValue;
}

/**
 * Prefixes to the next word
 * @param currentWordList the current word list list of the section
 * @param currentWord the current word
 * @param currentWordIdx the index of the current word in the section
 * @param insertIndex the current cursor index in the span
 * @param event the keypress event
 */
function prefixNextWord(currentWordList, currentWordIdx, currentWord, insertIndex, event) {
    //console.log('Prefix next word');

    if (insertIndex === 0) {
        currentWord.value = event.key + currentWord.value;
    } else {
        var nextWord = currentWordList.get(currentWordIdx + 1);
        nextWord.value = event.key + nextWord.value;
    }
}

/**
 * Inserts  a new word at the given index in the given section
 * @param currentSectionIdx the current section index
 * @param currentWordIdx the current word index
 * @param currentWord the current word
 * @param event the keypress event
 */
function addNewWord(currentSectionIdx, currentWordIdx, currentWord, event) {
    //??? - What was the initial intention here?????
    //var newWord = app.doc.getModel().create(Word, event.key, 100000, '99');
    //landmark
    if (!currentWord) {
        console.log("no current word");
        var newWord = app.doc.getModel().create(Word, event.key, 0, 99);
        app.transcript.get(currentSectionIdx).words.insert(currentWordIdx, newWord);

    } else {
        console.log("there is a current word");
        console.log(`current word time: ${currentWord.time}`);
        console.log(`current word value: ${currentWord.value}`);
        var newWord = app.doc.getModel().create(Word, event.key, currentWord.timestamp, 99);
        app.transcript.get(currentSectionIdx).words.insert(currentWordIdx + 1, newWord);
    }
}

/**
 * Split the current word into two words
 * @param currentSectionIdx the current section index
 * @param currentWordIdx the current word index
 * @param currentWord the current word
 * @param insertIndex the current cursor index in the span
 * @param event the keypress event
 */
function splitWord(currentSectionIdx, currentWordIdx, currentWord, insertIndex, event) {
    //console.log('Split word');

    var updatedCurrentWordValue = currentWord.value.substr(0, insertIndex) + event.key;
    var remainderNewWordValue = currentWord.value.substr(insertIndex);
    var remainderNewWord = app.doc.getModel().create(Word, remainderNewWordValue, currentWord.timestamp, currentWord.confidence);

    app.doc.getModel().beginCompoundOperation('SPLIT');

    app.transcript.get(currentSectionIdx).words.insert(currentWordIdx + 1, remainderNewWord);
    currentWord.value = updatedCurrentWordValue;

    app.doc.getModel().endCompoundOperation();
}

/**
 * Given a section object create the word elements, add to the editor
 * @param section a section object
 */
function createSectionEditorElement(section) {
    var sectionEditorElement = $('<div contentEditable="true" class="section-editor our-form-control"></div>');

    // add a span for each of the words in this section
    for (var i = 0; i < section.words.length; i++){
        sectionEditorElement.append(createWordElement(section.words.get(i)));
    }

    // Keystroke events on the editor
    sectionEditorElement.keypress(function(event) {

        // Get reference to section the edit happened in (objects - backend)

        var currentSectionId = section.id;
        var currentSectionIdx = getSectionIndexById(currentSectionId);
        var currentSection = app.transcript.get(currentSectionIdx);

        // get the span and the text of the span, i.e. word
        var currentWordId = window.getSelection().anchorNode.parentNode.id;

        // get the current word index in the section etc.
        var currentWordIdx = getWordIndexById(currentWordId, currentSectionIdx);
        var currentWordList = app.transcript.get(currentSectionIdx).words;

        if (currentWordList.length > 0) {
            var currentWord = currentWordList.get(currentWordIdx);
        }

        // Creating new section
        //console.log('KEYCODE: ' + event.keyCode);
        if (event.keyCode === 13) {

            event.preventDefault();
            splitSection(currentSectionIdx, currentWordList, currentWordIdx);

            // Any character key pressed
        } else { // TODO: only allow sensible keys here like alpha numeric, spaces etc.

            // character key 'insert' so keep adding to same span
            // Suppress default entering of character
            event.preventDefault();

            // first look at the current caret position
            var sel = window.getSelection();
            var insertIndex = Math.min(sel.anchorOffset, sel.focusOffset);

            // find the surrounding characters
            var surroundingChars = findPreviousAndNextWords(currentWordList, currentWordIdx, currentWord, insertIndex);
            var previousChar = surroundingChars.previousChar;
            var nextCharacter = surroundingChars.nextChar;
            console.log(`Previous character: ${previousChar}`);
            console.log(`Next character: ${nextCharacter}`)
            var isSpace = event.keyCode === 32;
            var prevIsSpace = previousChar === ' ';
            var nextIsSpace = nextCharacter === ' ';

            // if the character added isn't a space and there isn't a space beforehand
            // then we are in the middle/end of a word so we can just append
            if(!isSpace && !prevIsSpace) {
                // Edit current middle
                editCurrentWord(currentWord, insertIndex, event);
            }
            // if there is a space beforehand, but not after we have to
            // have to prefix the next word
            else if(!isSpace && prevIsSpace && !nextIsSpace) {
                // Edit next word (prefix)
                prefixNextWord(currentWordList, currentWordIdx, currentWord, insertIndex, event);

            }

            //if there is a space on either side and the charcater added is not
            // a space then we must add a new word!
            else if(!isSpace && prevIsSpace && nextIsSpace) {
                // New word
                addNewWord(currentSectionIdx, currentWordIdx, currentWord, event);
                //landmark
            }

            // if the character is a space and the prev/afters aren't
            // then we must split the current word
            else if(isSpace && !prevIsSpace && !nextIsSpace) {
                // Split word
                splitWord(currentSectionIdx, currentWordIdx, currentWord, insertIndex, event);
                //landmark
            }

            // if the character is a space and the previous character is a letter and we are at the last word
            // appeand a space to the word
            else if(isSpace && !prevIsSpace && nextIsSpace && currentWordIdx === currentWordList.length - 1) {

                //console.log("Append space to current word");
                currentWord.value = currentWord.value + event.key;

            } else if(isSpace && prevIsSpace) {
                // Ignore
                //console.log('ignore whitespace')
            }
        }
    });

    sectionEditorElement.keydown(function (event) {

        // console.log(event);

        //Move section up
        //Keycode 38 = CTRL+ALT+UP
        if(event.keyCode === 38 && event.ctrlKey && event.altKey) {
            var currentSectionId = section.id;
            var currentSectionIdx = getSectionIndexById(currentSectionId);
            if(currentSectionIdx > 0) {
                app.transcript.move(currentSectionIdx, currentSectionIdx - 1);
            }
        }

        //Move section down
        //Keycode 40 = CTRL+ALT+DOWN
        if(event.keyCode === 40 && event.ctrlKey && event.altKey) {
            var currentSectionId = section.id;
            var currentSectionIdx = getSectionIndexById(currentSectionId);
            if(currentSectionIdx < app.transcript.length - 1) {
                // Has to be +2 because moves to 'just before' destination index
                app.transcript.move(currentSectionIdx, currentSectionIdx + 2);
            }
        }

        if (event.keyCode == 37 && event.shiftKey) {
            event.preventDefault();
            var currentSectionId = section.id;
            var currentSectionIdx = getSectionIndexById(currentSectionId);

            if(currentSectionIdx > 0) {
              console.log("Moving back");
              var upSection = app.transcript.get(currentSectionIdx - 1);
              console.log(`going to time: ${upSection.startTime}`);
              scrollToSection(upSection);
              setPlayerTime(upSection.startTime);
              $(`#${UpSection.id} .section-editor`).focus();

            }

            else {
              setPlayerTime(section.startTime);
            }
        }

        if (event.keyCode == 39 && event.shiftKey) {
          event.preventDefault();
          var currentSectionId = section.id;
          var currentSectionIdx = getSectionIndexById(currentSectionId);

          if(currentSectionIdx < app.transcript.length - 1) {
              var downSection = app.transcript.get(currentSectionIdx + 1);
              scrollToSection(downSection);
              setPlayerTime(downSection.startTime);
              $(`#${downSection.id} .section-editor`).focus();
          }

          else {
            setPlayerTime(player.getDuration);
          }
        }

        if (event.keyCode == 8 && event.shiftKey) {
          event.preventDefault();
          setPlayerTime(section.startTime);
        }

        if(event.keyCode == 32 && event.shiftKey) {
          event.preventDefault();
          togglePlayPause();
        }

        if(event.keyCode === 8 && !event.shiftKey) {
            event.preventDefault();

            // Get reference to section the edit happened in (objects - backend)
            var currentSectionId = section.id;
            var currentSectionIdx = getSectionIndexById(currentSectionId);
            var currentSection = app.transcript.get(currentSectionIdx);

            // get the span and the text of the span, i.e. word
            var currentWordId = window.getSelection().anchorNode.parentNode.id;

            // get the current word index in the section etc.
            var currentWordIdx = getWordIndexById(currentWordId, currentSectionIdx);
            var currentWordList = app.transcript.get(currentSectionIdx).words;

            if (currentWordList.length > 0) {
                var currentWord = currentWordList.get(currentWordIdx);
            }

            // first look at the current caret position
            var sel = window.getSelection();
            var insertIndex = Math.min(sel.anchorOffset, sel.focusOffset);

            // if you are at the beginning of a section, insertIndex = 0, ignore it
            if (insertIndex > 0) {

                var prevChar = currentWord.value.charAt(insertIndex - 1);

                if (prevChar === ' ') {

                    // if there is a next word, merge with it
                    if (currentWordIdx < currentWordList.length - 1) {
                        mergeWords(currentWordList, currentWordIdx, currentWord, insertIndex);
                    } else {

                        //console.log("delete last space");
                        // no next word, just delete the space
                        var updatedWordVal = currentWord.value.slice(0, insertIndex - 1) + currentWord.value.slice(insertIndex);
                        currentWord.value = updatedWordVal;
                    }
                } else {
                    var updatedWordVal = currentWord.value.slice(0, insertIndex - 1) + currentWord.value.slice(insertIndex);

                    if (updatedWordVal === ' ' || updatedWordVal.length === 0) {
                        //console.log("delete word");
                        // deleting the char actually deletes the word
                        currentWordList.remove(currentWordIdx);
                    } else {
                        //console.log("delete last char");
                        currentWord.value = updatedWordVal;
                    }
                }

            } else {
                // At beginning of section, if no words in section delete it and get focus of previous section
                if(currentSection.words.length === 0 && app.transcript.length > 1) { // > 1 because don't want to delete only section!
                    //console.log('delete section ' + currentSectionIdx);
                    app.transcript.remove(currentSectionIdx);
                } else if (currentSectionIdx > 0) {
                    // there is a previous section, merge with it
                    mergeSections(currentSectionIdx, currentWordList);
                }
            }

        }

    });

    return sectionEditorElement;
}

/**
 * Merge this word with the previous word
 * @param currentWordIdx the index of current word
 * @param currentWordList the word list of current word
 * @param currentWord the current word
 * @param insertIndex the current index of the caret postion
 */
function mergeWords(currentWordList, currentWordIdx, currentWord, insertIndex) {
    //console.log("merge words");
    //TODO: If there are multiple spaces and caret is between two spaces - don't merge
    var nextWordVal = currentWordList.get(currentWordIdx + 1).value;
    var updatedWordVal = currentWord.value.slice(0, insertIndex - 1) + currentWord.value.slice(insertIndex) + nextWordVal;

    app.doc.getModel().beginCompoundOperation('MERGE');
    currentWordList.remove(currentWordIdx + 1);
    currentWord.value = updatedWordVal;
    app.doc.getModel().endCompoundOperation();
}

/**
 * Merge this section with the previous section
 * @param currentSectionIdx the current section index
 * @param currentWordList the current section's word list
 */
function mergeSections(currentSectionIdx, currentWordList) {
    app.doc.getModel().beginCompoundOperation('MERGE:SECTION');

    app.transcript.get(currentSectionIdx - 1).words.pushAll(currentWordList.asArray());
    app.transcript.remove(currentSectionIdx);

    app.doc.getModel().endCompoundOperation();
}

/**
 * Add a section element with all the words and the editor etc. our main function
 * @param section A real time section object
 */
function createSectionElement(section){

    // create a section element for this section object
    var sectionElement = $('<div class="section"></div>');

    sectionElement.attr('id', section.id);
    sectionElement.append(createSectionHeaderElement(section));
    sectionElement.append(createSectionEditorElement(section));

    // add the listeners for adding new words
    addListenersForNewWord(section);

    return sectionElement;
}

// The first time a file is opened, it must be initialized with the
// document structure. This function will add a collaborative string
// to our model at the root.
// TODO: here we would retrieve the automated transcript (word by word) and then create our first version of the real time transcript
function onFileInitialize(model) {

    var transcript = createTranscriptObject(asrJson, model);

    model.getRoot().set('transcript', transcript);

}

// After a file has been initialized and loaded, we can access the
// document. We will wire up the data model to the UI.
function onFileLoaded(doc) {

    // backup for local use
    app.doc = doc;
    app.transcript = doc.getModel().getRoot().get('transcript');

    // add the existing sections
    for (var i = 0; i < app.transcript.length; i++) {
        $("#transcript").append(createSectionElement(app.transcript.get(i)));
    }

    // event listeners for adding/removing sections
    app.transcript.addEventListener(gapi.drive.realtime.EventType.VALUES_ADDED, sectionAddEventListener);
    app.transcript.addEventListener(gapi.drive.realtime.EventType.VALUES_REMOVED, sectionRemoveEventListener);

    printTranscript(app.transcript);
}

/**
 * Event listener for adding a Section object to Transcript
 * @param event gapi.drive.realtime.EventType.VALUES_ADDED event for Transcript
 */
function sectionAddEventListener(event) {

    // console.log(event);

    // first add the section
    for (var i = 0; i < event.values.length; i++) {

        var id;

        if(_.isNull(event.movedFromIndex)) {

            var newSection = event.values[i];
            var newSectionElement = createSectionElement(newSection);

            // Just adding a new section, will always be after existing previous section
            id = app.transcript.get(event.index - 1).id;
            $('#' + id).after(newSectionElement);

            if (event.isLocal) focusOnSection(newSection);

        } else {

            // section add event happened because of moving sections
            var fromIdx = event.movedFromIndex;
            var toIdx = event.index;
            var currentSectionElement, insertionSectionElement;
            if(fromIdx > toIdx) {
                // Moving up, insert before
                id = app.transcript.get(toIdx).id;
                currentSectionElement = $('#' + id);
                insertionSectionElement = currentSectionElement.prev();
                currentSectionElement.detach().insertBefore(insertionSectionElement);
            } else {
                id = app.transcript.get(toIdx-1).id;
                currentSectionElement = $('#' + id);
                insertionSectionElement = currentSectionElement.next();
                currentSectionElement.detach().insertAfter(insertionSectionElement);
            }

            if (event.isLocal) currentSectionElement.find('.section-editor').focus();
        }
    }

}

/**
 * Event listener for removing a section object from Transcript
 * @param event gapi.drive.realtime.EventType.VALUES_REMOVED event for Transcript
 */
function sectionRemoveEventListener(event) {

    // console.log(event);

    // if the remove is because of moving sections, don't delete from DOM
    if(!_.isNull(event.movedToIndex)) return;

    // first remove the section
    var idx = event.index;
    for (var i = 0; i < event.values.length; i++) {
        var oldSection = event.values[i];
        $('#' + oldSection.id).remove();

        // move the caret if done by this user
        if (event.isLocal) {
            var sectionToFocus;

            if (idx > 0) {
                // try to move the caret to previous section
                sectionToFocus = app.transcript.get(idx - 1);
            } else {
                // if no previous section, keep it on the current section
                sectionToFocus = app.transcript.get(idx);
            }

            focusOnSection(sectionToFocus);
        }
    }

}

function createTranscriptObject(asrJson, model) {
    var transcript = model.createList();

    //var section = undefined;
    //var speakerIdx = 0;
    //var speaker = asrJson.speakers[speakerIdx].name;
    //var spkStartTime = parseFloat(asrJson.speakers[speakerIdx].time);
    //var speakerSwitchTime = spkStartTime + parseFloat(asrJson.speakers[speakerIdx].duration);
    /*
    asrJson.words.forEach(function (word, idx){

        if (word.time >= speakerSwitchTime) {
            speakerIdx++;
            speaker = asrJson.speakers[speakerIdx].name;
            spkStartTime = parseFloat(asrJson.speakers[speakerIdx].time);
            speakerSwitchTime = spkStartTime + parseFloat(asrJson.speakers[speakerIdx].duration);
            //New speaker so new section
            section = model.create(Section, spkStartTime, speaker, model.createList());
            transcript.push(section);
        }

        // create section at this word if necessary
        if(transcript.length === 0) {
            //Create first section
            section = model.create(Section, spkStartTime, speaker, model.createList());
            transcript.push(section);
        } else {
//                if(idx > 0) {
//                    if(asrJson.words[idx-1].name === '.') {
//                        // Last word was a full stop, new section time
//                        section = model.create(Section, word.time, 'Default S0', model.createList());
//                        transcript.push(section);
//                    }
//                }
        }

        // Check next word is not a full stop for space adding algorithm
        if(idx < asrJson.words.length -1) {
            if (asrJson.words[idx].name === '.') {

            } else if(asrJson.words[idx+1].name === '.') {
                // Next word is a full stop, don't add a space
                section.words.push(model.create(Word, word.name + '.' + ' ', word.time, word.confidence));
            } else {
                // Next word is not a full stop, add a space to the current word
                section.words.push(model.create(Word, word.name + ' ', word.time, word.confidence));
            }
        } else if (asrJson.words[idx].name !== '.') {
            section.words.push(model.create(Word, word.name, word.time, word.confidence));
        }

    });*/

    var section = model.create(Section, 0, 'MediaSite', model.createList());
    transcript.push(section);
    var captions = player.getCaptions();
    var captionStart = 0;
    var captionEnd = 0;
    var captionDuration = 0;

    //If the last non-whitespace was a full stop.
    //TODO: Make checks more efficient
    seenDot = false;
    captions.forEach(function(item, idx, arr) {
      captionStart = item.time === undefined? captionStart : item.time;
      captionEnd = item.endTime === undefined? captionEnd : item.endTime;
      captionDuration = captionEnd - captionStart;
      console.log(`caption time: ${captionStart}`);
      var wordList = item.text.split(" ");
      wordList.forEach(function(currentWord, i, words) {
        var whitespace = /\S/.test(currentWord);
        if (whitespace) {
          if (currentWord.slice(-1) == '.') {
            section.words.push(model.create(Word, currentWord, captionStart, 0.5));
            seenDot = true;
          }

          else {
            if (seenDot) {
              section = model.create(Section, captionStart, 'MediaSite', model.createList());
              transcript.push(section);
              seenDot = false;
            }
            var newWord = currentWord + ' ';
            //alert(`printing new word: ${newWord}`);
            section.words.push(model.create(Word, newWord, captionStart, 0.5));
          }
        }
      });
    });

    //alert("returning transcript");
    return transcript;
}

//TODO: delete once reading from server is done
var asrJson = {
    "job": {
        "lang": "en-GB",
        "user_id": 2954,
        "name": "JKzcd46j1wFMyq5vdGiN8l0p.mp3",
        "duration": 3333,
        "created_at": "Mon Mar 27 09:52:33 2017",
        "id": 2246722
    },
    "speakers": [
        {
            "duration": "20.590000",
            "confidence": null,
            "name": "M7",
            "time": "61.780000"
        }
    ],
    "words": [
        {
            "duration": "0.050000",
            "confidence": "0.670",
            "name": "I",
            "time": "61.780000"
        },
        {
            "duration": "0.100000",
            "confidence": "0.640",
            "name": "was",
            "time": "61.870000"
        },
        {
            "duration": "0.310000",
            "confidence": "0.640",
            "name": "reminded",
            "time": "62.020000"
        },
        {
            "duration": "0.060000",
            "confidence": "0.640",
            "name": "of",
            "time": "62.350000"
        },
        {
            "duration": "0.700000",
            "confidence": "0.650",
            "name": "Moses",
            "time": "62.420000"
        },
        {
            "duration": "0.210000",
            "confidence": "0.870",
            "name": ".",
            "time": "63.130000"
        },
        {
            "duration": "0.330000",
            "confidence": "1.000",
            "name": "This",
            "time": "63.480000"
        },
        {
            "duration": "0.270000",
            "confidence": "1.000",
            "name": "is",
            "time": "63.870000"
        },
        {
            "duration": "0.530000",
            "confidence": "0.680",
            "name": ".",
            "time": "64.530000"
        }],
    "format": "1.0"
};
//------------------------------------------------ PLAYER RELATED -------------------------------------

document.addEventListener('keydown', doc_keyDown, false);
document.addEventListener('keyup', doc_keyUp, false);

// Variable to keep track of F9 key being held down
var playKeyDown = false;

function doc_keyUp(event) {
    //f9 key released will pause audio
    if(event.keyCode === 120 && playKeyDown) {
        playKeyDown = false;
        togglePlayPause();
    }
}

function doc_keyDown(event) {

    //F7 rewind 10 seconds
    if(event.keyCode === 118 && event.ctrlKey) {
        var time = getPlayerTime();
        var cor = time < 10? 0 : time - 10;
        setPlayerTime(cor);
    }

    //F8 forward 10 seconds
    if(event.keyCode === 119 && event.ctrlKey) {
        var time = getPlayerTime();
        var duration = getDuration();
        var cor = duration - time < 10? duration : time + 10;
        setPlayerTime(cor);
    }

    //F9 key held down will play
    if(event.keyCode === 120 && !playKeyDown) {
        playKeyDown = true;

        if (!playing) {
          togglePlayPause();
        }
    }
}

var player;
// added global variable to store controller object (mediasite)
var controls;

function getPlayerReference() {
  player = new Mediasite.Player( "basicPlayer",
    {
      url: url + (url.indexOf("?") == -1 ? "?" : "&") + "player=MediasiteIntegration"
    });

  controls = new Mediasite.PlayerControls(player, "basicPlayer-controls",
    {
      imageSprite: "url(MediasitePlayerControls.png)"
    });

    //player.ontimeupdate = moveCursorByPlayer;
    player.addHandler("currenttimechanged", moveCursorByPlayer);
    //player.onplaying = updatePlayingState;
    //TODO: Take playing state directly from API for mediastate player
    player.addHandler("playstatechanged", updatePlayingState);
    //player.onpause = updatePlayingState;
}

// Needs to be set to true as event triggers when the player first loads
// Could be more lightweight maybe?
var playing = false;
function updatePlayingState(eventData) {
    //playing = !playing;
    state = eventData.playState;
    if (state == "playing") {
      playing = true;
    }
    else {
      playing = false;
    }
}

function togglePlayPause() {
    if(playing) {
        player.pause();
    } else {
        player.play();
    }
}

/**
 * Get the current player time in seconds
 *
 * @returns {double} SS.sssssss
 */
function getPlayerTime() {
    return player.getCurrentTime();
}

/**
* Get the length of the current video
*
* @returns {double} SS.sssssss
*/
function getDuration() {
  return player.getDuration();
}

/**
 * Set the player to the provided time in seconds
 *
 * @param time start-time in seconds
 */
function setPlayerTime(time) {
    //player.currentTime = time;
    player.seekTo(time);
}

/**
 * Format SS.sss to HH:MM:SS, sss
 *
 * @param d time in seconds
 * @returns {string} formatted time stamp string
 */
function secondsToHms(d) {
    d = Number(d);
    //console.log(d);

    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);
    var ms = d - Math.floor(d);
    ms = Math.floor(ms*1000);

    h = ('00' + h).slice(-2);
    m = ('00' + m).slice(-2);
    s = ('00' + s).slice(-2);

    return (h+':'+m+':'+s+', '+ms);
}

/**
 * Convert a timestamp string to milliseconds
 * @param timestamp A string containing at least HH:MM:SS, SSS
 */
function hmsToSeconds(timestamp) {
    var dateRegex = /\d\d\s*:\s*\d\d\s*:\s*\d\d\s*,\s*\d\d\d/;
    var timestamp = _.head(timestamp.match(dateRegex));

    if (timestamp) {
        var parts = timestamp.split(',');

        var hms = parts[0].split(':');
        var ms = +parts[1] / 1000;
        var hours = +hms[0] * 3600;
        var minutes = +hms[1] * 60;
        var seconds = +hms[2];

        return hours + minutes + seconds + ms;
    }
}

var currentWordId, currentSectionId;

/**
 * Detect when caret is moved between characters or sections to update player time
 */
document.onselectionchange = trackAudioByCursor;

function trackAudioByCursor() {
    if(playing) return;

    var sel = window.getSelection();
    if(!sel.anchorNode) return;

    var wordId = sel.focusNode.parentNode.id;
    var sectionId = sel.anchorNode.parentNode.parentNode.parentNode.id;
    // If section blank, means no words in section, update sectionId
    sectionId = (sectionId === '') ? sel.anchorNode.parentNode.id : sectionId;

    if(wordId !== currentWordId) {
        //Update current element caret position
        currentWordId = wordId;
        currentSectionId = sectionId;

        var sectionIdx = getSectionIndexById(sectionId);
        if(sectionIdx > -1) {
            var wordIdx = getWordIndexById(wordId, sectionIdx);

            var section = app.transcript.get(sectionIdx);
            var time = 0;

            if(section.words.length > 0) {
                // Words
                time = section.words.get(wordIdx).timestamp;
            } else {
                // Empty
                time = section.startTime;
            }
            setPlayerTime(time);
        }
    }
};

function scrollToSection(section) {
  var sectionElement = document.getElementById(section.id);
  var transcriptElement = document.getElementById("transcript");
  transcriptElement.scrollTop = sectionElement.offsetTop;
}

function moveCursorByPlayer(eventData) {
    if(!playing) return;
    var time = eventData.currentTime;
    //TODO: Change this loop to binary search sections also
    for (var i = 0; i < app.transcript.length; i++) {
        var section = app.transcript.get(i);
        var lastWordIdx = section.words.length - 1;
        if(time < section.words.get(lastWordIdx).timestamp) {
            //word to seek to is within this section
            var wordIdx = binarySearch(section.words, time, intLessThan, "timestamp");
            targetTime = section.words.get(wordIdx).timestamp;
            sameTime = true;
            while(sameTime && wordIdx > 0) {
              if (section.words.get(wordIdx-1).timestamp == targetTime) {
                wordIdx = wordIdx - 1;
              }

              else {
                sameTime = false;
              }
            }
            var id = section.words.get(wordIdx).id;
            var wordSpan = $('#' + id);
            // Be smarter
            scrollToSection(section);
            moveCursorToWord(wordSpan,0);
            //Found index, cancel loop
            break;
        }
    }
}

/**
 * A binary search algorithm with closest matching capability
 *
 * @param arr Array to be searched
 * @param find Element to find
 * @param comparator
 * @returns Index of word to seek to in section
 */
binarySearch = function(arr, find, comparator, property) {
    var low = 0, high = arr.length - 1, i, comparison, prev_comparison;
    while (low <= high) {
        i = Math.floor((low + high) / 2);
        comparison = comparator(arr.get(i)[property], find);
        prev_comparison = comparison;
        if (comparison < 0) { low = i + 1; continue; }
        if (comparison > 0) { high = i - 1; continue; }
        return i;
    }
    if (prev_comparison < 0) {
        var option_low = i;
        var option_high = (i+1 < high) ? i+1 : high;
    } else {
        var option_low = (i-1 > 0) ? i-1 : 0;
        var option_high = i;
    }
    var dist_a = find - arr.get(option_low)[property];
    var dist_b = arr.get(option_high)[property] - find;
    if (dist_a < dist_b) {
        return option_low;
    } else {
        return option_high;
    }
    return null;
};

//TODO change comparator to something more appropriate for timestamps
intLessThan = function(a,b) {
    if (a < b) {
        return -1;
    } else if (a > b) {
        return 1;
    } else {
        return 0;
    }
};
