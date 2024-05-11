import child_process from "child_process";
import type * as stream from "stream";
import { ParsedError } from "@suchipi/error-utils";
import { readUntilEnd } from "./read-until-end";

const runnerPath = require.resolve("../dist/child-process-worker");

type InChildProcess = {
  <Inputs extends { [key: string]: any }, Result>(
    inputs: Inputs,
    functionToRun: (inputs: Inputs) => Result | Promise<Result>
  ): Promise<Result>;

  <Result>(functionToRun: () => Result | Promise<Result>): Promise<Result>;
};

export const inChildProcess: InChildProcess = (...args: Array<any>) => {
  const inputs = typeof args[0] === "function" ? {} : args[0];
  const functionToRun = typeof args[0] === "function" ? args[0] : args[1];

  if (typeof inputs !== "object") {
    throw new Error(
      "The first argument to inChildProcess should be an object of input data to pass to the child process."
    );
  }

  if (typeof functionToRun !== "function") {
    throw new Error(
      "The second argument to inChildProcess should be a function to run in the child process."
    );
  }

  const here = new ParsedError(new Error("here"));

  const callingFrame = here.stackFrames[1];
  const callingFile = callingFrame?.fileName ?? "unknown file";

  const child = child_process.spawn(process.argv[0], [runnerPath], {
    stdio: ["inherit", "inherit", "inherit", "pipe", "pipe"],
  });

  return new Promise((resolve, reject) => {
    child.on("error", reject);

    const commsOut: stream.Writable = child.stdio![3] as any;
    const commsIn: stream.Readable = child.stdio![4] as any;

    child.on("spawn", () => {
      commsOut.end(
        JSON.stringify([inputs, functionToRun.toString(), callingFile]),
        "utf-8"
      );
    });

    let receivedData = "";
    readUntilEnd(commsIn).then((data) => {
      receivedData = data;
    });

    child.on("close", (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(
            `Child process exited with nonzero status code: ${JSON.stringify({
              code,
              signal,
            })}`
          )
        );
      } else {
        const result = JSON.parse(receivedData);
        switch (result.type) {
          case "success": {
            resolve(result.data);
            break;
          }
          case "error": {
            const error = new Error(result.error.message);
            Object.defineProperty(error, "name", { value: result.error.name });
            Object.defineProperty(error, "stack", {
              value:
                result.error.name +
                ": " +
                result.error.message +
                "\n" +
                result.error.stack
                  .split("\n")
                  .slice(1)
                  .filter((line) => !/node:internal|node:events/.test(line))
                  .map((line) => {
                    if (/evalmachine/.test(line)) {
                      const lineWithoutEvalMachine = line.replace(
                        /evalmachine(\.<anonymous>)?/,
                        "<function passed into inChildProcess>"
                      );

                      const matches = line.match(/:(\d+):(\d+)\)?$/);
                      if (!matches) {
                        return lineWithoutEvalMachine;
                      } else {
                        let [_, row, col] = matches;
                        // subtract 1 from row to skip the module wrapper function line
                        row = row - 1;

                        // subtract the length of the `return ` keywords in front of the function
                        if (row === 1) {
                          col = col - `return `.length;
                        }

                        const hadParen = /\)$/.test(lineWithoutEvalMachine);

                        return lineWithoutEvalMachine.replace(
                          /:\d+:\d+\)?$/,
                          `:${row}:${col - 1}${hadParen ? ")" : ""}`
                        );
                      }
                    } else {
                      return line;
                    }
                  })
                  .join("\n") +
                "\n" +
                error
                  .stack!.split("\n")
                  .slice(1)
                  .filter((line) => !/node:internal|node:events/.test(line))
                  .join("\n") +
                "\n" +
                here
                  .stack!.split("\n")
                  .slice(2)
                  .filter((line) => !/node:internal|node:events/.test(line))
                  .join("\n"),
            });
            reject(error);
            break;
          }
          default: {
            reject(
              new Error(
                `Internal parallel-park error: unhandled result type: ${result.type}`
              )
            );
          }
        }
      }
    });
  });
};
