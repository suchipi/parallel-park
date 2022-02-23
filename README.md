# parallel-park

Parallel/concurrent async work, optionally using multiple processes

## Usage

`parallel-park` exports two functions: `runJobs` and `inChildProcess`.

### `runJobs`

`runJobs` is kinda like `Promise.all`, but instead of running everything at once, it'll only run a few Promises at a time (you can choose how many to run at once). It's inspired by [Bluebird's Promise.map function](http://bluebirdjs.com/docs/api/promise.map.html).

To use it, you pass in an iterable (array, set, generator function, etc) of inputs and a mapper function that transforms each input into a Promise. Any Promises within the iterable will be awaited before being passed into your mapper function. You can also optionally specify the maximum number of Promises to wait on at a time by passing an object with a `concurrency` property, which is a number. The concurrency defaults to 8.

```ts
import { runJobs } from "parallel-park";

const inputs = ["alice", "bob", "carl", "dorsey", "edith"];
const results = await runJobs(
  inputs,
  async (name, index, inputsCount) => {
    // Do whatever async work you want inside this mapper function.
    // In this case, we use a hypothetical "getUser" function to
    // retrieve data about a user from some web API.
    console.log(`Getting fullName for ${name}...`);
    const user = await getUser(name);
    return user.fullName;
  },
  // This options object with concurrency is an optional argument.
  // If unspecified, it defaults to { concurrency: 8 }
  {
    // This number specifies how many times to call the mapper
    // function before waiting for one of the returned Promises
    // to resolve. Ie. "How many promises to have in-flight concurrently"
    concurrency: 2,
  }
);
// Logs these two immediately:
//
// Getting fullName for alice...
// Getting fullName for bob...
//
// But, it doesn't log anything else yet, because we told it to only run two things at a time.
// Then, after one of those Promises has finished, it logs:
//
// Getting fullName for carl...
//
// And so forth, until all of them are done.

// `results` is an Array of the resolved value you returned from your mapper function.
// The indices in the array correspond to the indices of your inputs.
console.log(results);
// Logs:
// [
//   "Alice Smith",
//   "Bob Eriksson",
//   "Carl Martinez",
//   "Dorsey Toth",
//   "Edith Skalla"
// ]
```

### `inChildProcess`

`inChildProcess` is a function that you pass a function into, and it spawns a separate node process to run your function in. Once your function has completed, its return/resolved value will be sent back to the node process you called `inChildProcess` from.

```ts
import { inChildProcess } from "parallel-park";

const result = await inChildProcess(() => {
  return 2 + 2;
});

console.log(result); // 4
```

Your function can also return a Promise:

```ts
// Either by returning a Promise directly...
await inChildProcess(() => {
  return Promise.resolve(2 + 2);
});

// Or by using an async function, which returns a Promise that resolves to the function's return value
await inChildProcess(async () => {
  return 2 + 2;
});
```

> ⚠️ NOTE: The return value of your function must be JSON-serializable, or else it won't make it across the gap between the parent node process and the child one.

The function you pass into `inChildProcess` will be executed in a separate node process; as such, it won't be able to access variables defined in the file calling `inChildProcess`:

```ts
const myName = "Lily";

await inChildProcess(() => {
  // Throws an error: myName is not defined
  return myName + "!";
});
```

To work around this, you can pass an object into `inChildProcess` as its first argument, before the function. When called this way, the function will receive that object:

```ts
await inChildProcess({ myName: "Lily" }, (data) => {
  const myName = data.myName;

  // No longer throws an error
  return myName + "!";
});
```

It's common to use object shorthand and destructuring syntax when passing values in:

```ts
const myName = "Lily";

await inChildProcess({ myName }, ({ myName }) => {
  return myName + "!";
});
```

> ⚠️ NOTE: The values in your input object must be JSON-serializable, or else they won't make it across the gap between the parent node process and the child one.

Because the inputs have to be JSON-serializable, you may run into an issue if trying to use an external module within the child process:

```ts
const util = require("util");

await inChildProcess({ util }, ({ util }) => {
  const someData = { something: true };
  // Throws an error: util.inspect is not a function
  return util.inspect(someData);
});
```

To work around this, call `require` inside the child process function:

```ts
await inChildProcess(() => {
  const util = require("util"); // the require is inside the function now

  const someData = { something: true };

  // No longer throws an error
  return util.inspect(someData);
});
```

If you want to use the external module both inside of the child process and outside of it, `require` it in both places:

```ts
const util = require("util");

await inChildProcess(() => {
  const util = require("util");

  const someData = { something: true };

  // No longer throws an error
  return util.inspect(someData);
});
```

The `require` inside of the child process can also be used to load stuff from your own code into the child process:

```ts
const file = "/home/lily/hello.txt";

await inChildProcess({ file }, async ({ file }) => {
  const processFile = require("./process-file");

  const results = await processFile(file);
  console.log(results);
  return results;
});
```

## License

MIT
