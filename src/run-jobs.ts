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

  let unstartedIndex = 0;

  const results = new Array(inputs.length);
  const runningPromises = new Set();
  let error: Error | null = null;

  function takeInput() {
    const inputIndex = unstartedIndex;
    unstartedIndex++;

    const input = inputs[inputIndex];
    const promise = mapper(input, inputIndex, inputs.length);

    if (
      typeof promise !== "object" ||
      promise == null ||
      typeof promise.then !== "function"
    ) {
      throw new Error(
        "Mapper function passed into runJobs didn't return a Promise. The mapper function should always return a Promise. The easiest way to ensure this is the case is to make your mapper function an async function."
      );
    }

    const promiseWithMore = promise.then(
      (result) => {
        results[inputIndex] = result;
        runningPromises.delete(promiseWithMore);
      },
      (err) => {
        runningPromises.delete(promiseWithMore);
        error = err;
      }
    );
    runningPromises.add(promiseWithMore);
  }

  function proceed() {
    if (unstartedIndex < inputs.length) {
      while (runningPromises.size < concurrency) {
        takeInput();
      }
    }
  }

  proceed();
  while (runningPromises.size > 0 && !error) {
    await Promise.race(runningPromises.values());
    if (error) {
      throw error;
    }
    proceed();
  }

  if (error) {
    throw error;
  }

  return results;
}
