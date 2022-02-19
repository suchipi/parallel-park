export async function runJobs<T, U>(
  inputs: Array<T>,
  mapper: (input: T, index: number, length: number) => Promise<U>,
  {
    /**
     * How many jobs are allowed to run at once.
     */
    concurrency = 8,
  }: {
    /**
     * How many jobs are allowed to run at once.
     */
    concurrency?: number;
  } = {}
): Promise<Array<U>> {
  if (concurrency < 1) {
    throw new Error(
      "Concurrency can't be less than one; that doesn't make any sense."
    );
  }

  if (inputs.length === 0) {
    return Promise.resolve([]);
  }

  concurrency = Math.min(concurrency, inputs.length);

  const total = inputs.length;
  let unstartedIndex = 0;
  let running = 0;
  let complete = 0;

  const results = new Array(inputs.length);
  const runningPromises = new Set();

  function takeInput() {
    if (complete === total) return;
    if (running === concurrency) {
      throw new Error(
        "Internal error: attempted to run more jobs than allowed."
      );
    }

    const inputIndex = unstartedIndex;
    unstartedIndex++;

    const input = inputs[inputIndex];
    const promise = mapper(input, inputIndex, total);
    running++;

    promise.then(
      (result) => {
        results[inputIndex] = result;
        complete++;
        runningPromises.delete(promise);
      },
      (err) => {
        runningPromises.delete(promise);
        throw err;
      }
    );
    runningPromises.add(promise);

    if (running < concurrency) {
      takeInput();
    }
  }

  takeInput();

  while (runningPromises.size > 0) {
    await Promise.race(runningPromises.values());
  }

  return results;
}
