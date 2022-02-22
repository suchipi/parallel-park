import { inChildProcess, runJobs } from ".";

test("using inChildProcess and runJobs together", async () => {
  const results = await runJobs([1, 2, 3, 4, 5], (input) =>
    inChildProcess({ input }, async ({ input }) => {
      await new Promise((resolve) => setTimeout(resolve, 100 * input));
      return { input, value: input + 4 };
    })
  );

  expect(results).toMatchInlineSnapshot(`
    Array [
      Object {
        "input": 1,
        "value": 5,
      },
      Object {
        "input": 2,
        "value": 6,
      },
      Object {
        "input": 3,
        "value": 7,
      },
      Object {
        "input": 4,
        "value": 8,
      },
      Object {
        "input": 5,
        "value": 9,
      },
    ]
  `);
});
