/**
 * Last update: 2016/06/26
 * https://translate.google.com/translate/releases/twsfe_w_20160620_RC00/r/js/desktop_module_main.js
 *
 * Everything between 'BEGIN' and 'END' was copied from the url above.
 * 
 * SOURCE: https://github.com/matheuss/google-translate-token/blob/master/index.js
 */

// var got = require('got');
// var Configstore = require('configstore');

/* eslint-disable */
// BEGIN

function sM(a) {
    var b;
    if (null !== yr)
        b = yr;
    else {
        b = wr(String.fromCharCode(84));
        var c = wr(String.fromCharCode(75));
        b = [b(), b()];
        b[1] = c();
        b = (yr = window[b.join(c())] || "") || ""
    }
    var d = wr(String.fromCharCode(116))
        , c = wr(String.fromCharCode(107))
        , d = [d(), d()];
    d[1] = c();
    c = "&" + d.join("") + "=";
    d = b.split(".");
    b = Number(d[0]) || 0;
    for (var e = [], f = 0, g = 0; g < a.length; g++) {
        var l = a.charCodeAt(g);
        128 > l ? e[f++] = l : (2048 > l ? e[f++] = l >> 6 | 192 : (55296 == (l & 64512) && g + 1 < a.length && 56320 == (a.charCodeAt(g + 1) & 64512) ? (l = 65536 + ((l & 1023) << 10) + (a.charCodeAt(++g) & 1023),
            e[f++] = l >> 18 | 240,
            e[f++] = l >> 12 & 63 | 128) : e[f++] = l >> 12 | 224,
            e[f++] = l >> 6 & 63 | 128),
            e[f++] = l & 63 | 128)
    }
    a = b;
    for (f = 0; f < e.length; f++)
        a += e[f],
            a = xr(a, "+-a^+6");
    a = xr(a, "+-3^+b+-f");
    a ^= Number(d[1]) || 0;
    0 > a && (a = (a & 2147483647) + 2147483648);
    a %= 1E6;
    return c + (a.toString() + "." + (a ^ b))
}

var yr = null;
var wr = function(a) {
    return function() {
        return a
    }
}
    , xr = function(a, b) {
    for (var c = 0; c < b.length - 2; c += 3) {
        var d = b.charAt(c + 2)
            , d = "a" <= d ? d.charCodeAt(0) - 87 : Number(d)
            , d = "+" == b.charAt(c + 1) ? a >>> d : a << d;
        a = "+" == b.charAt(c) ? a + d & 4294967295 : a ^ d
    }
    return a
};

// END
/* eslint-enable */

// var config = new Configstore('google-translate-api');

/* 
var window = {
    TKK: config.get('TKK') || '0'
};
*/
localStorage.setItem('TKK', localStorage.getItem('TKK') || '0');

