const http = require('voc-http');
const parseDocument = require('voc-dom');
const _ = require('underscore');

/** 
 * Unofficial Promise-based API interface for Vocabulary.com.
 * 
 * Uses Vocabulary.com's JSON API enpoints where possible.
 * Falls back on HTML extraction for some features.
 * */
class VocAPI {

    /**
     * @constructor
     */
    constructor(options) {
        this.PROTOCOL = 'https';
        this.HOST = 'www.vocabulary.com';
        this.URLBASE = `${this.PROTOCOL}://${this.HOST}`;
        this.listNameCache = {};

        this.loggedIn = false;
        this.http = http;

        // option defaults
        this.options = {
            'annotMode': 'src-lit', // scr-lit: use example source with LIT id, comment: use comments
            increaseImportanceForDuplicates: true, // TODO: implement feature
        };

        _.extend(this.options, options ? options : {});
    }

    /**
     * @access private
     * @param {*} res 
     */
    static defaultResHandler(res) {
        if (res.status === 200) {
            return Promise.resolve(res.response);

        } else if (res.status !== 200) {
            return Promise.reject(res.response);
        }
    }

    /**
     * Logs the user in & sets internal cookie auth so that further methods can access
     * account-specific information.
     * 
     * @param {String} username Username for the vocabulary.com account. 
     * @param {String} password Password for the vocabulary.com account.
     */
    login(username, password) {
        const formData = {
            ".cb-autoLogon": 1,
            "autoLogon":	true,
            username,
            password
        };

        return this.http('POST', `${this.URLBASE}/login/`, {
            referer: `${this.URLBASE}/login/`
        }, VocAPI.getFormData(formData)).then(VocAPI.defaultResHandler);
    }
    
    /**
     * Check the login status.
     * 
     * @access private
     */
    checkLogin() {
        if (!this.loggedIn) {
            const requestUrl = `${this.URLBASE}/account/progress`;
            return this.http('GET', requestUrl, {})
                .then(res => {
                    // TODO
                    // if (res.responseURL !== requestUrl) { 
                    //     // response url was not same as requested url: 302 login redirect happened
                    //     return Promise.reject('not logged in');
                    // } else {
                    //     this.loggedIn = true;
                    //     return Promise.resolve('already logged in');
                    // }
                });
         } else {
            return Promise.resolve('already logged in');
        }
    }

    /**
     * @param {*} id 
     */
    getListName(id) {
        if (id in this.listNameCache) {
            return Promise.resolve(this.listNameCache[id]);
        } else {
            return this.getLists().then(lists => {
                let list = lists.find(l => l.wordlistid == id);
                if (list) {
                    this.listNameCache[id] = list.name;
                    return this.listNameCache[id];
                } else {
                    return Promise.reject("List not found");
                }
            })
            .catch(console.warn)
        }
    }

    getListId(name) {
       let key = Object.keys(this.listNameCache).find(id => this.listNameCache[id] === name);
       if (key) {
           return Promise.resolve(this.listNameCache[key]);
       } else {
            return this.getLists().then(lists => {
                let list = lists.find(l => l.name === name);
                if (list) {
                    this.listNameCache[list.wordlistid] = list.name;
                    return list.wordlistid;
                } else {
                    return Promise.reject(new Error("List not found"));
                }
            })
       }
    }

     /**
     * @access private
     * @param {*} id 
     */
    getListNameSync(id) {
        if (id in this.listNameCache) {
            return this.listNameCache[id];
        } else {
            return null;
        }
    }

