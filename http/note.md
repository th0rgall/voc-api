
So, apparently: 

I misunderstood the "browser" field.

I thought it exchanged every require() in every project .js file according to the substitution rule.

But it only exchanges this for *external* modules that require the module itself. So it acts as a replaceable 'main' field. 

It seems to work with browserify now.

But it does not seems to work with webpack:
it cant resolve a folder-type local module like './http'