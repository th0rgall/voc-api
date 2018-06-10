/** 
 * Promise based API interface for Vocabulary.com
 * 
 * Uses Vocabulary.com's unofficial JSON API where possible.
 * Falls back on HTML extraction for definitions and word list content.
 * */
class VocAPI {

    constructor() {
        this.PROTOCOL = 'https';
        this.HOST = 'www.vocabulary.com';
        this.URLBASE = `${this.PROTOCOL}://${this.HOST}`;
        this.listNameCache = {};

        this.loggedIn = false;

        this.setReferrerInterceptor([
            `${this.URLBASE}/progress/*`,
            `${this.URLBASE}/lists/byprofile.json`, 
            `${this.URLBASE}/lists/save.json`,
            `${this.URLBASE}/lists/delete.json`,
            `${this.URLBASE}/lists/vocabgrabber/grab.json`,
            `${this.URLBASE}/lists/load.json`]);
    }

    /**
     * 
     * @param {*} method 
     * @param {*} url 
     * @param {*} options
     *                  {
     *                      referer: to set a specific referrer header,
     *                      reponseType:        - default document
     *                      credentials: boolean - default true 
     *                  } 
     * @param {*} data for POST or PUT 
     */
    http(method, url, options, data) {
        return new Promise((resolve, reject) => {
            let req = new XMLHttpRequest();
            req.open(method.toUpperCase(), url, true);
            // headers
            req.withCredentials = true;
            req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            let sendReg = /PUT|POST/i;
            if (method.match(sendReg)) {
                req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
            }
            // defaults
            req.responseType = 'document';
            req.withCredentials = true; 
            // options
            if (options) {
                if (options.referer) {
                    req.setRequestHeader("set-referer", options.referer);
                }
                if ( options.responseType ) req.responseType = options.responseType;
                if ( options.credentials ) req.withCredentials = options.credentials;
            }
            // generic response handler
            req.addEventListener("load", (response) => {
                resolve(req);
            });
            // send request
            if (method.match(sendReg)) {
                req.send(data);
            } else {
                req.send();
            }
        });
     }

    static defaultResHandler(res) {
        if (res.status == 200) {
            return Promise.resolve(res.response);

        } else if (res.status != 200) {
            return Promise.reject(res.response);
        }
    }
    
    /**
     * log-in check
     */
    checkLogin() {
        if (!this.loggedIn) {
            const requestUrl = `${this.URLBASE}/account/progress`;
            return this.http('GET', requestUrl, {})
                .then(res => {
                    if (res.responseURL !== requestUrl) { 
                        // response url was not same as requested url: 302 login redirect happened
                        return Promise.reject('not logged in');
                    } else {
                        this.loggedIn = true;
                        return Promise.resolve('already logged in');
                    }
                });
         } else {
            return Promise.resolve('already logged in');
        }
    }

    getListName(id) {
        if (id in this.listNameCache) {
            return Promise.resolve(this.listNameCache[id]);
        } else {
            return Promise.reject('Name not found in cache');
        }
    }

    getListNameSync(id) {
        if (id in this.listNameCache) {
            return this.listNameCache[id];
        } 
    }

    /**
     * @returns definition in the format
     * 
     * {
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
     * 
     * Primary meanings are, for every meaning, the first form of a given part of speech
     */
    getDefinition(word) 
    {
        /* stub */
        return "Not implemented."
    }

    /**
     * 
     */
    getLists() {
        return this.http('GET', `${this.URLBASE}/lists/byprofile.json`, {
                referer: `${this.URLBASE}/dictionary/hacker`,
                responseType: 'json'
            }).then((res) => {
                // options: name, createdate, wordcount, activitydate TODO: make options
                let sortBy = "modifieddate";
                if (res.status == 200) {
                    const lists = res.response.result.wordlists
                        .filter(wl => wl.owner)
                        .sort((a,b) => a[sortBy] > b[sortBy] ? -1 : 1); // high to low
                    
                    // fill cache with names
                    lists.forEach(wl => {
                        this.listNameCache[wl.wordlistid] = wl.name;
                    })
                    return Promise.resolve(lists);
                } else {
                    console.log(`Error: ` + res.responseText);
                    return Promise.reject();
                }
            });
   }

