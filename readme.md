# Vocabulary.com API

This is an unofficial Javascript API for vocabulary.com. It can be used in Node and in transpiled browser projects.

To access your user account data you need a vocabulary.com username & password.

## Getting started

```bash
yarn // OR npm install
```

```js
const VocAPI = require("voc-api");
const voc = new VocAPI();

// some methods extract public vocabulary.com information
voc.getDefinition("tester").then(definition => { console.log(definition.short) });
// prints: "When someone is a tester, they either administer tests or they assess the safety or function of a product. You might hope for an eventual career as a bubblegum tester."

// manage user list by logging in first
voc.login('<username>', '<password>').then(() => {
    // add the word "tester" to an existing vocabulary.com list with the name "Words to study". Include an example sentence.
    voc.addToListName({word: "tester", example: "The tester tested the untested application."}, "Words to study").then(() => console.log("Success!"));
});
```

For all possibilities, check out the API reference.

## [API Reference](https://th0rgall.github.io/voc-api/VocAPI.html)

## Usage in browsers vs Node.js

**For browser usage, you need to build this module using Webpack or Browserify**:

```bash
yarn add --dev browserify # or npm i --save-dev browserify
browserify ./node_modules/voc-api/vocabulary-api.js -o myvocapi.js
```
Now you can include myvocapi.js in a browser `<script>` tag. I will include a pre-built browser file in next releases.

This module was originally written for a [browser extension](https://github.com/th0rgall/voc-enhancer). It thus uses standard browser API's internally.

I created a layer that abstracts these browser APIs so a Node.js implementation can be provided.

If this module is `require`ed in a project that is transpiled by either Webpack or Browserify, a browser-native APIs will be used. If it is required in a Node project, the `request` and `jsdom` packages form substitutes for XMLHttpRequest and the browser DOM respectively. This is possible with the `"browser"` field in `package.json`. Quite a bit of overhead on the Node side, but this way the browser package stays relatively clean.