    /**
     * Gets definition of a word. 
     * @param {String} word the word to get a definition for
     * @returns {Definition} definition in the format. Proper return format documentation TODO, try it out & see what happens!
     */
    getDefinition(word) 
    {
        /* TODO: Response target spec
        *  {
        *  "word": string,
        *  "definition", string      // primary definition (as given by the meta description tag)
        *  "description": string     // the long format description unique to Vocabulary.com
        *  "audioURL": string        // of the form https://audio.vocab.com/1.0/us/C/12RWPXAD427B5.mp3
        *                               // with C/.... being the code, in data-audio on the element
        *                               // document.querySelector('.audio')
        *  "meanings": [       // categories of meanings
        *      {                   // specific meaning
        *          "forms": [          // different forms
        *              {
        *                  "pos": string,          // part of speech: v, n, ...                
        *                  "definition": string,
        *                  "synonyms": [ synonym ],           // TODO: kunnen ook meerdere zijn?
        *                  "subtypes": [                      // subtypes of the word
        *                      { "words": [ string ],   // subtypes
        *                        "defintition": string:
        *                      }
        *                  "supertypes":                   // TODO: only 1?
        *                  {
        *                       "words": [ string ]
        *                       "definition": string
        *                  }
        *              }
        *            ]
        *         }     
        *      ]
        *    }
        *  ]
        * }
        * Primary meanings are, for every meaning, the first form of a given part of speech
        */
        return this.http('GET', `${this.URLBASE}/dictionary/${word}`, {
            referer: `${this.URLBASE}/dictionary`,
            responseType: 'document'
        }).then(({response}) => {
            const doc = parseDocument(response);

            const outObject = {};
            outObject.word = word;

            const topPageEl = doc.querySelector('.wordPage')
            outObject.lang = topPageEl.dataset.lang;
            outObject.learnable = topPageEl.dataset.learnable;

            outObject.short = doc
                .querySelector('.short') // returns p
                .textContent;

            outObject.long = doc
                .querySelector('.long')
                .textContent;

            outObject.meanings = [];

            // full meanings, not primary
            // TODO: tag primary
            // TODO: finish
            const meanings = doc.querySelectorAll('.sense');
            for (let i = 0; i < meanings.length; i++) {
                let m = meanings[i];
                const mOut = {};

                // first of a meaning group
                // if (Array.prototype.indexOf.call(m.parentElement.children, m) === 0) {
                //     mOut.primary = true;
                // } TODO does not work with groups

                mOut.synsetid = /^s(\d+)$/.exec(m.id)[1];
                const d = m.querySelector('.definition');
                mOut.definition = d.childNodes[2].textContent.trim();

                

                outObject.meanings.push(mOut);
            }

            return outObject;
        })
    }

    /**
     * Returns a list of the lists of the logged in user.
     * @returns {Object[]} a list of word lists. Proper return format documentaiton TODO, try it out & see what happens!
     */
    getLists() {
        /* example output
         * [ { wordlistid: 2137002,
                name: 'In The Wild',
                shared: false,
                createdate: '2018-01-25T20:33:41.325Z',
                modifieddate: '2018-12-22T11:14:36.656Z',
                wordcount: 171,
                description: 'Words found in random places on the internet.',
                owner: true,
                activitydate: '2018-12-22T11:14:36.656Z',
                p: 0.34783363,
                ap: 0.19866072 },
         */
        return this.http('GET', `${this.URLBASE}/lists/byprofile.json`, {
                referer: `${this.URLBASE}/dictionary/hacker`,
                responseType: 'json'
            }).then((res) => {
                // options: name, createdate, wordcount, activitydate TODO: make options
                let sortBy = "modifieddate";
                if (res.status === 200) {
                    const lists = res.response.result.wordlists
                        .filter(wl => wl.owner)
                        .sort((a,b) => a[sortBy] > b[sortBy] ? -1 : 1); // high to low
                    
                    // fill cache with names
                    lists.forEach(wl => {
                        this.listNameCache[wl.wordlistid] = wl.name;
                    })
                    return Promise.resolve(lists);
                } else {
                    throw new Error(res.responseText);
                }
            });
   }

    /**
     * Gets the learning progress of a word
     * @param {String} word the word for which to retrieve progress
     * @returns {Object} progress object. Proper return format documentaiton TODO, try it out & see what happens! 
     */
    getProgress(word) {
        return this.http("POST", `${this.URLBASE}/progress/progress.json`, {
                referer: `${this.URLBASE}/dictionary/${word}`,
                responseType: 'json' 
            }, `word=${word}`).then((res) => {
                if (res.status === 200) {
                    if (res.response.lrn === false ) {
                        return Promise.reject('Not learnable');
                    } else {
                        const prog = res.response;
                        const response =  {
                            "word": prog.word,
                            "progress": prog.prg,
                            "priority": prog.pri,
                            "lists": prog.ld, // [{"current":false,"listId":2137002,"wordcount":87,"priority":5,"progress":0.410468,"name":"In The Wild"}]
                            "pos": prog.pos,
                            // I think prog.dif is individual diff, prog.diff is global diff
                            "diff": prog.dif ? prog.dif : prog.diff,
                            "def": prog.def
                            };
                        return response;
                    }
                } else {
                    throw new Error('Bad progress response from API');
                }
        });
    }

