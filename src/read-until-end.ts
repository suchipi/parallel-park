import type stream from "stream";
import makeDebug from "debug";
const debug = makeDebug("parallel-park:read-until-end");

let streamId = 0;

export function readUntilEnd(stream: stream.Readable): Promise<string> {
  const id = streamId;
  streamId++;

  return new Promise((resolve) => {
    let data = "";

    stream.on("data", (chunk) => {
      debug("received data chunk from stream", id);
      data += chunk.toString("utf-8");
    });

    stream.on("close", () => {
      debug(`stream ${id} closed; resolving`);
      resolve(data);
    });
  });
}
