# Vocabulary.com API

This is an unofficial Javascript API for vocabulary.com. It can be used in Firefox/Chrome web extensions or Node.js projects.

Unfortunately, the API can **not** be used in a regular web app because of CORS and other browser safety measures.

To access your user account data you need a vocabulary.com username & password.

## Getting started

To install:

```bash
npm install --save th0rgall/voc-api
```

(note: this package is not published on NPM at the moment)

Sample usage:

```js
const VocAPI = require("voc-api");
const voc = new VocAPI();

// some methods extract public vocabulary.com information
voc.getDefinition("tester").then((definition) => {
  console.log(definition.short);
});
// prints: "When someone is a tester, they either administer tests or they assess the safety or function of a product. You might hope for an eventual career as a bubblegum tester."

// manage user list by logging in first
voc.login("<username>", "<password>").then(() => {
  // add the word "tester" to an existing vocabulary.com list with the name "Words to study". Include an example sentence.
  voc
    .addToListName(
      {
        word: "tester",
        example: "The tester tested the untested application.",
      },
      "Words to study"
    )
    .then(() => console.log("Success!"));
});
```

For all features, check out the API reference.

## [API Reference](https://th0rgall.github.io/voc-api/VocAPI.html)
