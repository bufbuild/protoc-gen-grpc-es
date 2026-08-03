// Copyright 2026 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { suite, test } from "node:test";
import * as assert from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@grpc/grpc-js";
import type {
  ClientDuplexStream,
  ClientReadableStream,
  ClientUnaryCall,
  ClientWritableStream,
  handleBidiStreamingCall,
  handleClientStreamingCall,
  handleServerStreamingCall,
  handleUnaryCall,
  MethodDefinition,
  requestCallback,
} from "@grpc/grpc-js";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type {
  Int32Value,
  StringValue,
  StringValueSchema,
} from "@bufbuild/protobuf/wkt";
import * as serviceAllTs from "../src/gen/ts/service-all_grpc.js";
import * as serviceAllJs from "../src/gen/js/service-all_grpc.js";
import * as serviceEdgeCasesTs from "../src/gen/ts/service-edge-cases_grpc.js";
import * as serviceEdgeCasesJs from "../src/gen/js/service-edge-cases_grpc.js";

const genDir = join(__dirname, "..", "src", "gen");

// Compile-time assertion that types `A` and `B` are equivalent.
type Equivalent<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

function assertEquivalent<
  A,
  _B extends Equivalent<A, _B> extends true ? unknown : never,
>(): void {}

// Only assert against the TypeScript target - we later check the other targets
// against the TypeScript one.
void suite("service definition", () => {
  test("method paths", () => {
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.unary.path,
      "/service.ServiceAll/Unary",
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.serverStream.path,
      "/service.ServiceAll/ServerStream",
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.clientStream.path,
      "/service.ServiceAll/ClientStream",
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.bidi.path,
      "/service.ServiceAll/Bidi",
    );
  });

  test("stream flags", () => {
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.unary.requestStream,
      false,
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.unary.responseStream,
      false,
    );

    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.serverStream.requestStream,
      false,
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.serverStream.responseStream,
      true,
    );

    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.clientStream.requestStream,
      true,
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.clientStream.responseStream,
      false,
    );

    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.bidi.requestStream,
      true,
    );
    assert.strictEqual(
      serviceAllTs.ServiceAllDefinition.bidi.responseStream,
      true,
    );
  });
});

void suite("generated client class", () => {
  test("extends grpc.Client", () => {
    assert.ok(serviceAllTs.ServiceAllClient.prototype instanceof Client);
    assert.ok(
      serviceEdgeCasesTs.ServiceEmptyClient.prototype instanceof Client,
    );
    assert.ok(
      serviceEdgeCasesTs.ServiceNamesClient.prototype instanceof Client,
    );
  });
});

void suite("edge cases", () => {
  test("service without methods generates empty definition", () => {
    assert.deepStrictEqual(serviceEdgeCasesTs.ServiceEmptyDefinition, {});
  });

  test("rpc named Constructor is escaped", () => {
    // protobuf-es escapes the local name "constructor" to "constructor$"
    assert.strictEqual(
      serviceEdgeCasesTs.ServiceNamesDefinition.constructor$.path,
      "/service.ServiceNames/Constructor",
    );
    assert.strictEqual(
      typeof serviceEdgeCasesTs.ServiceNamesClient.prototype.constructor$,
      "function",
    );
  });

  test("rpc named Delete keeps its local name", () => {
    // "delete" is a reserved keyword but legal as a member name, so it is
    // not escaped.
    assert.strictEqual(
      serviceEdgeCasesTs.ServiceNamesDefinition.delete.path,
      "/service.ServiceNames/Delete",
    );
    assert.strictEqual(
      typeof serviceEdgeCasesTs.ServiceNamesClient.prototype.delete,
      "function",
    );
  });
});

void suite("generated files", () => {
  test("no file is generated for a proto file without services", () => {
    assert.ok(existsSync(join(genDir, "ts", "no-service_pb.ts")));
    assert.ok(!existsSync(join(genDir, "ts", "no-service_grpc.ts")));
    assert.ok(!existsSync(join(genDir, "js", "no-service_grpc.js")));
    assert.ok(!existsSync(join(genDir, "js", "no-service_grpc.d.ts")));
  });
});

void suite("generated definition types", () => {
  test("entries are MethodDefinition of the RPC's input and output", () => {
    const unary: MethodDefinition<StringValue, Int32Value> =
      serviceAllTs.ServiceAllDefinition.unary;
    const serverStream: MethodDefinition<StringValue, Int32Value> =
      serviceAllTs.ServiceAllDefinition.serverStream;
    const clientStream: MethodDefinition<StringValue, Int32Value> =
      serviceAllTs.ServiceAllDefinition.clientStream;
    const bidi: MethodDefinition<StringValue, Int32Value> =
      serviceAllTs.ServiceAllDefinition.bidi;

    assert.ok(unary !== undefined);
    assert.ok(serverStream !== undefined);
    assert.ok(clientStream !== undefined);
    assert.ok(bidi !== undefined);
  });
});

