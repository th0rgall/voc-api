const jsdom = require("jsdom");
const { JSDOM } = jsdom;

module.exports = function parseDocument(htmlText) {
    const dom = new JSDOM(htmlText);
    return dom.window.document;
}

