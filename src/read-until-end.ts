import type stream from "stream";

export function readUntilEnd(stream: stream.Readable): Promise<string> {
  return new Promise((resolve) => {
    let data = "";

    stream.on("data", (chunk) => {
      data += chunk.toString("utf-8");
    });

    stream.on("close", () => {
      resolve(data);
    });
  });
}
