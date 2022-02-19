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
  const now = Date.now(); /*?*/

  const results = await runJobs(
    [1, 2, 3, 4],
    async (num) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return [num, Date.now()];
    },
    { concurrency: 2 }
  );

  console.log(results);
});
