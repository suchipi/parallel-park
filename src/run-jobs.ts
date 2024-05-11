import makeDebug from "debug";
const debug = makeDebug("parallel-park:run-jobs");

function isThenable<T>(value: unknown): value is Promise<T> {
  return (
    typeof value === "object" &&
    value != null &&
    // @ts-ignore accessing .then
    typeof value.then === "function"
  );
}

const NOTHING = Symbol("NOTHING");

let runJobsCallId = 0;

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
  const callId = runJobsCallId;
  runJobsCallId++;

  debug(`runJobs called (callId: ${callId})`, { inputs, mapper, concurrency });

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
    debug(`reading next input (callId: ${callId})`);
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
    debug(`mapping input into Promise (callId: ${callId})`);
    const promise = mapper(input, inputIndex, maybeLength || Infinity);

    if (!isThenable(promise)) {
      throw new Error(
        "Mapper function passed into runJobs didn't return a Promise. The mapper function should always return a Promise. The easiest way to ensure this is the case is to make your mapper function an async function."
      );
    }

    const promiseWithMore = promise.then(
      (result) => {
        debug(`child Promise resolved for input (callId: ${callId}):`, input);
        results[inputIndex] = result;
        runningPromises.delete(promiseWithMore);
      },
      (err) => {
        debug(
          `child Promise rejected for input (callId: ${callId}):`,
          input,
          "with error:",
          err
        );
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
      debug(`throwing error (callId: ${callId})`);
      throw error;
    }
    await proceed();
  }

  if (error) {
    debug(`throwing error (callId: ${callId})`);
    throw error;
  }

  debug(`all done (callId: ${callId})`);
  return results;
}