void suite("generated client types", () => {
  test("unary is callback-style and accepts a message or init shape", () => {
    function f(
      client: serviceAllTs.ServiceAllClient,
      request: StringValue,
      callback: requestCallback<Int32Value>,
    ): ClientUnaryCall {
      // @ts-expect-error the callback is required
      client.unary(request);
      client.unary({ value: "hello" }, callback);
      client.unary({}, callback);
      // @ts-expect-error unknown fields are rejected
      client.unary({ unknownField: 123 }, callback);
      return client.unary(request, callback);
    }
    assert.ok(f !== undefined);
  });

  test("serverStream returns a readable stream", () => {
    function f(
      client: serviceAllTs.ServiceAllClient,
      request: StringValue,
    ): ClientReadableStream<Int32Value> {
      client.serverStream({ value: "hello" });
      return client.serverStream(request);
    }
    assert.ok(f !== undefined);
  });

  test("clientStream returns a writable stream accepting init shapes", () => {
    function f(
      client: serviceAllTs.ServiceAllClient,
      request: StringValue,
      callback: requestCallback<Int32Value>,
    ): ClientWritableStream<MessageInitShape<typeof StringValueSchema>> {
      const stream = client.clientStream(callback);
      stream.write(request);
      stream.write({ value: "hello" });
      return stream;
    }
    assert.ok(f !== undefined);
  });

  test("bidi returns a duplex stream accepting init shapes", () => {
    function f(
      client: serviceAllTs.ServiceAllClient,
      request: StringValue,
    ): ClientDuplexStream<
      MessageInitShape<typeof StringValueSchema>,
      Int32Value
    > {
      const stream = client.bidi();
      stream.write(request);
      stream.write({ value: "hello" });
      return stream;
    }
    assert.ok(f !== undefined);
  });
});

void suite("generated server types", () => {
  test("accepts handlers responding with a message or init shape", () => {
    function f(
      unary: handleUnaryCall<StringValue, Int32Value>,
      serverStream: handleServerStreamingCall<StringValue, Int32Value>,
      clientStream: handleClientStreamingCall<StringValue, Int32Value>,
      bidi: handleBidiStreamingCall<StringValue, Int32Value>,
      response: Int32Value,
    ): serviceAllTs.ServiceAllServer[] {
      const messageTyped: serviceAllTs.ServiceAllServer = {
        unary,
        serverStream,
        clientStream,
        bidi,
      };
      const initShapeTyped: serviceAllTs.ServiceAllServer = {
        unary(call, callback) {
          callback(null, { value: call.request.value.length });
          callback(null, response);
        },
        serverStream(call) {
          call.write({ value: 123 });
          call.write(response);
          call.end();
        },
        clientStream(_call, callback) {
          callback(null, { value: 123 });
          callback(null, response);
        },
        bidi(call) {
          call.write({ value: 123 });
          call.write(response);
          call.end();
        },
      };
      return [messageTyped, initShapeTyped];
    }
    assert.ok(f !== undefined);
  });

  test("rejects a wrongly typed handler", () => {
    function f(
      serverStream: handleServerStreamingCall<StringValue, Int32Value>,
      clientStream: handleClientStreamingCall<StringValue, Int32Value>,
      bidi: handleBidiStreamingCall<StringValue, Int32Value>,
    ): serviceAllTs.ServiceAllServer {
      return {
        // @ts-expect-error unary must be a handleUnaryCall, not a string
        unary: "not a handler",
        serverStream,
        clientStream,
        bidi,
      };
    }
    assert.ok(f !== undefined);
  });
});

void suite("ts generated code is equal to js generated code", () => {
  test("modules are structurally equal", () => {
    assert.deepStrictEqual(toPlain(serviceAllTs), toPlain(serviceAllJs));
    assert.deepStrictEqual(
      toPlain(serviceEdgeCasesTs),
      toPlain(serviceEdgeCasesJs),
    );
  });

  test("client classes expose the same methods", () => {
    assert.deepStrictEqual(
      methodNames(serviceAllTs.ServiceAllClient),
      methodNames(serviceAllJs.ServiceAllClient),
    );
    assert.deepStrictEqual(
      methodNames(serviceEdgeCasesTs.ServiceNamesClient),
      methodNames(serviceEdgeCasesJs.ServiceNamesClient),
    );
  });

  // Strip functions and other non-JSON values so the comparison covers the
  // serializable structure (definition paths and stream flags). Client classes
  // and serializer functions are compared separately or by parity of types.
  function toPlain(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value));
  }

  // The own method names on a generated client class prototype, which are
  // stripped by toPlain because they are functions.
  function methodNames(clientClass: { prototype: object }): string[] {
    return Object.getOwnPropertyNames(clientClass.prototype).sort();
  }
});

void suite("ts generated types are assignable to d.ts generated types", () => {
  test("definition, client, and server types are mutually assignable", () => {
    assertEquivalent<
      typeof serviceAllTs.ServiceAllDefinition,
      typeof serviceAllJs.ServiceAllDefinition
    >();
    assertEquivalent<
      serviceAllTs.ServiceAllClient,
      serviceAllJs.ServiceAllClient
    >();
    assertEquivalent<
      serviceAllTs.ServiceAllServer,
      serviceAllJs.ServiceAllServer
    >();
  });
});