    /**
     * Sets the priority for learning a word
     * @param {*} word 
     * @param {*} priority afaik: -1 for low priority (or auto?), 0 high priority
     * @returns {Promise}
     */
    setPriority(word, priority) {


        return this.http('POST', `${this.URLBASE}/progress/setpriority.json`, {
            referer: `${this.URLBASE}/dictionary/${word}`
        }, VocAPI.getFormData({word: word, priority: priority})).then(VocAPI.defaultResHandler);
        // todo: check response & adjust response handler for bad requests/responses
    }

    /**
     * @access private
     * @param {Object} res http response from autoComplete api
     * @returns {Meaning[]} a list of possible word meanings
     */
    static autoCompleteMapper(res) {
        let suggestions = [];
        let doc = parseDocument(res.response);
        let lis = doc.querySelectorAll('li');
        for (let i = 0; i < lis.length; i ++) {
            let el = lis[i];
            let suggestion = {};
            suggestion.lang = el.getAttribute('lang');
            suggestion.synsetid = el.getAttribute('synsetid');
            suggestion.word = el.getAttribute('word');
            suggestion.frequency = el.getAttribute('freq');
            suggestion.definition = el.firstChild.children[2].textContent;
            suggestions.push(suggestion);
        }

        return Promise.resolve(suggestions);
    }

    /**
     * Gives word suggestions for a search term. All suggestions are valid vocabulary.com words. The searchTerm can be a partial word, or slightly misspelled.
     * @param {*} searchTerm searchterm
     * @returns {Meaning[]} a list of possible word meanings (from different words)
     */
    autoComplete(searchTerm) {
        // TODO: re-test in browser
        return this.http('GET', `${this.URLBASE}/dictionary/autocomplete?${VocAPI.getFormData({search: searchTerm})}`)
        .then(VocAPI.autoCompleteMapper);
    }

    /**
     * @typedef {Object} Meaning
     * @property {String} word 
     * @property {definition} frequency Frequency of the usage of this meaning (possibly, not sure)
     * @property {String} synsetid id that identifies this particular meaning
     * @property {String} lang language, always "en" so far
     * @property {number} frequency Frequency of the usage of this meaning (possibly, not sure)
     */

     /**
     * Gives a list of learnable meanings (definitions) of the specific word
     * @param {String} word the word for which to retrieve meanings.
     * @returns {Meaning[]} a list of learnable meanings of the specific word
     */
    getMeanings(word) {
        // TODO: re-test in browser
        // TODO: these only give the learnable meanings. Definition should give full
        return this.http('GET', `${this.URLBASE}/dictionary/autocomplete?${VocAPI.getFormData({search: `word:"${word}"`})}`)
        .then(VocAPI.autoCompleteMapper);
    } 

    /**
     * @access private
     * @param {String} text
     * @returns {Object}
     * {
     *  "format":"list",
     *  "words":[{"word":"test","def":"standardized procedure for measuring sensitivity or aptitude","diff":290,"freq":58.08562}]
     *  "notfound": ['word1'],
     *  "notlearnable": ['word2']}}
     *  NOTE not learnable words are also included in 'words'
     */
    grabWords(text) {
        return this.http('POST', `${this.URLBASE}/lists/vocabgrabber/grab.json`, {
            referer: `${this.URLBASE}`,
            responseType: 'json'
        }, VocAPI.getFormData({text: text}))
        .then(VocAPI.defaultResHandler);
    }

    /**
     * Attempts to correct the word with the nearest available word in Vocabulary.com.
     * Rejects if no word was found.
     * @param {String} word the word to correct
     */
    correctWord(word) {
        return this.autoComplete(word).then(suggestions => {
            if (suggestions) {
                return Promise.resolve(VocAPI.getSimilarFrom(suggestions.map(w => w.word), word));
            } else {
                return Promise.reject('not found in Vocabulary.com');
            }
        });
    }

    /**
     * Provides a measure for the similarity of two words.
     * @access private
     * @param {*} word1 
     * @param {*} word2
     * @returns float between 0 and 1. 1 = one included in the other, 0 = completely unsimilar 
     */
    static similarity(word1, word2) {
        /* test:
        > sim2('speak','spozc')
        0.4000000000000001
        > sim2('pre-eminent','pre-eminently')
        1
        > sim2('pre-eminentitious','pre-eminently')
        0.8461538461538463
        > sim2('cooks','cooking')
        0.8
        */

        // TODO: should give slightly more weight to first letters for inflections/conjugations 
            // eg. speaks ~ speak
            // pre-eminent ~ pre-eminently
            // but this linear model should work too 
        let similarity = 1;
        let minLen = Math.min(word1.length, word2.length);
        let step = 1 / ((minLen === 0) ? 1 : minLen); 
        let i = 0, j = 0;
        while ( i < word1.length && j < word2.length) {
            if (word1[i] !== word2[j]) {
               similarity -= step; 
            }
            i++; j++;
        }
        return similarity;
    }

