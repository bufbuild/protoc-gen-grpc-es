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

import type {
  DescFile,
  DescMessage,
  DescMethod,
  DescService,
} from "@bufbuild/protobuf";
import {
  createEcmaScriptPlugin,
  type GeneratedFile,
  type Printable,
  type Schema,
  type Target,
  safeIdentifier,
} from "@bufbuild/protoplugin";
import { version } from "../package.json";

/**
 * The `protoc-gen-grpc-es` plugin.
 *
 * Generates gRPC service definitions, server interfaces, and client classes
 * for `@grpc/grpc-js` from Protobuf services, emitting TypeScript, JavaScript,
 * and TypeScript declaration files.
 */
export const protocGenGrpcEs = createEcmaScriptPlugin({
  name: "protoc-gen-grpc-es",
  version: `v${version}`,
  generateTs,
  generateJs,
  generateDts,
});

function generateTs(schema: Schema): void {
  for (const file of schema.files) {
    const f = schema.generateFile(file.name + "_grpc.ts");
    f.preamble(file);
    printClientMethodDefinitionType(f, file);
    for (const service of file.services) {
      generateServiceDefinition(f, service, "ts");
      generateServerInterface(f, service, "ts");
      generateClientClass(f, service, "ts");
    }
  }
}

function generateJs(schema: Schema): void {
  for (const file of schema.files) {
    const f = schema.generateFile(file.name + "_grpc.js");
    f.preamble(file);
    for (const service of file.services) {
      generateServiceDefinition(f, service, "js");
      generateClientClass(f, service, "js");
    }
  }
}

function generateDts(schema: Schema): void {
  for (const file of schema.files) {
    const f = schema.generateFile(file.name + "_grpc.d.ts");
    f.preamble(file);
    printClientMethodDefinitionType(f, file);
    for (const service of file.services) {
      generateServiceDefinition(f, service, "dts");
      generateServerInterface(f, service, "dts");
      generateClientClass(f, service, "dts");
    }
  }
}

// biome-ignore format: want this to read well
function generateServiceDefinition(f: GeneratedFile, service: DescService, target: Target): void {
  const name = definitionName(service);
  f.print(f.jsDoc(service));
  switch (target) {
    case "ts":
      f.print(f.export("const", name), ": ", getDefinitionTypeExpr(f, service), " = {");
      printDefinitionMethods(f, service, target);
      f.print("};");
      break;
    case "js":
      f.print(f.export("const", name), " = {");
      printDefinitionMethods(f, service, target);
      f.print("};");
      break;
    case "dts":
      f.print(f.export("declare const", name), ": ", getDefinitionTypeExpr(f, service), ";");
      break;
  }
  f.print();
}

// biome-ignore format: want this to read well
function printClientMethodDefinitionType(f: GeneratedFile, file: DescFile): void {
  if (!file.services.some((service) => service.methods.length > 0)) {
    return;
  }
  const MethodDefinition = f.import("MethodDefinition", "@grpc/grpc-js", true);
  f.print("type ClientMethodDefinition<RequestType, ResponseType> = Omit<", MethodDefinition, "<RequestType, ResponseType>, ", f.string("requestDeserialize"), " | ", f.string("responseSerialize"), ">;");
  f.print();
}

// biome-ignore format: want this to read well
function getDefinitionTypeExpr(f: GeneratedFile, service: DescService): Printable {
  if (service.methods.length === 0) {
    return "Record<string, never>";
  }
  const ServerMethodDefinition = f.import("ServerMethodDefinition", "@grpc/grpc-js", true);
  const p: Printable[] = ["{\n"];
  for (const method of service.methods) {
    const inputShape = f.importShape(method.input).toTypeOnly();
    const outputShape = f.importShape(method.output).toTypeOnly();
    p.push(f.jsDoc(method, "  "), "\n");
    p.push("  ", method.localName, ": ClientMethodDefinition<", messageInitShapeExpr(f, method.input), ", ", outputShape, "> & ", ServerMethodDefinition, "<", inputShape, ", ", messageInitShapeExpr(f, method.output), ">;\n");
  }
  p.push("}");
  return p;
}

