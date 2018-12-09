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
function http(method, url, options, data) {

    // TODO: this doesn't work as expected now
    // can I put firstRun in the outer scope?
    // or: make http an initializable object in vocabulary-api.js, and change http.js
    let firstRun = true;

    /**
     * Execute an function with a modified Referer header for browser requests
     * @param {*} requestUrls list of request URL match patters that need a referer change
     */
    function setReferrerInterceptor(requestUrls) {
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

    if (firstRun) {
        setReferrerInterceptor([
            `${this.URLBASE}/progress/*`,
            `${this.URLBASE}/lists/byprofile.json`, 
            `${this.URLBASE}/lists/save.json`,
            `${this.URLBASE}/lists/delete.json`,
            `${this.URLBASE}/lists/vocabgrabber/grab.json`,
            `${this.URLBASE}/lists/load.json`]);
        firstRun = false;
    }

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

module.exports = http;