function withModifiedReferrer(refererUrl, requestUrl, action) {
    function refererListener(details) {
        const i = details.requestHeaders.findIndex(e => e.name.toLowerCase() == "referer");
        if (i != -1) {
            details.requestHeaders[i].value = refererUrl;
        } else {
            details.requestHeaders.push({name: "referer", value: refererUrl});
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

function httpGet(requestUrl, type, modifiedReferrer) {
    return new Promise( (resolve, reject) => {
        var req = new XMLHttpRequest();
        //req.withCredentials = true;
        req.open("GET", requestUrl, true);
        req.responseType = type ? type : "document";
        req.onload = function () {
            if (req.status == 200) {
                resolve(req.response);
            }
            else if (req.status != 200) {
                reject();
            }
        }
        req.send();
    });
}

function updateTKK() {
    return new Promise(function (resolve, reject) {
        var now = Math.floor(Date.now() / 3600000);

        //if (Number(window.TKK.split('.')[0]) === now) {
        if (Number(localStorage.getItem('TKK').split('.')[0]) === now) {
            resolve();
        } else {
            //got('https://translate.google.com').then(function (res) {
            httpGet('https://translate.google.com').then(function (res) {
                // var code = res.body.match(/TKK=(.*?)\(\)\)'\);/g);
                var code = res.body.innerHTML.match(/TKK=(.*?)\(\)\)'\);/g);

                if (code) {
                    eval(code[0]);
                    /* eslint-disable no-undef */
                    if (typeof TKK !== 'undefined') {
                        // window.TKK = TKK;
                        // config.set('TKK', TKK);
                        localStorage.setItem('TKK', TKK);
                    }
                    /* eslint-enable no-undef */
                }

                /**
                 * Note: If the regex or the eval fail, there is no need to worry. The server will accept
                 * relatively old seeds.
                 */

                resolve();
            }).catch(function (err) {
                var e = new Error();
                e.code = 'BAD_NETWORK';
                e.message = err.message;
                reject(e);
            });
        }
    });
}

function getGoogleToken(text) {
    return updateTKK().then(function () {
        var tk = sM(text);
        tk = tk.replace('&tk=', '');
        return {name: 'tk', value: tk};
    }).catch(function (err) {
        throw err;
    });
}

// module.exports.get = get;

/**
 * API based on: https://github.com/matheuss/google-translate-api/blob/master/index.js
 */

/**
 * from: https://github.com/Gozala/querystring/blob/master/encode.js
 */
function stringifyPrimitive(v) {
    switch (typeof v) {
      case 'string':
        return v;
  
      case 'boolean':
        return v ? 'true' : 'false';
  
      case 'number':
        return isFinite(v) ? v : '';
  
      default:
        return '';
    }
  };

function stringify(obj, sep, eq, name) {
    sep = sep || '&';
    eq = eq || '=';
    if (obj === null) {
      obj = undefined;
    }
  
    if (typeof obj === 'object') {
      return Object.keys(obj).map(function(k) {
        var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
        if (Array.isArray(obj[k])) {
          return obj[k].map(function(v) {
            return ks + encodeURIComponent(stringifyPrimitive(v));
          }).join(sep);
        } else {
          return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
        }
      }).filter(Boolean).join(sep);
  
    }
  
    if (!name) return '';
    return encodeURIComponent(stringifyPrimitive(name)) + eq +
           encodeURIComponent(stringifyPrimitive(obj));
  };

function translate(text, opts) {
    opts = opts || {};

    var e;
    [opts.from, opts.to].forEach(function (lang) {
        if (lang && !isSupported(lang)) {
            e = new Error();
            e.code = 400;
            e.message = 'The language \'' + lang + '\' is not supported';
        }
    });
    if (e) {
        return new Promise(function (resolve, reject) {
            reject(e);
        });
    }

    opts.from = opts.from || 'auto';
    opts.to = opts.to || 'en';

    opts.from = getCode(opts.from);
    opts.to = getCode(opts.to);

    return getGoogleToken(text).then(function (token) {
        var url = 'https://translate.google.com/translate_a/single';
        /*
        var data = {
            client: 't',
            sl: opts.from,
            tl: opts.to,
            hl: opts.to,
            dt: ['at', 'bd', 'ex', 'ld', 'md', 'qca', 'rw', 'rm', 'ss', 't'],
            ie: 'UTF-8',
            oe: 'UTF-8',
            otf: 1,
            ssel: 0,
            tsel: 0,
            kc: 7,
            q: text
        };
        */
        var data = {
            client: 'gtx',
            sl: opts.from,
            tl: opts.to,
            hl: opts.to,
            dt: ['t', 'bd'],
            dj: '1',
            source: 'icon',
            q: text
        };
        data[token.name] = token.value;

        return url + '?' + stringify(data);
    }).then(function (url) {

        /* Create object of the form
         *  {
         *      "translations": [
         *          {
         *              "translation": trans
         *              "pos": pos
         *              "alternatives": [alt1, alt2]
         *          }
         * ]
         *  }
         */

        return httpGet(url, 'json').then(function (res) {
            var result = {
               translations: []
            };

            let posmapping_NL_NLabv = {
                'zelfstandig naamwoord': 'zn',
                'bijvoeglijk naamwoord': 'bn',
                'bijwoord': 'bw',
                'werkwoord': 'ww'
            }

            let posmapping_Google_Voc_NL_EN = {
                'zelfstandig naamwoord': 'n',
                'bijvoeglijk naamwoord': 'a',
                'bijwoord': 'r',
                'voorzetsel': 'r',
                'werkwoord': 'v'
            }

            let posmappingVocGoogle = {
                'n': 'zelfstandig naamwoord',
                'v': 'werkwoord', 
            }

            if (res.dict) {
                result.translations = res.dict.map(d => {
                    return {
                        translation: d.terms[0],
                        alternatives: d.terms.slice(1),
                        pos: posmapping_Google_Voc_NL_EN[d.pos]
                    };
                });

                // to a PoS reordering to put the requested in front if needed
                if (opts.pos) {
                    const pm = opts.pos;
                    result.translations = result.translations.sort((a,b) => {
                        if ((a.pos === pm) && (b.pos === pm)) return 0;
                        else if ((a.pos === pm) && (b.pos !== pm)) return -1;
                        else if ((a.pos !== pm) && (b.pos === pm)) return 1;
                        else return 0;
                    });
                }
            }

            return result;
        }).catch(function (err) {
            var e;
            e = new Error();
            if (err && err.statusCode !== undefined && err.statusCode !== 200) {
                e.code = 'BAD_REQUEST';
            } else {
                e.code = 'GTRANS_API_ERROR';
            }
            throw e;
        });
    });
}
