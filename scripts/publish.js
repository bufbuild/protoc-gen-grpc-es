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

import { execSync } from "node:child_process";

/*
 * Publish the package to npm
 *
 * Recommended procedure:
 * 1. Set a new version in `package.json`, e.g. "1.2.3".
 * 2. Run `npm install` to update `package-lock.json`.
 * 3. Commit and push all changes to a PR, wait for approval.
 * 4. Merge the PR.
 * 5. Create a release on GitHub with tag `v1.2.3`, which triggers the
 *    publish workflow that runs this script.
 */

const version = JSON.parse(
  execSync("npm pkg get version", { encoding: "utf-8" }),
);
gitCheckReleaseTag(version);
npmPublish(version);

/**
 * @param {string} version
 */
function npmPublish(version) {
  const tag = determinePublishTag(version);
  execSync(`npm publish --tag ${tag}`, {
    stdio: "inherit",
  });
}

/**
 * Throws if the tag `v<version>` is not among the tags pointing at HEAD.
 *
 * @param {string} version
 */
function gitCheckReleaseTag(version) {
  const expected = `v${version}`;
  const out = execSync("git tag --points-at HEAD", {
    encoding: "utf-8",
  });
  const tags = out
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (!tags.includes(expected)) {
    throw new Error(
      `Expected git tag ${expected} on HEAD, found: ${tags.join(", ") || "(none)"}`,
    );
  }
}

/**
 * @param {string} version
 * @returns {string}
 */
function determinePublishTag(version) {
  if (/^\d+\.\d+\.\d+$/.test(version)) {
    return "latest";
  }
  if (/^\d+\.\d+\.\d+-alpha.*$/.test(version)) {
    return "alpha";
  }
  if (/^\d+\.\d+\.\d+-beta.*$/.test(version)) {
    return "beta";
  }
  if (/^\d+\.\d+\.\d+-rc.*$/.test(version)) {
    return "rc";
  }
  throw new Error(`Unable to determine publish tag from version ${version}`);
}