    static isSimilar(word1, word2, threshold) {
        return VocAPI.similarity(word1, word2) > (threshold ? threshold : 0.6);
    }

    /**
     * @typedef {Object} WordSimilarity
     * @property {String} word 
     * @property {number} similarity similarity to a given word (low 0 - 1 high)
     */

    /**
     * Returns the most similar word string from an array of strings, compared to a given word
     * @access private
     * @param {String[]} arr
     * @param {String} word
     * @returns {WordSimilarity[]} wordSimilarities array of objects with a word string and similarity
     */
    static getSimilarFrom(arr, word) {
        return arr
        .filter(w => VocAPI.isSimilar(w, word))
        // if multiple are similar, select the most similar
        .reduce( (acc, cur) => {    
            let curSimil = VocAPI.similarity(cur, word);
            if (acc.similarity < curSimil) {
                return {word: cur, similarity: curSimil};
            } else { return acc; }
        }, {word: word, similarity: 0}).word;
    };

    /**
     * Bulk-correct a list of word objects.
     * @param {Word[]} words a list of word objects to be corrected
     */
    correctWords(words) {
        /*
        1. grab words
        2. run through in order with a similarity checker
            --> use the 'notfound' key to verify / preprocess ?
            --> 'notlearnable' key exists too (can add and will be in list, but not learnable)
            - combine grabword with local word that is similar (>0.6), ala list merge
            - skip local word that are highly unsimilar, add to not-supported list)
        3. return words with local comments etc + not-supported list
        */
        // convert requested words to a string
        let wordText = "";
        if (words.length > 1) {
            wordText = words.map(w => w.word).join(', ');
        } else if (words.length == 1) {
            wordText = words[0].word + ",";
        } else {
            return Promise.reject("Can't add an empty list");
        }

        return this.grabWords(wordText).then( (result) => {

            console.log(result);

            let merge = (original, grab) => {
                const newWord = {...original};
                newWord.word = grab;
                return newWord;
            }

            let resultWords = result.words.map(w => w.word)
            let mergeResult = [];
            let corrected = [];
            let notfound = result.notfound ? result.notfound : [];
            let notlearnable = result.notlearnable ? result.notlearnable : [];
            let resultIndex = 0;

            let inputs = [];
            
            // loop over originally requested words
            for (let i = 0; i < words.length && resultIndex < resultWords.length; i++) {
                let original = words[i];
                let resultWord = result.words[resultIndex]; 

                // word was not found, skip it
                if (notfound.indexOf(original.word) !== -1) {
                    continue;
                }

                // explanation:
                // if there are multiple words of the same stem, vocab's grabber only takes out one and puts it 
                // in the order of the first one. The variants, if not equal to the stem, are added to the 'input' property
                // TODO: give it higher importance: more appearnces, more important
                // TODO: is desired behavior to have two examples? then change is necessary

                // build inputs
                // TODO: might be done more than once for the same resultIndex
                let currentInput = resultWord.input ? resultWord.input : []; 
                if (currentInput) { // word has more inputs
                    // add word itself for the following check
                    inputs = [resultWord.word, ...currentInput, ...inputs];
                }

                if (inputs.find(w => w === original.word) 
                    && !( currentInput.find(w => w === original.word) || resultWord.word === original.word) ) { // check if current was an input for another one before
                    continue; // skip as well
                    // TODO: add as a second instance of the word before, with new example? as an option
                }

                /* TODO: not necessary: not learnable words are in 'words' --> treat them normally
                // is a similar was found in notlearnable ==> merge & add it
                } else if (getSimilarFrom(notlearnable, original.word)) {
                    mergeResult.push(merge(original, resultWord.word));
                    continue;
                }
                */

                // not in not found, not in not learnable ==> we assume similarity by order
                mergeResult.push(merge(original, resultWord.word));

                if (original.word !== resultWord.word) {
                    corrected.push(original);
                }
                resultIndex++;
            }
            return Promise.resolve({
                words: mergeResult,
                notfound: notfound,
                notlearnable: notlearnable,
                corrected: corrected
                });
        });
    }

