import test from "node:test";
import assert from "node:assert/strict";

import {
  compareAssertionState
} from "../dist/index.js";

test(
  "matches assertion state using exact deep equality",
  () => {
    assert.equal(
      compareAssertionState(
        {
          count: 1,
          items: [
            "a",
            "b"
          ]
        },
        {
          count: 1,
          items: [
            "a",
            "b"
          ]
        }
      ),
      true
    );
  }
);

test(
  "detects assertion state differences",
  () => {
    assert.equal(
      compareAssertionState(
        {
          count: 1
        },
        {
          count: 2
        }
      ),
      false
    );

    assert.equal(
      compareAssertionState(
        {
          count: 1
        },
        {
          count: "1"
        }
      ),
      false
    );
  }
);