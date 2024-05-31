import fs from "fs";
import vm from "vm";
import makeModuleEnv from "make-module-env";
import makeDebug from "debug";
import { readUntilEnd } from "./read-until-end";
import path from "path";

const debug = makeDebug("parallel-park:child-process-worker");

const commsIn = fs.createReadStream(
  // @ts-ignore
  null,
  { fd: 3 }
);
const commsOut = fs.createWriteStream(
  // @ts-ignore
  null,
  { fd: 4 }
);

debug("reading input data...");
readUntilEnd(commsIn)
  .then((data) => {
    debug("parsing input data...");
    try {
      const [inputs, fnString, callingFile] = JSON.parse(data);
      onReady(inputs, fnString, callingFile);
    } catch (err) {
      onError(err as Error);
    }
  })
  .catch(onError);

function onReady(inputs: any, fnString: string, callingFile: string) {
  debug("in onReady %o", { inputs, fnString, callingFile });

  // Relevant when callingFile is eg. "REPL2" (from Node.js repl)
  if (!path.isAbsolute(callingFile)) {
    callingFile = path.join(process.cwd(), "fake-path.js");
  }

  const wrapperFn = vm.runInThisContext(
    `(function moduleWrapper(exports, require, module, __filename, __dirname) {
  return ${fnString};})`
  );
  const env = makeModuleEnv(callingFile);
  const fn = wrapperFn(
    env.exports,
    env.require,
    env.module,
    env.__filename,
    env.__dirname
  );
  const result = fn(inputs);

  if (
    typeof result === "object" &&
    result != null &&
    typeof result.then === "function"
  ) {
    result.then(onSuccess, onError);
  } else {
    onSuccess(result);
  }
}

function onSuccess(data: any) {
  debug("in onSuccess %o", { data });

  commsOut.end(JSON.stringify({ type: "success", data }));
}

function onError(error: Error) {
  debug("in onError %o", { error });

  commsOut.end(
    JSON.stringify({
      type: "error",
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  );
}
