<div align="center">

![The Buf logo](https://github.com/bufbuild/protoc-gen-grpc-es/blob/HEAD/.github/buf-logo.svg)

# @bufbuild/protoc-gen-grpc-es

[![NPM Version](https://img.shields.io/npm/v/%40bufbuild%2Fprotoc-gen-grpc-es?style=flat-square)](https://www.npmjs.com/package/@bufbuild/protoc-gen-grpc-es)
[![NPM License](https://img.shields.io/npm/l/%40bufbuild%2Fprotoc-gen-grpc-es?style=flat-square)](https://github.com/bufbuild/protoc-gen-grpc-es/blob/main/LICENSE)
[![Slack](https://img.shields.io/badge/slack-buf-%23e01e5a?style=flat-square)](https://buf.build/links/slack)

`protoc-gen-grpc-es` generates **well-typed, idiomatic [gRPC](https://grpc.io) stubs** for [Protobuf-ES](https://github.com/bufbuild/protobuf-es) (`@bufbuild/protobuf`), the ergonomic and modern Protobuf library for JavaScript and TypeScript.

Plugs into your existing [`@grpc/grpc-js`](https://www.npmjs.com/package/@grpc/grpc-js) channels and servers.

</div>

It's a compatibility layer for projects already built on [`@grpc/grpc-js`](https://www.npmjs.com/package/@grpc/grpc-js). The generated clients and servers plug into your existing gRPC channels and servers, but serialize Protobuf-ES messages directly. This lets you upgrade to a better Protobuf package without touching your RPC stack.

> [!TIP]
> For new projects, use [Connect-ES](https://github.com/connectrpc/connect-es) instead. Connect speaks the gRPC and gRPC-Web protocols in addition to its own, so existing gRPC clients can call a Connect server unchanged. But you also get plain HTTP APIs you can `curl`, first-class streaming, and generated clients for **every major language**, including your frontend. `protoc-gen-grpc-es` only exists so current gRPC codebases already built on `@grpc/grpc-js` can get the improvements of Protobuf-ES today without a full rewrite.

## Getting started

### Installation

To install the runtime libraries and the `protoc` plugins, run:

```shell
npm install @bufbuild/protobuf @grpc/grpc-js
npm install --save-dev @bufbuild/protoc-gen-es @bufbuild/protoc-gen-grpc-es @types/node
```

### Generating code

We recommend using [`buf`](https://github.com/bufbuild/buf) to generate code. Add a new `buf.gen.yaml` configuration file:

```yaml
# Learn more: https://buf.build/docs/configuration/v2/buf-gen-yaml
version: v2
inputs:
  - directory: proto
plugins:
  - local: protoc-gen-es
    out: src/gen
    opt: target=ts
  - local: protoc-gen-grpc-es
    out: src/gen
    opt: target=ts
```

Place your `.proto` files in the `./proto` directory, then run:

```bash
npx buf generate
```

## Usage

For every Protobuf file that contains services, the plugin generates a `_grpc.ts` file next to the `_pb.ts` file from `protoc-gen-es`. For example, the following service:

```protobuf
syntax = "proto3";
package example;

service ElizaService {
  rpc Say(SayRequest) returns (SayResponse);
}

message SayRequest {
  string sentence = 1;
}

message SayResponse {
  string sentence = 1;
}
```

generates the following exports in `eliza_grpc.ts`:

- `ElizaServiceDefinition`: The `@grpc/grpc-js` service definition.
- `ElizaServiceServer`: An interface for the server implementation.
- `ElizaServiceClient`: A client with a typed method for every RPC.

To implement a server:

```ts
import * as grpc from "@grpc/grpc-js";
import { ElizaServiceDefinition, type ElizaServiceServer } from "./gen/eliza_grpc.js";

const implementation: ElizaServiceServer = {
  say(call, callback) {
    callback(null, { sentence: `You said: ${call.request.sentence}` });
  },
};

const server = new grpc.Server();
server.addService(ElizaServiceDefinition, implementation);
server.bindAsync("localhost:50051", grpc.ServerCredentials.createInsecure(), () => {});
```

To call it with a client:

```ts
import * as grpc from "@grpc/grpc-js";
import { ElizaServiceClient } from "./gen/eliza_grpc.js";

const client = new ElizaServiceClient("localhost:50051", grpc.credentials.createInsecure());
client.say({ sentence: "Hi" }, (error, response) => {
  if (error) {
    throw error;
  }
  console.log(response?.sentence);
});
```

## Plugin options

`protoc-gen-grpc-es` supports the same options as `protoc-gen-es`:

| Option                                                                                                                      | Values                               | Default  | Description                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------- | --------------------------------------------------------------- |
| [`target`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#target)                                 | `js`, `ts`, `dts` (combine with `+`) | `js+dts` | Which files to generate.                                        |
| [`import_extension`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#import_extension)             | `none`, `js`, `ts`                   | `none`   | File extension to use in import paths.                          |
| [`js_import_style`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#js_import_style)               | `module`, `legacy_commonjs`          | `module` | Use ECMAScript `import`/`export` or CommonJS `require`.         |
| [`keep_empty_files`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#keep_empty_filestrue)         | `true`, `false`                      | `false`  | Keep generated files even if they contain no services.          |
| [`ts_nocheck`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#ts_nochecktrue)                     | `true`, `false`                      | `false`  | Generate a `// @ts-nocheck` annotation at the top of each file. |
| [`elide_plugin_version`](https://github.com/bufbuild/protobuf-es/tree/main/packages/protoc-gen-es#elide_plugin_versiontrue) | `true`, `false`                      | `false`  | Omit the plugin version from generated file headers.            |

Make sure to use the same `target` and `import_extension` values for both plugins, so that the generated `_grpc` files can import from the generated `_pb` files.
