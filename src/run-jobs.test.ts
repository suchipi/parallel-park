import { runJobs } from "./run-jobs";

test("doesn't work with zero concurrency", () => {
  return expect(async () => {
    await runJobs(
      [1, 2, 3, 4],
      async (num) => {
        return num + 1;
      },
      { concurrency: 0 }
    );
  }).rejects.toBeInstanceOf(Error);
});

test("doesn't work with negative concurrency", () => {
  return expect(async () => {
    await runJobs(
      [1, 2, 3, 4],
      async (num) => {
        return num + 1;
      },
      { concurrency: -1 }
    );
  }).rejects.toBeInstanceOf(Error);
});

test("basic test", async () => {
  const results = await runJobs([1, 2, 3, 4], async (num) => {
    return num + 1;
  });

  expect(results).toEqual([2, 3, 4, 5]);
});

test("zero inputs", async () => {
  const results = await runJobs([], async (num) => {
    return num + 1;
  });

  expect(results).toEqual([]);
});

test("doesn't work when mapper function returns a non-promise", () => {
  expect.assertions(2);

  const promise = runJobs(
    [1, 2, 3, 4],
    // @ts-ignore
    (num) => {
      return num + 1;
    }
  );

  return promise.catch((err) => {
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatchInlineSnapshot(
      `"Mapper function passed into runJobs didn't return a Promise. The mapper function should always return a Promise. The easiest way to ensure this is the case is to make your mapper function an async function."`
    );
  });
});

test("concurrency greater than inputs length still works", async () => {
  const results = await runJobs(
    [1, 2, 3, 4],
    async (num) => {
      return num + 1;
    },
    { concurrency: 1000 }
  );

  expect(results).toEqual([2, 3, 4, 5]);
});

test("verify only [concurrency] inputs are run at once", async () => {
  const now = Date.now();

  const results = await runJobs(
    [1, 2, 3, 4],
    async (num) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return { num, time: Date.now() };
    },
    { concurrency: 2 }
  );

  expect(results.length).toBe(4);

  expect(results[0].time - now).toBeGreaterThan(950);
  expect(results[0].time - results[1].time).toBeLessThan(10);
  expect(results[2].time - results[3].time).toBeLessThan(10);

  expect(results[2].time - results[0].time).toBeGreaterThan(950);
  expect(results[3].time - results[0].time).toBeGreaterThan(950);
});

test("if any promise in the mapper throws, the whole thing throws", (done) => {
  expect.assertions(2);

  const promise = runJobs([1, 2, 3, 4], async (num) => {
    if (num === 4) {
      throw new Error("uh oh spaghetti-o");
    }
    return num + 1;
  });

  promise
    .then((results) => {
      done(new Error("Promise resolved when it should have rejected!"));
    })
    .catch((err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("uh oh spaghetti-o");
      done();
    });
});