    /**
     * 
     */
    progress(word) {
        return this.http("POST", `${this.URLBASE}/progress/progress.json`, {
                referer: `${this.URLBASE}/dictionary/${word}`,
                responseType: 'json' 
            }, `word=${word}`).then((res) => {
                if (res.status = 200) {
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
                        return Promise.resolve(response);
                    }
                } else {
                    return Promise.reject('Bad response');
                }
        });
    }

    /**
     *  
     * @param {*} word 
     * @param {*} priority afaik: -1 for low priority, 0 for auto, 1 for  
     */
    setPriority(word, priority) {
        return this.http('POST', `${this.URLBASE}/progress/setpriority.json`, {
            referer: `${this.URLBASE}/dictionary/${word}`
        }, VocAPI.getFormData({word: word, priority: priority})).then(VocAPI.defaultResHandler);
        // todo: check response & adjust response handler for bad requests/responses
    }

    /**
     * Gives possible words for a search term 
     * @param {*} searchTerm searchterm
     * @returns a list of suggestion objects in the  form: 
     * {
     *    "word": string word,
     *    "lang": string lang - probably 'en',
     *    "synsetid": string (number) the id of the 'meaning' of the word - multiple meanings are possible!
     *    "frequency": string (number) I dunno. Frequency of appearance in texts, like shown on definition pages?
     *    "definition": string - short definition of the word 
     * }
     * 
     * TODO: you can do search=word:"word" for an exact search
     */
    autoComplete(searchTerm) {
        return this.http('GET', `${this.URLBASE}/dictionary/autocomplete?${VocAPI.getFormData({search: searchTerm})}`)
        .then(res => {
            let suggestions = []
            let lis = res.response.querySelectorAll('li');
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
        });
    }

    /**
     * @returns 
     *  {"format":"list",
     *  "words":[{"word":"test","def":"standardized procedure for measuring sensitivity or aptitude","diff":290,"freq":58.08562}]
     *  "notfound": ['word1'],
     *  "notlearnable": ['word2']}
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
     * Corrects the word with the nearest available word in Vocabulary.com
     * Rejects if no word was found.
     * @param {*} word 
     */
    correctWord(word) {
        return this.autoComplete(word).then(suggestions => {
            if (suggestions) {
                return Promise.resolve(suggestions[0].word);
                // TODO: do a manual similarity/family test before passing through?
            } else {
                return Promise.reject('not found in Vocabulary.com');
            }
        });
    }

    /**
     * Provides a measure for the similarity of two words.
     * @param {*} word1 
     * @param {*} word2
     * @returns float between 0 and 1. 1 = one included in the other, 0 = completely unsimilar 
     */
    similarity(word1, word2) {
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

    isSimilar(word1, word2, threshold) {
        return this.similarity(word1, word2) > (threshold ? threshold : 0.6);
    }

    /**
     * bulk-correct a list of words 
     * @param {*} words 
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
        let wordText = words.map(w => w.word).join(', ');

        return this.grabWords(wordText).then( (result) => {

            let getSimilarFrom = (arr, word) => {
                return arr
                .filter(w => this.isSimilar(w, word))
                // if multiple are similar, select the most similar
                .reduce( (acc, cur) => {    
                    let curSimil = this.similarity(cur, word);
                    if (acc.similarity < curSimil) {
                        return {word: cur, similarity: curSimil};
                    } else { return acc; }
                }, {word: undefined, similarity: 0}).word;
            };

            let merge = (original, grab) => {
                return {
                    word: grab,
                    description: original.description,
                    example: original.example
                };
            }

            let resultWords = result.words.map(w => w.word)
            let mergeResult = [];
            let corrected = [];
            let notfound = result.notfound ? result.notfound : [];
            let notlearnable = result.notlearnable ? result.notlearnable : [];
            let resultIndex = 0;
            // loop over originally requested words
            for (let i = 0; i < words.length && resultIndex < resultWords.length; i++) {
                let original = words[i];
                if (notfound.indexOf(original.word) !== -1) {
                    continue;
                }
                /* TODO: not necessary: not learnable words are in 'words' --> treat them normally
                // is a similar was found in notlearnable ==> merge & add it
                } else if (getSimilarFrom(notlearnable, original.word)) {
                    mergeResult.push(merge(original, resultWords[resultIndex]));
                    continue;
                }
                */
                // not in not found, not in not learnable ==> we assume similarity by order
                mergeResult.push(merge(original, resultWords[resultIndex]));
                if (original.word !== resultWords[resultIndex]) {
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
     * @param wordToLearn as a plain word
     */
    startLearning(wordToLearn) {
        return this.http('POST', `${this.URLBASE}/progress/startlearning.json`, 
                {referer: `${this.URLBASE}/dictionary/${wordToLearn}`},`word=${wordToLearn}`)
                .then(VocAPI.defaultResHandler);
    }

    /**
     * Maps word objects from this API interface's format to voc.com's format
     * Adds some obvious info
     * @param {} w 
     */
    static wordMapper(w) {
        let nw = {
        "word": w.word,
        "lang": "en"
        }
        w.description ? nw["description"] = w.description : false;
        const now = new Date();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const pad = (c) => (c+'').length === 1 ? '0' + c : c+'';
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

        // add example sentence
        if (w.example) {
            nw.example = { "text": w.example };
        } else if (w.sentence) {
            nw.example = { "text": w.sentence};
        } 

        return nw;
    }

    /** 
    * @param words an array of words to add to the list - format:
    * [
        {
            "word":"kangaroo",
            "location": 
            "sentence": 
            "description":"Test kangaroo", 
            "example": "Kangaroo makes me boo"
        }
        ]
        description and example are optional
    * @param listId id of the listlist
    * @returns {"status":0,"result":listId} 0 is ok
    */ 
    addToList(words, listId) {
        // single word: use single word correction
        if (words && words.length === 1) {
            let inword = words[0];
            return this.correctWord(inword.word).then((word) => {
                let outword = inword;
                if (inword.word !== word) {
                    console.log(`${inword.word} corrected to ${word}`);
                    outword.word = word;
                }
                return this.http('POST', `${this.URLBASE}/lists/save.json`, {
                    referer: `${this.URLBASE}/dictionary/${words[0]}` 
                }, VocAPI.getFormData({
                    "addwords": JSON.stringify([outword].map(VocAPI.wordMapper)),
                    "id": listId 
                }))
                .then(VocAPI.defaultResHandler)
                .then((res) => {return Promise.resolve({
                    original: inword,
                    corrected: word
                })}); 
            });
        // multiple words: use bulk correction
        } else if (words && words.length > 1) {
            return this.correctWords(words).then((result) => {
                return this.http('POST', `${this.URLBASE}/lists/save.json`, {
                    referer: `${this.URLBASE}/dictionary/${result.words[0]}` 
                }, VocAPI.getFormData({
                    "addwords": JSON.stringify(result.words.map(VocAPI.wordMapper)),
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
            "words": words.map(VocAPI.wordMapper),
            "name": listName,
            "description": description,
            "action": "create",
            "shared": shared
         };

        return this.http('POST', `${this.URLBASE}/lists/save.json`,
                {
                    referer: `${this.URLBASE}/lists/vocabgrabber`,
                    responseType: 'json' 
                }, VocAPI.getFormData({'wordlist': JSON.stringify(listObj)})).then(VocAPI.defaultResHandler);
     }

    static translation(requestUrl, modifiedReferrer) {
        return this.http('GET', requestUrl, {
                referer: modifiedReferrer,
                credentials: false
            }).then(VocAPI.defaultResHandler);
    }

    deleteList(listId) {
        return this.http('POST', `${this.URLBASE}/lists/delete.json`, {
            referer: `${this.URLBASE}/lists/${listId}/edit`
        }, VocAPI.getFormData({id: listId}))
        .then(VocAPI.defaultResHandler);
    }


    /**
     * 
     * @param 
     * @returns
        [{"word":"zilch","lang":"en",
        "description":"Added from URL: https://forums.macrumors.com/threads/usb-c-powerba… on Wednesday 6 June 2018 at 14:08.",
        "example":{"text":"So far, zilch.","offsets":[8,13]},"definition":"a quantity of no importance","shortdefinition":"a quantity of no importance",
        "audio":["D/15IWYVT54ZU23"],"ffreq":4.6965513531891756E-4}}]
     */
    getList(listId) {
        return this.http('POST', `${this.URLBASE}/lists/load.json`, {
            referer: `${this.URLBASE}/dictionary/hack`
        }, VocAPI.getFormData({id: listId}))
        .then(VocAPI.defaultResHandler);
    }

    /**
     * Execute an function with a modified Referer header for browser requests
     * @param {*} requestUrls list of request URL match patters that need a referer change
     */
    setReferrerInterceptor(requestUrls) {
        function refererListener(details) {
            const i = details.requestHeaders.findIndex(e => e.name.toLowerCase() == "set-referer");
            // convert set-referer to Referer
            if (i != -1) {
                details.requestHeaders.push({name: "Referer", value: details.requestHeaders[i].value});
                //delete details.requestHeaders[i]; TODO: this causes problems, the reference is still used above ?
                // now it's sending
                // another way that worked is to keep a url -> referer mapping in the object and update it in http
            }
            // Firefox uses promises
            // return Promise.resolve(details);
            // Chrome doesn't. Todo: https://github.com/mozilla/webextension-polyfill
        
            // important: do create a new object, passing the modified argument does not work
            return {requestHeaders: details.requestHeaders};
        }

        // modify headers with webRequest hook
        chrome.webRequest.onBeforeSendHeaders.addListener(
            refererListener, //  function
            {urls: requestUrls}, // RequestFilter object
            ["requestHeaders", "blocking"] //  extraInfoSpec
        );
    }

    /**
     * Transforms objects of the form {"key": value, "key2": value2} to the form key=value&key2=value2
     * With the values interpreted as strings. They are URL encoded in the process.
     * @param {*} object 
     */
    static getFormData(object) {
        // const formData = new FormData();
        // Object.keys(object).forEach(key => formData.append(key, object[key]));
        let returnString = '';
        Object.keys(object).forEach((key, index) => returnString += `${index === 0 ? '' : '&'}${key}=${encodeURIComponent(object[key])}`)
        return returnString;
        }
}
/*
if (module) {
    module.exports = VocAPI;
} */