// biome-ignore format: want this to read well
function printDefinitionMethods(f: GeneratedFile, service: DescService, target: Extract<Target, "ts" | "js">): void {
  const { create, toBinary, fromBinary } = f.runtime;
  for (const method of service.methods) {
    const inputShape = f.importShape(method.input).toTypeOnly();
    const outputShape = f.importShape(method.output).toTypeOnly();
    const inputSchema = f.importSchema(method.input);
    const outputSchema = f.importSchema(method.output);
    const requestStream = method.methodKind === "client_streaming" || method.methodKind === "bidi_streaming";
    const responseStream = method.methodKind === "server_streaming" || method.methodKind === "bidi_streaming";
    f.print("  ", method.localName, ": {");
    f.print("    path: ", f.string(`/${service.typeName}/${method.name}`), ",");
    f.print("    requestStream: ", requestStream, ",");
    f.print("    responseStream: ", responseStream, ",");
    if (target === "ts") {
      f.print("    requestSerialize: (value: ", messageInitShapeExpr(f, method.input), "): Buffer => Buffer.from(", toBinary, "(", inputSchema, ", ", create, "(", inputSchema, ", value))),");
      f.print("    requestDeserialize: (bytes: Buffer): ", inputShape, " => ", fromBinary, "(", inputSchema, ", bytes),");
      f.print("    responseSerialize: (value: ", messageInitShapeExpr(f, method.output), "): Buffer => Buffer.from(", toBinary, "(", outputSchema, ", ", create, "(", outputSchema, ", value))),");
      f.print("    responseDeserialize: (bytes: Buffer): ", outputShape, " => ", fromBinary, "(", outputSchema, ", bytes),");
    } else {
      f.print("    requestSerialize: (value) => Buffer.from(", toBinary, "(", inputSchema, ", ", create, "(", inputSchema, ", value))),");
      f.print("    requestDeserialize: (bytes) => ", fromBinary, "(", inputSchema, ", bytes),");
      f.print("    responseSerialize: (value) => Buffer.from(", toBinary, "(", outputSchema, ", ", create, "(", outputSchema, ", value))),");
      f.print("    responseDeserialize: (bytes) => ", fromBinary, "(", outputSchema, ", bytes),");
    }
    f.print("  },");
  }
}

// biome-ignore format: want this to read well
function generateServerInterface(f: GeneratedFile, service: DescService, target: Extract<Target, "ts" | "dts">): void {
  const UntypedServiceImplementation = f.import("UntypedServiceImplementation", "@grpc/grpc-js", true);
  const declaration = target === "ts" ? "interface" : "declare interface";
  f.print(f.jsDoc(service));
  f.print(f.export(declaration, serverName(service)), " extends ", UntypedServiceImplementation, " {");
  for (const method of service.methods) {
    const handler = f.import(handlerTypeName(method), "@grpc/grpc-js", true);
    f.print(f.jsDoc(method, "  "));
    f.print("  ", method.localName, ": ", handler, "<", f.importShape(method.input).toTypeOnly(), ", ", messageInitShapeExpr(f, method.output), ">;");
  }
  f.print("}");
  f.print();
}

// biome-ignore format: want this to read well
function generateClientClass(f: GeneratedFile, service: DescService, target: Target): void {
  const Client = f.import("Client", "@grpc/grpc-js");
  const declaration = target === "dts" ? "declare class" : "class";
  f.print(f.jsDoc(service));
  f.print(f.export(declaration, clientName(service)), " extends ", Client, " {");
  for (const method of service.methods) {
    printClientMethod(f, service, method, target);
  }
  f.print("}");
  f.print();
}

