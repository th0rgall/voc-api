
const request = require('request-promise');

function http(method, url, options, data) {
    return new Promise((resolve, reject) => {
        let requestOptions = {
            url,
            method,
            followAllRedirects: true,
            jar: true,
            resolveWithFullResponse: true,
            headers: {}
        }

        let sendReg = /PUT|POST/i;
        if (method.match(sendReg) && data) {
            requestOptions['form'] = data;
        }

        // options
        if (options) {
            if (options.referer) {
                requestOptions.headers['referer'] = options.referer;
            }
            // expect json response
            if ( options.responseType === 'json') requestOptions.json = true;
            if ( options.credentials ) req.withCredentials = options.credentials;
        }
        

        let transformResponse = (res) => {

            // console.log(requestOptions);
            // console.log(res.body.length);
            // console.log(res.headers);
            // console.log(res.statusCode);

            // documentation: Get the full response instead of just the body
            
            let response = {};
            response.status = res.statusCode;

            // json --> res.response contains data
            // otherwise res.responseTe
            if (options && options.responseType === 'json') {
                response.response = res.body;
            } else {
                // TODO: also populate responsetext? confusing
                response.responseText = res.body;
                response.response = res.body;
            }

            //console.log(res.body);
            return response;
        }

        let callTransformed = (f) => (a => f(transformResponse(a)));
        request(requestOptions)
        .then(callTransformed(resolve))
        .catch(callTransformed(reject));
    }

    )
}

module.exports = http;