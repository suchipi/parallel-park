import { inChildProcess } from "./in-child-process";
import path from "path";

const rootDir = path.resolve(__dirname, "..");

test("basic test (no inputs)", async () => {
  const result = await inChildProcess(() => {
    return 52;
  });
  expect(result).toBe(52);
});

test("basic test (with inputs)", async () => {
  const result = await inChildProcess(
    { first: "potato", second: "knishes" },
    ({ first, second }) => {
      return first + " " + second;
    }
  );
  expect(result).toBe("potato knishes");
});

function cleanStack(stack: string) {
  return stack
    .replace(new RegExp(rootDir, "g"), "<rootDir>")
    .split("\n")
    .filter((line) => !line.match(/node_modules\/jest/))
    .filter((line) => !line.match(/Pipe/))
    .join("\n");
}

test("sync error bubbles up", async () => {
  expect.assertions(2);

  function doIt() {
    const child = () => {
      function inside() {
        // hi
        throw new Error("sad :(");
      }

      inside();
    };

    return inChildProcess(child);
  }

  try {
    await doIt();
  } catch (err) {
    expect(err.message).toBe("sad :(");
    expect(cleanStack(err.stack)).toMatchInlineSnapshot(`
"Error: sad :(
    at inside (<function passed into inChildProcess>:4:14)
    at <function passed into inChildProcess>:6:6
    at onReady (<rootDir>/dist/child-process-worker.js:42:20)
    at <rootDir>/dist/child-process-worker.js:25:9
    at ChildProcess.<anonymous> (<rootDir>/src/in-child-process.ts:109:27)
    at doIt (<rootDir>/src/in-child-process.test.ts:45:26)
    at Object.doIt (<rootDir>/src/in-child-process.test.ts:49:11)"
`);
  }
});

test("async error bubbles up", async () => {
  expect.assertions(2);

  function doIt() {
    async function child() {
      throw new Error("uh oh!");
    }

    return inChildProcess(child);
  }

  try {
    await doIt();
  } catch (err) {
    expect(err.message).toBe("uh oh!");

    expect(cleanStack(err.stack)).toMatchInlineSnapshot(`
"Error: uh oh!
    at child (<function passed into inChildProcess>:2:12)
    at onReady (<rootDir>/dist/child-process-worker.js:42:20)
    at <rootDir>/dist/child-process-worker.js:25:9
    at ChildProcess.<anonymous> (<rootDir>/src/in-child-process.ts:109:27)
    at doIt (<rootDir>/src/in-child-process.test.ts:73:26)
    at Object.doIt (<rootDir>/src/in-child-process.test.ts:77:11)"
`);
  }
});

test("require in child process", async () => {
  const result = await inChildProcess(() => {
    // require should be relative to the file where the inChildProcess call is
    const sampleFile = require("./test-fixtures/sample-file");
    return sampleFile;
  });
  expect(result).toBe("Hello!");
});

test("extremely large inputs", async () => {
  const result = await inChildProcess(
    {
      // A 'W' so big, Wario might not fit through the W door
      W: "W".repeat(1024 * 1024),
    },
    ({ W }) => {
      return W.length;
    }
  );
  expect(result).toBe(1024 * 1024);
});

test("extremely large outputs", async () => {
  const result = await inChildProcess(() => {
    return "W".repeat(1024 * 1024);
  });
  expect(result.length).toBe(1024 * 1024);
});