    /**
     * @param {String} wordToLearn word
     */
    startLearning(wordToLearn) {
        return this.http('POST', `${this.URLBASE}/progress/startlearning.json`, 
                {referer: `${this.URLBASE}/dictionary/${wordToLearn}`},`word=${wordToLearn}`)
                .then(VocAPI.defaultResHandler);
    }

    /**
     * @param {String} listId list to start learning
     */
    startLearningList(listId) {
        // TODO: test + use in double priority checker with option to auto-start learning if that is not yet so
        return this.http('POST', `${this.URLBASE}/lists/${listId}/start.json`, 
        {referer: `${this.URLBASE}/lists/${listId}`})
        .then(VocAPI.defaultResHandler);
    }

    /**
     * Maps word objects from this API interface's format to voc.com's format
     * Adds some obvious info like date added
     * @access private
     * @param {Word} w word
     */
    wordMapper(w) {
        let nw = {
        "word": w.word,
        "lang": "en"
        }
        w.description ? nw["description"] = w.description : false;
        const now = new Date();
        const pad = (c) => (c+'').length === 1 ? '0' + c : c+'';

        // add example sentence
        if (w.example) {
            // limit example lenght to 500 to prevent errors (vocab restriction)
            // TODO: possibly, if > 500 chars, find word and  extract 500 chars around the word with ... [rest] word [rest] ...
            w.example = w.example.slice(0, 500);
            nw.example = { "text": w.example };
        } else if (w.sentence) {
            nw.example = { "text": w.sentence};
        }
        
        // puts date in word comment depending on options
        if (!this.options || this.options.annotMode && this.options.annotMode === 'comment') {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const hhmm = pad(now.getHours()) + ':' + pad(now.getMinutes());
            const dateString = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} at ${hhmm}.`;
            const locationString = w.location ? `Added from URL: ${w.location} on ${dateString}` : undefined;
            const isolatedDateString = `Added on ${dateString}`;
            
            // add description and URL if present
            if (w.description) {
                nw.description = w.description;
                if (locationString) {
                    nw.description += '\n' + locationString;
                } else {
                    nw.description += '\n' + isolatedDateString;
                }
            } else {
                if (locationString) {
                    nw.description = locationString;
                } else {
                    nw.description = isolatedDateString;
                }
            }
        // puts date in source a source object
        } else if (this.options.annotMode && this.options.annotMode === 'src-lit') {
            const date = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
            let example = {};

            if (w.description) {
                nw.description = w.description;
            }

            if (w.example || w.sentence) {
                nw.example.source = {
                    id: 'LIT', // this special id will allow the source to be shown in lists
                                        // probably stands for non-online 'literature'
                                        // found in voc.com js code
                    href: w.locationString ? w.locationString : undefined,
                    date: date,
                    name: w.title ? w.title : 'Untitled source'
                };
            }
        }

        // adds synsetid if present
        if (w.synsetid) {
            nw.synsetid = w.synsetid;
        }

        return nw;
    }

    /**
     * @typedef {Object} Word
     * @property {string} word the word
     * @property {string} [location] URL location of the word
     * @property {string} [description] description to be added to be attached to the word in a word list
     * @property {string} [example] example or source text containing the word
     */

    /** 
    * Add a given list to an existing list, given by name. The first (most recent) list with that name will be used. 
    * Convenience method that combines getListName and addToList.
    * @param {Word[]} words an array of words to add to the list
    * @param {number} listName name of the list
    * @returns {{"status": status, "result": listId}} statusObject 0 is ok
    */  
    addToListName(words, listName) {
        return this.getListId(listName).then((id) => this.addToList(words, id));
    }

    /** 
    * @param {Word[]} words an array of words to add to the list
    * @param {number} listId id of the list
    * @returns {{"original": String, "corrected": String, "listId": String}} response object 
    */ 
    addToList(words, listId) {
        // single word: use single word correction
        if (words && words.length === 1) {
            let inword = words[0];
            return this.correctWord(inword.word).then((word) => {
                let outword = _.extend({}, inword);
                if (inword.word !== word) {
                    console.log(`${inword.word} corrected to ${word}`);
                    outword.word = word;
                }
                return this.http('POST', `${this.URLBASE}/lists/save.json`, {
                    referer: `${this.URLBASE}/dictionary/${words[0]}`,
                    responseType: "json" 
                }, VocAPI.getFormData({
                    "addwords": JSON.stringify([outword].map(this.wordMapper.bind(this))),
                    "id": listId 
                }))
                .then(VocAPI.defaultResHandler)
                .then((res) => {
                    if (res.status === 1) {
                        throw new Error(res.message, res);
                    } else {
                        return {
                            original: inword,
                            corrected: word,
                            listId: res.result
                        }
                    }
                })
                // increase priority of duplicates
                // TODO: warn that setting priority requires wordlist to be in learning program
                .then( (addedWord) => {
                    if (this.options.increaseImportanceForDuplicates) {
                        this.getList(listId)
                        .then((listSrc) => {
                            // check if already existing in list / TODO do with progress for single?
                            let fi = listSrc.words.find(w => w === addedWord.corrected);
                            if (fi) {
                                this.setPriority(addedWord.corrected, 1).then(); 
                            }
                        });
                    }
                    return addedWord;
                });
            });


        // multiple words: use bulk correction
        // TODO: progress & result handling like above
        } else if (words && words.length > 1) {
            return this.correctWords(words).then((result) => {
                return this.http('POST', `${this.URLBASE}/lists/save.json`, {
                    referer: `${this.URLBASE}/dictionary/${result.words[0]}` 
                }, VocAPI.getFormData({
                    "addwords": JSON.stringify(result.words.map(this.wordMapper.bind(this))),
                    "id": listId 
                }))
                .then(VocAPI.defaultResHandler)
                .then(() => Promise.resolve(result)); // pass info back to requester
                });
        };
    }

    /** 
    * @param words an array of words to add to the new list
    * @param listName name of the new list
    * @param description description of the list
    * @param shared boolean that shows whether list should be shared or not
    */ 
    addToNewList(words, listName, description, shared) {

        let listObj = {
            "name": listName,
            "description": description,
            "action": "create",
            "shared": shared
         };

        return this.correctWords(words).then(result => {
            listObj.words = result.words.map(this.wordMapper.bind(this));
            return this.http('POST', `${this.URLBASE}/lists/save.json`,
            {
                referer: `${this.URLBASE}/lists/vocabgrabber`,
                responseType: 'json' 
            }, VocAPI.getFormData({'wordlist': JSON.stringify(listObj)})).then(VocAPI.defaultResHandler);
        })
     }

    deleteList(listId) {
        return this.http('POST', `${this.URLBASE}/lists/delete.json`, {
            referer: `${this.URLBASE}/lists/${listId}/edit`
        }, VocAPI.getFormData({id: listId}))
        .then(VocAPI.defaultResHandler)
        .then(r => {
            // invalidate cache
            delete this.listNameCache[listId];
            // handle response
            return r;});
    }

    /**
     * Gets a list of words
     * @param {String} listId the ID of the list to get 
     * @returns {Object[]} a list of vocabulary.com word objects
     */
    getList(listId) {
        // TODO
        /* example
            [{"word":"zilch","lang":"en",
                "description":"Added from URL: https://forums.macrumors.com/threads/usb-c-powerba… on Wednesday 6 June 2018 at 14:08.",
                "example":{"text":"So far, zilch.","offsets":[8,13]},"definition":"a quantity of no importance","shortdefinition":"a quantity of no importance",
                "audio":["D/15IWYVT54ZU23"],"ffreq":4.6965513531891756E-4}}]

        // error format: {status: 1, "errortype", "error", "message"}
        */
        return this.http('POST', `${this.URLBASE}/lists/load.json`, {
            referer: `${this.URLBASE}/dictionary/hack`,
            responseType: "json"
        }, VocAPI.getFormData({id: listId}))
        .then(VocAPI.defaultResHandler).then(listSrc => {
            if (listSrc.status === 1) {
                throw new Error(listSrc.message, listSrc);
            } else {
                return listSrc.result;
            }
        });
    }

    /**
     * @param {String} name name of the list
     */
    getListByName(name) {
        // TODO: test
        return this.getListId(name).then(this.getList.bind(this));
    }

    /**
     * Transforms objects of the form {"key": value, "key2": value2} to the form key=value&key2=value2
     * With the values interpreted as strings. They are URL encoded in the process.
     * @access private
     * @param {Object} object 
     */
    static getFormData(object) {
        // const formData = new FormData();
        // Object.keys(object).forEach(key => formData.append(key, object[key]));
        let returnString = '';
        Object.keys(object).forEach((key, index) => returnString += `${index === 0 ? '' : '&'}${key}=${encodeURIComponent(object[key])}`)
        return returnString;
        }
}

// TODO: I'd like to remove this
// the build process is not nice atm
// could be changes if all files relied on import / export / require
// but not possible, see notes in http 
if (process.browser) {
    window.VocAPI = VocAPI;
} else {
    module.exports = VocAPI;
}