// biome-ignore format: want this to read well
function printClientMethod(f: GeneratedFile, service: DescService, method: DescMethod, target: Target): void {
  const Metadata = f.import("Metadata", "@grpc/grpc-js", true);
  const CallOptions = f.import("CallOptions", "@grpc/grpc-js", true);
  const requestCallback = f.import("requestCallback", "@grpc/grpc-js", true);
  const outputShape = f.importShape(method.output).toTypeOnly();
  const inputInit = messageInitShapeExpr(f, method.input);
  // localName is safe to use as a class method name: protobuf-es escapes
  // reserved object properties such as "constructor".
  const name = method.localName;
  const def: Printable = [definitionName(service), ".", name];
  const callback: Printable = [requestCallback, "<", outputShape, ">"];
  switch (method.methodKind) {
    case "unary": {
      const ClientUnaryCall = f.import("ClientUnaryCall", "@grpc/grpc-js", true);
      // Overload signatures
      if (target !== "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", callback: ", callback, "): ", ClientUnaryCall, ";");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", metadata: ", Metadata, ", callback: ", callback, "): ", ClientUnaryCall, ";");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", options: ", CallOptions, ", callback: ", callback, "): ", ClientUnaryCall, ";");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", metadata: ", Metadata, ", options: ", CallOptions, ", callback: ", callback, "): ", ClientUnaryCall, ";");
      }
      // Method implementation
      if (target === "ts") {
        f.print("  ", name, "(request: ", inputInit, ", metadataOrOptionsOrCallback?: ", Metadata, " | ", CallOptions, " | ", callback, ", optionsOrCallback?: ", CallOptions, " | ", callback, ", callback?: ", callback, "): ", ClientUnaryCall, " {");
        f.print("    return this.makeUnaryRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      request,");
        f.print("      metadataOrOptionsOrCallback as ", Metadata, ",");
        f.print("      optionsOrCallback as ", CallOptions, ",");
        f.print("      callback as ", callback, ",");
        f.print("    );");
        f.print("  }");
      } else if (target === "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request, metadataOrOptionsOrCallback, optionsOrCallback, callback) {");
        f.print("    return this.makeUnaryRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      request,");
        f.print("      metadataOrOptionsOrCallback,");
        f.print("      optionsOrCallback,");
        f.print("      callback,");
        f.print("    );");
        f.print("  }");
      }
      break;
    }
    case "server_streaming": {
      const ClientReadableStream = f.import("ClientReadableStream", "@grpc/grpc-js", true);
      // Overload signatures
      if (target !== "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", metadata?: ", Metadata, ", options?: ", CallOptions, "): ", ClientReadableStream, "<", outputShape, ">;");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request: ", inputInit, ", options?: ", CallOptions, "): ", ClientReadableStream, "<", outputShape, ">;");
      }
      // Method implementation
      if (target === "ts") {
        f.print("  ", name, "(request: ", inputInit, ", metadataOrOptions?: ", Metadata, " | ", CallOptions, ", options?: ", CallOptions, "): ", ClientReadableStream, "<", outputShape, "> {");
        f.print("    return this.makeServerStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      request,");
        f.print("      metadataOrOptions as ", Metadata, ",");
        f.print("      options,");
        f.print("    );");
        f.print("  }");
      } else if (target === "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(request, metadataOrOptions, options) {");
        f.print("    return this.makeServerStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      request,");
        f.print("      metadataOrOptions,");
        f.print("      options,");
        f.print("    );");
        f.print("  }");
      }
      break;
    }
    case "client_streaming": {
      const ClientWritableStream = f.import("ClientWritableStream", "@grpc/grpc-js", true);
      // Overload signatures
      if (target !== "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(callback: ", callback, "): ", ClientWritableStream, "<", inputInit, ">;");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(metadata: ", Metadata, ", callback: ", callback, "): ", ClientWritableStream, "<", inputInit, ">;");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(options: ", CallOptions, ", callback: ", callback, "): ", ClientWritableStream, "<", inputInit, ">;");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(metadata: ", Metadata, ", options: ", CallOptions, ", callback: ", callback, "): ", ClientWritableStream, "<", inputInit, ">;");
      }
      // Method implementation
      if (target === "ts") {
        f.print("  ", name, "(metadataOrOptionsOrCallback?: ", Metadata, " | ", CallOptions, " | ", callback, ", optionsOrCallback?: ", CallOptions, " | ", callback, ", callback?: ", callback, "): ", ClientWritableStream, "<", inputInit, "> {");
        f.print("    return this.makeClientStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      metadataOrOptionsOrCallback as ", Metadata, ",");
        f.print("      optionsOrCallback as ", CallOptions, ",");
        f.print("      callback as ", callback, ",");
        f.print("    );");
        f.print("  }");
      } else if (target === "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(metadataOrOptionsOrCallback, optionsOrCallback, callback) {");
        f.print("    return this.makeClientStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      metadataOrOptionsOrCallback,");
        f.print("      optionsOrCallback,");
        f.print("      callback,");
        f.print("    );");
        f.print("  }");
      }
      break;
    }
    case "bidi_streaming": {
      const ClientDuplexStream = f.import("ClientDuplexStream", "@grpc/grpc-js", true);
      // Overload signatures
      if (target !== "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(metadata?: ", Metadata, ", options?: ", CallOptions, "): ", ClientDuplexStream, "<", inputInit, ", ", outputShape, ">;");
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(options?: ", CallOptions, "): ", ClientDuplexStream, "<", inputInit, ", ", outputShape, ">;");
      }
      // Method implementation
      if (target === "ts") {
        f.print("  ", name, "(metadataOrOptions?: ", Metadata, " | ", CallOptions, ", options?: ", CallOptions, "): ", ClientDuplexStream, "<", inputInit, ", ", outputShape, "> {");
        f.print("    return this.makeBidiStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      metadataOrOptions as ", Metadata, ",");
        f.print("      options,");
        f.print("    );");
        f.print("  }");
      } else if (target === "js") {
        f.print(f.jsDoc(method, "  "));
        f.print("  ", name, "(metadataOrOptions, options) {");
        f.print("    return this.makeBidiStreamRequest(");
        f.print("      ", def, ".path,");
        f.print("      ", def, ".requestSerialize,");
        f.print("      ", def, ".responseDeserialize,");
        f.print("      metadataOrOptions,");
        f.print("      options,");
        f.print("    );");
        f.print("  }");
      }
      break;
    }
  }
}

function messageInitShapeExpr(
  f: GeneratedFile,
  message: DescMessage,
): Printable {
  const MessageInitShape = f.import(
    "MessageInitShape",
    "@bufbuild/protobuf",
    true,
  );
  return [MessageInitShape, "<typeof ", f.importSchema(message), ">"];
}

function handlerTypeName(method: DescMethod): string {
  switch (method.methodKind) {
    case "unary":
      return "handleUnaryCall";
    case "server_streaming":
      return "handleServerStreamingCall";
    case "client_streaming":
      return "handleClientStreamingCall";
    case "bidi_streaming":
      return "handleBidiStreamingCall";
  }
}

function definitionName(service: DescService): string {
  return safeIdentifier(service.name + "Definition");
}

function serverName(service: DescService): string {
  return safeIdentifier(service.name + "Server");
}

function clientName(service: DescService): string {
  return safeIdentifier(service.name + "Client");
}
