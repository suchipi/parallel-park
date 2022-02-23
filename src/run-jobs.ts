function isThenable<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value != null &&
    // @ts-ignore accessing .then
    typeof value.then === "function"
  );
}

const NOTHING = Symbol("NOTHING");

export async function runJobs<T, U>(
  inputs: Iterable<T | Promise<T>> | AsyncIterable<T | Promise<T>>,
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

  const inputsArray: Array<T> = [];
  const inputIteratorFactory =
    inputs[Symbol.asyncIterator || NOTHING] || inputs[Symbol.iterator];
  const inputIterator = inputIteratorFactory.call(inputs);
  const maybeLength = Array.isArray(inputs) ? inputs.length : null;

  let iteratorDone = false;

  async function readInput(): Promise<boolean> {
    let nextResult = inputIterator.next();
    if (isThenable(nextResult)) {
      nextResult = await nextResult;
    }
    if (nextResult.done) {
      iteratorDone = true;
      return false;
    } else {
      let value = nextResult.value;
      if (isThenable<T>(value)) {
        value = await value;
      }
      inputsArray.push(value);
      return true;
    }
  }

  let unstartedIndex = 0;

  const results = new Array(maybeLength || 0);
  const runningPromises = new Set();
  let error: Error | null = null;

  async function takeInput() {
    const read = await readInput();
    if (!read) return;

    const inputIndex = unstartedIndex;
    unstartedIndex++;

    const input = inputsArray[inputIndex];
    const promise = mapper(input, inputIndex, maybeLength || Infinity);

    if (!isThenable(promise)) {
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

  async function proceed() {
    while (!iteratorDone && runningPromises.size < concurrency) {
      await takeInput();
    }
  }

  await proceed();
  while (runningPromises.size > 0 && !error) {
    await Promise.race(runningPromises.values());
    if (error) {
      throw error;
    }
    await proceed();
  }

  if (error) {
    throw error;
  }

  return results;
}
