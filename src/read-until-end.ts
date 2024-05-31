import type stream from "stream";
import makeDebug from "debug";
const debug = makeDebug("parallel-park:read-until-end");

let streamId = 0;

export function readUntilEnd(stream: stream.Readable): Promise<string> {
  const id = `${process.pid}-${streamId}`;
  streamId++;

  return new Promise((resolve) => {
    let data = "";

    stream.on("data", (chunk) => {
      const chunkStr = chunk.toString("utf-8");
      debug("received data chunk from stream %s: %o", id, chunkStr);
      data += chunkStr;
    });

    stream.on("close", () => {
      debug("stream %s closed; resolving with: %o", id, data);
      resolve(data);
    });
  });
}
