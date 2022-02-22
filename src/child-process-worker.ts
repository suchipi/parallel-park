import fs from "fs";
import vm from "vm";
import makeModuleEnv from "make-module-env";

const comms = fs.createWriteStream(
  // @ts-ignore
  null,
  { fd: 3 }
);

const [inputsString, fnString, callingFile] = process.argv.slice(2);

function onSuccess(data: any) {
  comms.write(JSON.stringify({ type: "success", data }));
}

function onError(error: Error) {
  comms.write(
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

try {
  const wrapperFn = vm.runInThisContext(
    `(function moduleWrapper(exports, require, module, __filename, __dirname) {
return ${fnString};})`
  );
  const inputs = JSON.parse(inputsString);

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
} catch (err) {
  onError(err as Error);
}
