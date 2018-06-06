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
    }
    
    /**
     * log-in check
     */
    checkLogin() {
        if (!this.loggedIn) {
            const requestUrl = `${this.URLBASE}/account/progress`;
            var req = new XMLHttpRequest();
            req.open("GET", requestUrl, true);
            //req.withCredentials = true;
            req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            req.responseType = "json";
            
            return new Promise((resolve, reject) => {
                req.onload = function () {
                    if (req.responseURL !== requestUrl) { // response url was not same as requested url: 302 login redirect happened
                        reject('not logged in');
                    } else {
                        loggedIn = true;
                        resolve('already logged in');
                    }
                }
                req.send();
            })
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
    getDefinition(word) {
        /* stub */
        return "Not implemented."
    }

    /**
     * 
     */
    getLists() {
        return new Promise( (resolve, reject) => {
            const refererUrl = `${this.URLBASE}/dictionary/hacker`; 
            const requestUrl = `${this.URLBASE}/lists/byprofile.json`;

            // options: name, createdate, wordcount, activitydate TODO: make options
            let sortBy = "modifieddate"

            VocAPI.withModifiedReferrer(refererUrl, requestUrl, (detachHook) => {
                var req = new XMLHttpRequest();
                req.open("GET", requestUrl, true);
                req.withCredentials = true;
                req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                req.responseType = "json";
                // TODO: this versus onload?
                req.onreadystatechange = () => {
                    if (req.readyState == 4 && req.status == 200) {
                        detachHook();
                        
                        const lists = req.response.result.wordlists
                            .filter(wl => wl.owner)
                            .sort((a,b) => a[sortBy] > b[sortBy] ? -1 : 1); // high to low
                        
                        // fill cache with names
                        lists.forEach(wl => {
                            this.listNameCache[wl.wordlistid] = wl.name;
                        })
                        resolve(lists);
                    }
                    else if (req.status != 200) {
                        console.log(`Error: ` + req.responseText);
                        detachHook();
                        reject();
                    }
                }
                req.send();
                }); 
        }
        );
    }

    /**
     * @param wordToLearn as a plain word
     */
    startLearning(wordToLearn) {
        return new Promise((resolve, reject) => {
            console.log("Trying to learn " + wordToLearn)
            const refererUrl = `${this.URLBASE}/dictionary/${wordToLearn}`; 
            const requestUrl = `${this.URLBASE}/progress/startlearning.json`;
        
            VocAPI.withModifiedReferrer(refererUrl, requestUrl, (detachHook) => {
              var req = new XMLHttpRequest();
              req.open("POST", requestUrl, true);
              req.withCredentials = true;
              req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
              req.onreadystatechange = function () {
                if (req.readyState == 4 && req.status == 200) {
                    detachHook();
                    resolve(req.responseText);
                }
                else if (req.status != 200) {
                    detachHook();
                    reject();
                    console.log(`Error: ` + req.responseText);
                }
              }
              req.send(`word=${wordToLearn}`);
            });
        });
    }

    /**
     * Maps words from this interface's format to voc.com's format
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
                nw.description += '\n\n' + locationString;
            } else {
                nw.descripton += '\n\n' + isolatedDateString;
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
            "description":"Test kangaroo", 
            "example": "Kangaroo makes me boo"
        }
        ]
        description and example are optional
    * @param listId id of the listlist
    */ 
    addToList(words, listId) {
        return new Promise((resolve, reject) => {
            console.log("Trying to save " + words)
            const refererUrl = `${this.URLBASE}/dictionary/${words[0]}`; 
            const requestUrl = `${this.URLBASE}/lists/save.json`;
          
            VocAPI.withModifiedReferrer(refererUrl, requestUrl, (detachHook) => {
              var req = new XMLHttpRequest();
              req.open("POST", requestUrl, true);
              req.withCredentials = true;
              req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
              let wordObjects = words.map(VocAPI.wordMapper);

              req.onload = function () {
                if (req.status == 200) {
                    console.log(req.responseText);
                    detachHook();
                    resolve(req.responseText);
                }
                else if (req.status != 200) {
                    detachHook();
                    reject(req.responseText);        
                    console.log(`Error: ` + req.responseText);
                }
               }
              const toSend = {
                  "addwords": JSON.stringify(wordObjects),
                  "id": listId 
              }
              req.send(VocAPI.getFormData(toSend));
            });
        });
    }

    /** 
    * @param words an array of words to add to the new list
    * @param listName name of the new list
    * @param description description of the list
    * @param shared boolean that shows whether list should be shared or not
    */ 
    addToNewList(words, listName, description, shared) {
        return new Promise((resolve, reject) => {
            const refererUrl = `${this.URLBASE}/lists/vocabgrabber`; 
            const requestUrl = `${this.URLBASE}/lists/save.json`;
          
            let listObj = {
              //"words": words.map((w) => { return {"word": w} }),
              "words": words.map(VocAPI.wordMapper),
              "name": listName,
              "description": description,
              "action": "create",
              "shared": shared
            }
          
            VocAPI.withModifiedReferrer(refererUrl, requestUrl, (detachHook) => {
              var req = new XMLHttpRequest();
              req.open("POST", requestUrl, true);
              req.responseType = "json";
              req.withCredentials = true;
              req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
          
              req.onload = function () {
                if (req.status == 200) {
                    console.log(req.response);
                    detachHook();
                    resolve(req.response);                    
                } else if (req.status != 200) {
                    detachHook()
                    console.log(`Error: ` + req.response);
                    reject(req.response);
                }
               }
              req.send(VocAPI.getFormData({'wordlist': JSON.stringify(listObj)}));
            });
        });
    }

    static translation(requestUrl, modifiedReferrer) {
        return new Promise((resolve, reject) => {
            let action = (detachHook) => {
                var req = new XMLHttpRequest();
                req.withCredentials = false;
                req.open("GET", requestUrl, true);
                req.responseType = 'json';
                req.onload = function () {
                    if (detachHook) detachHook();
                    if (req.status == 200) {
                        resolve(req.response);
                    }
                    else if (req.status != 200) {
                        reject();
                    }
                 }
                req.send();
            };
            VocAPI.withModifiedReferrer(modifiedReferrer, requestUrl, action);
        });
    }

    /**
     * Execute an function with a modified Referer header for browser requests
     * @param {*} refererUrl the referer URL that will be injected
     * @param {*} requestUrl the request URL's for which the header has to be injected
     * @param {*} action the action (request) to be executed. 
     *                  Gets passed a function that will detach the header modifier hook if called
     */
    static withModifiedReferrer(refererUrl, requestUrl, action) {
        function refererListener(details) {
            const i = details.requestHeaders.findIndex(e => e.name.toLowerCase() == "referer");
            if (i != -1) {
                details.requestHeaders[i].value = refererUrl;
            } else {
                details.requestHeaders.push({name: "Referer", value: refererUrl});
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
        {urls: [requestUrl]}, // RequestFilter object
        ["requestHeaders", "blocking"] //  extraInfoSpec
        );

        // TODO:    why not hook detach after action? async?
        //          hook should be detached after the request was sent, automatically   
        action(() => {
        // detach hook
        if (chrome.webRequest.onBeforeSendHeaders.hasListener(refererListener)) {
            chrome.webRequest.onBeforeSendHeaders.removeListener(refererListener)
        }
        });
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