import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";

import {
  replayFixture
} from "../dist/index.js";

test(
  "replay sends custom body and headers unchanged",
  async (t) => {
    let receivedBody = "";
    let receivedSignature;
    let receivedContentType;

    const server = createServer(
      async (request, response) => {
        const chunks = [];

        for await (const chunk of request) {
          chunks.push(chunk);
        }

        receivedBody = Buffer.concat(
          chunks
        ).toString("utf8");

        receivedSignature =
          request.headers["stripe-signature"];

        receivedContentType =
          request.headers["content-type"];

        response.writeHead(
          200,
          {
            "content-type": "application/json"
          }
        );

        response.end(
          JSON.stringify({
            ok: true
          })
        );
      }
    );

    server.listen(
      0,
      "127.0.0.1"
    );

    await once(
      server,
      "listening"
    );

    t.after(
      () =>
        new Promise((resolve) => {
          server.close(resolve);
        })
    );

    const address = server.address();

    assert.notEqual(
      address,
      null
    );

    assert.equal(
      typeof address,
      "object"
    );

    const fixture = {
      event: {
        id: "evt_test_001",
        provider: "stripe",
        type: "payment_intent.succeeded",
        payload: {
          fallback: true
        }
      },
      baseline: null
    };

    const requestBody =
      '{\n  "exact": "body"\n}\n';

    const result = await replayFixture(
      fixture,
      `http://127.0.0.1:${address.port}/webhook`,
      5000,
      {
        body: requestBody,
        headers: {
          "stripe-signature":
            "t=123,v1=test-signature"
        }
      }
    );

    assert.equal(
      receivedBody,
      requestBody
    );

    assert.equal(
      receivedSignature,
      "t=123,v1=test-signature"
    );

    assert.equal(
      receivedContentType,
      "application/json"
    );

    assert.deepEqual(
      result,
      {
        status: 200,
        body: {
          ok: true
        }
      }
    );
  }
);